import httpx
import json
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_random_exponential
from tenacity.wait import wait_base
from .base import BaseSearchProvider, SearchResult
from ..utils import search_prompt, fetch_prompt, url_describe_prompt, rank_sources_prompt
from ..logger import log_info
from ..config import config

_logger = logging.getLogger(__name__)
_ssl_warning_emitted = False


def get_local_time_info() -> str:
    try:
        local_tz = datetime.now().astimezone().tzinfo
        local_now = datetime.now(local_tz)
    except Exception:
        local_now = datetime.now(timezone.utc)

    weekdays_cn = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    weekday = weekdays_cn[local_now.weekday()]

    return (
        f"[Current Time Context]\n"
        f"- Date: {local_now.strftime('%Y-%m-%d')} ({weekday})\n"
        f"- Time: {local_now.strftime('%H:%M:%S')}\n"
        f"- Timezone: {local_now.tzname() or 'Local'}\n"
    )


RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _is_retryable_exception(exc) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError, httpx.RemoteProtocolError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS_CODES
    return False


class _WaitWithRetryAfter(wait_base):

    def __init__(self, multiplier: float, max_wait: int):
        self._base_wait = wait_random_exponential(multiplier=multiplier, max=max_wait)
        self._protocol_error_base = 3.0

    def __call__(self, retry_state):
        if retry_state.outcome and retry_state.outcome.failed:
            exc = retry_state.outcome.exception()
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
                retry_after = self._parse_retry_after(exc.response)
                if retry_after is not None:
                    return retry_after
            if isinstance(exc, httpx.RemoteProtocolError):
                return self._base_wait(retry_state) + self._protocol_error_base
        return self._base_wait(retry_state)

    def _parse_retry_after(self, response: httpx.Response) -> Optional[float]:
        header = response.headers.get("Retry-After")
        if not header:
            return None
        header = header.strip()

        if header.isdigit():
            return float(header)

        try:
            retry_dt = parsedate_to_datetime(header)
            if retry_dt.tzinfo is None:
                retry_dt = retry_dt.replace(tzinfo=timezone.utc)
            delay = (retry_dt - datetime.now(timezone.utc)).total_seconds()
            return max(0.0, delay)
        except (TypeError, ValueError):
            return None


class OpenAICompatibleSearchProvider(BaseSearchProvider):
    def __init__(self, api_url: str, api_key: str, model: str = "grok-4-fast", stream: bool = False):
        super().__init__(api_url, api_key)
        self.model = model
        self.stream = stream

    def get_provider_name(self) -> str:
        return "OpenAI-compatible"

    def _build_api_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "smart-search/0.1.0",
        }

    def _get_ssl_verify(self) -> bool:
        global _ssl_warning_emitted
        verify = config.ssl_verify_enabled
        if not verify and not _ssl_warning_emitted:
            _ssl_warning_emitted = True
            _logger.warning("SSL_VERIFY=false: OpenAI-compatible API 请求已禁用 SSL 证书验证，存在安全风险")
        return verify

    async def search(self, query: str, platform: str = "", ctx=None) -> List[SearchResult]:
        headers = self._build_api_headers()
        platform_prompt = ""

        if platform:
            platform_prompt = "\n\nYou should search the web for the information you need, and focus on these platform: " + platform + "\n"

        time_context = get_local_time_info() + "\n"

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": search_prompt,
                },
                {"role": "user", "content": time_context + query + platform_prompt},
            ],
            "stream": self.stream,
        }

        await log_info(ctx, f"platform_prompt: { query + platform_prompt}", config.debug_enabled)

        if self.stream:
            return await self._execute_stream_with_retry(headers, payload, ctx)
        return await self._execute_completion_with_retry(headers, payload, ctx)

    async def fetch(self, url: str, ctx=None) -> str:
        headers = self._build_api_headers()
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": fetch_prompt,
                },
                {"role": "user", "content": url + "\n获取该网页内容并返回其结构化Markdown格式" },
            ],
            "stream": self.stream,
        }
        if self.stream:
            return await self._execute_stream_with_retry(headers, payload, ctx)
        return await self._execute_completion_with_retry(headers, payload, ctx)

    async def _parse_streaming_response(self, response, ctx=None) -> str:
        content = ""
        full_body_buffer = []

        async for line in response.aiter_lines():
            line = line.strip()
            if not line:
                continue

            full_body_buffer.append(line)

            if line.startswith("data:"):
                if line in ("data: [DONE]", "data:[DONE]"):
                    continue
                try:
                    json_str = line[5:].lstrip()
                    data = json.loads(json_str)
                    choices = data.get("choices", [])
                    if choices and len(choices) > 0:
                        delta = choices[0].get("delta", {})
                        if "content" in delta:
                            content += delta["content"]
                except (json.JSONDecodeError, IndexError):
                    continue

        if not content and full_body_buffer:
            try:
                full_text = "".join(full_body_buffer)
                data = json.loads(full_text)
                if "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0].get("message", {})
                    content = message.get("content", "")
            except json.JSONDecodeError:
                pass

        await log_info(ctx, f"content: {content}", config.debug_enabled)

        return content

    async def _execute_stream_with_retry(self, headers: dict, payload: dict, ctx=None) -> str:
        timeout = httpx.Timeout(connect=6.0, read=120.0, write=10.0, pool=None)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, verify=self._get_ssl_verify()) as client:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(config.retry_max_attempts + 1),
                wait=_WaitWithRetryAfter(config.retry_multiplier, config.retry_max_wait),
                retry=retry_if_exception(_is_retryable_exception),
                reraise=True,
            ):
                with attempt:
                    async with client.stream(
                        "POST",
                        f"{self.api_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    ) as response:
                        response.raise_for_status()
                        return await self._parse_streaming_response(response, ctx)

    async def _parse_completion_response(self, response: httpx.Response, ctx=None) -> str:
        """解析非流式 completion 响应，兼容 JSON 和 SSE 文本 fallback"""
        content = ""
        body_text = response.text or ""
        sources: list[dict] = []

        try:
            data = response.json()
        except Exception:
            data = None

        if isinstance(data, dict):
            sources = self._extract_citations(data)
            choices = data.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                if isinstance(message, dict):
                    content = message.get("content", "") or ""
                    message_citations = self._normalize_citations(message.get("citations"))
                    if message_citations:
                        sources = self._merge_citations(sources, message_citations)

        # SSE fallback: 部分中转站即使设置 stream=False 仍可能返回 SSE 格式
        if not content and body_text.lstrip().startswith("data:"):
            class _LineResponse:
                def __init__(self, text: str):
                    self._lines = text.splitlines()

                async def aiter_lines(self):
                    for line in self._lines:
                        yield line

            content = await self._parse_streaming_response(_LineResponse(body_text), ctx)

        if content and sources:
            content = f"{content.rstrip()}\n\nsources({json.dumps(sources, ensure_ascii=False)})"

        await log_info(ctx, f"content: {content}", config.debug_enabled)

        return content

    def _extract_citations(self, data: dict) -> list[dict]:
        sources = self._normalize_citations(data.get("citations"))
        for choice in data.get("choices", []) or []:
            if not isinstance(choice, dict):
                continue
            message = choice.get("message")
            if isinstance(message, dict):
                sources = self._merge_citations(sources, self._normalize_citations(message.get("citations")))
        return sources

    def _normalize_citations(self, citations) -> list[dict]:
        if not citations:
            return []
        if not isinstance(citations, list):
            citations = [citations]

        normalized: list[dict] = []
        seen: set[str] = set()
        for item in citations:
            source: dict = {}
            if isinstance(item, str):
                url = item.strip()
                if not url.startswith(("http://", "https://")):
                    continue
                source["url"] = url
            elif isinstance(item, dict):
                url = item.get("url") or item.get("href") or item.get("link")
                if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                    continue
                source["url"] = url
                title = item.get("title") or item.get("name") or item.get("label")
                if isinstance(title, str) and title.strip():
                    source["title"] = title.strip()
            else:
                continue

            if source["url"] in seen:
                continue
            seen.add(source["url"])
            normalized.append(source)
        return normalized

    def _merge_citations(self, *source_lists: list[dict]) -> list[dict]:
        merged: list[dict] = []
        seen: set[str] = set()
        for source_list in source_lists:
            for item in source_list or []:
                url = item.get("url")
                if not isinstance(url, str) or not url or url in seen:
                    continue
                seen.add(url)
                merged.append(item)
        return merged

    async def _execute_completion_with_retry(self, headers: dict, payload: dict, ctx=None) -> str:
        """执行带重试机制的非流式 HTTP 请求，兼容上游返回 JSON 或 SSE 文本"""
        timeout = httpx.Timeout(connect=6.0, read=120.0, write=10.0, pool=None)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, verify=self._get_ssl_verify()) as client:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(config.retry_max_attempts + 1),
                wait=_WaitWithRetryAfter(config.retry_multiplier, config.retry_max_wait),
                retry=retry_if_exception(_is_retryable_exception),
                reraise=True,
            ):
                with attempt:
                    response = await client.post(
                        f"{self.api_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    return await self._parse_completion_response(response, ctx)

    async def describe_url(self, url: str, ctx=None) -> dict:
        headers = self._build_api_headers()
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": url_describe_prompt},
                {"role": "user", "content": url},
            ],
            "stream": False,
        }
        result = await self._execute_completion_with_retry(headers, payload, ctx)
        title, extracts = url, ""
        for line in result.strip().splitlines():
            if line.startswith("Title:"):
                title = line[6:].strip() or url
            elif line.startswith("Extracts:"):
                extracts = line[9:].strip()
        return {"title": title, "extracts": extracts, "url": url}

    async def rank_sources(self, query: str, sources_text: str, total: int, ctx=None) -> list[int]:
        """让 OpenAI-compatible 模型按查询相关度对信源排序，返回排序后的序号列表"""
        headers = self._build_api_headers()
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": rank_sources_prompt},
                {"role": "user", "content": f"Query: {query}\n\n{sources_text}"},
            ],
            "stream": False,
        }
        result = await self._execute_completion_with_retry(headers, payload, ctx)
        order: list[int] = []
        seen: set[int] = set()
        for token in result.strip().split():
            try:
                n = int(token)
                if 1 <= n <= total and n not in seen:
                    seen.add(n)
                    order.append(n)
            except ValueError:
                continue
        for i in range(1, total + 1):
            if i not in seen:
                order.append(i)
        return order

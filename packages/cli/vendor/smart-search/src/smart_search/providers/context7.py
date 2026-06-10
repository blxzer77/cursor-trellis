import json
import time
from typing import Any
from urllib.parse import quote

import httpx
from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_random_exponential

from .base import BaseSearchProvider
from ..config import config
from ..logger import log_info


RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _is_retryable_exception(exc) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS_CODES
    return False


def _normalize_library(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id") or "",
        "title": item.get("title") or "",
        "description": item.get("description") or "",
        "trust_score": item.get("trustScore"),
        "benchmark_score": item.get("benchmarkScore"),
        "total_snippets": item.get("totalSnippets"),
        "stars": item.get("stars"),
        "provider": "context7",
    }


class Context7Provider(BaseSearchProvider):
    def __init__(self, api_url: str, api_key: str, timeout: float = 30.0):
        super().__init__(api_url.rstrip("/"), api_key)
        self.timeout = timeout

    def get_provider_name(self) -> str:
        return "Context7"

    async def search(self, query: str, max_results: int = 5) -> str:
        return await self.library(query)

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json, text/plain",
            "X-Context7-Source": "smart-search",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def library(self, name: str, query: str = "", ctx=None) -> str:
        request_query = f"{name} {query}".strip()
        endpoint = f"{self.api_url}/api/v2/search?query={quote(request_query)}"
        await log_info(ctx, f"Context7 library: {request_query}", config.debug_enabled)
        start_time = time.time()
        try:
            data = await self._get_with_retry(endpoint)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            raw_results = data if isinstance(data, list) else data.get("results", [])
            results = [_normalize_library(item) for item in raw_results or []]
            output = {
                "ok": True,
                "query": request_query,
                "provider": "context7",
                "results": results,
                "total": len(results),
                "elapsed_ms": elapsed_ms,
            }
        except Exception as e:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            output = {
                "ok": False,
                "query": request_query,
                "provider": "context7",
                "error": str(e),
                "elapsed_ms": elapsed_ms,
            }
        return json.dumps(output, ensure_ascii=False, indent=2)

    async def docs(self, library_id: str, query: str, ctx=None) -> str:
        endpoint = f"{self.api_url}/api/v2/context?libraryId={quote(library_id, safe='')}&query={quote(query)}"
        await log_info(ctx, f"Context7 docs: {library_id} {query}", config.debug_enabled)
        start_time = time.time()
        try:
            data = await self._get_with_retry(endpoint)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            snippets = data.get("codeSnippets", []) if isinstance(data, dict) else []
            info = data.get("infoSnippets", []) if isinstance(data, dict) else []
            content = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else str(data)
            output = {
                "ok": True,
                "library_id": library_id,
                "query": query,
                "provider": "context7",
                "code_snippets": snippets,
                "info_snippets": info,
                "results": snippets + info,
                "total": len(snippets) + len(info),
                "content": content,
                "elapsed_ms": elapsed_ms,
            }
        except Exception as e:
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            output = {
                "ok": False,
                "library_id": library_id,
                "query": query,
                "provider": "context7",
                "error": str(e),
                "elapsed_ms": elapsed_ms,
            }
        return json.dumps(output, ensure_ascii=False, indent=2)

    async def _get_with_retry(self, endpoint: str) -> Any:
        timeout = httpx.Timeout(connect=6.0, read=self.timeout, write=10.0, pool=None)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(config.retry_max_attempts + 1),
                wait=wait_random_exponential(multiplier=config.retry_multiplier, max=config.retry_max_wait),
                retry=retry_if_exception(_is_retryable_exception),
                reraise=True,
            ):
                with attempt:
                    response = await client.get(endpoint, headers=self._headers())
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return response.json()
                    text = response.text
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"content": text, "results": []}
        return {}

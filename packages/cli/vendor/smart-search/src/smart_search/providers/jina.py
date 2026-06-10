import json
import time
from typing import Any

import httpx


CHALLENGE_MARKERS = (
    "title: just a moment",
    "checking if the site connection is secure",
    "attention required! | cloudflare",
    "enable javascript and cookies to continue",
)


def _elapsed_ms(start: float) -> float:
    return round((time.time() - start) * 1000, 2)


def _error_payload(exc: Exception) -> dict[str, str]:
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        if status_code in {401, 403}:
            error_type = "auth_error"
        elif status_code == 422:
            error_type = "parameter_error"
        elif status_code == 429:
            error_type = "rate_limited"
        else:
            error_type = "network_error"
        body = (exc.response.text or exc.response.reason_phrase or "")[:300]
        return {"error_type": error_type, "error": f"HTTP {status_code}: {body}"}
    if isinstance(exc, httpx.TimeoutException):
        return {"error_type": "timeout", "error": "request timed out"}
    if isinstance(exc, httpx.RequestError):
        return {"error_type": "network_error", "error": str(exc)}
    return {"error_type": "runtime_error", "error": str(exc)}


def _mask_secret(text: str, secret: str) -> str:
    return text.replace(secret, "***") if secret else text


def _quality_error(content: str) -> str:
    lower = content.strip().lower()
    if not lower:
        return "empty response"
    for marker in CHALLENGE_MARKERS:
        if marker in lower:
            return f"low-quality challenge page detected: {marker}"
    return ""


class JinaReaderProvider:
    def __init__(
        self,
        reader_api_url: str,
        api_key: str | None = None,
        respond_with: str = "",
        timeout: float = 30.0,
    ):
        self.reader_api_url = reader_api_url.rstrip("/")
        self.api_key = api_key or ""
        self.respond_with = respond_with.strip()
        self.timeout = timeout

    async def fetch(self, url: str) -> str:
        start = time.time()
        if self.respond_with and not self.api_key:
            return json.dumps(
                {
                    "ok": False,
                    "provider": "jina",
                    "url": url,
                    "error_type": "config_error",
                    "error": "JINA_RESPOND_WITH requires JINA_API_KEY.",
                    "elapsed_ms": _elapsed_ms(start),
                },
                ensure_ascii=False,
                indent=2,
            )

        headers = {"X-Return-Format": "markdown", "Accept": "text/plain, text/markdown, */*"}
        if self.respond_with:
            headers["X-Respond-With"] = self.respond_with
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        endpoint = f"{self.reader_api_url}/{url}"
        try:
            timeout = httpx.Timeout(connect=6.0, read=self.timeout, write=10.0, pool=None)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(endpoint, headers=headers)
                response.raise_for_status()
            content = response.text.strip()
            quality_error = _quality_error(content)
            if quality_error:
                return json.dumps(
                    {
                        "ok": False,
                        "provider": "jina",
                        "url": url,
                        "error_type": "quality_error",
                        "error": quality_error,
                        "content": content,
                        "elapsed_ms": _elapsed_ms(start),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            return json.dumps(
                {
                    "ok": True,
                    "provider": "jina",
                    "url": url,
                    "content": content,
                    "elapsed_ms": _elapsed_ms(start),
                },
                ensure_ascii=False,
                indent=2,
            )
        except Exception as e:
            error = _error_payload(e)
            message = _mask_secret(error["error"], self.api_key)
            return json.dumps(
                {
                    "ok": False,
                    "provider": "jina",
                    "url": url,
                    "error_type": error["error_type"],
                    "error": message,
                    "elapsed_ms": _elapsed_ms(start),
                },
                ensure_ascii=False,
                indent=2,
            )

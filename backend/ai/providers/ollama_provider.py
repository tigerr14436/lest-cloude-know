
"""Ollama AI Provider."""

import httpx

from ai.providers.base import BaseAIProvider


class OllamaProvider(BaseAIProvider):

    def __init__(
        self,
        model: str = "qwen2.5:7b-instruct-q4_K_M",
        base_url: str = "http://localhost:11434",
        timeout: float = 180.0,
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        response_format: dict | str | None = None,
    ) -> str:
        """Gửi yêu cầu đến Ollama Chat API."""

        url = f"{self.base_url}/api/chat"

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }

        if response_format is not None:
            payload["format"] = response_format

        print("\n========== OLLAMA REQUEST ==========")
        print("Model:", self.model)
        print("URL:", url)
        print("JSON MODE:", response_format is not None)
        print("====================================\n")

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout
            ) as client:
                response = await client.post(
                    url,
                    json=payload,
                )

                response.raise_for_status()
                data = response.json()

            content = data.get("message", {}).get("content")

            if not isinstance(content, str):
                raise ValueError(
                    "Ollama không trả về nội dung hợp lệ."
                )

            print("\n========== OLLAMA RESPONSE ==========")
            print(content)
            print("=====================================\n")

            return content

        except httpx.TimeoutException as error:
            raise RuntimeError(
                "Ollama phản hồi quá thời gian cho phép."
            ) from error

        except httpx.HTTPStatusError as error:
            print(
                "Ollama HTTP error:",
                error.response.status_code,
                error.response.text,
            )
            raise RuntimeError(
                "Ollama API trả về lỗi HTTP."
            ) from error

        except httpx.RequestError as error:
            raise RuntimeError(
                "Không thể kết nối đến Ollama."
            ) from error

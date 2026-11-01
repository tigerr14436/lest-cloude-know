import httpx

from ai.providers.base import BaseAIProvider


class OllamaProvider(BaseAIProvider):

    def __init__(
        self,
        model: str = "qwen2.5:7b-instruct-q4_K_M",
        base_url: str = "http://localhost:11434",
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
    ) -> str:

        url = f"{self.base_url}/api/chat"

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }

        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()

            data = response.json()

        return data["message"]["content"]

import asyncio

from ai.providers.ollama_provider import OllamaProvider


async def main():
    provider = OllamaProvider()

    result = await provider.generate([
        {
            "role": "system",
            "content": "Bạn là AI Agent quản lý dự án DevTask. Trả lời bằng tiếng Việt.",
        },
        {
            "role": "user",
            "content": "Hãy giải thích vai trò của Backend Developer trong một dự án quản lý công việc.",
        },
    ])

    print("\n===== KẾT QUẢ AI =====\n")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
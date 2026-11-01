from abc import ABC, abstractmethod
from typing import Any


class BaseAIProvider(ABC):

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
    ) -> str:
        """
        Sinh câu trả lời từ danh sách messages.
        Mỗi message có role và content.
        """
        pass
    
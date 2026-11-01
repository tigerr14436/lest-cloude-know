
import asyncio
from pprint import pprint

from database import AsyncSessionLocal
from ai.services.knowledge_service import get_approved_knowledge


PROJECT_ID = "9abab879-c929-4325-a03b-40b64c225893"

# User B - thành viên Backend
USER_B_ID = "438fc875-0b38-4caa-a301-586fdec98013"

# User A - Owner
USER_A_ID = "a51801eb-5038-4369-8529-58bb25fb4ff1"


async def main():
    async with AsyncSessionLocal() as db:

        print("\n===== USER B KNOWLEDGE =====")

        knowledge_b = await get_approved_knowledge(
            db=db,
            project_id=PROJECT_ID,
            user_id=USER_B_ID,
        )

        pprint(knowledge_b)

        print("\n===== OWNER KNOWLEDGE =====")

        knowledge_a = await get_approved_knowledge(
            db=db,
            project_id=PROJECT_ID,
            user_id=USER_A_ID,
        )

        pprint(knowledge_a)

        print("\n===== COMPARISON =====")

        ids_b = {item["id"] for item in knowledge_b}
        ids_a = {item["id"] for item in knowledge_a}

        print("User B:", len(ids_b), "Knowledge")
        print("Owner:", len(ids_a), "Knowledge")

        print("Same Knowledge:", ids_b == ids_a)


if __name__ == "__main__":
    asyncio.run(main())

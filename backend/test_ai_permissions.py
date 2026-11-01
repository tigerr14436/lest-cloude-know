import asyncio
from uuid import UUID

from database import AsyncSessionLocal
from ai.services.permission_service import get_project_ai_permissions


PROJECT_ID = UUID("9abab879-c929-4325-a03b-40b64c225893")
USER_B_ID = UUID("438fc875-0b38-4caa-a301-586fdec98013")


async def main():
    async with AsyncSessionLocal() as db:
        permissions = await get_project_ai_permissions(
            db=db,
            project_id=PROJECT_ID,
            user_id=USER_B_ID,
        )

        print("\n===== QUYỀN TRUY CẬP CỦA USER B =====")
        print("Project role:", permissions["project_role"])
        print("Is owner:", permissions["is_owner"])
        print("Accessible group IDs:")

        for group_id in permissions["accessible_group_ids"]:
            print("-", group_id)


if __name__ == "__main__":
    asyncio.run(main())
import asyncio
from uuid import UUID
from pprint import pprint

from database import AsyncSessionLocal
from ai.services.project_context import build_project_context


PROJECT_ID = UUID("9abab879-c929-4325-a03b-40b64c225893")
USER_B_ID = UUID("438fc875-0b38-4caa-a301-586fdec98013")


async def main():
    async with AsyncSessionLocal() as db:
        context = await build_project_context(
            db=db,
            project_id=PROJECT_ID,
            user_id=USER_B_ID,
        )

        print("\n===== ACCESS SCOPE =====")
        pprint(context.get("access_scope"))

        print("\n===== GROUPS =====")
        for group in context.get("groups", []):
            print(group["name"], group["id"])

        print("\n===== TASKS =====")
        for task in context.get("tasks", []):
            print({
                "title": task["title"],
                "group_ids": task["group_ids"],
            })

        print("\n===== SUBTASKS =====")
        for subtask in context.get("subtasks", []):
            print({
                "title": subtask["title"],
                "group_id": subtask["group_id"],
            })


if __name__ == "__main__":
    asyncio.run(main())
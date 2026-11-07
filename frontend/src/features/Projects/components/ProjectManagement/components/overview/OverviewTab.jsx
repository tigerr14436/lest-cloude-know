import React from "react";
import ProjectInfoCard from "./ProjectInfoCard";
import StatCards from "./StatCards";
import ProgressCard from "./ProgressCard";
import GroupsCard from "./GroupsCard";
import RecentTasksCard from "./RecentTasksCard";
import MembersCard from "./MembersCard";
import InviteMemberCard from "./InviteMemberCard";

// Tab "Tổng quan dự án" - ghép các thẻ nhỏ lại với nhau
export default function OverviewTab({
  project,
  stats,
  groups,
  projectTasks,
  projectMembers,
  isLoadingTasks,
  isLoadingMembers,
  isProjectOwner,
  isAnyGroupLeader,
  onChangeTab,
  onSaveDescription,
  isSavingDescription,
  onInviteMember,
  isInviting,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        color: "#e2e8f0",
      }}
    >
      <ProjectInfoCard
        project={project}
        isProjectOwner={isProjectOwner}
        isAnyGroupLeader={isAnyGroupLeader}
        onSaveDescription={onSaveDescription}
        isSavingDescription={isSavingDescription}
      />

      <StatCards stats={stats} />

      <ProgressCard stats={stats} isLoadingTasks={isLoadingTasks} />

      <GroupsCard groups={groups} onManageGroups={() => onChangeTab("groups")} />

      <RecentTasksCard
        projectTasks={projectTasks}
        isLoadingTasks={isLoadingTasks}
        onViewKanban={() => onChangeTab("kanban")}
      />

      <MembersCard
        projectMembers={projectMembers}
        isLoadingMembers={isLoadingMembers}
        totalMembers={stats.totalMembers}
      />

      {isProjectOwner && (
        <InviteMemberCard onInvite={onInviteMember} isSending={isInviting} />
      )}
    </div>
  );
}

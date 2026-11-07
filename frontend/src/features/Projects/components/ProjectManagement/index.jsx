import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../ProjectManagement.css";

// Các tab sẵn có (nằm ngoài thư mục này)
import CodeManagement from "../CodeManagement";
import CodeReview from "../CodeReview";
import GroupManagement from "../GroupManagement";
import ProjectCostCalculator from "../ProjectCostCalculator";

// Hooks
import useToast from "./hooks/useToast";
import useCurrentUser from "./hooks/useCurrentUser";
import useProjectList from "./hooks/useProjectList";
import useProjectDetail from "./hooks/useProjectDetail";
import useProjectStats from "./hooks/useProjectStats";
import useTaskManagement from "./hooks/useTaskManagement";
import useProjectInvitation from "./hooks/useProjectInvitation";

// Components
import ToastContainer from "./components/ToastContainer";
import ProjectHeader from "./components/ProjectHeader";
import ProjectTabs from "./components/ProjectTabs";
import OverviewTab from "./components/overview/OverviewTab";
import KanbanTab from "./components/KanbanTab";
import ProjectListView from "./components/ProjectListView";
import ProjectModal from "./components/ProjectModal";
import TaskModal from "./components/TaskModal";

import OwnerAIChat from "../OwnerAIChat";

export default function ProjectManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const { toastList, showNotification, removeToast } = useToast();
  const currentUser = useCurrentUser();

  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // ---------- Dự án ----------
  const projectApi = useProjectList({
    navigate,
    selectedProject,
    setSelectedProject,
    showNotification,
  });

  const { projectList } = projectApi;

  // Quay lại đúng dự án / tab khi từ trang khác về
  useEffect(() => {
    const returnProjectId = location.state?.returnProjectId;

    if (!returnProjectId || projectList.length === 0) return;

    const project = projectList.find(
      (item) => String(item.id) === String(returnProjectId),
    );

    if (project) {
      setSelectedProject(project);
      setActiveTab(location.state?.returnTab || "overview");
      navigate("/project", { replace: true, state: null });
    }
  }, [location.state, projectList, navigate]);

  // ---------- Nhóm, Task, thành viên của dự án đang chọn ----------
  const {
    groups,
    setGroups,
    projectTasks,
    setProjectTasks,
    projectMembers,
    isLoadingTasks,
    isLoadingMembers,
  } = useProjectDetail(selectedProject, showNotification);

  // ---------- Phân quyền ----------
  const isProjectOwner = selectedProject?.role === "owner";

  const isAnyGroupLeader = groups.some(
    (group) => group.leader_id === currentUser?.id,
  );

  // Chỉ Owner được sửa Task cấp dự án
  const canManageKanban = isProjectOwner;

  const stats = useProjectStats(projectTasks, groups, projectMembers);

  // ---------- Mời thành viên (Name Tag / email) ----------
  const invitation = useProjectInvitation(
    selectedProject?.id,
    showNotification,
  );

  // ---------- Task ----------
  const taskApi = useTaskManagement({
    selectedProject,
    groups,
    projectTasks,
    setProjectTasks,
    isProjectOwner,
    canManageKanban,
    showNotification,
  });

  // =====================================================
  // GIAO DIỆN
  // =====================================================

  return (
    <div className="khung-quan-ly-du-an">
      <ToastContainer toastList={toastList} removeToast={removeToast} />

      {selectedProject ? (
        <div>
          <ProjectHeader
            project={selectedProject}
            isProjectOwner={isProjectOwner}
            isAnyGroupLeader={isAnyGroupLeader}
            showCreateTask={activeTab === "kanban" && canManageKanban}
            onBack={() => setSelectedProject(null)}
            onCreateTask={() => taskApi.openCreateTaskModal("todo")}
          />

          <ProjectTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            isProjectOwner={isProjectOwner}
          />

          {activeTab === "overview" && (
            <OverviewTab
              project={selectedProject}
              stats={stats}
              groups={groups}
              projectTasks={projectTasks}
              projectMembers={projectMembers}
              isLoadingTasks={isLoadingTasks}
              isLoadingMembers={isLoadingMembers}
              isProjectOwner={isProjectOwner}
              isAnyGroupLeader={isAnyGroupLeader}
              onChangeTab={setActiveTab}
              onSaveDescription={(text) =>
                projectApi.saveProjectDescription(selectedProject, text)
              }
              isSavingDescription={projectApi.isSavingDescription}
              onInviteMember={invitation.sendInvitation}
              isInviting={invitation.isSending}
            />
          )}

          {activeTab === "kanban" && (
            <KanbanTab
              canManage={canManageKanban}
              stats={stats}
              projectTasks={projectTasks}
              isLoadingTasks={isLoadingTasks}
              changeTaskStatus={taskApi.changeTaskStatus}
              openTaskModal={taskApi.openCreateTaskModal}
              editTask={taskApi.openEditTaskModal}
              deleteTask={taskApi.handleDeleteTask}
            />
          )}

          {activeTab === "groups" && (
            <GroupManagement
              projectId={selectedProject.id}
              project={selectedProject}
              groups={groups}
              setGroups={setGroups}
              projectMembers={projectMembers}
              projectTasks={projectTasks}
              isProjectOwner={isProjectOwner}
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.name || ""}
              currentUserEmail={currentUser?.email || ""}
              showNotification={showNotification}
            />
          )}

          {activeTab === "code" && (
            <CodeManagement
              projectId={selectedProject.id}
              role={selectedProject.role}
              showNotification={showNotification}
            />
          )}

          {activeTab === "review" && (
            <CodeReview
              projectId={selectedProject.id}
              showNotification={showNotification}
            />
          )}

          {activeTab === "cost" && (
            <ProjectCostCalculator
              projectId={selectedProject.id}
              isProjectOwner={isProjectOwner}
              projectTasks={projectTasks}
              showNotification={showNotification}
            />
          )}

          {activeTab === "owner-ai" && isProjectOwner && (
            <OwnerAIChat
              projectId={selectedProject.id}
              projectName={selectedProject.name}
            />
          )}
        </div>
      ) : (
        <ProjectListView
          projectList={projectApi.projectList}
          isLoadingProjects={projectApi.isLoadingProjects}
          onOpenCreate={projectApi.openCreateProject}
          joinCode={projectApi.joinCode}
          setJoinCode={projectApi.setJoinCode}
          isJoiningProject={projectApi.isJoiningProject}
          onJoinProject={projectApi.handleJoinProject}
          copiedId={projectApi.copiedId}
          copyJoinCode={projectApi.copyJoinCode}
          setSelectedProject={setSelectedProject}
          handleDeleteProject={projectApi.handleDeleteProject}
          onEditProject={projectApi.openEditProject}
          onCompleteProject={projectApi.markProjectComplete}
        />
      )}

      {projectApi.isProjectModalOpen && (
        <ProjectModal
          isEditing={Boolean(projectApi.editingProjectId)}
          form={projectApi.projectForm}
          setForm={projectApi.setProjectForm}
          isSaving={projectApi.isCreatingProject}
          onClose={projectApi.closeProjectModal}
          onSubmit={projectApi.handleCreateProject}
        />
      )}

      {taskApi.isTaskModalOpen && (
        <TaskModal
          isEditing={Boolean(taskApi.editingTaskId)}
          form={taskApi.taskForm}
          setForm={taskApi.setTaskForm}
          saving={taskApi.savingTask}
          loadingGroups={taskApi.loadingTaskGroups}
          groups={groups}
          taskGroupId={taskApi.taskGroupId}
          setTaskGroupId={taskApi.setTaskGroupId}
          projectMembers={projectMembers}
          isLoadingMembers={isLoadingMembers}
          onClose={taskApi.closeTaskModal}
          onSubmit={taskApi.handleSaveTask}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { sendAuthenticatedRequest } from "../api";
import { EMPTY_TASK_FORM } from "../constants";
import {
  validateTaskEstimates,
  getTaskEstimatePayload,
} from "../utils/taskUtils";

// Toàn bộ logic Task: đổi trạng thái, tạo / sửa / xóa, phân công nhóm
export default function useTaskManagement({
  selectedProject,
  groups,
  projectTasks,
  setProjectTasks,
  isProjectOwner,
  canManageKanban,
  showNotification,
}) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentTaskColumn, setCurrentTaskColumn] = useState("todo");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskGroupId, setTaskGroupId] = useState("");
  const [taskGroupAssignments, setTaskGroupAssignments] = useState({});
  const [loadingTaskGroups, setLoadingTaskGroups] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ ...EMPTY_TASK_FORM });

  const closeTaskModal = () => setIsTaskModalOpen(false);

  // ---------- Cập nhật trạng thái Task ----------
  const changeTaskStatus = async (taskId, targetStatus) => {
    const originalTask = projectTasks.find((task) => task.id === taskId);

    if (!originalTask) return;

    setProjectTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: targetStatus } : task,
      ),
    );

    try {
      await sendAuthenticatedRequest(`/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: targetStatus }),
      });

      showNotification(
        "thong-tin",
        "Cập nhật tiến độ",
        "Đã lưu thay đổi vào hệ thống",
      );
    } catch (error) {
      setProjectTasks((prev) =>
        prev.map((task) => (task.id === taskId ? originalTask : task)),
      );

      showNotification("loi", "Không lưu được", error.message);
    }
  };

  // ---------- Phân công Task cho nhóm ----------
  const loadTaskGroupAssignments = async () => {
    if (!selectedProject?.id || !isProjectOwner) {
      return {};
    }

    setLoadingTaskGroups(true);

    try {
      const boards = await Promise.all(
        groups.map(async (group) => ({
          groupId: group.id,
          board: await sendAuthenticatedRequest(
            `/projects/${selectedProject.id}/groups/${group.id}/kanban`,
          ),
        })),
      );

      const assignments = {};

      boards.forEach(({ groupId, board }) => {
        (board?.tasks || []).forEach((task) => {
          assignments[task.id] = groupId;
        });
      });

      setTaskGroupAssignments(assignments);

      return assignments;
    } finally {
      setLoadingTaskGroups(false);
    }
  };

  const saveTaskGroupAssignment = async (taskId, previousGroupId, nextGroupId) => {
    if (previousGroupId === nextGroupId) return;

    const base = `/projects/${selectedProject.id}/groups`;

    if (previousGroupId) {
      await sendAuthenticatedRequest(
        `${base}/${previousGroupId}/kanban/tasks/${taskId}`,
        { method: "DELETE" },
      );
    }

    if (nextGroupId) {
      await sendAuthenticatedRequest(`${base}/${nextGroupId}/kanban/tasks`, {
        method: "POST",
        body: JSON.stringify({ task_id: taskId }),
      });
    }

    setTaskGroupAssignments((prev) => {
      const updated = { ...prev };

      if (nextGroupId) {
        updated[taskId] = nextGroupId;
      } else {
        delete updated[taskId];
      }

      return updated;
    });
  };

  // ---------- Lưu Task ----------
  const handleSaveTask = async (e) => {
    e.preventDefault();

    if (!canManageKanban) {
      showNotification(
        "loi",
        "Quyền truy cập",
        "Chỉ Chủ dự án được chỉnh sửa Task cấp dự án!",
      );
      return;
    }

    if (!taskForm.title.trim() || !selectedProject) return;

    const estimateError = validateTaskEstimates(taskForm);

    if (estimateError) {
      showNotification(
        "loi",
        "Thời gian dự kiến không hợp lệ",
        estimateError,
      );
      return;
    }

    if (savingTask || loadingTaskGroups) return;

    setSavingTask(true);

    try {
      let savedTaskId = editingTaskId;

      const taskPayload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        status: currentTaskColumn,
        priority: taskForm.priority,
        assignee: taskForm.assignee || null,
        deadline: taskForm.deadline
          ? new Date(`${taskForm.deadline}T00:00:00`).toISOString()
          : null,
        ...getTaskEstimatePayload(taskForm),
      };

      if (editingTaskId) {
        const updatedTask = await sendAuthenticatedRequest(
          `/tasks/${editingTaskId}`,
          { method: "PUT", body: JSON.stringify(taskPayload) },
        );

        setProjectTasks((prev) =>
          prev.map((task) => (task.id === editingTaskId ? updatedTask : task)),
        );

        showNotification(
          "thanh-cong",
          "Cập nhật công việc",
          `Đã lưu thay đổi cho "${taskForm.title}"`,
        );
      } else {
        const newTask = await sendAuthenticatedRequest("/tasks", {
          method: "POST",
          body: JSON.stringify({
            project_id: selectedProject.id,
            ...taskPayload,
          }),
        });

        savedTaskId = newTask.id;

        setProjectTasks((prev) => [newTask, ...prev]);

        showNotification(
          "thanh-cong",
          "Thêm công việc",
          `Đã tạo "${taskForm.title}"`,
        );
      }

      // Giữ nguyên cơ chế phân công Task cho nhóm
      try {
        await saveTaskGroupAssignment(
          savedTaskId,
          editingTaskId ? taskGroupAssignments[editingTaskId] || "" : "",
          taskGroupId,
        );
      } catch (assignmentError) {
        showNotification(
          "loi",
          "Không lưu được nhóm phụ trách",
          assignmentError.message,
        );

        await loadTaskGroupAssignments().catch(() => {});

        return;
      }

      setIsTaskModalOpen(false);
      setEditingTaskId(null);
      setTaskForm({ ...EMPTY_TASK_FORM });
      setTaskGroupId("");
    } catch (error) {
      showNotification("loi", "Không lưu được Task", error.message);
    } finally {
      setSavingTask(false);
    }
  };

  // ---------- Mở form chỉnh sửa Task ----------
  const openEditTaskModal = (task) => {
    if (!canManageKanban) {
      showNotification(
        "can-bao",
        "Hạn chế quyền",
        "Chỉ Chủ dự án mới có thể chỉnh sửa Task.",
      );
      return;
    }

    setEditingTaskId(task.id);
    setTaskGroupId(taskGroupAssignments[task.id] || "");

    loadTaskGroupAssignments()
      .then((assignments) => setTaskGroupId(assignments[task.id] || ""))
      .catch((error) => {
        showNotification(
          "loi",
          "Không tải được nhóm phụ trách",
          error.message,
        );
      });

    setCurrentTaskColumn(task.status);

    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      assignee: task.assignee || "",
      deadline: task.deadline ? task.deadline.split("T")[0] : "",
      estimated_best_days: task.estimated_best_days ?? "",
      estimated_average_days: task.estimated_average_days ?? "",
      estimated_worst_days: task.estimated_worst_days ?? "",
    });

    setIsTaskModalOpen(true);
  };

  // ---------- Mở form tạo Task ----------
  const openCreateTaskModal = (columnKey) => {
    if (!canManageKanban) {
      showNotification(
        "can-bao",
        "Hạn chế quyền",
        "Chỉ Chủ dự án mới có quyền tạo Task mới.",
      );
      return;
    }

    setEditingTaskId(null);
    setTaskGroupId("");

    loadTaskGroupAssignments().catch((error) => {
      showNotification("loi", "Không tải được nhóm phụ trách", error.message);
    });

    setCurrentTaskColumn(columnKey);
    setTaskForm({ ...EMPTY_TASK_FORM });
    setIsTaskModalOpen(true);
  };

  // ---------- Xóa Task ----------
  const handleDeleteTask = async (taskId, title) => {
    if (!canManageKanban) {
      showNotification(
        "loi",
        "Hạn chế quyền",
        "Chỉ Chủ dự án mới có quyền xóa Task.",
      );
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa task "${title}"?`)) return;

    try {
      await sendAuthenticatedRequest(`/tasks/${taskId}`, { method: "DELETE" });

      setProjectTasks((prev) => prev.filter((task) => task.id !== taskId));

      showNotification("can-bao", "Đã xóa", `Đã xóa task "${title}"`);
    } catch (error) {
      showNotification("loi", "Không xóa được", error.message);
    }
  };

  return {
    isTaskModalOpen,
    editingTaskId,
    taskForm,
    setTaskForm,
    taskGroupId,
    setTaskGroupId,
    loadingTaskGroups,
    savingTask,
    closeTaskModal,
    changeTaskStatus,
    handleSaveTask,
    openEditTaskModal,
    openCreateTaskModal,
    handleDeleteTask,
  };
}

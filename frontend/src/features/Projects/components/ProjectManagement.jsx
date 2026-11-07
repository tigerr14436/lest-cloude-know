
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FolderPlus,
  UserPlus,
  FolderKanban,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Code2,
  Search,
  LayoutGrid,
  List,
  CheckSquare,
  ArrowLeft,
  Plus,
  Clock,
  X,
  Info,
  AlertTriangle,
  BarChart2,
  FileCode,
  Users,
  Lock,
  DollarSign,
} from "lucide-react";
import "../ProjectManagement.css";

import ProjectCard from "./ProjectCard";
import KanbanBoard from "./KanbanBoard";
import CodeManagement from "./CodeManagement";
import CodeReview from "./CodeReview";
import ProjectChat from "./ProjectChat";
import GroupManagement from "./GroupManagement";
import ProjectCostCalculator from "./ProjectCostCalculator";

async function sendAuthenticatedRequest(apiPath, options = {}) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Người dùng chưa đăng nhập");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(
    `http://127.0.0.1:8000/api${apiPath}`,
    {
      ...options,
      headers,
    },
  );

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Đã có lỗi xảy ra",
    );
  }

  return data;
}

// Form mặc định khi tạo Task
const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  priority: "medium",
  assignee: "",
  deadline: "",
  estimated_best_days: "",
  estimated_average_days: "",
  estimated_worst_days: "",
};

// Kiểm tra 3 mức thời gian dự kiến
function validateTaskEstimates(form) {
  const fields = [
    {
      key: "estimated_best_days",
      label: "Thời gian tốt nhất",
    },
    {
      key: "estimated_average_days",
      label: "Thời gian trung bình",
    },
    {
      key: "estimated_worst_days",
      label: "Thời gian tệ nhất",
    },
  ];

  const values = [];

  for (const field of fields) {
    const rawValue = form[field.key];

    if (
      rawValue === "" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      values.push(null);
      continue;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= 0) {
      return `${field.label} phải là số lớn hơn 0.`;
    }

    if (value > 7) {
      return `${field.label} không được vượt quá 7 ngày.`;
    }

    values.push(value);
  }

  const enteredValues = values.filter(
    (value) => value !== null,
  );

  for (let i = 1; i < enteredValues.length; i++) {
    if (enteredValues[i] < enteredValues[i - 1]) {
      return (
        "Thời gian phải theo thứ tự: " +
        "tốt nhất ≤ trung bình ≤ tệ nhất."
      );
    }
  }

  return null;
}

// Chuyển dữ liệu form thành dữ liệu gửi Backend
function getTaskEstimatePayload(form) {
  return {
    estimated_best_days:
      form.estimated_best_days === ""
        ? null
        : Number(form.estimated_best_days),

    estimated_average_days:
      form.estimated_average_days === ""
        ? null
        : Number(form.estimated_average_days),

    estimated_worst_days:
      form.estimated_worst_days === ""
        ? null
        : Number(form.estimated_worst_days),
  };
}

// Định dạng ngày hiển thị
function formatProjectDate(value) {
  if (!value) return "Chưa cập nhật";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return date.toLocaleDateString("vi-VN");
}

// Nhãn trạng thái Task
function getTaskStatusLabel(status) {
  const labels = {
    todo: "Cần làm",
    in_progress: "Đang thực hiện",
    review: "Đang kiểm tra",
    done: "Hoàn thành",
  };

  return labels[status] || status || "Chưa xác định";
}

// Màu trạng thái Task
function getTaskStatusColor(status) {
  const colors = {
    todo: "#94a3b8",
    in_progress: "#f59e0b",
    review: "#38bdf8",
    done: "#34d399",
  };

  return colors[status] || "#94a3b8";
}

// Nhãn mức độ ưu tiên
function getTaskPriorityLabel(priority) {
  const labels = {
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
  };

  return labels[priority] || "Chưa xác định";
}

// Màu mức độ ưu tiên
function getTaskPriorityColor(priority) {
  const colors = {
    low: "#34d399",
    medium: "#fbbf24",
    high: "#f87171",
  };

  return colors[priority] || "#94a3b8";
}

export default function ProjectManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);

  const currentUserName = currentUser?.name || "";
  const currentUserEmail = currentUser?.email || "";

  const [projectList, setProjectList] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] =
    useState(true);

  const [selectedProject, setSelectedProject] =
    useState(null);

  const [projectTasks, setProjectTasks] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);

  const [isLoadingMembers, setIsLoadingMembers] =
    useState(false);

  const [isLoadingTasks, setIsLoadingTasks] =
    useState(false);

  // Tab mặc định là Tổng quan dự án
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const returnProjectId = location.state?.returnProjectId;

    if (!returnProjectId || projectList.length === 0) {
      return;
    }

    const project = projectList.find(
      (item) =>
        String(item.id) === String(returnProjectId),
    );

    if (project) {
      setSelectedProject(project);

      setActiveTab(
        location.state?.returnTab || "overview",
      );

      navigate("/project", {
        replace: true,
        state: null,
      });
    }
  }, [location.state, projectList, navigate]);

  // Nhóm và quyền lấy từ Backend
  const [groups, setGroups] = useState([]);

  const isProjectOwner =
    selectedProject?.role === "owner";

  const isAnyGroupLeader = groups.some(
    (group) => group.leader_id === currentUser?.id,
  );

  // Chỉ Owner được sửa Task cấp dự án
  const canManageKanban = isProjectOwner;

  // =====================================================
  // THỐNG KÊ TỔNG QUAN DỰ ÁN
  // Chỉ thống kê Task cấp dự án, không cộng Subtask.
  // =====================================================

  const totalTasks = projectTasks.length;

  const todoTasks = projectTasks.filter(
    (task) => task.status === "todo",
  ).length;

  const inProgressTasks = projectTasks.filter(
    (task) => task.status === "in_progress",
  ).length;

  const reviewTasks = projectTasks.filter(
    (task) => task.status === "review",
  ).length;

  const completedTasks = projectTasks.filter(
    (task) => task.status === "done",
  ).length;

  const projectProgress =
    totalTasks > 0
      ? Math.round(
          (completedTasks / totalTasks) * 100,
        )
      : 0;

  const totalGroups = groups.length;
  const totalMembers = projectMembers.length;

  const projectStatusLabel =
    selectedProject?.status === "completed"
      ? "Đã hoàn thành"
      : "Đang thực hiện";

  // =====================================================
  // STATE DỰ ÁN
  // =====================================================

  const [editingProjectId, setEditingProjectId] =
    useState(null);

  const [isProjectModalOpen, setIsProjectModalOpen] =
    useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
  });

  const [joinCode, setJoinCode] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [viewMode, setViewMode] = useState("grid");

  // =====================================================
  // STATE TASK
  // =====================================================

  const [isTaskModalOpen, setIsTaskModalOpen] =
    useState(false);

  const [currentTaskColumn, setCurrentTaskColumn] =
    useState("todo");

  const [editingTaskId, setEditingTaskId] =
    useState(null);

  const [taskGroupId, setTaskGroupId] = useState("");

  const [taskGroupAssignments, setTaskGroupAssignments] =
    useState({});

  const [loadingTaskGroups, setLoadingTaskGroups] =
    useState(false);

  const [savingTask, setSavingTask] = useState(false);

  const [taskForm, setTaskForm] = useState({
    ...EMPTY_TASK_FORM,
  });

  // =====================================================
  // STATE THÔNG BÁO
  // =====================================================

  const [toastList, setToastList] = useState([]);

  const [isCreatingProject, setIsCreatingProject] =
    useState(false);

  const [isJoiningProject, setIsJoiningProject] =
    useState(false);

  const [copiedId, setCopiedId] = useState(null);

  // =====================================================
  // THÔNG BÁO
  // =====================================================

  const showNotification = (type, title, message) => {
    const id = Date.now();

    setToastList((prev) => [
      ...prev,
      { id, type, title, message },
    ]);

    setTimeout(() => {
      setToastList((prev) =>
        prev.filter((toast) => toast.id !== id),
      );
    }, 4000);
  };

  const removeToast = (id) => {
    setToastList((prev) =>
      prev.filter((toast) => toast.id !== id),
    );
  };

  // =====================================================
  // TẢI DỮ LIỆU BAN ĐẦU
  // =====================================================

  useEffect(() => {
    fetchProjectList();

    sendAuthenticatedRequest("/users/me")
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  // Tải danh sách nhóm
  useEffect(() => {
    setGroups([]);

    if (!selectedProject?.id) return;

    let active = true;

    sendAuthenticatedRequest(
      `/projects/${selectedProject.id}/groups`,
    )
      .then((data) => {
        if (active) {
          setGroups(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        if (active) {
          showNotification(
            "loi",
            "Không tải được nhóm",
            error.message,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProject?.id]);

  // Tải Task của dự án
  useEffect(() => {
    if (selectedProject?.id) {
      fetchProjectTasks(selectedProject.id);
    } else {
      setProjectTasks([]);
    }
  }, [selectedProject?.id]);

  // Tải thành viên dự án
  useEffect(() => {
    const projectId = selectedProject?.id;

    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    setProjectMembers([]);
    setIsLoadingMembers(true);

    sendAuthenticatedRequest(
      `/projects/${projectId}/members`,
    )
      .then((data) => {
        setProjectMembers(
          Array.isArray(data) ? data : [],
        );
      })
      .catch((error) => {
        setProjectMembers([]);

        showNotification(
          "loi",
          "Không tải được thành viên",
          error.message,
        );
      })
      .finally(() => {
        setIsLoadingMembers(false);
      });
  }, [selectedProject?.id]);

  // =====================================================
  // API DỰ ÁN
  // =====================================================

  const fetchProjectList = async () => {
    setIsLoadingProjects(true);

    try {
      const data = await sendAuthenticatedRequest(
        "/projects",
      );

      setProjectList(data || []);
    } catch (error) {
      if (error.message.includes("chưa đăng nhập")) {
        navigate("/");
        return;
      }

      showNotification(
        "loi",
        "Không tải được dự án",
        error.message,
      );
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const fetchProjectTasks = async (projectId) => {
    setIsLoadingTasks(true);

    try {
      const data = await sendAuthenticatedRequest(
        `/tasks?project_id=${projectId}`,
      );

      setProjectTasks(
        Array.isArray(data) ? data : [],
      );
    } catch (error) {
      setProjectTasks([]);

      showNotification(
        "loi",
        "Không tải được công việc",
        error.message,
      );
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const openEditProject = (project) => {
    if (project.role !== "owner") return;

    setEditingProjectId(project.id);

    setProjectForm({
      name: project.name || "",
      description: project.description || "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
    });

    setIsProjectModalOpen(true);
  };

  const openCreateProject = () => {
    setEditingProjectId(null);

    setProjectForm({
      name: "",
      description: "",
      start_date: "",
      end_date: "",
    });

    setIsProjectModalOpen(true);
  };

  const markProjectComplete = async (project) => {
    if (
      project.role !== "owner" ||
      project.status === "completed"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Đánh dấu dự án "${project.name}" đã hoàn thành? Dữ liệu và nhóm vẫn được giữ lại.`,
      )
    ) {
      return;
    }

    try {
      const updated = await sendAuthenticatedRequest(
        `/projects/${project.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: "completed",
          }),
        },
      );

      setProjectList((prev) =>
        prev.map((projectItem) =>
          projectItem.id === updated.id
            ? updated
            : projectItem,
        ),
      );

      if (selectedProject?.id === updated.id) {
        setSelectedProject(updated);
      }

      showNotification(
        "thanh-cong",
        "Hoàn thành dự án",
        `Đã kết thúc "${project.name}". Các nhóm chưa bị xóa.`,
      );
    } catch (error) {
      showNotification(
        "loi",
        "Không hoàn thành được dự án",
        error.message,
      );
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();

    const name = projectForm.name.trim();

    if (
      !name ||
      !projectForm.start_date ||
      !projectForm.end_date
    ) {
      showNotification(
        "loi",
        "Thiếu thông tin",
        "Vui lòng nhập tên và thời gian dự án.",
      );

      return;
    }

    if (
      projectForm.end_date < projectForm.start_date
    ) {
      showNotification(
        "loi",
        "Ngày không hợp lệ",
        "Ngày kết thúc không được trước ngày bắt đầu.",
      );

      return;
    }

    if (isCreatingProject) return;

    setIsCreatingProject(true);

    try {
      const newProject =
        await sendAuthenticatedRequest(
          editingProjectId
            ? `/projects/${editingProjectId}`
            : "/projects",
          {
            method: editingProjectId ? "PUT" : "POST",
            body: JSON.stringify({
              name,
              description:
                projectForm.description.trim() || null,
              start_date: projectForm.start_date,
              end_date: projectForm.end_date,
            }),
          },
        );

      setProjectList((prev) =>
        editingProjectId
          ? prev.map((project) =>
              project.id === newProject.id
                ? newProject
                : project,
            )
          : [newProject, ...prev],
      );

      if (selectedProject?.id === newProject.id) {
        setSelectedProject(newProject);
      }

      setEditingProjectId(null);

      setProjectForm({
        name: "",
        description: "",
        start_date: "",
        end_date: "",
      });

      setIsProjectModalOpen(false);

      showNotification(
        "thanh-cong",
        "Thành công",
        `Đã lưu dự án "${newProject.name}"`,
      );
    } catch (error) {
      showNotification(
        "loi",
        "Không tạo được dự án",
        error.message || "Không thể tạo dự án",
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleJoinProject = async (e) => {
    e.preventDefault();

    if (!joinCode.trim()) return;

    setIsJoiningProject(true);

    try {
      const joinedProject =
        await sendAuthenticatedRequest(
          "/projects/join",
          {
            method: "POST",
            body: JSON.stringify({
              join_code: joinCode.trim(),
            }),
          },
        );

      setProjectList((prev) => [
        joinedProject,
        ...prev.filter(
          (project) => project.id !== joinedProject.id,
        ),
      ]);

      showNotification(
        "thanh-cong",
        "Tham gia thành công",
        `Bạn đã vào dự án "${joinedProject.name}"`,
      );

      setJoinCode("");
    } catch (error) {
      showNotification(
        "loi",
        "Lỗi tham gia",
        error.message,
      );
    } finally {
      setIsJoiningProject(false);
    }
  };

  const copyJoinCode = (code, id) => {
    navigator.clipboard.writeText(code);

    setCopiedId(id);

    showNotification(
      "thong-tin",
      "Đã sao chép",
      `Mã tham gia ${code} đã lưu vào bộ nhớ tạm`,
    );

    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteProject = async (id, name) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa/rời khỏi dự án "${name}"?`,
      )
    ) {
      return;
    }

    try {
      await sendAuthenticatedRequest(
        `/projects/${id}`,
        { method: "DELETE" },
      );

      setProjectList((prev) =>
        prev.filter((item) => item.id !== id),
      );

      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }

      showNotification(
        "can-bao",
        "Đã xóa dự án",
        `Đã gỡ bỏ "${name}" khỏi danh sách`,
      );
    } catch (error) {
      showNotification(
        "loi",
        "Không xóa được dự án",
        error.message,
      );
    }
  };

  // =====================================================
  // CẬP NHẬT TRẠNG THÁI TASK
  // =====================================================

  const changeTaskStatus = async (
    taskId,
    targetStatus,
  ) => {
    const originalTask = projectTasks.find(
      (task) => task.id === taskId,
    );

    if (!originalTask) return;

    setProjectTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: targetStatus }
          : task,
      ),
    );

    try {
      await sendAuthenticatedRequest(
        `/tasks/${taskId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: targetStatus,
          }),
        },
      );

      showNotification(
        "thong-tin",
        "Cập nhật tiến độ",
        "Đã lưu thay đổi vào hệ thống",
      );
    } catch (error) {
      setProjectTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? originalTask
            : task,
        ),
      );

      showNotification(
        "loi",
        "Không lưu được",
        error.message,
      );
    }
  };

  // =====================================================
  // PHÂN CÔNG TASK CHO NHÓM
  // =====================================================

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

  const saveTaskGroupAssignment = async (
    taskId,
    previousGroupId,
    nextGroupId,
  ) => {
    if (previousGroupId === nextGroupId) return;

    const base = `/projects/${selectedProject.id}/groups`;

    if (previousGroupId) {
      await sendAuthenticatedRequest(
        `${base}/${previousGroupId}/kanban/tasks/${taskId}`,
        { method: "DELETE" },
      );
    }

    if (nextGroupId) {
      await sendAuthenticatedRequest(
        `${base}/${nextGroupId}/kanban/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            task_id: taskId,
          }),
        },
      );
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

  // =====================================================
  // LƯU TASK
  // =====================================================

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

    if (!taskForm.title.trim() || !selectedProject) {
      return;
    }

    const estimateError =
      validateTaskEstimates(taskForm);

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
        description:
          taskForm.description.trim() || null,
        status: currentTaskColumn,
        priority: taskForm.priority,
        assignee: taskForm.assignee || null,

        deadline: taskForm.deadline
          ? new Date(
              `${taskForm.deadline}T00:00:00`,
            ).toISOString()
          : null,

        ...getTaskEstimatePayload(taskForm),
      };

      if (editingTaskId) {
        const updatedTask =
          await sendAuthenticatedRequest(
            `/tasks/${editingTaskId}`,
            {
              method: "PUT",
              body: JSON.stringify(taskPayload),
            },
          );

        setProjectTasks((prev) =>
          prev.map((task) =>
            task.id === editingTaskId
              ? updatedTask
              : task,
          ),
        );

        showNotification(
          "thanh-cong",
          "Cập nhật công việc",
          `Đã lưu thay đổi cho "${taskForm.title}"`,
        );
      } else {
        const newTask =
          await sendAuthenticatedRequest(
            "/tasks",
            {
              method: "POST",
              body: JSON.stringify({
                project_id: selectedProject.id,
                ...taskPayload,
              }),
            },
          );

        savedTaskId = newTask.id;

        setProjectTasks((prev) => [
          newTask,
          ...prev,
        ]);

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
          editingTaskId
            ? taskGroupAssignments[editingTaskId] || ""
            : "",
          taskGroupId,
        );
      } catch (assignmentError) {
        showNotification(
          "loi",
          "Không lưu được nhóm phụ trách",
          assignmentError.message,
        );

        await loadTaskGroupAssignments().catch(
          () => {},
        );

        return;
      }

      setIsTaskModalOpen(false);
      setEditingTaskId(null);
      setTaskForm({ ...EMPTY_TASK_FORM });
      setTaskGroupId("");
    } catch (error) {
      showNotification(
        "loi",
        "Không lưu được Task",
        error.message,
      );
    } finally {
      setSavingTask(false);
    }
  };

  // =====================================================
  // MỞ FORM CHỈNH SỬA TASK
  // =====================================================

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
    setTaskGroupId(
      taskGroupAssignments[task.id] || "",
    );

    loadTaskGroupAssignments()
      .then((assignments) => {
        setTaskGroupId(
          assignments[task.id] || "",
        );
      })
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
      deadline: task.deadline
        ? task.deadline.split("T")[0]
        : "",

      estimated_best_days:
        task.estimated_best_days ?? "",

      estimated_average_days:
        task.estimated_average_days ?? "",

      estimated_worst_days:
        task.estimated_worst_days ?? "",
    });

    setIsTaskModalOpen(true);
  };

  // =====================================================
  // MỞ FORM TẠO TASK
  // =====================================================

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
      showNotification(
        "loi",
        "Không tải được nhóm phụ trách",
        error.message,
      );
    });

    setCurrentTaskColumn(columnKey);
    setTaskForm({ ...EMPTY_TASK_FORM });

    setIsTaskModalOpen(true);
  };

  // =====================================================
  // XÓA TASK
  // =====================================================

  const handleDeleteTask = async (
    taskId,
    title,
  ) => {
    if (!canManageKanban) {
      showNotification(
        "loi",
        "Hạn chế quyền",
        "Chỉ Chủ dự án mới có quyền xóa Task.",
      );

      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa task "${title}"?`,
      )
    ) {
      return;
    }

    try {
      await sendAuthenticatedRequest(
        `/tasks/${taskId}`,
        { method: "DELETE" },
      );

      setProjectTasks((prev) =>
        prev.filter((task) => task.id !== taskId),
      );

      showNotification(
        "can-bao",
        "Đã xóa",
        `Đã xóa task "${title}"`,
      );
    } catch (error) {
      showNotification(
        "loi",
        "Không xóa được",
        error.message,
      );
    }
  };

  // =====================================================
  // LỌC DANH SÁCH DỰ ÁN
  // =====================================================

  const filteredProjects = projectList.filter(
    (project) => {
      const projectName = (
        project.name || ""
      ).toLowerCase();

      const projectJoinCode = (
        project.join_code || ""
      ).toLowerCase();

      const keyword = searchKeyword.toLowerCase();

      const matchesKeyword =
        projectName.includes(keyword) ||
        projectJoinCode.includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        project.status === statusFilter;

      return matchesKeyword && matchesStatus;
    },
  );

  // =====================================================
  // GIAO DIỆN
  // =====================================================

  return (
    <div className="khung-quan-ly-du-an">
      {/* THÔNG BÁO */}
      <div className="khung-chua-toast">
        {toastList.map((toast) => (
          <div
            key={toast.id}
            className={`thong-bao-item ${toast.type}`}
          >
            <div className="bieu-tuong-toast">
              {toast.type === "thanh-cong" && (
                <CheckCircle2 size={20} />
              )}

              {toast.type === "loi" && (
                <AlertCircle size={20} />
              )}

              {toast.type === "thong-tin" && (
                <Info size={20} />
              )}

              {toast.type === "can-bao" && (
                <AlertTriangle size={20} />
              )}
            </div>

            <div className="noi-dung-toast">
              <div className="tieu-de-thong-bao">
                {toast.title}
              </div>

              <div className="chi-tiet-thong-bao">
                {toast.message}
              </div>
            </div>

            <button
              className="nut-dong-toast"
              onClick={() => removeToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {selectedProject ? (
        <div>
          {/* HEADER DỰ ÁN */}
          <div
            className="phan-header-kanban"
            style={{ marginBottom: "16px" }}
          >
            <button
              className="nut-quay-lai"
              onClick={() => setSelectedProject(null)}
            >
              <ArrowLeft size={16} />
              <span>Quay lại Danh sách Dự án</span>
            </button>

            <div className="khung-tieu-de-kanban">
              <div className="avatar-du-an">
                {selectedProject.name
                  ?.charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h3 className="tieu-de-du-an-kanban">
                  {selectedProject.name}
                </h3>

                <span
                  className="nhan-ma-moi"
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "4px",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Mã:{" "}
                    <strong
                      style={{ color: "#38bdf8" }}
                    >
                      {selectedProject.join_code ||
                        "Chưa có"}
                    </strong>
                  </span>

                  <span
                    style={{
                      background: isProjectOwner
                        ? "#6366f1"
                        : isAnyGroupLeader
                          ? "#f59e0b"
                          : "#334155",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    {isProjectOwner
                      ? "Chủ dự án (Owner)"
                      : isAnyGroupLeader
                        ? "Trưởng nhóm (Leader)"
                        : "Thành viên (Member)"}
                  </span>
                </span>
              </div>
            </div>

            {activeTab === "kanban" &&
              canManageKanban && (
                <button
                  className="nut-chinh"
                  onClick={() =>
                    openCreateTaskModal("todo")
                  }
                >
                  <Plus size={16} />
                  <span>Tạo Task Mới</span>
                </button>
              )}
          </div>

          {/* TAB CHUYỂN ĐỔI GIAO DIỆN */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid #334155",
              paddingBottom: "12px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() =>
                setActiveTab("overview")
              }
              style={{
                background:
                  activeTab === "overview"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <BarChart2 size={15} />
              Tổng quan dự án
            </button>

            <button
              onClick={() =>
                setActiveTab("kanban")
              }
              style={{
                background:
                  activeTab === "kanban"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FolderKanban size={15} />
              Bảng Kanban
            </button>

            <button
              onClick={() =>
                setActiveTab("groups")
              }
              style={{
                background:
                  activeTab === "groups"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Users size={15} />
              Nhóm & Phân quyền Trưởng nhóm
            </button>

            <button
              onClick={() =>
                setActiveTab("code")
              }
              style={{
                background:
                  activeTab === "code"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Code2 size={15} />
              Quản lý Code
            </button>

            <button
              onClick={() =>
                setActiveTab("review")
              }
              style={{
                background:
                  activeTab === "review"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileCode size={15} />
              Code Review
            </button>

            <button
              onClick={() =>
                setActiveTab("cost")
              }
              style={{
                background:
                  activeTab === "cost"
                    ? "#4f46e5"
                    : "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <DollarSign size={15} />
              Tính chi phí dự án
            </button>
          </div>

          {/* =================================================
              0. TỔNG QUAN DỰ ÁN
          ================================================= */}

          {activeTab === "overview" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                color: "#e2e8f0",
              }}
            >
              {/* THÔNG TIN CHUNG */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #1e293b, #172554)",
                  border: "1px solid #334155",
                  borderRadius: "14px",
                  padding: "22px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "21px",
                          fontWeight: 700,
                          color: "#f8fafc",
                        }}
                      >
                        {selectedProject.name}
                      </h2>

                      <span
                        style={{
                          background:
                            selectedProject.status ===
                            "completed"
                              ? "rgba(52,211,153,0.15)"
                              : "rgba(56,189,248,0.15)",
                          color:
                            selectedProject.status ===
                            "completed"
                              ? "#34d399"
                              : "#38bdf8",
                          padding: "5px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {projectStatusLabel}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: "#cbd5e1",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {selectedProject.description ||
                        "Dự án chưa có mô tả."}
                    </p>
                  </div>

                  <div
                    style={{
                      background: "rgba(15,23,42,0.6)",
                      border: "1px solid #475569",
                      borderRadius: "10px",
                      padding: "12px 16px",
                      minWidth: "160px",
                    }}
                  >
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "5px",
                      }}
                    >
                      Mã tham gia dự án
                    </div>

                    <div
                      style={{
                        color: "#38bdf8",
                        fontWeight: 700,
                        fontSize: "18px",
                        letterSpacing: "1px",
                      }}
                    >
                      {selectedProject.join_code ||
                        "Chưa có"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "14px",
                    marginTop: "22px",
                    paddingTop: "18px",
                    borderTop: "1px solid #334155",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <Clock
                        size={13}
                        style={{
                          display: "inline",
                          marginRight: "5px",
                        }}
                      />
                      Ngày bắt đầu
                    </div>

                    <strong style={{ fontSize: "14px" }}>
                      {formatProjectDate(
                        selectedProject.start_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <Clock
                        size={13}
                        style={{
                          display: "inline",
                          marginRight: "5px",
                        }}
                      />
                      Ngày kết thúc
                    </div>

                    <strong style={{ fontSize: "14px" }}>
                      {formatProjectDate(
                        selectedProject.end_date,
                      )}
                    </strong>
                  </div>

                  <div>
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <Users
                        size={13}
                        style={{
                          display: "inline",
                          marginRight: "5px",
                        }}
                      />
                      Vai trò của bạn
                    </div>

                    <strong style={{ fontSize: "14px" }}>
                      {isProjectOwner
                        ? "Chủ dự án"
                        : isAnyGroupLeader
                          ? "Trưởng nhóm"
                          : "Thành viên"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* CÁC THẺ THỐNG KÊ */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "14px",
                }}
              >
                {[
                  {
                    label: "Tổng công việc",
                    value: totalTasks,
                    icon: <FolderKanban size={21} />,
                    color: "#818cf8",
                    background:
                      "rgba(99,102,241,0.15)",
                  },
                  {
                    label: "Đang thực hiện",
                    value: inProgressTasks,
                    icon: <Clock size={21} />,
                    color: "#fbbf24",
                    background:
                      "rgba(245,158,11,0.15)",
                  },
                  {
                    label: "Đã hoàn thành",
                    value: completedTasks,
                    icon: <CheckSquare size={21} />,
                    color: "#34d399",
                    background:
                      "rgba(52,211,153,0.15)",
                  },
                  {
                    label: "Thành viên",
                    value: totalMembers,
                    icon: <Users size={21} />,
                    color: "#38bdf8",
                    background:
                      "rgba(56,189,248,0.15)",
                  },
                  {
                    label: "Nhóm",
                    value: totalGroups,
                    icon: <FolderPlus size={21} />,
                    color: "#c084fc",
                    background:
                      "rgba(192,132,252,0.15)",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      padding: "17px",
                      display: "flex",
                      alignItems: "center",
                      gap: "13px",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: item.background,
                        color: item.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>

                    <div>
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "12px",
                          marginBottom: "5px",
                        }}
                      >
                        {item.label}
                      </div>

                      <div
                        style={{
                          color: "#f8fafc",
                          fontSize: "23px",
                          fontWeight: 700,
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TIẾN ĐỘ DỰ ÁN */}
              <div
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        color: "#f8fafc",
                        fontSize: "16px",
                      }}
                    >
                      Tiến độ hoàn thành dự án
                    </h3>

                    <p
                      style={{
                        margin: "5px 0 0",
                        color: "#94a3b8",
                        fontSize: "12px",
                      }}
                    >
                      Tỷ lệ Task cấp dự án đã hoàn thành
                    </p>
                  </div>

                  <strong
                    style={{
                      fontSize: "26px",
                      color: "#34d399",
                    }}
                  >
                    {isLoadingTasks
                      ? "..."
                      : `${projectProgress}%`}
                  </strong>
                </div>

                <div
                  style={{
                    height: "12px",
                    background: "#0f172a",
                    borderRadius: "20px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${projectProgress}%`,
                      background:
                        "linear-gradient(90deg, #6366f1, #34d399)",
                      borderRadius: "20px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: "12px",
                    marginTop: "18px",
                  }}
                >
                  {[
                    {
                      label: "Cần làm",
                      value: todoTasks,
                      color: "#94a3b8",
                    },
                    {
                      label: "Đang thực hiện",
                      value: inProgressTasks,
                      color: "#fbbf24",
                    },
                    {
                      label: "Đang kiểm tra",
                      value: reviewTasks,
                      color: "#38bdf8",
                    },
                    {
                      label: "Hoàn thành",
                      value: completedTasks,
                      color: "#34d399",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#cbd5e1",
                        fontSize: "13px",
                      }}
                    >
                      <span
                        style={{
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          background: item.color,
                          flexShrink: 0,
                        }}
                      />

                      <span>{item.label}</span>

                      <strong
                        style={{
                          color: "#f8fafc",
                          marginLeft: "auto",
                        }}
                      >
                        {isLoadingTasks
                          ? "..."
                          : item.value}
                      </strong>
                    </div>
                  ))}
                </div>

                {totalTasks === 0 &&
                  !isLoadingTasks && (
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        margin: "14px 0 0",
                      }}
                    >
                      Dự án chưa có Task cấp dự án để
                      tính tiến độ.
                    </p>
                  )}
              </div>

              {/* DANH SÁCH NHÓM */}
              <div
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      color: "#f8fafc",
                      fontSize: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Users size={18} color="#c084fc" />
                    Các nhóm trong dự án
                  </h3>

                  <button
                    onClick={() =>
                      setActiveTab("groups")
                    }
                    style={{
                      border: "1px solid #475569",
                      background: "#0f172a",
                      color: "#cbd5e1",
                      borderRadius: "7px",
                      padding: "7px 11px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Quản lý nhóm
                    <ArrowRight
                      size={13}
                      style={{
                        display: "inline",
                        marginLeft: "5px",
                        verticalAlign: "middle",
                      }}
                    />
                  </button>
                </div>

                {groups.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "9px",
                          padding: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "9px",
                            marginBottom: "9px",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              background:
                                "rgba(192,132,252,0.15)",
                              color: "#c084fc",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <FolderKanban size={17} />
                          </div>

                          <strong
                            style={{
                              color: "#f8fafc",
                              fontSize: "14px",
                            }}
                          >
                            {group.name}
                          </strong>
                        </div>

                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: "12px",
                          }}
                        >
                          Trưởng nhóm:{" "}
                          <span
                            style={{ color: "#e2e8f0" }}
                          >
                            {group.leader ||
                              group.leader_name ||
                              "Chưa phân công"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "20px",
                      fontSize: "13px",
                    }}
                  >
                    Chưa có nhóm nào trong dự án.
                  </div>
                )}
              </div>

              {/* DANH SÁCH TASK */}
              <div
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      color: "#f8fafc",
                      fontSize: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckSquare
                      size={18}
                      color="#818cf8"
                    />
                    Công việc gần đây
                  </h3>

                  <button
                    onClick={() =>
                      setActiveTab("kanban")
                    }
                    style={{
                      border: "1px solid #475569",
                      background: "#0f172a",
                      color: "#cbd5e1",
                      borderRadius: "7px",
                      padding: "7px 11px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Xem Kanban
                    <ArrowRight
                      size={13}
                      style={{
                        display: "inline",
                        marginLeft: "5px",
                        verticalAlign: "middle",
                      }}
                    />
                  </button>
                </div>

                {isLoadingTasks ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "#94a3b8",
                    }}
                  >
                    <Loader2
                      size={24}
                      className="icon-quay"
                    />
                    <p>Đang tải công việc...</p>
                  </div>
                ) : projectTasks.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "9px",
                    }}
                  >
                    {projectTasks
                      .slice(0, 8)
                      .map((task) => (
                        <div
                          key={task.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                            background: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            padding: "12px 14px",
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            <div
                              style={{
                                color: "#f8fafc",
                                fontSize: "13px",
                                fontWeight: 600,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {task.title}
                            </div>

                            <div
                              style={{
                                color: "#94a3b8",
                                fontSize: "11px",
                                marginTop: "5px",
                              }}
                            >
                              Người thực hiện:{" "}
                              {task.assignee ||
                                "Chưa phân công"}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                background:
                                  "rgba(148,163,184,0.12)",
                                color:
                                  getTaskPriorityColor(
                                    task.priority,
                                  ),
                                border: `1px solid ${getTaskPriorityColor(
                                  task.priority,
                                )}55`,
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                              }}
                            >
                              Ưu tiên:{" "}
                              {getTaskPriorityLabel(
                                task.priority,
                              )}
                            </span>

                            <span
                              style={{
                                background:
                                  `${getTaskStatusColor(task.status)}18`,
                                color:
                                  getTaskStatusColor(
                                    task.status,
                                  ),
                                border: `1px solid ${getTaskStatusColor(
                                  task.status,
                                )}55`,
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getTaskStatusLabel(
                                task.status,
                              )}
                            </span>
                          </div>
                        </div>
                      ))}

                    {projectTasks.length > 8 && (
                      <div
                        style={{
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: "12px",
                          paddingTop: "5px",
                        }}
                      >
                        Hiển thị 8/{projectTasks.length}{" "}
                        công việc. Chuyển sang Kanban để
                        xem toàn bộ.
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "20px",
                      fontSize: "13px",
                    }}
                  >
                    Dự án chưa có công việc nào.
                  </div>
                )}
              </div>

              {/* DANH SÁCH THÀNH VIÊN */}
              <div
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      color: "#f8fafc",
                      fontSize: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Users size={18} color="#38bdf8" />
                    Thành viên dự án
                  </h3>

                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: "12px",
                    }}
                  >
                    {isLoadingMembers
                      ? "Đang tải..."
                      : `${totalMembers} thành viên`}
                  </span>
                </div>

                {isLoadingMembers ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "#94a3b8",
                    }}
                  >
                    <Loader2
                      size={24}
                      className="icon-quay"
                    />
                    <p>Đang tải thành viên...</p>
                  </div>
                ) : projectMembers.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {projectMembers.map((member) => (
                      <div
                        key={member.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "11px",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "9px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background:
                              "rgba(56,189,248,0.15)",
                            color: "#38bdf8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {(member.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              color: "#f8fafc",
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                          >
                            {member.name ||
                              "Chưa cập nhật tên"}
                          </div>

                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: "11px",
                              overflowWrap: "anywhere",
                              marginTop: "3px",
                            }}
                          >
                            {member.email || ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "20px",
                      fontSize: "13px",
                    }}
                  >
                    Chưa có thông tin thành viên.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1. BẢNG KANBAN */}
          {activeTab === "kanban" && (
            <>
              {!canManageKanban && (
                <div
                  style={{
                    background:
                      "rgba(245, 158, 11, 0.1)",
                    border:
                      "1px solid rgba(245, 158, 11, 0.3)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    color: "#fbbf24",
                    fontSize: "13px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Lock size={16} />
                  Bạn đang truy cập dưới quyền Thành viên.
                  Chỉ Chủ dự án mới có quyền Thêm / Sửa /
                  Xóa công việc.
                </div>
              )}

              <div className="thanh-thong-ke-kanban">
                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background:
                        "rgba(99, 102, 241, 0.2)",
                      color: "#818cf8",
                    }}
                  >
                    <FolderKanban size={20} />
                  </div>

                  <div className="thong-tin-thong-ke">
                    <h5>Tổng công việc</h5>
                    <p>{projectTasks.length} Tasks</p>
                  </div>
                </div>

                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background:
                        "rgba(245, 158, 11, 0.2)",
                      color: "#fbbf24",
                    }}
                  >
                    <Clock size={20} />
                  </div>

                  <div className="thong-tin-thong-ke">
                    <h5>Đang thực hiện</h5>
                    <p>
                      {
                        projectTasks.filter(
                          (task) =>
                            task.status === "in_progress",
                        ).length
                      }{" "}
                      Tasks
                    </p>
                  </div>
                </div>

                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background:
                        "rgba(52, 211, 153, 0.2)",
                      color: "#34d399",
                    }}
                  >
                    <CheckSquare size={20} />
                  </div>

                  <div className="thong-tin-thong-ke">
                    <h5>Hoàn thành</h5>
                    <p>
                      {
                        projectTasks.filter(
                          (task) =>
                            task.status === "done",
                        ).length
                      }{" "}
                      Tasks
                    </p>
                  </div>
                </div>

                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background:
                        "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                    }}
                  >
                    <BarChart2 size={20} />
                  </div>

                  <div className="thong-tin-thong-ke">
                    <h5>Tiến độ dự án</h5>
                    <p>
                      {projectTasks.length > 0
                        ? Math.round(
                            (projectTasks.filter(
                              (task) =>
                                task.status === "done",
                            ).length /
                              projectTasks.length) *
                              100,
                          )
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <KanbanBoard
                projectTasks={projectTasks}
                isLoadingTasks={isLoadingTasks}
                changeTaskStatus={changeTaskStatus}
                openTaskModal={openCreateTaskModal}
                editTask={openEditTaskModal}
                deleteTask={handleDeleteTask}
                canManage={canManageKanban}
              />
            </>
          )}

          {/* 2. TAB QUẢN LÝ NHÓM */}
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
              currentUserName={currentUserName}
              currentUserEmail={currentUserEmail}
              showNotification={showNotification}
            />
          )}

          {/* 3. CODE MANAGEMENT */}
          {activeTab === "code" && (
            <CodeManagement
              projectId={selectedProject.id}
              role={selectedProject.role}
              showNotification={showNotification}
            />
          )}

          {/* 4. CODE REVIEW */}
          {activeTab === "review" && (
            <CodeReview
              projectId={selectedProject.id}
              showNotification={showNotification}
            />
          )}

          {/* 5. TÍNH CHI PHÍ DỰ ÁN */}
          {activeTab === "cost" && (
            <ProjectCostCalculator
              projectId={selectedProject.id}
              isProjectOwner={isProjectOwner}
              projectTasks={projectTasks}
              showNotification={showNotification}
            />
          )}
        </div>
      ) : (
        <>
          {/* TRANG DANH SÁCH DỰ ÁN */}
          <div className="tieu-de-trang-quan-ly">
            <h2 className="tieu-de-chinh">
              Quản lý Dự án
            </h2>

            <p className="tieu-de-phu">
              Khởi tạo dự án mới, phân quyền Trưởng nhóm
              và theo dõi tiến độ công việc
            </p>
          </div>

          <div className="luoi-hanh-dong-du-an">
            {/* TẠO DỰ ÁN */}
            <div className="the-hanh-dong">
              <div className="bieu-tuong-the">
                <FolderPlus size={22} />
              </div>

              <h3>Tạo Dự Án Mới</h3>

              <p className="mo-ta-the">
                Thiết lập không gian quản lý tiến độ và
                công việc riêng cho đội ngũ của bạn
              </p>

              <button
                type="button"
                className="nut-chinh"
                onClick={openCreateProject}
              >
                <FolderPlus size={16} />
                <span>Tạo Dự Án</span>
              </button>
            </div>

            {/* THAM GIA DỰ ÁN */}
            <div className="the-hanh-dong">
              <div className="bieu-tuong-the phu">
                <UserPlus size={22} />
              </div>

              <h3>Tham Gia Dự Án</h3>

              <p className="mo-ta-the">
                Nhập mã mời (Join Code) được chia sẻ từ
                quản trị viên để tham gia
              </p>

              <form
                onSubmit={handleJoinProject}
                className="form-hanh-dong"
              >
                <div className="nhom-nhap-lieu">
                  <KeyRound
                    size={18}
                    className="bieu-tuong-input"
                  />

                  <input
                    type="text"
                    placeholder="Nhập mã tham gia (VD: DEV-8892)..."
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value)
                    }
                    className="o-nhap-lieu"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isJoiningProject}
                  className="nut-phu"
                >
                  {isJoiningProject ? (
                    <Loader2
                      size={16}
                      className="icon-quay"
                    />
                  ) : (
                    <ArrowRight size={16} />
                  )}

                  <span>
                    {isJoiningProject
                      ? "Đang tham gia..."
                      : "Tham Gia Ngay"}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* DANH SÁCH DỰ ÁN */}
          <div className="khung-danh-sach-du-an">
            <div className="thanh-tieu-de-section">
              <div className="nhom-tieu-de">
                <FolderKanban
                  size={20}
                  className="icon-tieu-de"
                />

                <h3>
                  Dự án của bạn ({filteredProjects.length})
                </h3>
              </div>

              <div className="nhom-cong-cu">
                <div className="khung-tim-kiem">
                  <Search
                    size={16}
                    className="icon-tim-kiem"
                  />

                  <input
                    type="text"
                    placeholder="Tìm kiếm dự án hoặc mã..."
                    value={searchKeyword}
                    onChange={(e) =>
                      setSearchKeyword(e.target.value)
                    }
                  />
                </div>

                <select
                  className="bo-loc-select"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                >
                  <option value="all">
                    Tất cả trạng thái
                  </option>

                  <option value="active">
                    Đang thực hiện
                  </option>

                  <option value="completed">
                    Đã hoàn thành
                  </option>
                </select>

                <div className="chuyen-che-do-xem">
                  <button
                    className={`nut-che-do ${
                      viewMode === "grid"
                        ? "dang-chon"
                        : ""
                    }`}
                    onClick={() =>
                      setViewMode("grid")
                    }
                    title="Chế độ Lưới"
                  >
                    <LayoutGrid size={16} />
                  </button>

                  <button
                    className={`nut-che-do ${
                      viewMode === "list"
                        ? "dang-chon"
                        : ""
                    }`}
                    onClick={() =>
                      setViewMode("list")
                    }
                    title="Chế độ Danh sách"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {isLoadingProjects ? (
              <div className="trang-thai-trong">
                <Loader2
                  size={48}
                  className="icon-quay"
                />

                <p>Đang tải danh sách dự án...</p>
              </div>
            ) : filteredProjects.length > 0 ? (
              viewMode === "grid" ? (
                <div className="luoi-the-du-an">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      viewMode="grid"
                      copiedId={copiedId}
                      copyJoinCode={copyJoinCode}
                      setSelectedProject={setSelectedProject}
                      handleDeleteProject={
                        handleDeleteProject
                      }
                      onEditProject={openEditProject}
                      onCompleteProject={
                        markProjectComplete
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="danh-sach-dang-dong">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      viewMode="list"
                      copiedId={copiedId}
                      copyJoinCode={copyJoinCode}
                      setSelectedProject={setSelectedProject}
                      handleDeleteProject={
                        handleDeleteProject
                      }
                      onEditProject={openEditProject}
                      onCompleteProject={
                        markProjectComplete
                      }
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="trang-thai-trong">
                <FolderKanban
                  size={48}
                  className="icon-trong"
                />

                <p>
                  {searchKeyword
                    ? `Không tìm thấy dự án nào khớp với "${searchKeyword}"`
                    : "Chưa có dự án nào trong danh sách. Hãy khởi tạo hoặc tham gia dự án ngay!"}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL TẠO / CHỈNH SỬA DỰ ÁN */}
      {isProjectModalOpen && (
        <div
          className="lop-phu-modal"
          onClick={() =>
            !isCreatingProject &&
            setIsProjectModalOpen(false)
          }
        >
          <div
            className="noi-dung-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="header-modal">
              <h4 className="tieu-de-modal">
                {editingProjectId
                  ? "Chỉnh Sửa Dự Án"
                  : "Tạo Dự Án Mới"}
              </h4>

              <button
                type="button"
                className="nut-dong-modal"
                disabled={isCreatingProject}
                onClick={() =>
                  setIsProjectModalOpen(false)
                }
                aria-label="Đóng form tạo dự án"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="nhom-form-group">
                <label
                  className="nhan-form"
                  htmlFor="project-name"
                >
                  Tên dự án *
                </label>

                <input
                  id="project-name"
                  className="input-form"
                  type="text"
                  maxLength={255}
                  required
                  autoFocus
                  placeholder="VD: Website Quản Lý Công Việc CNTT"
                  value={projectForm.name}
                  onChange={(e) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              {/* MÔ TẢ CHI TIẾT DỰ ÁN */}
              <div className="nhom-form-group">
                <label
                  className="nhan-form"
                  htmlFor="project-description"
                >
                  Mô tả chi tiết dự án
                </label>

                <textarea
                  id="project-description"
                  className="textarea-form"
                  rows={8}
                  placeholder="Nhập mô tả chi tiết dự án: mục tiêu, phạm vi, yêu cầu chức năng, công nghệ sử dụng, kế hoạch triển khai, các yêu cầu và thông tin liên quan..."
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    minHeight: "180px",
                    resize: "vertical",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                />
              </div>

              <div className="luoi-hai-cot-modal">
                <div className="nhom-form-group">
                  <label
                    className="nhan-form"
                    htmlFor="project-start"
                  >
                    Ngày bắt đầu *
                  </label>

                  <input
                    id="project-start"
                    type="date"
                    className="input-form"
                    required
                    value={projectForm.start_date}
                    max={
                      projectForm.end_date || undefined
                    }
                    onChange={(e) =>
                      setProjectForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="nhom-form-group">
                  <label
                    className="nhan-form"
                    htmlFor="project-end"
                  >
                    Ngày kết thúc *
                  </label>

                  <input
                    id="project-end"
                    type="date"
                    className="input-form"
                    required
                    min={
                      projectForm.start_date || undefined
                    }
                    value={projectForm.end_date}
                    onChange={(e) =>
                      setProjectForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="chan-modal">
                <button
                  type="button"
                  className="nut-hanh-dong-the xem"
                  disabled={isCreatingProject}
                  onClick={() =>
                    setIsProjectModalOpen(false)
                  }
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="nut-chinh"
                  disabled={isCreatingProject}
                >
                  {isCreatingProject ? (
                    <Loader2
                      size={16}
                      className="icon-quay"
                    />
                  ) : (
                    <FolderPlus size={16} />
                  )}

                  <span>
                    {isCreatingProject
                      ? "Đang lưu..."
                      : editingProjectId
                        ? "Lưu Thay Đổi"
                        : "Tạo Dự Án"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO / CHỈNH SỬA TASK */}
      {isTaskModalOpen && (
        <div
          className="lop-phu-modal"
          onClick={() => {
            if (!savingTask) {
              setIsTaskModalOpen(false);
            }
          }}
        >
          <div
            className="noi-dung-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="header-modal">
              <h4 className="tieu-de-modal">
                {editingTaskId
                  ? "Chỉnh Sửa Công Việc"
                  : "Tạo Task Mới cho Dự Án"}
              </h4>

              <button
                type="button"
                className="nut-dong-modal"
                disabled={savingTask}
                onClick={() =>
                  setIsTaskModalOpen(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask}>
              {/* TÊN TASK */}
              <div className="nhom-form-group">
                <label className="nhan-form">
                  Tên công việc / Task
                </label>

                <input
                  type="text"
                  className="input-form"
                  placeholder="VD: Thiết kế API Đăng nhập OAuth2..."
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              {/* MÔ TẢ */}
              <div className="nhom-form-group">
                <label className="nhan-form">
                  Mô tả chi tiết
                </label>

                <textarea
                  className="textarea-form"
                  placeholder="Yêu cầu công việc, tài liệu tham khảo..."
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              {/* ĐỘ ƯU TIÊN VÀ NGƯỜI THỰC HIỆN */}
              <div className="luoi-hai-cot-modal">
                <div className="nhom-form-group">
                  <label className="nhan-form">
                    Mức độ ưu tiên
                  </label>

                  <select
                    className="select-form"
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">
                      Trung bình
                    </option>
                    <option value="high">Cao</option>
                  </select>
                </div>

                <div className="nhom-form-group">
                  <label className="nhan-form">
                    Người thực hiện
                  </label>

                  <select
                    className="select-form"
                    value={taskForm.assignee}
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        assignee: e.target.value,
                      }))
                    }
                    disabled={isLoadingMembers}
                    style={{ width: "100%" }}
                  >
                    <option value="">
                      {isLoadingMembers
                        ? "Đang tải thành viên..."
                        : "-- Chọn thành viên --"}
                    </option>

                    {projectMembers.map((member) => (
                      <option
                        key={member.id}
                        value={member.name}
                      >
                        {member.name}
                        {member.email
                          ? ` (${member.email})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* NHÓM CHỊU TRÁCH NHIỆM */}
              <div className="nhom-form-group">
                <label className="nhan-form">
                  Nhóm chịu trách nhiệm
                </label>

                <select
                  className="select-form"
                  value={taskGroupId}
                  onChange={(e) =>
                    setTaskGroupId(e.target.value)
                  }
                  disabled={
                    loadingTaskGroups || savingTask
                  }
                  style={{ width: "100%" }}
                >
                  <option value="">
                    -- Chưa giao cho nhóm --
                  </option>

                  {groups.map((group) => (
                    <option
                      key={group.id}
                      value={group.id}
                    >
                      {group.name}
                      {group.leader
                        ? ` — Leader: ${group.leader}`
                        : ""}
                    </option>
                  ))}
                </select>

                <small
                  style={{
                    color: "#94a3b8",
                    display: "block",
                    marginTop: 6,
                  }}
                >
                  {loadingTaskGroups
                    ? "Đang kiểm tra phân công hiện tại..."
                    : "Chỉ Owner được phân công. Task sẽ xuất hiện trong Kanban của nhóm đã chọn."}
                </small>
              </div>

              {/* DEADLINE */}
              <div className="nhom-form-group">
                <label className="nhan-form">
                  Hạn hoàn thành (Deadline)
                </label>

                <input
                  type="date"
                  className="input-form"
                  value={taskForm.deadline}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      deadline: e.target.value,
                    }))
                  }
                />
              </div>

              {/* ƯỚC LƯỢNG THỜI GIAN TASK */}
              <div
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <Clock
                    size={17}
                    color="#38bdf8"
                  />

                  <h4
                    style={{
                      color: "#38bdf8",
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    Thời gian dự kiến hoàn thành
                  </h4>
                </div>

                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    margin: "0 0 14px",
                    lineHeight: 1.5,
                  }}
                >
                  Nhập ba mức ước lượng thời gian cho
                  Task. Đơn vị tính là ngày, tối đa 7
                  ngày. Các trường có thể để trống.
                </p>

                <div className="luoi-hai-cot-modal">
                  <div className="nhom-form-group">
                    <label
                      className="nhan-form"
                      htmlFor="task-estimated-best"
                    >
                      Tốt nhất (ngày)
                    </label>

                    <input
                      id="task-estimated-best"
                      type="number"
                      className="input-form"
                      min="0.01"
                      max="7"
                      step="0.01"
                      placeholder="VD: 1"
                      value={
                        taskForm.estimated_best_days
                      }
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          estimated_best_days:
                            e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="nhom-form-group">
                    <label
                      className="nhan-form"
                      htmlFor="task-estimated-average"
                    >
                      Trung bình (ngày)
                    </label>

                    <input
                      id="task-estimated-average"
                      type="number"
                      className="input-form"
                      min="0.01"
                      max="7"
                      step="0.01"
                      placeholder="VD: 2"
                      value={
                        taskForm.estimated_average_days
                      }
                      onChange={(e) =>
                        setTaskForm((prev) => ({
                          ...prev,
                          estimated_average_days:
                            e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="nhom-form-group">
                  <label
                    className="nhan-form"
                    htmlFor="task-estimated-worst"
                  >
                    Tệ nhất (ngày)
                  </label>

                  <input
                    id="task-estimated-worst"
                    type="number"
                    className="input-form"
                    min="0.01"
                    max="7"
                    step="0.01"
                    placeholder="VD: 3"
                    value={
                      taskForm.estimated_worst_days
                    }
                    onChange={(e) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        estimated_worst_days:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  Điều kiện: Tốt nhất ≤ Trung bình ≤ Tệ
                  nhất. Đây là thời gian dự kiến, không
                  phải thời gian thực tế đã làm.
                </small>
              </div>

              {/* NÚT LƯU */}
              <div className="chan-modal">
                <button
                  type="button"
                  className="nut-hanh-dong-the xem"
                  disabled={savingTask}
                  onClick={() =>
                    setIsTaskModalOpen(false)
                  }
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="nut-chinh"
                  disabled={
                    savingTask || loadingTaskGroups
                  }
                >
                  {savingTask ? (
                    <>
                      <Loader2
                        size={16}
                        className="icon-quay"
                      />
                      Đang lưu...
                    </>
                  ) : editingTaskId ? (
                    "Lưu Thay Đổi"
                  ) : (
                    "Tạo Task ngay"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

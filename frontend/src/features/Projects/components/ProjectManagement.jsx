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
  LayoutDashboard,
} from "lucide-react";
import "../ProjectManagement.css";

import ProjectCard from "./ProjectCard";
import KanbanBoard from "./KanbanBoard";
import CodeManagement from "./CodeManagement";
import CodeReview from "./CodeReview";
import ProjectChat from "./ProjectChat";
import GroupManagement from "./GroupManagement";
import ProjectCostCalculator from "./ProjectCostCalculator";
import ProjectDashboard from "./ProjectDashboard";
async function sendAuthenticatedRequest(apiPath, options = {}) {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Người dùng chưa đăng nhập");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`http://127.0.0.1:8000/api${apiPath}`, {
    ...options,
    headers,
  });
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || "Đã có lỗi xảy ra");
  return data;
}

export default function ProjectManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const currentUserName = currentUser?.name || "";
  const currentUserEmail = currentUser?.email || "";

  const [projectList, setProjectList] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const [activeTab, setActiveTab] = useState("kanban");
  useEffect(() => {
    const returnProjectId = location.state?.returnProjectId;

    if (!returnProjectId || projectList.length === 0) return;

    const project = projectList.find(
      (item) => String(item.id) === String(returnProjectId),
    );

    if (project) {
      setSelectedProject(project);
      setActiveTab(location.state?.returnTab || "kanban");

      navigate("/project", { replace: true, state: null });
    }
  }, [location.state, projectList, navigate]);

  // Nhóm và quyền lấy từ Backend; không sử dụng dữ liệu mẫu.
  const [groups, setGroups] = useState([]);
  const isProjectOwner = selectedProject?.role === "owner";
  const isAnyGroupLeader = groups.some((g) => g.leader_id === currentUser?.id);
  // Kanban dự án chỉ Owner có quyền sửa Task theo API backend/main.py.
  const canManageKanban = isProjectOwner;

  const [editingProjectId, setEditingProjectId] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
  });
  const [joinCode, setJoinCode] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentTaskColumn, setCurrentTaskColumn] = useState("todo");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskGroupId, setTaskGroupId] = useState("");
  const [taskGroupAssignments, setTaskGroupAssignments] = useState({});
  const [loadingTaskGroups, setLoadingTaskGroups] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignee: "",
    deadline: "",
  });

  const [toastList, setToastList] = useState([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchProjectList();
    sendAuthenticatedRequest("/users/me")
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    setGroups([]);
    if (!selectedProject?.id) return;
    let active = true;
    sendAuthenticatedRequest(`/projects/${selectedProject.id}/groups`)
      .then((data) => {
        if (active) setGroups(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active)
          showNotification("loi", "Không tải được nhóm", error.message);
      });
    return () => {
      active = false;
    };
  }, [selectedProject?.id]);

  useEffect(() => {
    if (selectedProject) fetchProjectTasks(selectedProject.id);
  }, [selectedProject?.id]);

  useEffect(() => {
    const projectId = selectedProject?.id;
    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    setIsLoadingMembers(true);
    sendAuthenticatedRequest(`/projects/${projectId}/members`)
      .then((data) => setProjectMembers(Array.isArray(data) ? data : []))
      .catch((error) => {
        setProjectMembers([]);
        showNotification("loi", "Không tải được thành viên", error.message);
      })
      .finally(() => setIsLoadingMembers(false));
  }, [selectedProject?.id]);

  const showNotification = (type, title, message) => {
    const id = Date.now();
    setToastList((prev) => [...prev, { id, type, title, message }]);
    setTimeout(
      () => setToastList((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const removeToast = (id) =>
    setToastList((prev) => prev.filter((t) => t.id !== id));

  const fetchProjectList = async () => {
    setIsLoadingProjects(true);
    try {
      const data = await sendAuthenticatedRequest("/projects");
      setProjectList(data || []);
    } catch (error) {
      if (error.message.includes("chưa đăng nhập")) {
        navigate("/");
        return;
      }
      showNotification("loi", "Không tải được dự án", error.message);
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
      setProjectTasks(data || []);
    } catch (error) {
      showNotification("loi", "Không tải được công việc", error.message);
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
    setProjectForm({ name: "", description: "", start_date: "", end_date: "" });
    setIsProjectModalOpen(true);
  };

  const markProjectComplete = async (project) => {
    if (project.role !== "owner" || project.status === "completed") return;
    if (
      !window.confirm(
        `Đánh dấu dự án "${project.name}" đã hoàn thành? Dữ liệu và nhóm vẫn được giữ lại.`,
      )
    )
      return;
    try {
      const updated = await sendAuthenticatedRequest(
        `/projects/${project.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "completed" }),
        },
      );
      setProjectList((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      showNotification(
        "thanh-cong",
        "Hoàn thành dự án",
        `Đã kết thúc "${project.name}". Các nhóm chưa bị xóa.`,
      );
    } catch (error) {
      showNotification("loi", "Không hoàn thành được dự án", error.message);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const name = projectForm.name.trim();
    if (!name || !projectForm.start_date || !projectForm.end_date) {
      showNotification(
        "loi",
        "Thiếu thông tin",
        "Vui lòng nhập tên và thời gian dự án.",
      );
      return;
    }
    if (projectForm.end_date < projectForm.start_date) {
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
      const newProject = await sendAuthenticatedRequest(
        editingProjectId ? `/projects/${editingProjectId}` : "/projects",
        {
          method: editingProjectId ? "PUT" : "POST",
          body: JSON.stringify({
            name,
            description: projectForm.description.trim() || null,
            start_date: projectForm.start_date,
            end_date: projectForm.end_date,
          }),
        },
      );
      setProjectList((prev) =>
        editingProjectId
          ? prev.map((p) => (p.id === newProject.id ? newProject : p))
          : [newProject, ...prev],
      );
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
      const message =
        typeof error.message === "string"
          ? error.message
          : "Không thể tạo dự án";
      showNotification("loi", "Không tạo được dự án", message);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleJoinProject = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsJoiningProject(true);
    try {
      const joinedProject = await sendAuthenticatedRequest("/projects/join", {
        method: "POST",
        body: JSON.stringify({ join_code: joinCode.trim() }),
      });
      setProjectList((prev) => [joinedProject, ...prev]);
      showNotification(
        "thanh-cong",
        "Tham gia thành công",
        `Bạn đã vào dự án "${joinedProject.name}"`,
      );
      setJoinCode("");
    } catch (error) {
      showNotification("loi", "Lỗi tham gia", error.message);
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
    if (!window.confirm(`Bạn có chắc chắn muốn xóa/rời khỏi dự án "${name}"?`))
      return;
    try {
      await sendAuthenticatedRequest(`/projects/${id}`, { method: "DELETE" });
      setProjectList((prev) => prev.filter((item) => item.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
      showNotification(
        "can-bao",
        "Đã xóa dự án",
        `Đã gỡ bỏ "${name}" khỏi danh sách`,
      );
    } catch (error) {
      showNotification("loi", "Không xóa được dự án", error.message);
    }
  };

  const changeTaskStatus = async (taskId, targetStatus) => {
    const originalTask = projectTasks.find((t) => t.id === taskId);
    if (!originalTask) return;

    setProjectTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
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
        prev.map((t) => (t.id === taskId ? originalTask : t)),
      );
      showNotification("loi", "Không lưu được", error.message);
    }
  };

  // Đọc phân công hiện tại qua API Kanban nhóm đã có; không cần API mới.
  const loadTaskGroupAssignments = async () => {
    if (!selectedProject?.id || !isProjectOwner) return {};
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
      // Backend từ chối gỡ Task nếu đã có Subtask, nhằm bảo vệ dữ liệu.
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
      if (nextGroupId) updated[taskId] = nextGroupId;
      else delete updated[taskId];
      return updated;
    });
  };

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

    if (savingTask || loadingTaskGroups) return;
    setSavingTask(true);
    try {
      let savedTaskId = editingTaskId;
      if (editingTaskId) {
        const updatedTask = await sendAuthenticatedRequest(
          `/tasks/${editingTaskId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              title: taskForm.title.trim(),
              description: taskForm.description || null,
              status: currentTaskColumn,
              priority: taskForm.priority,
              assignee: taskForm.assignee || null,
              deadline: taskForm.deadline
                ? new Date(taskForm.deadline).toISOString()
                : null,
            }),
          },
        );
        setProjectTasks((prev) =>
          prev.map((t) =>
            t.id === editingTaskId ? updatedTask || { ...t, ...taskForm } : t,
          ),
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
            title: taskForm.title.trim(),
            description: taskForm.description || null,
            status: currentTaskColumn,
            priority: taskForm.priority,
            assignee: taskForm.assignee || null,
            deadline: taskForm.deadline
              ? new Date(taskForm.deadline).toISOString()
              : null,
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
        // Task đã lưu, giữ form mở để người dùng xử lý việc phân nhóm.
        return;
      }
      setIsTaskModalOpen(false);
      setEditingTaskId(null);
      setTaskForm({
        title: "",
        description: "",
        priority: "medium",
        assignee: "",
        deadline: "",
      });
    } catch (error) {
      showNotification("loi", "Không lưu được task", error.message);
    } finally {
      setSavingTask(false);
    }
  };

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
      .catch((error) =>
        showNotification("loi", "Không tải được nhóm phụ trách", error.message),
      );
    setCurrentTaskColumn(task.status);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      assignee: task.assignee || "",
      deadline: task.deadline ? task.deadline.split("T")[0] : "",
    });
    setIsTaskModalOpen(true);
  };

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
    loadTaskGroupAssignments().catch((error) =>
      showNotification("loi", "Không tải được nhóm phụ trách", error.message),
    );
    setCurrentTaskColumn(columnKey);
    setTaskForm({
      title: "",
      description: "",
      priority: "medium",
      assignee: "",
      deadline: "",
    });
    setIsTaskModalOpen(true);
  };

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
      setProjectTasks((prev) => prev.filter((t) => t.id !== taskId));
      showNotification("can-bao", "Đã xóa", `Đã xóa task "${title}"`);
    } catch (error) {
      showNotification("loi", "Không xóa được", error.message);
    }
  };

  const filteredProjects = projectList.filter((project) => {
    const matchesKeyword =
      project.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      project.join_code.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    return matchesKeyword && matchesStatus;
  });

  return (
    <div className="khung-quan-ly-du-an">
      <div className="khung-chua-toast">
        {toastList.map((toast) => (
          <div key={toast.id} className={`thong-bao-item ${toast.type}`}>
            <div className="bieu-tuong-toast">
              {toast.type === "thanh-cong" && <CheckCircle2 size={20} />}
              {toast.type === "loi" && <AlertCircle size={20} />}
              {toast.type === "thong-tin" && <Info size={20} />}
              {toast.type === "can-bao" && <AlertTriangle size={20} />}
            </div>
            <div className="noi-dung-toast">
              <div className="tieu-de-thong-bao">{toast.title}</div>
              <div className="chi-tiet-thong-bao">{toast.message}</div>
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
          <div className="phan-header-kanban" style={{ marginBottom: "16px" }}>
            <button
              className="nut-quay-lai"
              onClick={() => setSelectedProject(null)}
            >
              <ArrowLeft size={16} />
              <span>Quay lại Danh sách Dự án</span>
            </button>
            <div className="khung-tieu-de-kanban">
              <div className="avatar-du-an">
                {selectedProject.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="tieu-de-du-an-kanban">{selectedProject.name}</h3>
                <span
                  className="nhan-ma-moi"
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "4px",
                  }}
                >
                  <span>
                    Mã:{" "}
                    <strong style={{ color: "#38bdf8" }}>
                      {selectedProject.join_code}
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
            {activeTab === "kanban" && canManageKanban && (
              <button
                className="nut-chinh"
                onClick={() => openCreateTaskModal("todo")}
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
              onClick={() => setActiveTab("dashboard")}
              style={{
                background: activeTab === "dashboard" ? "#4f46e5" : "#1e293b",
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
              <LayoutDashboard size={15} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab("kanban")}
              style={{
                background: activeTab === "kanban" ? "#4f46e5" : "#1e293b",
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
              <FolderKanban size={15} /> Bảng Kanban
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              style={{
                background: activeTab === "groups" ? "#4f46e5" : "#1e293b",
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
              <Users size={15} /> Nhóm & Phân quyền Trưởng nhóm
            </button>
            <button
              onClick={() => setActiveTab("code")}
              style={{
                background: activeTab === "code" ? "#4f46e5" : "#1e293b",
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
              <Code2 size={15} /> Quản lý Code
            </button>
            <button
              onClick={() => setActiveTab("review")}
              style={{
                background: activeTab === "review" ? "#4f46e5" : "#1e293b",
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
              <FileCode size={15} /> Code Review
            </button>
            <button
              onClick={() => setActiveTab("cost")}
              style={{
                background: activeTab === "cost" ? "#4f46e5" : "#1e293b",
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
              <DollarSign size={15} /> Tính chi phí dự án
            </button>
          </div>
          {activeTab === "dashboard" && (
            <ProjectDashboard
              projectList={projectList}
              projectTasks={projectTasks}
              groups={groups}
            />
          )}
          {/* 1. BẢNG KANBAN */}
          {activeTab === "kanban" && (
            <>
              {!canManageKanban && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
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
                  <Lock size={16} /> Bạn đang truy cập dưới quyền Thành viên.
                  Chỉ Chủ dự án mới có quyền Thêm / Sửa / Xóa công việc.
                </div>
              )}

              <div className="thanh-thong-ke-kanban">
                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background: "rgba(99, 102, 241, 0.2)",
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
                      background: "rgba(245, 158, 11, 0.2)",
                      color: "#fbbf24",
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div className="thong-tin-thong-ke">
                    <h5>Đang thực hiện</h5>
                    <p>
                      {
                        projectTasks.filter((t) => t.status === "in_progress")
                          .length
                      }{" "}
                      Tasks
                    </p>
                  </div>
                </div>
                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background: "rgba(52, 211, 153, 0.2)",
                      color: "#34d399",
                    }}
                  >
                    <CheckSquare size={20} />
                  </div>
                  <div className="thong-tin-thong-ke">
                    <h5>Hoàn thành</h5>
                    <p>
                      {projectTasks.filter((t) => t.status === "done").length}{" "}
                      Tasks
                    </p>
                  </div>
                </div>
                <div className="the-thong-ke">
                  <div
                    className="nen-icon-thong-ke"
                    style={{
                      background: "rgba(56, 189, 248, 0.2)",
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
                            (projectTasks.filter((t) => t.status === "done")
                              .length /
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
              groups={groups}
              setGroups={setGroups}
              projectMembers={projectMembers}
              projectTasks={projectTasks}
              isProjectOwner={isProjectOwner}
              currentUserId={currentUser?.id}
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
              projectTasks={projectTasks}
              showNotification={showNotification}
            />
          )}
        </div>
      ) : (
        <>
          <div className="tieu-de-trang-quan-ly">
            <h2 className="tieu-de-chinh">Quản lý Dự án</h2>
            <p className="tieu-de-phu">
              Khởi tạo dự án mới, phân quyền Trưởng nhóm và theo dõi tiến độ
              công việc
            </p>
          </div>

          <div className="luoi-hanh-dong-du-an">
            <div className="the-hanh-dong">
              <div className="bieu-tuong-the">
                <FolderPlus size={22} />
              </div>
              <h3>Tạo Dự Án Mới</h3>
              <p className="mo-ta-the">
                Thiết lập không gian quản lý tiến độ và công việc riêng cho đội
                ngũ của bạn
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

            <div className="the-hanh-dong">
              <div className="bieu-tuong-the phu">
                <UserPlus size={22} />
              </div>
              <h3>Tham Gia Dự Án</h3>
              <p className="mo-ta-the">
                Nhập mã mời (Join Code) được chia sẻ từ quản trị viên để tham
                gia
              </p>
              <form onSubmit={handleJoinProject} className="form-hanh-dong">
                <div className="nhom-nhap-lieu">
                  <KeyRound size={18} className="bieu-tuong-input" />
                  <input
                    type="text"
                    placeholder="Nhập mã tham gia (VD: DEV-8892)..."
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
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
                    <Loader2 size={16} className="icon-quay" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  <span>
                    {isJoiningProject ? "Đang tham gia..." : "Tham Gia Ngay"}
                  </span>
                </button>
              </form>
            </div>
          </div>

          <div className="khung-danh-sach-du-an">
            <div className="thanh-tieu-de-section">
              <div className="nhom-tieu-de">
                <FolderKanban size={20} className="icon-tieu-de" />
                <h3>Dự án của bạn ({filteredProjects.length})</h3>
              </div>
              <div className="nhom-cong-cu">
                <div className="khung-tim-kiem">
                  <Search size={16} className="icon-tim-kiem" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm dự án hoặc mã..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                <select
                  className="bo-loc-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang thực hiện</option>
                  <option value="completed">Đã hoàn thành</option>
                </select>
                <div className="chuyen-che-do-xem">
                  <button
                    className={`nut-che-do ${viewMode === "grid" ? "dang-chon" : ""}`}
                    onClick={() => setViewMode("grid")}
                    title="Chế độ Lưới"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={`nut-che-do ${viewMode === "list" ? "dang-chon" : ""}`}
                    onClick={() => setViewMode("list")}
                    title="Chế độ Danh sách"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {isLoadingProjects ? (
              <div className="trang-thai-trong">
                <Loader2 size={48} className="icon-quay" />
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
                      handleDeleteProject={handleDeleteProject}
                      onEditProject={openEditProject}
                      onCompleteProject={markProjectComplete}
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
                      handleDeleteProject={handleDeleteProject}
                      onEditProject={openEditProject}
                      onCompleteProject={markProjectComplete}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="trang-thai-trong">
                <FolderKanban size={48} className="icon-trong" />
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

      {/* Modal tạo dự án */}
      {isProjectModalOpen && (
        <div
          className="lop-phu-modal"
          onClick={() => !isCreatingProject && setIsProjectModalOpen(false)}
        >
          <div className="noi-dung-modal" onClick={(e) => e.stopPropagation()}>
            <div className="header-modal">
              <h4 className="tieu-de-modal">
                {editingProjectId ? "Chỉnh Sửa Dự Án" : "Tạo Dự Án Mới"}
              </h4>
              <button
                type="button"
                className="nut-dong-modal"
                disabled={isCreatingProject}
                onClick={() => setIsProjectModalOpen(false)}
                aria-label="Đóng form tạo dự án"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="nhom-form-group">
                <label className="nhan-form" htmlFor="project-name">
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
                    setProjectForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="nhom-form-group">
                <label className="nhan-form" htmlFor="project-description">
                  Mô tả ngắn
                </label>
                <textarea
                  id="project-description"
                  className="textarea-form"
                  rows={3}
                  maxLength={1000}
                  placeholder="Mục tiêu và nội dung chính của dự án..."
                  value={projectForm.description}
                  onChange={(e) =>
                    setProjectForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="luoi-hai-cot-modal">
                <div className="nhom-form-group">
                  <label className="nhan-form" htmlFor="project-start">
                    Ngày bắt đầu *
                  </label>
                  <input
                    id="project-start"
                    type="date"
                    className="input-form"
                    required
                    value={projectForm.start_date}
                    max={projectForm.end_date || undefined}
                    onChange={(e) =>
                      setProjectForm((p) => ({
                        ...p,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="nhom-form-group">
                  <label className="nhan-form" htmlFor="project-end">
                    Ngày kết thúc *
                  </label>
                  <input
                    id="project-end"
                    type="date"
                    className="input-form"
                    required
                    min={projectForm.start_date || undefined}
                    value={projectForm.end_date}
                    onChange={(e) =>
                      setProjectForm((p) => ({
                        ...p,
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
                  onClick={() => setIsProjectModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="nut-chinh"
                  disabled={isCreatingProject}
                >
                  {isCreatingProject ? (
                    <Loader2 size={16} className="icon-quay" />
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

      {/* Modal Task */}
      {isTaskModalOpen && (
        <div
          className="lop-phu-modal"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <div className="noi-dung-modal" onClick={(e) => e.stopPropagation()}>
            <div className="header-modal">
              <h4 className="tieu-de-modal">
                {editingTaskId
                  ? "Chỉnh Sửa Công Việc"
                  : "Tạo Task Mới cho Dự Án"}
              </h4>
              <button
                className="nut-dong-modal"
                onClick={() => setIsTaskModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTask}>
              <div className="nhom-form-group">
                <label className="nhan-form">Tên công việc / Task</label>
                <input
                  type="text"
                  className="input-form"
                  placeholder="VD: Thiết kế API Đăng nhập OAuth2..."
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="nhom-form-group">
                <label className="nhan-form">Mô tả chi tiết</label>
                <textarea
                  className="textarea-form"
                  placeholder="Yêu cầu công việc, tài liệu tham khảo..."
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                />
              </div>
              <div className="luoi-hai-cot-modal">
                <div className="nhom-form-group">
                  <label className="nhan-form">Mức độ ưu tiên</label>
                  <select
                    className="select-form"
                    value={taskForm.priority}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, priority: e.target.value })
                    }
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                  </select>
                </div>
                <div className="nhom-form-group">
                  <label className="nhan-form">Người thực hiện</label>
                  <select
                    className="select-form"
                    value={taskForm.assignee}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, assignee: e.target.value })
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
                      <option key={member.id} value={member.name}>
                        {member.name} {member.email ? `(${member.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="nhom-form-group">
                <label className="nhan-form">Nhóm chịu trách nhiệm</label>
                <select
                  className="select-form"
                  value={taskGroupId}
                  onChange={(e) => setTaskGroupId(e.target.value)}
                  disabled={loadingTaskGroups || savingTask}
                  style={{ width: "100%" }}
                >
                  <option value="">-- Chưa giao cho nhóm --</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                      {group.leader ? ` — Leader: ${group.leader}` : ""}
                    </option>
                  ))}
                </select>
                <small
                  style={{ color: "#94a3b8", display: "block", marginTop: 6 }}
                >
                  {loadingTaskGroups
                    ? "Đang kiểm tra phân công hiện tại..."
                    : "Chỉ Owner được phân công. Task sẽ xuất hiện trong Kanban của nhóm đã chọn."}
                </small>
              </div>
              <div className="nhom-form-group">
                <label className="nhan-form">Hạn hoàn thành (Deadline)</label>
                <input
                  type="date"
                  className="input-form"
                  value={taskForm.deadline}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, deadline: e.target.value })
                  }
                />
              </div>
              <div className="chan-modal">
                <button
                  type="button"
                  className="nut-hanh-dong-the xem"
                  onClick={() => setIsTaskModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="nut-chinh"
                  disabled={savingTask || loadingTaskGroups}
                >
                  {savingTask
                    ? "Đang lưu..."
                    : editingTaskId
                      ? "Lưu Thay Đổi"
                      : "Tạo Task ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

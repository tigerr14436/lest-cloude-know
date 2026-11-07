import { useState, useEffect } from "react";
import { sendAuthenticatedRequest } from "../api";
import { EMPTY_PROJECT_FORM } from "../constants";

// Danh sách dự án + tạo / sửa / tham gia / xóa / hoàn thành
export default function useProjectList({
  navigate,
  selectedProject,
  setSelectedProject,
  showNotification,
}) {
  const [projectList, setProjectList] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [editingProjectId, setEditingProjectId] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ ...EMPTY_PROJECT_FORM });

  const [joinCode, setJoinCode] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  // Tải danh sách dự án
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

  useEffect(() => {
    fetchProjectList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeProjectModal = () => setIsProjectModalOpen(false);

  const openCreateProject = () => {
    setEditingProjectId(null);
    setProjectForm({ ...EMPTY_PROJECT_FORM });
    setIsProjectModalOpen(true);
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

  const markProjectComplete = async (project) => {
    if (project.role !== "owner" || project.status === "completed") return;

    if (
      !window.confirm(
        `Đánh dấu dự án "${project.name}" đã hoàn thành? Dữ liệu và nhóm vẫn được giữ lại.`,
      )
    ) {
      return;
    }

    try {
      const updated = await sendAuthenticatedRequest(`/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed" }),
      });

      setProjectList((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
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
      showNotification("loi", "Không hoàn thành được dự án", error.message);
    }
  };

  // Tạo mới hoặc cập nhật dự án
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
      const savedProject = await sendAuthenticatedRequest(
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
          ? prev.map((project) =>
              project.id === savedProject.id ? savedProject : project,
            )
          : [savedProject, ...prev],
      );

      if (selectedProject?.id === savedProject.id) {
        setSelectedProject(savedProject);
      }

      setEditingProjectId(null);
      setProjectForm({ ...EMPTY_PROJECT_FORM });
      setIsProjectModalOpen(false);

      showNotification(
        "thanh-cong",
        "Thành công",
        `Đã lưu dự án "${savedProject.name}"`,
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

  // Sửa / xóa mô tả ngay tại trang Tổng quan (description rỗng = xóa mô tả)
  const saveProjectDescription = async (project, description) => {
    if (!project || project.role !== "owner" || isSavingDescription) {
      return false;
    }

    setIsSavingDescription(true);

    try {
      const updated = await sendAuthenticatedRequest(`/projects/${project.id}`, {
        method: "PUT",
        body: JSON.stringify({ description }),
      });

      setProjectList((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );

      if (selectedProject?.id === updated.id) {
        setSelectedProject(updated);
      }

      showNotification(
        "thanh-cong",
        description ? "Đã lưu mô tả" : "Đã xóa mô tả",
        description
          ? "Mô tả dự án đã được cập nhật."
          : "Mô tả dự án đã được xóa.",
      );

      return true;
    } catch (error) {
      showNotification("loi", "Không cập nhật được mô tả", error.message);
      return false;
    } finally {
      setIsSavingDescription(false);
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

      setProjectList((prev) => [
        joinedProject,
        ...prev.filter((project) => project.id !== joinedProject.id),
      ]);

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
    if (!window.confirm(`Bạn có chắc chắn muốn xóa/rời khỏi dự án "${name}"?`)) {
      return;
    }

    try {
      await sendAuthenticatedRequest(`/projects/${id}`, { method: "DELETE" });

      setProjectList((prev) => prev.filter((item) => item.id !== id));

      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }

      showNotification(
        "can-bao",
        "Đã xóa dự án",
        `Đã gỡ bỏ "${name}" khỏi danh sách`,
      );
    } catch (error) {
      showNotification("loi", "Không xóa được dự án", error.message);
    }
  };

  return {
    projectList,
    isLoadingProjects,
    // modal dự án
    isProjectModalOpen,
    editingProjectId,
    projectForm,
    setProjectForm,
    isCreatingProject,
    openCreateProject,
    openEditProject,
    closeProjectModal,
    handleCreateProject,
    // tham gia
    joinCode,
    setJoinCode,
    isJoiningProject,
    handleJoinProject,
    // khác
    copiedId,
    copyJoinCode,
    handleDeleteProject,
    markProjectComplete,
    // mô tả
    isSavingDescription,
    saveProjectDescription,
  };
}

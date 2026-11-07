import { useState, useEffect } from "react";
import { sendAuthenticatedRequest } from "../api";

// Tải nhóm, Task và thành viên của dự án đang chọn
export default function useProjectDetail(selectedProject, showNotification) {
  const projectId = selectedProject?.id;

  const [groups, setGroups] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Tải danh sách nhóm
  useEffect(() => {
    setGroups([]);

    if (!projectId) return;

    let active = true;

    sendAuthenticatedRequest(`/projects/${projectId}/groups`)
      .then((data) => {
        if (active) setGroups(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active) {
          showNotification("loi", "Không tải được nhóm", error.message);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Tải Task của dự án
  // Tải Task của dự án và tự đồng bộ khi Owner AI thay đổi Task
useEffect(() => {
  if (!projectId) {
    setProjectTasks([]);
    return;
  }

  let active = true;

  const fetchProjectTasks = async () => {
    setIsLoadingTasks(true);

    try {
      const data = await sendAuthenticatedRequest(
        `/tasks?project_id=${projectId}`
      );

      if (active) {
        setProjectTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      if (active) {
        showNotification(
          "loi",
          "Không tải được công việc",
          error.message
        );
      }
    } finally {
      if (active) {
        setIsLoadingTasks(false);
      }
    }
  };

  // Tải Task lần đầu khi mở dự án
  fetchProjectTasks();

  // Nhận thông báo khi Owner AI thực thi thay đổi Task
  const handleProjectTasksUpdated = (event) => {
    const updatedProjectId = event.detail?.projectId;

    if (
      String(updatedProjectId) === String(projectId)
    ) {
      fetchProjectTasks();
    }
  };

  window.addEventListener(
    "devtask:project-tasks-updated",
    handleProjectTasksUpdated
  );

  return () => {
    active = false;

    window.removeEventListener(
      "devtask:project-tasks-updated",
      handleProjectTasksUpdated
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId]);

  // Tải thành viên dự án
  useEffect(() => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }

    setProjectMembers([]);
    setIsLoadingMembers(true);

    sendAuthenticatedRequest(`/projects/${projectId}/members`)
      .then((data) => setProjectMembers(Array.isArray(data) ? data : []))
      .catch((error) => {
        setProjectMembers([]);
        showNotification("loi", "Không tải được thành viên", error.message);
      })
      .finally(() => setIsLoadingMembers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return {
    groups,
    setGroups,
    projectTasks,
    setProjectTasks,
    projectMembers,
    isLoadingTasks,
    isLoadingMembers,
  };
}

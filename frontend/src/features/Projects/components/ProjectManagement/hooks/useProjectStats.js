// Thống kê Task cấp dự án (không cộng Subtask)
export default function useProjectStats(projectTasks, groups, projectMembers) {
  const countByStatus = (status) =>
    projectTasks.filter((task) => task.status === status).length;

  const totalTasks = projectTasks.length;
  const completedTasks = countByStatus("done");

  return {
    totalTasks,
    todoTasks: countByStatus("todo"),
    inProgressTasks: countByStatus("in_progress"),
    reviewTasks: countByStatus("review"),
    completedTasks,
    projectProgress:
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    totalGroups: groups.length,
    totalMembers: projectMembers.length,
  };
}

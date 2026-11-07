// Nhãn vai trò hiển thị ở phần Tổng quan
export function getRoleLabel(isProjectOwner, isAnyGroupLeader) {
  if (isProjectOwner) return "Chủ dự án";
  if (isAnyGroupLeader) return "Trưởng nhóm";
  return "Thành viên";
}

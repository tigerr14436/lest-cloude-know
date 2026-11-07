import {
  BarChart2,
  FolderKanban,
  Users,
  Code2,
  FileCode,
  DollarSign,
  Bot,
} from "lucide-react";

// Form mặc định khi tạo Task
export const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  priority: "medium",
  assignee: "",
  deadline: "",
  estimated_best_days: "",
  estimated_average_days: "",
  estimated_worst_days: "",
};

// Form mặc định khi tạo / sửa dự án
export const EMPTY_PROJECT_FORM = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
};

// Danh sách tab trong trang chi tiết dự án
export const PROJECT_TABS = [
  { key: "overview", label: "Tổng quan dự án", icon: BarChart2 },
  { key: "kanban", label: "Bảng Kanban", icon: FolderKanban },
  { key: "groups", label: "Nhóm & Phân quyền Trưởng nhóm", icon: Users },
  { key: "code", label: "Quản lý Code", icon: Code2 },
  { key: "review", label: "Code Review", icon: FileCode },
  { key: "cost", label: "Tính chi phí dự án", icon: DollarSign },
  { key: "owner-ai", label: "Owner AI", icon: Bot },
];

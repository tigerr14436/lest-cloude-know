import React from "react";
import { FolderKanban, Clock, CheckSquare, BarChart2, Lock } from "lucide-react";
import KanbanBoard from "../../KanbanBoard";

const STAT_ICON_BG = (rgb) => `rgba(${rgb}, 0.2)`;

export default function KanbanTab({
  canManage,
  stats,
  projectTasks,
  isLoadingTasks,
  changeTaskStatus,
  openTaskModal,
  editTask,
  deleteTask,
}) {
  const statCards = [
    {
      title: "Tổng công việc",
      text: `${stats.totalTasks} Tasks`,
      icon: <FolderKanban size={20} />,
      background: STAT_ICON_BG("99, 102, 241"),
      color: "#818cf8",
    },
    {
      title: "Đang thực hiện",
      text: `${stats.inProgressTasks} Tasks`,
      icon: <Clock size={20} />,
      background: STAT_ICON_BG("245, 158, 11"),
      color: "#fbbf24",
    },
    {
      title: "Hoàn thành",
      text: `${stats.completedTasks} Tasks`,
      icon: <CheckSquare size={20} />,
      background: STAT_ICON_BG("52, 211, 153"),
      color: "#34d399",
    },
    {
      title: "Tiến độ dự án",
      text: `${stats.projectProgress}%`,
      icon: <BarChart2 size={20} />,
      background: STAT_ICON_BG("56, 189, 248"),
      color: "#38bdf8",
    },
  ];

  return (
    <>
      {!canManage && (
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
          <Lock size={16} />
          Bạn đang truy cập dưới quyền Thành viên. Chỉ Chủ dự án mới có quyền
          Thêm / Sửa / Xóa công việc.
        </div>
      )}

      <div className="thanh-thong-ke-kanban">
        {statCards.map((card) => (
          <div className="the-thong-ke" key={card.title}>
            <div
              className="nen-icon-thong-ke"
              style={{ background: card.background, color: card.color }}
            >
              {card.icon}
            </div>

            <div className="thong-tin-thong-ke">
              <h5>{card.title}</h5>
              <p>{card.text}</p>
            </div>
          </div>
        ))}
      </div>

      <KanbanBoard
        projectTasks={projectTasks}
        isLoadingTasks={isLoadingTasks}
        changeTaskStatus={changeTaskStatus}
        openTaskModal={openTaskModal}
        editTask={editTask}
        deleteTask={deleteTask}
        canManage={canManage}
      />
    </>
  );
}

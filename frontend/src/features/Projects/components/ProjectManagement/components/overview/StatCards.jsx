import React from "react";
import { FolderKanban, Clock, CheckSquare, Users, FolderPlus } from "lucide-react";

export default function StatCards({ stats }) {
  const items = [
    {
      label: "Tổng công việc",
      value: stats.totalTasks,
      icon: <FolderKanban size={21} />,
      color: "#818cf8",
      background: "rgba(99,102,241,0.15)",
    },
    {
      label: "Đang thực hiện",
      value: stats.inProgressTasks,
      icon: <Clock size={21} />,
      color: "#fbbf24",
      background: "rgba(245,158,11,0.15)",
    },
    {
      label: "Đã hoàn thành",
      value: stats.completedTasks,
      icon: <CheckSquare size={21} />,
      color: "#34d399",
      background: "rgba(52,211,153,0.15)",
    },
    {
      label: "Thành viên",
      value: stats.totalMembers,
      icon: <Users size={21} />,
      color: "#38bdf8",
      background: "rgba(56,189,248,0.15)",
    },
    {
      label: "Nhóm",
      value: stats.totalGroups,
      icon: <FolderPlus size={21} />,
      color: "#c084fc",
      background: "rgba(192,132,252,0.15)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "14px",
      }}
    >
      {items.map((item) => (
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
              style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "5px" }}
            >
              {item.label}
            </div>

            <div style={{ color: "#f8fafc", fontSize: "23px", fontWeight: 700 }}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

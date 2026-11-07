import React from "react";
import { ArrowLeft, Plus } from "lucide-react";

export default function ProjectHeader({
  project,
  isProjectOwner,
  isAnyGroupLeader,
  showCreateTask,
  onBack,
  onCreateTask,
}) {
  const badgeBackground = isProjectOwner
    ? "#6366f1"
    : isAnyGroupLeader
      ? "#f59e0b"
      : "#334155";

  const badgeLabel = isProjectOwner
    ? "Chủ dự án (Owner)"
    : isAnyGroupLeader
      ? "Trưởng nhóm (Leader)"
      : "Thành viên (Member)";

  return (
    <div className="phan-header-kanban" style={{ marginBottom: "16px" }}>
      <button className="nut-quay-lai" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Quay lại Danh sách Dự án</span>
      </button>

      <div className="khung-tieu-de-kanban">
        <div className="avatar-du-an">
          {project.name?.charAt(0).toUpperCase()}
        </div>

        <div>
          <h3 className="tieu-de-du-an-kanban">{project.name}</h3>

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
              <strong style={{ color: "#38bdf8" }}>
                {project.join_code || "Chưa có"}
              </strong>
            </span>

            <span
              style={{
                background: badgeBackground,
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              {badgeLabel}
            </span>
          </span>
        </div>
      </div>

      {showCreateTask && (
        <button className="nut-chinh" onClick={onCreateTask}>
          <Plus size={16} />
          <span>Tạo Task Mới</span>
        </button>
      )}
    </div>
  );
}

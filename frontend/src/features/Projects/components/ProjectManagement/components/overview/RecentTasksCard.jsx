import React from "react";
import { CheckSquare, ArrowRight, Loader2 } from "lucide-react";
import {
  getTaskStatusLabel,
  getTaskStatusColor,
  getTaskPriorityLabel,
  getTaskPriorityColor,
} from "../../utils/taskUtils";
import {
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  outlineButtonStyle,
  arrowIconStyle,
  emptyBoxStyle,
  loadingBoxStyle,
} from "../../styles";

const MAX_VISIBLE_TASKS = 8;

function TaskRow({ task }) {
  const priorityColor = getTaskPriorityColor(task.priority);
  const statusColor = getTaskStatusColor(task.status);

  return (
    <div
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
      <div style={{ minWidth: 0, flex: 1 }}>
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

        <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "5px" }}>
          Người thực hiện: {task.assignee || "Chưa phân công"}
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
            background: "rgba(148,163,184,0.12)",
            color: priorityColor,
            border: `1px solid ${priorityColor}55`,
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
          }}
        >
          Ưu tiên: {getTaskPriorityLabel(task.priority)}
        </span>

        <span
          style={{
            background: `${statusColor}18`,
            color: statusColor,
            border: `1px solid ${statusColor}55`,
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            whiteSpace: "nowrap",
          }}
        >
          {getTaskStatusLabel(task.status)}
        </span>
      </div>
    </div>
  );
}

export default function RecentTasksCard({
  projectTasks,
  isLoadingTasks,
  onViewKanban,
}) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <h3 style={cardTitleStyle}>
          <CheckSquare size={18} color="#818cf8" />
          Công việc gần đây
        </h3>

        <button onClick={onViewKanban} style={outlineButtonStyle}>
          Xem Kanban
          <ArrowRight size={13} style={arrowIconStyle} />
        </button>
      </div>

      {isLoadingTasks ? (
        <div style={loadingBoxStyle}>
          <Loader2 size={24} className="icon-quay" />
          <p>Đang tải công việc...</p>
        </div>
      ) : projectTasks.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {projectTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          {projectTasks.length > MAX_VISIBLE_TASKS && (
            <div
              style={{
                textAlign: "center",
                color: "#94a3b8",
                fontSize: "12px",
                paddingTop: "5px",
              }}
            >
              Hiển thị {MAX_VISIBLE_TASKS}/{projectTasks.length} công việc.
              Chuyển sang Kanban để xem toàn bộ.
            </div>
          )}
        </div>
      ) : (
        <div style={emptyBoxStyle}>Dự án chưa có công việc nào.</div>
      )}
    </div>
  );
}

import React from "react";
import { Clock, Users } from "lucide-react";
import { formatProjectDate } from "../../utils/dateUtils";
import { getRoleLabel } from "../../utils/roleUtils";
import ProjectDescription from "./ProjectDescription";
import { inlineIconStyle } from "../../styles";

const labelStyle = { color: "#94a3b8", fontSize: "12px", marginBottom: "6px" };

export default function ProjectInfoCard({
  project,
  isProjectOwner,
  isAnyGroupLeader,
  onSaveDescription,
  isSavingDescription,
}) {
  const isCompleted = project.status === "completed";

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e293b, #172554)",
        border: "1px solid #334155",
        borderRadius: "14px",
        padding: "22px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "21px",
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              {project.name}
            </h2>

            <span
              style={{
                background: isCompleted
                  ? "rgba(52,211,153,0.15)"
                  : "rgba(56,189,248,0.15)",
                color: isCompleted ? "#34d399" : "#38bdf8",
                padding: "5px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {isCompleted ? "Đã hoàn thành" : "Đang thực hiện"}
            </span>
          </div>

          <ProjectDescription
            description={project.description}
            canEdit={isProjectOwner}
            isSaving={isSavingDescription}
            onSave={onSaveDescription}
          />
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.6)",
            border: "1px solid #475569",
            borderRadius: "10px",
            padding: "12px 16px",
            minWidth: "160px",
          }}
        >
          <div
            style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "5px" }}
          >
            Mã tham gia dự án
          </div>

          <div
            style={{
              color: "#38bdf8",
              fontWeight: 700,
              fontSize: "18px",
              letterSpacing: "1px",
            }}
          >
            {project.join_code || "Chưa có"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginTop: "22px",
          paddingTop: "18px",
          borderTop: "1px solid #334155",
        }}
      >
        <div>
          <div style={labelStyle}>
            <Clock size={13} style={inlineIconStyle} />
            Ngày bắt đầu
          </div>
          <strong style={{ fontSize: "14px" }}>
            {formatProjectDate(project.start_date)}
          </strong>
        </div>

        <div>
          <div style={labelStyle}>
            <Clock size={13} style={inlineIconStyle} />
            Ngày kết thúc
          </div>
          <strong style={{ fontSize: "14px" }}>
            {formatProjectDate(project.end_date)}
          </strong>
        </div>

        <div>
          <div style={labelStyle}>
            <Users size={13} style={inlineIconStyle} />
            Vai trò của bạn
          </div>
          <strong style={{ fontSize: "14px" }}>
            {getRoleLabel(isProjectOwner, isAnyGroupLeader)}
          </strong>
        </div>
      </div>
    </div>
  );
}

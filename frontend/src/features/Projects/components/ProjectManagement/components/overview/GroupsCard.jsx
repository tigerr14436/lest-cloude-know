import React from "react";
import { Users, FolderKanban, ArrowRight } from "lucide-react";
import {
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  outlineButtonStyle,
  arrowIconStyle,
  emptyBoxStyle,
} from "../../styles";

export default function GroupsCard({ groups, onManageGroups }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <h3 style={cardTitleStyle}>
          <Users size={18} color="#c084fc" />
          Các nhóm trong dự án
        </h3>

        <button onClick={onManageGroups} style={outlineButtonStyle}>
          Quản lý nhóm
          <ArrowRight size={13} style={arrowIconStyle} />
        </button>
      </div>

      {groups.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          {groups.map((group) => (
            <div
              key={group.id}
              style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "9px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  marginBottom: "9px",
                }}
              >
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    background: "rgba(192,132,252,0.15)",
                    color: "#c084fc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FolderKanban size={17} />
                </div>

                <strong style={{ color: "#f8fafc", fontSize: "14px" }}>
                  {group.name}
                </strong>
              </div>

              <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                Trưởng nhóm:{" "}
                <span style={{ color: "#e2e8f0" }}>
                  {group.leader || group.leader_name || "Chưa phân công"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyBoxStyle}>Chưa có nhóm nào trong dự án.</div>
      )}
    </div>
  );
}

import React from "react";
import { Users, Loader2 } from "lucide-react";
import {
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  emptyBoxStyle,
  loadingBoxStyle,
} from "../../styles";

export default function MembersCard({
  projectMembers,
  isLoadingMembers,
  totalMembers,
}) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <h3 style={cardTitleStyle}>
          <Users size={18} color="#38bdf8" />
          Thành viên dự án
        </h3>

        <span style={{ color: "#94a3b8", fontSize: "12px" }}>
          {isLoadingMembers ? "Đang tải..." : `${totalMembers} thành viên`}
        </span>
      </div>

      {isLoadingMembers ? (
        <div style={loadingBoxStyle}>
          <Loader2 size={24} className="icon-quay" />
          <p>Đang tải thành viên...</p>
        </div>
      ) : projectMembers.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {projectMembers.map((member) => (
            <div
              key={member.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "9px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "rgba(56,189,248,0.15)",
                  color: "#38bdf8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(member.name || "?").charAt(0).toUpperCase()}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{ color: "#f8fafc", fontSize: "13px", fontWeight: 600 }}
                >
                  {member.name || "Chưa cập nhật tên"}
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "11px",
                    overflowWrap: "anywhere",
                    marginTop: "3px",
                  }}
                >
                  {member.email || ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyBoxStyle}>Chưa có thông tin thành viên.</div>
      )}
    </div>
  );
}

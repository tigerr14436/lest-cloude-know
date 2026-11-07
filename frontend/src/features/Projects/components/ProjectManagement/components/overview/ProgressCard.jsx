import React from "react";
import { cardStyle } from "../../styles";

export default function ProgressCard({ stats, isLoadingTasks }) {
  const legend = [
    { label: "Cần làm", value: stats.todoTasks, color: "#94a3b8" },
    { label: "Đang thực hiện", value: stats.inProgressTasks, color: "#fbbf24" },
    { label: "Đang kiểm tra", value: stats.reviewTasks, color: "#38bdf8" },
    { label: "Hoàn thành", value: stats.completedTasks, color: "#34d399" },
  ];

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "16px" }}>
            Tiến độ hoàn thành dự án
          </h3>

          <p style={{ margin: "5px 0 0", color: "#94a3b8", fontSize: "12px" }}>
            Tỷ lệ Task cấp dự án đã hoàn thành
          </p>
        </div>

        <strong style={{ fontSize: "26px", color: "#34d399" }}>
          {isLoadingTasks ? "..." : `${stats.projectProgress}%`}
        </strong>
      </div>

      <div
        style={{
          height: "12px",
          background: "#0f172a",
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${stats.projectProgress}%`,
            background: "linear-gradient(90deg, #6366f1, #34d399)",
            borderRadius: "20px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "12px",
          marginTop: "18px",
        }}
      >
        {legend.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#cbd5e1",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: item.color,
                flexShrink: 0,
              }}
            />

            <span>{item.label}</span>

            <strong style={{ color: "#f8fafc", marginLeft: "auto" }}>
              {isLoadingTasks ? "..." : item.value}
            </strong>
          </div>
        ))}
      </div>

      {stats.totalTasks === 0 && !isLoadingTasks && (
        <p style={{ color: "#94a3b8", fontSize: "12px", margin: "14px 0 0" }}>
          Dự án chưa có Task cấp dự án để tính tiến độ.
        </p>
      )}
    </div>
  );
}

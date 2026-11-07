import React from "react";
import { PROJECT_TABS } from "../constants";

export default function ProjectTabs({ activeTab, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        borderBottom: "1px solid #334155",
        paddingBottom: "12px",
        marginBottom: "20px",
        flexWrap: "wrap",
      }}
    >
      {PROJECT_TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            background: activeTab === key ? "#4f46e5" : "#1e293b",
            color: "#fff",
            border: "1px solid #334155",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}

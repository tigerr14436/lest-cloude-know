import React, { useState } from "react";
import { UserPlus, Send, Loader2 } from "lucide-react";
import { cardStyle, cardHeaderStyle, cardTitleStyle } from "../../styles";

const METHODS = [
  { key: "name_tag", label: "Name Tag", placeholder: "VD: #A1B2", type: "text" },
  { key: "email", label: "Email", placeholder: "VD: ten@email.com", type: "email" },
];

// Chỉ Chủ dự án thấy thẻ này
export default function InviteMemberCard({ onInvite, isSending }) {
  const [method, setMethod] = useState("name_tag");
  const [value, setValue] = useState("");

  const current = METHODS.find((item) => item.key === method);

  const changeMethod = (key) => {
    setMethod(key);
    setValue("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const ok = await onInvite({ method, value });
    if (ok) setValue("");
  };

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <h3 style={cardTitleStyle}>
          <UserPlus size={18} color="#34d399" />
          Mời thành viên vào dự án
        </h3>
      </div>

      <p
        style={{
          margin: "0 0 14px",
          color: "#94a3b8",
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        Nhập Name Tag hoặc email của người dùng đã có tài khoản. Họ sẽ nhận
        thông báo và vào dự án sau khi chấp nhận lời mời.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {METHODS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => changeMethod(item.key)}
            disabled={isSending}
            style={{
              background: method === item.key ? "#4f46e5" : "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: "7px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
      >
        <input
          type={current.type}
          className="input-form"
          placeholder={current.placeholder}
          value={value}
          disabled={isSending}
          onChange={(e) => setValue(e.target.value)}
          required
          style={{ flex: 1, minWidth: "220px" }}
        />

        <button
          type="submit"
          className="nut-chinh"
          disabled={isSending || !value.trim()}
        >
          {isSending ? (
            <Loader2 size={16} className="icon-quay" />
          ) : (
            <Send size={16} />
          )}
          <span>{isSending ? "Đang gửi..." : "Gửi lời mời"}</span>
        </button>
      </form>
    </div>
  );
}

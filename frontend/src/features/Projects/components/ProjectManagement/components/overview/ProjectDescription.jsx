import React, { useState } from "react";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

const actionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid #475569",
  color: "#cbd5e1",
  borderRadius: "7px",
  padding: "6px 10px",
  fontSize: "12px",
  cursor: "pointer",
};

// Mô tả dự án: Chủ dự án có thể Sửa hoặc Xóa ngay tại trang Tổng quan
export default function ProjectDescription({
  description,
  canEdit,
  isSaving,
  onSave, // (text) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(description || "");
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    const text = draft.trim();

    // Không có thay đổi thì chỉ đóng form
    if (text === (description || "").trim()) {
      setIsEditing(false);
      return;
    }

    const ok = await onSave(text);
    if (ok) setIsEditing(false);
  };

  const removeDescription = async () => {
    if (!description) return;

    if (!window.confirm("Xóa toàn bộ mô tả của dự án này?")) return;

    await onSave("");
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#94a3b8", fontSize: "12px" }}>Mô tả dự án</span>

        {canEdit && !isEditing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              style={actionButtonStyle}
              onClick={startEdit}
              disabled={isSaving}
            >
              <Pencil size={13} />
              Chỉnh sửa
            </button>

            <button
              type="button"
              style={{
                ...actionButtonStyle,
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.4)",
                opacity: description ? 1 : 0.5,
                cursor: description ? "pointer" : "not-allowed",
              }}
              onClick={removeDescription}
              disabled={isSaving || !description}
              title={description ? "Xóa mô tả" : "Dự án chưa có mô tả"}
            >
              {isSaving ? (
                <Loader2 size={13} className="icon-quay" />
              ) : (
                <Trash2 size={13} />
              )}
              Xóa
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <>
          <textarea
            className="textarea-form"
            rows={8}
            autoFocus
            value={draft}
            disabled={isSaving}
            placeholder="Nhập mô tả dự án: mục tiêu, phạm vi, yêu cầu, công nghệ..."
            onChange={(e) => setDraft(e.target.value)}
            style={{
              width: "100%",
              minHeight: "160px",
              resize: "vertical",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              style={actionButtonStyle}
              onClick={cancelEdit}
              disabled={isSaving}
            >
              <X size={13} />
              Hủy
            </button>

            <button
              type="button"
              style={{
                ...actionButtonStyle,
                background: "#4f46e5",
                border: "1px solid #4f46e5",
                color: "#fff",
              }}
              onClick={saveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 size={13} className="icon-quay" />
              ) : (
                <Check size={13} />
              )}
              {isSaving ? "Đang lưu..." : "Lưu mô tả"}
            </button>
          </div>
        </>
      ) : (
        <p
          style={{
            margin: 0,
            color: "#cbd5e1",
            fontSize: "14px",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {description || "Dự án chưa có mô tả."}
        </p>
      )}
    </div>
  );
}

import React from "react";
import { X, Loader2, FolderPlus } from "lucide-react";

// Modal tạo / chỉnh sửa dự án
export default function ProjectModal({
  isEditing,
  form,
  setForm,
  isSaving,
  onClose,
  onSubmit,
}) {
  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="lop-phu-modal" onClick={() => !isSaving && onClose()}>
      <div className="noi-dung-modal" onClick={(e) => e.stopPropagation()}>
        <div className="header-modal">
          <h4 className="tieu-de-modal">
            {isEditing ? "Chỉnh Sửa Dự Án" : "Tạo Dự Án Mới"}
          </h4>

          <button
            type="button"
            className="nut-dong-modal"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Đóng form tạo dự án"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="nhom-form-group">
            <label className="nhan-form" htmlFor="project-name">
              Tên dự án *
            </label>

            <input
              id="project-name"
              className="input-form"
              type="text"
              maxLength={255}
              required
              autoFocus
              placeholder="VD: Website Quản Lý Công Việc CNTT"
              value={form.name}
              onChange={updateField("name")}
            />
          </div>

          <div className="nhom-form-group">
            <label className="nhan-form" htmlFor="project-description">
              Mô tả chi tiết dự án
            </label>

            <textarea
              id="project-description"
              className="textarea-form"
              rows={8}
              placeholder="Nhập mô tả chi tiết dự án: mục tiêu, phạm vi, yêu cầu chức năng, công nghệ sử dụng, kế hoạch triển khai, các yêu cầu và thông tin liên quan..."
              value={form.description}
              onChange={updateField("description")}
              style={{
                width: "100%",
                minHeight: "180px",
                resize: "vertical",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            />
          </div>

          <div className="luoi-hai-cot-modal">
            <div className="nhom-form-group">
              <label className="nhan-form" htmlFor="project-start">
                Ngày bắt đầu *
              </label>

              <input
                id="project-start"
                type="date"
                className="input-form"
                required
                value={form.start_date}
                max={form.end_date || undefined}
                onChange={updateField("start_date")}
              />
            </div>

            <div className="nhom-form-group">
              <label className="nhan-form" htmlFor="project-end">
                Ngày kết thúc *
              </label>

              <input
                id="project-end"
                type="date"
                className="input-form"
                required
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={updateField("end_date")}
              />
            </div>
          </div>

          <div className="chan-modal">
            <button
              type="button"
              className="nut-hanh-dong-the xem"
              disabled={isSaving}
              onClick={onClose}
            >
              Hủy
            </button>

            <button type="submit" className="nut-chinh" disabled={isSaving}>
              {isSaving ? (
                <Loader2 size={16} className="icon-quay" />
              ) : (
                <FolderPlus size={16} />
              )}

              <span>
                {isSaving
                  ? "Đang lưu..."
                  : isEditing
                    ? "Lưu Thay Đổi"
                    : "Tạo Dự Án"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

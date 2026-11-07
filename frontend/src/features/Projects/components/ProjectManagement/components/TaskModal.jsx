import React from "react";
import { X, Loader2 } from "lucide-react";
import TaskEstimateFields from "./TaskEstimateFields";

// Modal tạo / chỉnh sửa Task
export default function TaskModal({
  isEditing,
  form,
  setForm,
  saving,
  loadingGroups,
  groups,
  taskGroupId,
  setTaskGroupId,
  projectMembers,
  isLoadingMembers,
  onClose,
  onSubmit,
}) {
  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div
      className="lop-phu-modal"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div className="noi-dung-modal" onClick={(e) => e.stopPropagation()}>
        <div className="header-modal">
          <h4 className="tieu-de-modal">
            {isEditing ? "Chỉnh Sửa Công Việc" : "Tạo Task Mới cho Dự Án"}
          </h4>

          <button
            type="button"
            className="nut-dong-modal"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {/* TÊN TASK */}
          <div className="nhom-form-group">
            <label className="nhan-form">Tên công việc / Task</label>

            <input
              type="text"
              className="input-form"
              placeholder="VD: Thiết kế API Đăng nhập OAuth2..."
              value={form.title}
              onChange={updateField("title")}
              required
            />
          </div>

          {/* MÔ TẢ */}
          <div className="nhom-form-group">
            <label className="nhan-form">Mô tả chi tiết</label>

            <textarea
              className="textarea-form"
              placeholder="Yêu cầu công việc, tài liệu tham khảo..."
              value={form.description}
              onChange={updateField("description")}
            />
          </div>

          {/* ĐỘ ƯU TIÊN VÀ NGƯỜI THỰC HIỆN */}
          <div className="luoi-hai-cot-modal">
            <div className="nhom-form-group">
              <label className="nhan-form">Mức độ ưu tiên</label>

              <select
                className="select-form"
                value={form.priority}
                onChange={updateField("priority")}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
              </select>
            </div>

            <div className="nhom-form-group">
              <label className="nhan-form">Người thực hiện</label>

              <select
                className="select-form"
                value={form.assignee}
                onChange={updateField("assignee")}
                disabled={isLoadingMembers}
                style={{ width: "100%" }}
              >
                <option value="">
                  {isLoadingMembers
                    ? "Đang tải thành viên..."
                    : "-- Chọn thành viên --"}
                </option>

                {projectMembers.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                    {member.email ? ` (${member.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NHÓM CHỊU TRÁCH NHIỆM */}
          <div className="nhom-form-group">
            <label className="nhan-form">Nhóm chịu trách nhiệm</label>

            <select
              className="select-form"
              value={taskGroupId}
              onChange={(e) => setTaskGroupId(e.target.value)}
              disabled={loadingGroups || saving}
              style={{ width: "100%" }}
            >
              <option value="">-- Chưa giao cho nhóm --</option>

              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                  {group.leader ? ` — Leader: ${group.leader}` : ""}
                </option>
              ))}
            </select>

            <small style={{ color: "#94a3b8", display: "block", marginTop: 6 }}>
              {loadingGroups
                ? "Đang kiểm tra phân công hiện tại..."
                : "Chỉ Owner được phân công. Task sẽ xuất hiện trong Kanban của nhóm đã chọn."}
            </small>
          </div>

          {/* DEADLINE */}
          <div className="nhom-form-group">
            <label className="nhan-form">Hạn hoàn thành (Deadline)</label>

            <input
              type="date"
              className="input-form"
              value={form.deadline}
              onChange={updateField("deadline")}
            />
          </div>

          {/* ƯỚC LƯỢNG THỜI GIAN */}
          <TaskEstimateFields form={form} setForm={setForm} />

          {/* NÚT LƯU */}
          <div className="chan-modal">
            <button
              type="button"
              className="nut-hanh-dong-the xem"
              disabled={saving}
              onClick={onClose}
            >
              Hủy
            </button>

            <button
              type="submit"
              className="nut-chinh"
              disabled={saving || loadingGroups}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="icon-quay" />
                  Đang lưu...
                </>
              ) : isEditing ? (
                "Lưu Thay Đổi"
              ) : (
                "Tạo Task ngay"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

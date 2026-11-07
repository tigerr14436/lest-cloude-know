import React from "react";
import { Clock } from "lucide-react";

// Khối nhập 3 mức thời gian dự kiến của Task
export default function TaskEstimateFields({ form, setForm }) {
  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const numberInputProps = {
    type: "number",
    className: "input-form",
    min: "0.01",
    max: "7",
    step: "0.01",
  };

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: 14,
        marginTop: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Clock size={17} color="#38bdf8" />

        <h4 style={{ color: "#38bdf8", fontSize: 14, margin: 0 }}>
          Thời gian dự kiến hoàn thành
        </h4>
      </div>

      <p
        style={{
          color: "#94a3b8",
          fontSize: 12,
          margin: "0 0 14px",
          lineHeight: 1.5,
        }}
      >
        Nhập ba mức ước lượng thời gian cho Task. Đơn vị tính là ngày, tối đa 7
        ngày. Các trường có thể để trống.
      </p>

      <div className="luoi-hai-cot-modal">
        <div className="nhom-form-group">
          <label className="nhan-form" htmlFor="task-estimated-best">
            Tốt nhất (ngày)
          </label>

          <input
            {...numberInputProps}
            id="task-estimated-best"
            placeholder="VD: 1"
            value={form.estimated_best_days}
            onChange={updateField("estimated_best_days")}
          />
        </div>

        <div className="nhom-form-group">
          <label className="nhan-form" htmlFor="task-estimated-average">
            Trung bình (ngày)
          </label>

          <input
            {...numberInputProps}
            id="task-estimated-average"
            placeholder="VD: 2"
            value={form.estimated_average_days}
            onChange={updateField("estimated_average_days")}
          />
        </div>
      </div>

      <div className="nhom-form-group">
        <label className="nhan-form" htmlFor="task-estimated-worst">
          Tệ nhất (ngày)
        </label>

        <input
          {...numberInputProps}
          id="task-estimated-worst"
          placeholder="VD: 3"
          value={form.estimated_worst_days}
          onChange={updateField("estimated_worst_days")}
        />
      </div>

      <small
        style={{
          display: "block",
          color: "#64748b",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Điều kiện: Tốt nhất ≤ Trung bình ≤ Tệ nhất. Đây là thời gian dự kiến,
        không phải thời gian thực tế đã làm.
      </small>
    </div>
  );
}

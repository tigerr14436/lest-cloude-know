// Kiểm tra 3 mức thời gian dự kiến
export function validateTaskEstimates(form) {
  const fields = [
    { key: "estimated_best_days", label: "Thời gian tốt nhất" },
    { key: "estimated_average_days", label: "Thời gian trung bình" },
    { key: "estimated_worst_days", label: "Thời gian tệ nhất" },
  ];

  const values = [];

  for (const field of fields) {
    const rawValue = form[field.key];

    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      values.push(null);
      continue;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value <= 0) {
      return `${field.label} phải là số lớn hơn 0.`;
    }

    if (value > 7) {
      return `${field.label} không được vượt quá 7 ngày.`;
    }

    values.push(value);
  }

  const enteredValues = values.filter((value) => value !== null);

  for (let i = 1; i < enteredValues.length; i++) {
    if (enteredValues[i] < enteredValues[i - 1]) {
      return "Thời gian phải theo thứ tự: tốt nhất ≤ trung bình ≤ tệ nhất.";
    }
  }

  return null;
}

// Chuyển dữ liệu form thành dữ liệu gửi Backend
export function getTaskEstimatePayload(form) {
  const toNumber = (value) => (value === "" ? null : Number(value));

  return {
    estimated_best_days: toNumber(form.estimated_best_days),
    estimated_average_days: toNumber(form.estimated_average_days),
    estimated_worst_days: toNumber(form.estimated_worst_days),
  };
}

// Nhãn trạng thái Task
export function getTaskStatusLabel(status) {
  const labels = {
    todo: "Cần làm",
    in_progress: "Đang thực hiện",
    review: "Đang kiểm tra",
    done: "Hoàn thành",
  };

  return labels[status] || status || "Chưa xác định";
}

// Màu trạng thái Task
export function getTaskStatusColor(status) {
  const colors = {
    todo: "#94a3b8",
    in_progress: "#f59e0b",
    review: "#38bdf8",
    done: "#34d399",
  };

  return colors[status] || "#94a3b8";
}

// Nhãn mức độ ưu tiên
export function getTaskPriorityLabel(priority) {
  const labels = { low: "Thấp", medium: "Trung bình", high: "Cao" };

  return labels[priority] || "Chưa xác định";
}

// Màu mức độ ưu tiên
export function getTaskPriorityColor(priority) {
  const colors = { low: "#34d399", medium: "#fbbf24", high: "#f87171" };

  return colors[priority] || "#94a3b8";
}

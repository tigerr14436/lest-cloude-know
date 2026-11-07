import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Wallet, TrendingDown, PiggyBank, Plus, Pencil, Trash2,
  RefreshCw, Save, X, Receipt, Tags, Lock, AlertCircle,
} from "lucide-react";

const API_ROOT = "http://127.0.0.1:8000/api";

const emptyCategory = { name: "", description: "", estimated_amount: "0" };
const emptyExpense = {
  category_id: "", name: "", amount: "", expense_date: new Date().toISOString().slice(0, 10),
  description: "",
};

const money = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: "#0f172a", color: "#f8fafc",
  border: "1px solid #475569", borderRadius: 8, padding: "10px 12px", fontSize: 13,
};
const labelStyle = {
  display: "block", color: "#cbd5e1", fontSize: 12, fontWeight: 600, marginBottom: 6,
};
const panelStyle = {
  background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 18,
};
const buttonStyle = {
  border: 0, borderRadius: 8, padding: "9px 13px", fontWeight: 700,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
};

export default function ProjectCostCalculator({
  projectId,
  isProjectOwner = false,
  projectTasks = [],
  showNotification,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    start_date: "", end_date: "", budget_limit: "0",
  });
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const notify = (type, title, message) => {
    if (showNotification) showNotification(type, title, message);
  };

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

    const response = await fetch(`${API_ROOT}/projects/${projectId}/costs${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 204) return null;
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = result?.detail;
      throw new Error(Array.isArray(detail) ? detail.map((x) => x.msg).join(", ") : detail || `Lỗi HTTP ${response.status}`);
    }
    return result;
  }, [projectId]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const result = await request("");
      setData(result);
      setSettingsForm({
        start_date: result.start_date || "",
        end_date: result.end_date || "",
        budget_limit: String(result.budget_limit ?? 0),
      });
    } catch (error) {
      notify("loi", "Không tải được dữ liệu chi phí", error.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, request]);

  useEffect(() => { loadData(); }, [loadData]);

  const categories = data?.categories || [];
  const expenses = data?.expenses || [];
  const totalActual = Number(data?.total_actual || 0);
  const budget = Number(data?.budget_limit || 0);
  const remaining = Number(data?.remaining_budget ?? budget - totalActual);
  const estimatedTotal = useMemo(
    () => categories.reduce((sum, category) => sum + Number(category.estimated_amount || 0), 0),
    [categories],
  );
  const categoryName = (id) => categories.find((item) => item.id === id)?.name || "Danh mục đã xóa";

  const saveSettings = async (event) => {
    event.preventDefault();
    if (!isProjectOwner) return;
    if (settingsForm.start_date && settingsForm.end_date && settingsForm.end_date < settingsForm.start_date) {
      notify("loi", "Ngày không hợp lệ", "Ngày kết thúc không được trước ngày bắt đầu.");
      return;
    }
    const amount = Number(settingsForm.budget_limit);
    if (!Number.isSafeInteger(amount) || amount < 0) {
      notify("loi", "Ngân sách không hợp lệ", "Ngân sách phải là số nguyên không âm.");
      return;
    }
    setSavingSettings(true);
    try {
      await request("/settings", {
        method: "PUT",
        body: JSON.stringify({
          start_date: settingsForm.start_date || null,
          end_date: settingsForm.end_date || null,
          budget_limit: amount,
        }),
      });
      await loadData();
      notify("thanh-cong", "Đã lưu thông tin dự án", "Ngân sách và thời gian dự án đã được cập nhật.");
    } catch (error) {
      notify("loi", "Không lưu được thông tin", error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    if (!isProjectOwner) return;
    const name = categoryForm.name.trim();
    const estimated = Number(categoryForm.estimated_amount);
    if (!name || !Number.isSafeInteger(estimated) || estimated < 0) {
      notify("loi", "Dữ liệu danh mục không hợp lệ", "Nhập tên danh mục và số tiền ước lượng là số nguyên không âm.");
      return;
    }
    setSavingRecord(true);
    try {
      const payload = {
        name,
        description: categoryForm.description.trim() || null,
        estimated_amount: estimated,
      };
      if (editingCategoryId) {
        await request(`/categories/${editingCategoryId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await request("/categories", { method: "POST", body: JSON.stringify(payload) });
      }
      setCategoryForm(emptyCategory);
      setEditingCategoryId(null);
      await loadData();
      notify("thanh-cong", "Đã lưu danh mục", "Danh mục chi phí đã được lưu vào cơ sở dữ liệu.");
    } catch (error) {
      notify("loi", "Không lưu được danh mục", error.message);
    } finally {
      setSavingRecord(false);
    }
  };

  const editCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      estimated_amount: String(category.estimated_amount ?? 0),
    });
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Xóa danh mục "${category.name}"? Danh mục đang có khoản chi sẽ không thể xóa.`)) return;
    try {
      await request(`/categories/${category.id}`, { method: "DELETE" });
      await loadData();
      notify("thanh-cong", "Đã xóa danh mục", category.name);
    } catch (error) {
      notify("loi", "Không xóa được danh mục", error.message);
    }
  };

  const saveExpense = async (event) => {
    event.preventDefault();
    if (!isProjectOwner) return;
    const amount = Number(expenseForm.amount);
    if (!expenseForm.category_id || !expenseForm.name.trim() ||
        !Number.isSafeInteger(amount) || amount <= 0 || !expenseForm.expense_date) {
      notify("loi", "Khoản chi chưa hợp lệ", "Vui lòng nhập tên, danh mục, ngày chi và số tiền nguyên dương.");
      return;
    }
    setSavingRecord(true);
    try {
      const payload = {
        category_id: expenseForm.category_id,
        name: expenseForm.name.trim(),
        amount,
        expense_date: expenseForm.expense_date,
        description: expenseForm.description.trim() || null,
      };
      if (editingExpenseId) {
        await request(`/expenses/${editingExpenseId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await request("/expenses", { method: "POST", body: JSON.stringify(payload) });
      }
      setExpenseForm({ ...emptyExpense, category_id: categories[0]?.id || "" });
      setEditingExpenseId(null);
      await loadData();
      notify("thanh-cong", "Đã lưu khoản chi", "Khoản chi thực tế đã được cập nhật.");
    } catch (error) {
      notify("loi", "Không lưu được khoản chi", error.message);
    } finally {
      setSavingRecord(false);
    }
  };

  const editExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      category_id: expense.category_id,
      name: expense.name,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      description: expense.description || "",
    });
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Xóa khoản chi "${expense.name}"?`)) return;
    try {
      await request(`/expenses/${expense.id}`, { method: "DELETE" });
      await loadData();
      notify("thanh-cong", "Đã xóa khoản chi", expense.name);
    } catch (error) {
      notify("loi", "Không xóa được khoản chi", error.message);
    }
  };

  const cancelCategoryEdit = () => {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
  };
  const cancelExpenseEdit = () => {
    setEditingExpenseId(null);
    setExpenseForm({ ...emptyExpense, category_id: categories[0]?.id || "" });
  };

  if (loading && !data) {
    return <div style={{ ...panelStyle, color: "#cbd5e1", textAlign: "center", padding: 40 }}>Đang tải dữ liệu chi phí dự án...</div>;
  }

  if (!data) {
    return (
      <div style={{ ...panelStyle, color: "#fca5a5" }}>
        <AlertCircle size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
        Không tải được dữ liệu. Kiểm tra backend và thử tải lại.
        <button onClick={loadData} style={{ ...buttonStyle, marginLeft: 12, background: "#334155", color: "#fff" }}>
          <RefreshCw size={15} /> Tải lại
        </button>
      </div>
    );
  }

  const Stat = ({ icon: Icon, title, value, color }) => (
    <div style={{ ...panelStyle, display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: `${color}22`, color }}>
        <Icon size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 5 }}>{title}</div>
        <strong style={{ color, fontSize: 17, overflowWrap: "anywhere" }}>{value}</strong>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, color: "#f8fafc", paddingBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20 }}>Quản lý chi phí dự án</h3>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "6px 0 0" }}>
            Theo dõi ngân sách dự kiến, khoản chi thực tế và số dư còn lại.
          </p>
        </div>
        <button onClick={loadData} disabled={loading} style={{ ...buttonStyle, background: "#334155", color: "#e2e8f0" }}>
          <RefreshCw size={15} /> {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {!isProjectOwner && (
        <div style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 10, padding: 12, color: "#fcd34d", fontSize: 13 }}>
          <Lock size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
          Bạn đang ở quyền xem. Chỉ Chủ dự án mới được thêm, sửa hoặc xóa dữ liệu chi phí.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        <Stat icon={Wallet} title="Ngân sách dự kiến" value={money(budget)} color="#38bdf8" />
        <Stat icon={TrendingDown} title="Tổng chi phí thực tế" value={money(totalActual)} color="#fb7185" />
        <Stat icon={PiggyBank} title="Ngân sách còn lại" value={money(remaining)} color={remaining >= 0 ? "#34d399" : "#f87171"} />
        <Stat icon={Tags} title="Tổng ước lượng theo danh mục" value={money(estimatedTotal)} color="#c4b5fd" />
      </div>

      <section style={panelStyle}>
        <h4 style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={18} color="#38bdf8" /> Thời gian và ngân sách dự án</h4>
        <form onSubmit={saveSettings}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Ngày bắt đầu</label>
              <input type="date" style={inputStyle} value={settingsForm.start_date} disabled={!isProjectOwner}
                onChange={(e) => setSettingsForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ngày kết thúc</label>
              <input type="date" style={inputStyle} min={settingsForm.start_date || undefined} value={settingsForm.end_date} disabled={!isProjectOwner}
                onChange={(e) => setSettingsForm((p) => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Tổng ngân sách dự kiến (VNĐ)</label>
              <input type="number" min="0" step="1" style={inputStyle} value={settingsForm.budget_limit} disabled={!isProjectOwner}
                onChange={(e) => setSettingsForm((p) => ({ ...p, budget_limit: e.target.value }))} />
            </div>
          </div>
          {isProjectOwner && (
            <button type="submit" disabled={savingSettings} style={{ ...buttonStyle, marginTop: 14, background: "#4f46e5", color: "#fff" }}>
              <Save size={15} /> {savingSettings ? "Đang lưu..." : "Lưu thông tin dự án"}
            </button>
          )}
        </form>
      </section>

      <section style={panelStyle}>
        <h4 style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><Tags size={18} color="#a78bfa" /> Danh mục và ước lượng chi phí</h4>
        {isProjectOwner && (
          <form onSubmit={saveCategory} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, alignItems: "end", marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Tên danh mục *</label>
              <input style={inputStyle} maxLength={120} required value={categoryForm.name}
                onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ví dụ: Nhân sự" />
            </div>
            <div>
              <label style={labelStyle}>Mô tả</label>
              <input style={inputStyle} value={categoryForm.description}
                onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} placeholder="Mô tả danh mục" />
            </div>
            <div>
              <label style={labelStyle}>Số tiền ước lượng (VNĐ)</label>
              <input style={inputStyle} type="number" min="0" step="1" value={categoryForm.estimated_amount}
                onChange={(e) => setCategoryForm((p) => ({ ...p, estimated_amount: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={savingRecord} style={{ ...buttonStyle, background: "#4f46e5", color: "#fff" }}>
                {editingCategoryId ? <Save size={15} /> : <Plus size={15} />}
                {editingCategoryId ? "Lưu danh mục" : "Thêm danh mục"}
              </button>
              {editingCategoryId && <button type="button" onClick={cancelCategoryEdit} style={{ ...buttonStyle, background: "#475569", color: "#fff" }}><X size={15} /> Hủy</button>}
            </div>
          </form>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600, fontSize: 13 }}>
            <thead><tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #475569" }}>
              <th style={{ padding: 10 }}>Danh mục</th><th style={{ padding: 10 }}>Mô tả</th><th style={{ padding: 10 }}>Ước lượng</th>
              {isProjectOwner && <th style={{ padding: 10, textAlign: "right" }}>Thao tác</th>}
            </tr></thead>
            <tbody>
              {categories.length ? categories.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: 10, fontWeight: 700 }}>{item.name}</td>
                  <td style={{ padding: 10, color: "#94a3b8" }}>{item.description || "—"}</td>
                  <td style={{ padding: 10, color: "#c4b5fd", fontWeight: 700 }}>{money(item.estimated_amount)}</td>
                  {isProjectOwner && <td style={{ padding: 10, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button title="Sửa danh mục" onClick={() => editCategory(item)} style={{ ...buttonStyle, padding: 7, background: "#334155", color: "#e2e8f0", marginRight: 6 }}><Pencil size={14} /></button>
                    <button title="Xóa danh mục" onClick={() => deleteCategory(item)} style={{ ...buttonStyle, padding: 7, background: "#7f1d1d", color: "#fecaca" }}><Trash2 size={14} /></button>
                  </td>}
                </tr>
              )) : <tr><td colSpan={isProjectOwner ? 4 : 3} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Chưa có danh mục chi phí.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <h4 style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><Receipt size={18} color="#34d399" /> Các khoản chi thực tế</h4>
        {isProjectOwner && (
          categories.length === 0 ? (
            <p style={{ color: "#fbbf24", fontSize: 13 }}>Bạn cần tạo ít nhất một danh mục trước khi ghi nhận khoản chi.</p>
          ) : (
            <form onSubmit={saveExpense} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, alignItems: "end", marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Tên khoản chi *</label>
                <input style={inputStyle} maxLength={255} required value={expenseForm.name}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ví dụ: Thanh toán máy chủ" />
              </div>
              <div>
                <label style={labelStyle}>Danh mục *</label>
                <select style={inputStyle} required value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, category_id: e.target.value }))}>
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Số tiền (VNĐ) *</label>
                <input style={inputStyle} type="number" min="1" step="1" required value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="1500000" />
              </div>
              <div>
                <label style={labelStyle}>Ngày chi *</label>
                <input style={inputStyle} type="date" required value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, expense_date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Ghi chú</label>
                <input style={inputStyle} value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} placeholder="Thông tin bổ sung" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={savingRecord} style={{ ...buttonStyle, background: "#059669", color: "#fff" }}>
                  {editingExpenseId ? <Save size={15} /> : <Plus size={15} />}
                  {editingExpenseId ? "Lưu khoản chi" : "Thêm khoản chi"}
                </button>
                {editingExpenseId && <button type="button" onClick={cancelExpenseEdit} style={{ ...buttonStyle, background: "#475569", color: "#fff" }}><X size={15} /> Hủy</button>}
              </div>
            </form>
          )
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680, fontSize: 13 }}>
            <thead><tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #475569" }}>
              <th style={{ padding: 10 }}>Khoản chi</th><th style={{ padding: 10 }}>Danh mục</th><th style={{ padding: 10 }}>Ngày chi</th><th style={{ padding: 10 }}>Số tiền</th><th style={{ padding: 10 }}>Ghi chú</th>
              {isProjectOwner && <th style={{ padding: 10, textAlign: "right" }}>Thao tác</th>}
            </tr></thead>
            <tbody>
              {expenses.length ? expenses.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: 10, fontWeight: 700 }}>{item.name}</td>
                  <td style={{ padding: 10 }}>{categoryName(item.category_id)}</td>
                  <td style={{ padding: 10, color: "#94a3b8" }}>{item.expense_date}</td>
                  <td style={{ padding: 10, color: "#34d399", fontWeight: 700 }}>{money(item.amount)}</td>
                  <td style={{ padding: 10, color: "#94a3b8" }}>{item.description || "—"}</td>
                  {isProjectOwner && <td style={{ padding: 10, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button title="Sửa khoản chi" onClick={() => editExpense(item)} style={{ ...buttonStyle, padding: 7, background: "#334155", color: "#e2e8f0", marginRight: 6 }}><Pencil size={14} /></button>
                    <button title="Xóa khoản chi" onClick={() => deleteExpense(item)} style={{ ...buttonStyle, padding: 7, background: "#7f1d1d", color: "#fecaca" }}><Trash2 size={14} /></button>
                  </td>}
                </tr>
              )) : <tr><td colSpan={isProjectOwner ? 6 : 5} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Chưa ghi nhận khoản chi thực tế nào.</td></tr>}
            </tbody>
            {expenses.length > 0 && <tfoot><tr style={{ borderTop: "1px solid #64748b" }}>
              <td colSpan="3" style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>Tổng chi thực tế</td>
              <td style={{ padding: 12, color: "#34d399", fontWeight: 800 }}>{money(totalActual)}</td>
              <td colSpan={isProjectOwner ? 2 : 1}></td>
            </tr></tfoot>}
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={18} color="#38bdf8" /> Danh sách công việc từ Kanban</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, fontSize: 13 }}>
            <thead><tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #475569" }}>
              <th style={{ padding: 10 }}>Công việc</th><th style={{ padding: 10 }}>Trạng thái</th><th style={{ padding: 10 }}>Ưu tiên</th><th style={{ padding: 10 }}>Người thực hiện</th><th style={{ padding: 10 }}>Hạn hoàn thành</th>
            </tr></thead>
            <tbody>
              {projectTasks.length ? projectTasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: 10 }}>{task.title}</td><td style={{ padding: 10 }}>{task.status || "—"}</td>
                  <td style={{ padding: 10 }}>{task.priority || "—"}</td><td style={{ padding: 10 }}>{task.assignee || "Chưa giao"}</td>
                  <td style={{ padding: 10 }}>{task.deadline ? String(task.deadline).slice(0, 10) : "—"}</td>
                </tr>
              )) : <tr><td colSpan="5" style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>Dự án chưa có công việc.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div style={{ color: "#64748b", fontSize: 11 }}>
        Dữ liệu ngân sách, danh mục và khoản chi được tải/lưu qua API Backend; tổng chi và ngân sách còn lại được tính từ dữ liệu thực tế trong cơ sở dữ liệu.
      </div>
    </div>
  );
}

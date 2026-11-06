
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  Eye,
  Clock,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import SubtaskDetail from './SubtaskDetail';

const COLUMNS = [
  ['todo', 'Cần làm', '#94a3b8'],
  ['in_progress', 'Đang làm', '#38bdf8'],
  ['review', 'Kiểm tra', '#fbbf24'],
  ['done', 'Hoàn thành', '#34d399'],
];

const API = 'http://127.0.0.1:8000';

async function request(projectId, groupId, suffix = '', options = {}) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Bạn cần đăng nhập lại');
  }

  const response = await fetch(
    `${API}/api/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(groupId)}/kanban${suffix}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
  );

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : `HTTP ${response.status}`,
    );
  }

  return data;
}

const panel = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 14,
  padding: 16,
};

const field = {
  width: '100%',
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  padding: '10px',
  borderRadius: 8,
  boxSizing: 'border-box',
};

const btn = {
  background: '#0284c7',
  color: 'white',
  border: 0,
  borderRadius: 8,
  padding: '9px 14px',
  cursor: 'pointer',
};

const INITIAL_FORM = {
  task_id: '',
  title: '',
  description: '',
  priority: 'medium',
  assignee_id: '',
  estimated_best_hours: '',
  estimated_average_hours: '',
  estimated_worst_hours: '',
};

// Chuyển ô nhập trống thành null.
const parseEstimate = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

// Định dạng thời gian dự kiến.
const displayEstimate = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Chưa ước lượng';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'Không xác định';
  }

  return `${number.toLocaleString('vi-VN')} giờ`;
};

export default function GroupKanbanBoard({
  projectId,
  group,
  projectTasks = [],
  currentUserId,
  isProjectOwner,
  onBack,
  showNotification,
}) {
  const [data, setData] = useState({
    tasks: [],
    subtasks: [],
  });

  const [detailId, setDetailId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [taskToAssign, setTaskToAssign] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);

  // ID của Subtask đang chỉnh sửa.
  // null nghĩa là đang ở chế độ tạo mới.
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);

  const canManage =
    isProjectOwner ||
    (!!currentUserId && group.leader_id === currentUserId);

  const members = group.members || [];

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const result = await request(projectId, group.id);

      setData({
        tasks: Array.isArray(result?.tasks) ? result.tasks : [],
        subtasks: Array.isArray(result?.subtasks)
          ? result.subtasks
          : [],
      });

      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, group.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const execute = async (work, success) => {
    if (busy) return;

    setBusy(true);

    try {
      await work();
      await refresh();

      showNotification?.(
        'thanh-cong',
        'Thành công',
        success,
      );
    } catch (e) {
      setError(e.message);

      showNotification?.(
        'loi',
        'Không thực hiện được',
        e.message,
      );
    } finally {
      setBusy(false);
    }
  };

  // Kiểm tra 3 mốc thời gian dự kiến.
  const validateEstimates = () => {
    const estimates = [
      {
        label: 'Thời gian tốt nhất',
        value: parseEstimate(form.estimated_best_hours),
      },
      {
        label: 'Thời gian trung bình',
        value: parseEstimate(form.estimated_average_hours),
      },
      {
        label: 'Thời gian tệ nhất',
        value: parseEstimate(form.estimated_worst_hours),
      },
    ];

    for (const estimate of estimates) {
      if (estimate.value === null) continue;

      if (
        !Number.isFinite(estimate.value) ||
        estimate.value <= 0
      ) {
        showNotification?.(
          'loi',
          'Thời gian không hợp lệ',
          `${estimate.label} phải là số lớn hơn 0.`,
        );

        return false;
      }
    }

    const provided = estimates.filter(
      (item) => item.value !== null,
    );

    for (let i = 1; i < provided.length; i++) {
      if (provided[i - 1].value > provided[i].value) {
        showNotification?.(
          'loi',
          'Thứ tự thời gian không hợp lệ',
          'Thời gian tốt nhất phải nhỏ hơn hoặc bằng trung bình, và trung bình phải nhỏ hơn hoặc bằng thời gian tệ nhất.',
        );

        return false;
      }
    }

    return true;
  };

  // Owner giao Task cho nhóm.
  const assign = () => {
    if (!taskToAssign) return;

    execute(
      async () => {
        await request(
          projectId,
          group.id,
          '/tasks',
          {
            method: 'POST',
            body: JSON.stringify({
              task_id: taskToAssign,
            }),
          },
        );

        setTaskToAssign('');
      },
      'Đã giao Task cho nhóm',
    );
  };

  // Bắt đầu chỉnh sửa Subtask.
  const startEdit = (subtask) => {
    if (!canManage || busy) return;

    setEditingSubtaskId(subtask.id);

    setForm({
      task_id: subtask.task_id || '',
      title: subtask.title || '',
      description: subtask.description || '',
      priority: subtask.priority || 'medium',
      assignee_id: subtask.assignee_id || '',

      estimated_best_hours:
        subtask.estimated_best_hours ?? '',

      estimated_average_hours:
        subtask.estimated_average_hours ?? '',

      estimated_worst_hours:
        subtask.estimated_worst_hours ?? '',
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Hủy chỉnh sửa.
  const cancelEdit = () => {
    setEditingSubtaskId(null);
    setForm(INITIAL_FORM);
  };

  // Tạo mới hoặc cập nhật Subtask.
  const submitForm = (e) => {
    e.preventDefault();

    if (!canManage) {
      showNotification?.(
        'loi',
        'Không có quyền',
        'Chỉ Owner hoặc Leader mới được tạo hoặc sửa Subtask.',
      );
      return;
    }

    if (!form.task_id || !form.title.trim()) {
      showNotification?.(
        'loi',
        'Thiếu thông tin',
        'Vui lòng chọn Task cha và nhập tên Subtask.',
      );
      return;
    }

    if (!validateEstimates()) return;

    const isEditing = Boolean(editingSubtaskId);

    execute(
      async () => {
        const payload = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          assignee_id: form.assignee_id || null,

          estimated_best_hours: parseEstimate(
            form.estimated_best_hours,
          ),

          estimated_average_hours: parseEstimate(
            form.estimated_average_hours,
          ),

          estimated_worst_hours: parseEstimate(
            form.estimated_worst_hours,
          ),
        };

        if (isEditing) {
          // Cập nhật Subtask hiện tại.
          await request(
            projectId,
            group.id,
            `/subtasks/${editingSubtaskId}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          );
        } else {
          // Tạo Subtask mới.
          await request(
            projectId,
            group.id,
            '/subtasks',
            {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                task_id: form.task_id,
              }),
            },
          );
        }

        setEditingSubtaskId(null);
        setForm(INITIAL_FORM);
      },
      isEditing
        ? 'Đã cập nhật Subtask'
        : 'Đã tạo Subtask',
    );
  };

  // Cập nhật trạng thái Subtask.
  const changeStatus = (subtask, status) =>
    execute(
      () =>
        request(
          projectId,
          group.id,
          `/subtasks/${subtask.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          },
        ),
      'Đã cập nhật trạng thái',
    );

  // Xóa Subtask.
  const remove = (subtask) => {
    if (!canManage || busy) return;

    if (!window.confirm(`Xóa Subtask "${subtask.title}"?`)) {
      return;
    }

    execute(
      () =>
        request(
          projectId,
          group.id,
          `/subtasks/${subtask.id}`,
          {
            method: 'DELETE',
          },
        ),
      'Đã xóa Subtask',
    );
  };

  // Gỡ Task khỏi nhóm.
  const unassign = (task) => {
    if (!isProjectOwner || busy) return;

    if (!window.confirm(`Gỡ Task "${task.title}" khỏi nhóm?`)) {
      return;
    }

    execute(
      () =>
        request(
          projectId,
          group.id,
          `/tasks/${task.id}`,
          {
            method: 'DELETE',
          },
        ),
      'Đã gỡ Task',
    );
  };

  const availableTasks = projectTasks.filter(
    (task) =>
      !data.tasks.some((assigned) => assigned.id === task.id),
  );

  const detailSubtask = data.subtasks.find(
    (subtask) => subtask.id === detailId,
  );

  if (detailSubtask) {
    return (
      <SubtaskDetail
        projectId={projectId}
        group={group}
        subtask={detailSubtask}
        parentTask={data.tasks.find(
          (task) => task.id === detailSubtask.task_id,
        )}
        currentUserId={currentUserId}
        isProjectOwner={isProjectOwner}
        onBack={() => setDetailId(null)}
        onStatusChange={async (subtask, status) => {
          await changeStatus(subtask, status);
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        color: '#f8fafc',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{ ...btn, background: '#334155' }}
        >
          <ArrowLeft
            size={15}
            style={{ verticalAlign: 'middle' }}
          />{' '}
          Chi tiết nhóm
        </button>

        <h3 style={{ margin: 0, fontSize: 20 }}>
          <Layers
            size={19}
            style={{
              verticalAlign: 'middle',
              color: '#38bdf8',
            }}
          />{' '}
          Kanban nhóm: {group.name}
        </h3>

        <button
          type="button"
          onClick={refresh}
          disabled={loading || busy}
          style={{ ...btn, background: '#334155' }}
        >
          <RefreshCw
            size={15}
            style={{ verticalAlign: 'middle' }}
          />{' '}
          Tải lại
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#451a1a',
            color: '#fecaca',
          }}
        >
          {error}
        </div>
      )}

      {/* OWNER GIAO TASK */}
      {isProjectOwner && (
        <div style={panel}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Owner giao Task dự án cho nhóm
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <select
              aria-label="Chọn Task dự án"
              style={{ ...field, flex: 1 }}
              value={taskToAssign}
              onChange={(e) =>
                setTaskToAssign(e.target.value)
              }
            >
              <option value="">
                -- Chọn Task chưa giao --
              </option>

              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              style={btn}
              disabled={busy || !taskToAssign}
              onClick={assign}
            >
              Giao Task
            </button>
          </div>
        </div>
      )}

      {/* DANH SÁCH TASK ĐƯỢC GIAO */}
      <div style={panel}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          Task dự án được giao ({data.tasks.length})
        </div>

        {data.tasks.length === 0 ? (
          <div style={{ color: '#94a3b8' }}>
            Chưa có Task nào được Owner giao cho nhóm.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {data.tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 10,
                  background: '#0f172a',
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong>{task.title}</strong>

                  <div
                    style={{
                      fontSize: 12,
                      color: '#94a3b8',
                    }}
                  >
                    {
                      data.subtasks.filter(
                        (subtask) =>
                          subtask.task_id === task.id,
                      ).length
                    }{' '}
                    Subtask · {task.status}
                  </div>
                </div>

                {isProjectOwner && (
                  <button
                    type="button"
                    title="Gỡ Task khỏi nhóm"
                    disabled={busy}
                    onClick={() => unassign(task)}
                    style={{
                      ...btn,
                      background: '#7f1d1d',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FORM TẠO / CHỈNH SỬA SUBTASK */}
      {canManage && data.tasks.length > 0 && (
        <form onSubmit={submitForm} style={panel}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 12,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            {editingSubtaskId ? (
              <>
                <Pencil size={17} color="#fbbf24" />
                Chỉnh sửa Subtask
              </>
            ) : (
              <>
                <Plus size={17} />
                Tạo Subtask mới
              </>
            )}
          </div>

          {editingSubtaskId && (
            <div
              style={{
                padding: 10,
                marginBottom: 12,
                borderRadius: 8,
                background: '#422006',
                color: '#fde68a',
                fontSize: 13,
              }}
            >
              Bạn đang chỉnh sửa Subtask. Hãy kiểm tra thông tin
              trước khi lưu thay đổi.
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 10,
            }}
          >
            <select
              required
              aria-label="Task cha"
              style={{
                ...field,
                opacity: editingSubtaskId ? 0.6 : 1,
                cursor: editingSubtaskId ? 'not-allowed' : 'pointer',
              }}
              value={form.task_id}
              disabled={Boolean(editingSubtaskId)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  task_id: e.target.value,
                }))
              }
            >
              <option value="">
                -- Thuộc Task dự án --
              </option>

              {data.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>

            <input
              required
              maxLength={255}
              placeholder="Tên Subtask"
              style={field}
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
            />

            <select
              aria-label="Người thực hiện"
              style={field}
              value={form.assignee_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  assignee_id: e.target.value,
                }))
              }
            >
              <option value="">-- Chưa phân công --</option>

              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Độ ưu tiên"
              style={field}
              value={form.priority}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  priority: e.target.value,
                }))
              }
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          <textarea
            placeholder="Mô tả Subtask (không bắt buộc)"
            style={{
              ...field,
              marginTop: 10,
              minHeight: 64,
            }}
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />

          {/* THỜI GIAN DỰ KIẾN */}
          <div
            style={{
              marginTop: 18,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Clock size={17} color="#38bdf8" />
              Thời gian thực hiện dự kiến
            </div>

            <div
              style={{
                color: '#94a3b8',
                fontSize: 12,
                marginTop: 5,
              }}
            >
              Đơn vị tính: giờ. Đây là thời gian ước lượng,
              không phải thời gian thực tế đã thực hiện.
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <label
                htmlFor="estimated-best-hours"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: '#34d399',
                  marginBottom: 6,
                }}
              >
                Tốt nhất (giờ)
              </label>

              <input
                id="estimated-best-hours"
                type="number"
                min="0.01"
                step="any"
                placeholder="VD: 2"
                style={field}
                value={form.estimated_best_hours}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    estimated_best_hours: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label
                htmlFor="estimated-average-hours"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: '#38bdf8',
                  marginBottom: 6,
                }}
              >
                Trung bình (giờ)
              </label>

              <input
                id="estimated-average-hours"
                type="number"
                min="0.01"
                step="any"
                placeholder="VD: 4"
                style={field}
                value={form.estimated_average_hours}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    estimated_average_hours: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label
                htmlFor="estimated-worst-hours"
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: '#fbbf24',
                  marginBottom: 6,
                }}
              >
                Tệ nhất (giờ)
              </label>

              <input
                id="estimated-worst-hours"
                type="number"
                min="0.01"
                step="any"
                placeholder="VD: 6"
                style={field}
                value={form.estimated_worst_hours}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    estimated_worst_hours: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div
            style={{
              color: '#94a3b8',
              fontSize: 12,
              marginTop: 8,
            }}
          >
            Có thể để trống. Nếu nhập, thời gian phải lớn hơn 0
            và theo thứ tự: Tốt nhất ≤ Trung bình ≤ Tệ nhất.
          </div>

          {/* NÚT LƯU / TẠO / HỦY */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 14,
            }}
          >
            <button
              disabled={busy}
              style={{
                ...btn,
                background: editingSubtaskId ? '#d97706' : '#0284c7',
                opacity: busy ? 0.6 : 1,
              }}
              type="submit"
            >
              {editingSubtaskId ? (
                <Save
                  size={15}
                  style={{ verticalAlign: 'middle' }}
                />
              ) : (
                <Plus
                  size={15}
                  style={{ verticalAlign: 'middle' }}
                />
              )}{' '}
              {busy
                ? 'Đang xử lý...'
                : editingSubtaskId
                  ? 'Lưu thay đổi'
                  : 'Tạo Subtask'}
            </button>

            {editingSubtaskId && (
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                style={{
                  ...btn,
                  background: '#475569',
                }}
              >
                <X
                  size={15}
                  style={{ verticalAlign: 'middle' }}
                />{' '}
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      )}

      {/* KANBAN SUBTASK */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(4, minmax(235px, 1fr))',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
        }}
      >
        {COLUMNS.map(([status, label, color]) => {
          const columnSubtasks = data.subtasks.filter(
            (subtask) => subtask.status === status,
          );

          return (
            <section
              key={status}
              style={{
                ...panel,
                padding: 12,
                minWidth: 235,
                alignSelf: 'start',
              }}
            >
              <h4
                style={{
                  margin: '0 0 14px',
                  color,
                }}
              >
                {label} ({columnSubtasks.length})
              </h4>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {columnSubtasks.map((subtask) => {
                  const allowed =
                    canManage ||
                    subtask.assignee_id === currentUserId;

                  return (
                    <article
                      key={subtask.id}
                      style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        {subtask.title}
                      </strong>

                      <button
                        type="button"
                        onClick={() => setDetailId(subtask.id)}
                        style={{
                          ...btn,
                          marginTop: 10,
                          background: '#334155',
                          width: '100%',
                          justifyContent: 'center',
                          display: 'flex',
                          gap: 7,
                          alignItems: 'center',
                        }}
                      >
                        <Eye size={15} /> Xem chi tiết
                      </button>

                      {subtask.description && (
                        <p
                          style={{
                            color: '#94a3b8',
                            fontSize: 12,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {subtask.description}
                        </p>
                      )}

                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: 12,
                          marginTop: 7,
                        }}
                      >
                        Task:{' '}
                        {data.tasks.find(
                          (task) =>
                            task.id === subtask.task_id,
                        )?.title || '—'}
                      </div>

                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: 12,
                        }}
                      >
                        Người làm:{' '}
                        {subtask.assignee_name || 'Chưa phân công'}
                      </div>

                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: 12,
                        }}
                      >
                        Ưu tiên: {subtask.priority}
                      </div>

                      {/* HIỂN THỊ THỜI GIAN DỰ KIẾN */}
                      <div
                        style={{
                          marginTop: 10,
                          padding: 9,
                          background: '#1e293b',
                          borderRadius: 8,
                          border: '1px solid #334155',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#38bdf8',
                            marginBottom: 7,
                          }}
                        >
                          <Clock size={14} />
                          Thời gian dự kiến
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 6,
                            fontSize: 11,
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ color: '#34d399' }}>
                            Tốt nhất
                          </span>
                          <span>
                            {displayEstimate(
                              subtask.estimated_best_hours,
                            )}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 6,
                            fontSize: 11,
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ color: '#38bdf8' }}>
                            Trung bình
                          </span>
                          <span>
                            {displayEstimate(
                              subtask.estimated_average_hours,
                            )}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 6,
                            fontSize: 11,
                          }}
                        >
                          <span style={{ color: '#fbbf24' }}>
                            Tệ nhất
                          </span>
                          <span>
                            {displayEstimate(
                              subtask.estimated_worst_hours,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* ĐỔI TRẠNG THÁI */}
                      {allowed && (
                        <select
                          aria-label={`Đổi trạng thái ${subtask.title}`}
                          disabled={busy}
                          style={{
                            ...field,
                            marginTop: 10,
                          }}
                          value={subtask.status}
                          onChange={(e) =>
                            changeStatus(
                              subtask,
                              e.target.value,
                            )
                          }
                        >
                          {COLUMNS.map(([value, name]) => (
                            <option key={value} value={value}>
                              {name}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* NÚT SỬA VÀ XÓA */}
                      {canManage && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 10,
                            borderTop: '1px solid #334155',
                            paddingTop: 9,
                          }}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(subtask)}
                            style={{
                              ...btn,
                              flex: 1,
                              background: '#854d0e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: '8px 10px',
                            }}
                          >
                            <Pencil size={14} />
                            Sửa
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remove(subtask)}
                            style={{
                              ...btn,
                              flex: 1,
                              background: '#7f1d1d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: '8px 10px',
                            }}
                          >
                            <Trash2 size={14} />
                            Xóa
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}

                {!loading && columnSubtasks.length === 0 && (
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 12,
                    }}
                  >
                    Chưa có Subtask
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

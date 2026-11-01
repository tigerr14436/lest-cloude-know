
import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

const priorityLabels = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

export default function AISubtaskProposalCard({
  proposal,
  draft,
  onChange,
  onSave,
  onConfirm,
  onReject,
  canConfirm,
  busy,
  error,
}) {
  if (!proposal) {
    return (
      <div className="ai-proposal-loading">
        <Loader2 size={16} className="ai-spin" />
        Đang tải đề xuất Subtask...
      </div>
    );
  }

  const items = Array.isArray(draft)
    ? draft
    : proposal.items || [];

  const isPending = proposal.status === 'pending';

  const isDirty =
    JSON.stringify(items) !==
    JSON.stringify(proposal.items || []);

  return (
    <section className="ai-proposal-card">
      <div className="ai-proposal-header">
        <div>
          <div className="ai-proposal-title">
            <ShieldCheck size={17} />
            Đề xuất Subtask
          </div>

          <div className="ai-proposal-meta">
            Task ID: {proposal.task_id}
          </div>
        </div>

        <span className={`ai-proposal-status ${proposal.status}`}>
          {proposal.status === 'pending'
            ? 'Chờ xác nhận'
            : proposal.status === 'confirmed'
              ? 'Đã xác nhận'
              : 'Đã từ chối'}
        </span>
      </div>

      <div className="ai-proposal-items">
        {items.map((item, index) => (
          <div
            className="ai-proposal-item"
            key={`${proposal.id}-${index}`}
          >
            <div className="ai-proposal-item-heading">
              Subtask {index + 1}
            </div>

            <label>Tiêu đề</label>
            <input
              type="text"
              maxLength={255}
              value={item.title || ''}
              disabled={!isPending || busy}
              onChange={(event) =>
                onChange(index, 'title', event.target.value)
              }
            />

            <label>Mô tả</label>
            <textarea
              rows={2}
              value={item.description || ''}
              disabled={!isPending || busy}
              onChange={(event) =>
                onChange(index, 'description', event.target.value)
              }
            />

            <label>Độ ưu tiên</label>
            <select
              value={item.priority || 'medium'}
              disabled={!isPending || busy}
              onChange={(event) =>
                onChange(index, 'priority', event.target.value)
              }
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>
        ))}
      </div>

      {error && (
        <div className="ai-proposal-error">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {isPending && (
        <>
          {!canConfirm && (
            <div className="ai-proposal-permission">
              Chỉ Owner hoặc Leader của nhóm được xác nhận tạo Subtask.
              Bạn vẫn có thể chỉnh sửa hoặc từ chối đề xuất này.
            </div>
          )}

          <div className="ai-proposal-actions">
            <button
              type="button"
              className="ai-proposal-save"
              disabled={busy || !isDirty}
              onClick={onSave}
            >
              {busy
                ? <Loader2 size={15} className="ai-spin" />
                : <Save size={15} />}
              Lưu chỉnh sửa
            </button>

            <button
              type="button"
              className="ai-proposal-confirm"
              disabled={
                busy ||
                !canConfirm ||
                items.length === 0 ||
                items.some(item => !item.title?.trim())
              }
              onClick={onConfirm}
            >
              {busy
                ? <Loader2 size={15} className="ai-spin" />
                : <CheckCircle2 size={15} />}
              Xác nhận tạo Subtask
            </button>

            <button
              type="button"
              className="ai-proposal-reject"
              disabled={busy}
              onClick={onReject}
            >
              <XCircle size={15} />
              Từ chối
            </button>
          </div>
        </>
      )}

      {proposal.status === 'confirmed' && (
        <div className="ai-proposal-success">
          <CheckCircle2 size={17} />
          Đã tạo thành công {proposal.created_subtask_ids?.length || 0} Subtask.
          Hãy mở Kanban nhóm để kiểm tra.
        </div>
      )}

      {proposal.status === 'rejected' && (
        <div className="ai-proposal-rejected">
          Đề xuất này đã bị từ chối. Không có Subtask nào được tạo.
        </div>
      )}
    </section>
  );
}

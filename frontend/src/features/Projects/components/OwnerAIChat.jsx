
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot, Send, Plus, MessageSquare, Sparkles, Loader2,
  User, CheckCircle2, XCircle, Clock, ShieldCheck,
  RefreshCw, ListTodo, Users, CalendarDays, AlertCircle,
  History, Play, ChevronDown, ChevronUp, Calendar,
  UserRound, FolderKanban
} from "lucide-react";
import "./OwnerAIChat.css";

const API_BASE = "http://127.0.0.1:8000";

async function ownerAIRequest(projectId, path = "", options = {}) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Phiên đăng nhập hết hạn.");
  }

  const response = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/owner-ai/conversations${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Lỗi HTTP ${response.status}`
    );
  }

  return data;
}

const ACTION_LABELS = {
  task_create: "Tạo công việc",
  task_update: "Cập nhật công việc",
  group_create: "Tạo nhóm",
  group_update: "Cập nhật nhóm",
  member_invite: "Mời thành viên",
  weekly_schedule_create: "Tạo kế hoạch tuần",
  member_role_update: "Thay đổi vai trò",
};

const STATUS_LABELS = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  executed: "Đã thực thi",
  failed: "Thực thi thất bại",
};

const PRIORITY_LABELS = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

function formatDate(value) {
  if (!value) return "Chưa thiết lập";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Deadline thường có dạng YYYY-MM-DD.
// Dùng định dạng riêng để tránh lệch ngày do múi giờ.
function formatDeadline(value) {
  if (!value) return "Chưa thiết lập";

  const text = String(value);

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleDateString("vi-VN");
}

function getPriorityLabel(priority) {
  return PRIORITY_LABELS[String(priority || "").toLowerCase()] || "Chưa xác định";
}

function getPayload(proposal) {
  return (
    proposal?.payload ||
    proposal?.action_payload ||
    proposal?.proposed_action ||
    {}
  );
}

function getProposalResult(proposal) {
  return (
    proposal?.result ||
    proposal?.execution_result ||
    {}
  );
}

function getProposalStatus(proposal) {
  return String(
    proposal?.status ||
    proposal?.proposal_status ||
    "pending"
  ).toLowerCase();
}

function normalizeProposalResponse(response, previous, action) {
  // Một số API có thể trả proposal trực tiếp,
  // một số API trả proposal bên trong object.
  const updated =
    response?.proposal ||
    response?.data?.proposal ||
    response?.data ||
    response ||
    {};

  const fallbackStatus =
    action === "approve" ? "approved" : "rejected";

  return {
    ...previous,
    ...updated,
    id: updated.id || previous.id,
    action_type:
      updated.action_type || previous.action_type,
    payload:
      updated.payload ||
      updated.action_payload ||
      previous.payload ||
      previous.action_payload ||
      {},
    status:
      updated.status ||
      updated.proposal_status ||
      fallbackStatus,
  };
}

/**
 * Bảng hiển thị đề xuất Task.
 * Không thay đổi payload gốc từ Backend.
 */
function TaskProposalTable({ tasks, isWeekly = false }) {
  const taskList = Array.isArray(tasks) ? tasks : [tasks];

  if (!taskList.length) {
    return (
      <div className="owner-empty-proposal">
        Không có công việc nào trong đề xuất.
      </div>
    );
  }

  return (
    <div className="owner-task-table-wrapper">
      {isWeekly && (
        <div className="owner-weekly-heading">
          <CalendarDays size={17} />
          Danh sách công việc trong kế hoạch tuần
        </div>
      )}

      <div className="owner-task-table-scroll">
        <table className="owner-task-table">
          <thead>
            <tr>
              <th className="owner-task-index">STT</th>
              <th>Tên công việc</th>
              <th>Mô tả</th>
              <th>Độ ưu tiên</th>
              <th>Deadline</th>
              <th>Nhóm</th>
              <th>Người phụ trách</th>
            </tr>
          </thead>

          <tbody>
            {taskList.map((task, index) => (
              <tr key={task.id || task.task_id || index}>
                <td className="owner-task-index">{index + 1}</td>

                <td>
                  <div className="owner-task-title">
                    {task.title || task.name || "Chưa có tên"}
                  </div>
                </td>

                <td>
                  <div className="owner-task-description">
                    {task.description || "Không có mô tả"}
                  </div>
                </td>

                <td>
                  <span
                    className={`owner-priority ${
                      String(task.priority || "").toLowerCase()
                    }`}
                  >
                    {getPriorityLabel(task.priority)}
                  </span>
                </td>

                <td>
                  <span className="owner-task-meta">
                    <Calendar size={14} />
                    {formatDeadline(task.deadline || task.due_date)}
                  </span>
                </td>

                <td>
                  <span className="owner-task-meta">
                    <FolderKanban size={14} />
                    {task.group_name ||
                      task.group_id ||
                      "Chưa phân công"}
                  </span>
                </td>

                <td>
                  <span className="owner-task-meta">
                    <UserRound size={14} />
                    {task.assignee_name ||
                      task.assignee_id ||
                      "Chưa phân công"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="owner-task-table-footer">
        <ListTodo size={15} />
        Tổng cộng: <strong>{taskList.length}</strong> công việc
      </div>
    </div>
  );
}

/**
 * Hiển thị payload dạng thông tin có cấu trúc
 * đối với các loại đề xuất không phải tạo Task.
 */
function GenericProposalDetails({ payload }) {
  const entries = Object.entries(payload || {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  if (!entries.length) {
    return <p className="owner-empty-proposal">Không có dữ liệu chi tiết.</p>;
  }

  return (
    <div className="owner-generic-details">
      {entries.map(([key, value]) => (
        <div className="owner-generic-row" key={key}>
          <span>{key}</span>
          <strong>
            {typeof value === "object"
              ? JSON.stringify(value)
              : String(value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ProposalCard({ proposal, onReview, onExecute, busy }) {
  const [expanded, setExpanded] = useState(true);

  const payload = getPayload(proposal);
  const result = getProposalResult(proposal);
  const status = getProposalStatus(proposal);

  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isExecuted = status === "executed";
  const isFailed = status === "failed";

  const isTaskCreate = proposal.action_type === "task_create";
  const isWeeklySchedule =
    proposal.action_type === "weekly_schedule_create";

  const weeklyTasks = Array.isArray(payload.tasks)
    ? payload.tasks
    : [];

  const showProposalDetails = isPending;

  return (
    <section className="owner-proposal">
      {/* HEADER */}
      <div className="owner-proposal-head">
        <div className="owner-proposal-icon">
          <ListTodo size={19} />
        </div>

        <div className="owner-proposal-heading">
          <strong>
            {ACTION_LABELS[proposal.action_type] ||
              proposal.action_type ||
              "Đề xuất từ AI"}
          </strong>

          <span>Đề xuất từ Owner AI</span>
        </div>

        <span className={`owner-status ${status}`}>
          {STATUS_LABELS[status] || status}
        </span>

        <button
          type="button"
          className="owner-icon-button"
          onClick={() => setExpanded(value => !value)}
          title={expanded ? "Thu gọn" : "Mở rộng"}
        >
          {expanded ? (
            <ChevronUp size={17} />
          ) : (
            <ChevronDown size={17} />
          )}
        </button>
      </div>

      {expanded && (
        <>
          {/* CHỈ HIỂN THỊ CHI TIẾT KHI ĐANG CHỜ DUYỆT */}
          {showProposalDetails && (
            <div className="owner-proposal-content">
              {isTaskCreate ? (
                <>
                  <div className="owner-payload-title">
                    <ListTodo size={17} />
                    Chi tiết công việc được đề xuất
                  </div>

                  <TaskProposalTable tasks={payload} />
                </>
              ) : isWeeklySchedule ? (
                <>
                  <div className="owner-payload-title">
                    <CalendarDays size={17} />
                    Kế hoạch công việc
                  </div>

                  <div className="owner-weekly-period">
                    <div>
                      <span>Ngày bắt đầu</span>
                      <strong>
                        {formatDeadline(payload.start_date)}
                      </strong>
                    </div>

                    <div>
                      <span>Ngày kết thúc</span>
                      <strong>
                        {formatDeadline(payload.end_date)}
                      </strong>
                    </div>
                  </div>

                  <TaskProposalTable
                    tasks={weeklyTasks}
                    isWeekly
                  />
                </>
              ) : (
                <>
                  <div className="owner-payload-title">
                    Nội dung đề xuất
                  </div>

                  <GenericProposalDetails payload={payload} />
                </>
              )}
            </div>
          )}

          {/* ĐÃ DUYỆT */}
          {isApproved && (
            <div className="owner-approved-panel">
              <div className="owner-approved-panel-icon">
                <ShieldCheck size={23} />
              </div>

              <div className="owner-approved-panel-content">
                <strong>Đề xuất đã được duyệt</strong>

                <span>
                  Chủ dự án đã chấp thuận đề xuất này.
                  Bạn có thể thực thi để tạo hoặc cập nhật dữ liệu.
                </span>
              </div>

              <button
                type="button"
                className="owner-button owner-button-success"
                disabled={busy}
                onClick={() => onExecute(proposal)}
              >
                {busy ? (
                  <Loader2 className="owner-spin" size={16} />
                ) : (
                  <Play size={15} />
                )}

                Thực thi
              </button>
            </div>
          )}

          {/* ĐÃ TỪ CHỐI */}
          {isRejected && (
            <div className="owner-rejected-panel">
              <div className="owner-rejected-panel-icon">
                <XCircle size={23} />
              </div>

              <div className="owner-rejected-panel-content">
                <strong>Đề xuất đã bị từ chối</strong>

                <span>
                  Đề xuất này đã được chủ dự án từ chối.
                  Nội dung đề xuất không được thực thi.
                </span>
              </div>
            </div>
          )}

          {/* ĐÃ THỰC THI */}
          {isExecuted && (
            <div className="owner-executed-panel">
              <div className="owner-executed-panel-icon">
                <CheckCircle2 size={23} />
              </div>

              <div className="owner-executed-panel-content">
                <strong>Thực thi thành công</strong>

                <span>
                  Hệ thống đã thực hiện đề xuất này.
                </span>

                {Object.keys(result).length > 0 && (
                  <pre>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* THỰC THI THẤT BẠI */}
          {isFailed && (
            <div className="owner-failed-panel">
              <AlertCircle size={20} />

              <div>
                <strong>Thực thi thất bại</strong>

                <span>
                  {result.error ||
                    result.message ||
                    "Không thể thực thi đề xuất. Vui lòng kiểm tra lại."}
                </span>
              </div>
            </div>
          )}

          {/* NÚT DUYỆT / TỪ CHỐI */}
          {isPending && (
            <div className="owner-proposal-actions">
              <button
                type="button"
                className="owner-button owner-button-danger"
                disabled={busy}
                onClick={() => onReview(proposal, "reject")}
              >
                {busy ? (
                  <Loader2 className="owner-spin" size={16} />
                ) : (
                  <XCircle size={16} />
                )}

                Từ chối
              </button>

              <button
                type="button"
                className="owner-button owner-button-primary"
                disabled={busy}
                onClick={() => onReview(proposal, "approve")}
              >
                {busy ? (
                  <Loader2 className="owner-spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}

                Duyệt đề xuất
              </button>
            </div>
          )}

          <div className="owner-proposal-date">
            Tạo lúc: {formatDate(proposal.created_at)}
          </div>
        </>
      )}
    </section>
  );
}

export default function OwnerAIChat({ projectId, projectName }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [proposals, setProposals] = useState({});
  const [logs, setLogs] = useState([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, proposals]);

  const loadProposals = async (conversationId) => {
    const data = await ownerAIRequest(
      projectId,
      `/${encodeURIComponent(conversationId)}/proposals`
    );

    const next = {};

    (Array.isArray(data) ? data : []).forEach(item => {
      next[item.id] = item;
    });

    setProposals(next);
  };

  const loadLogs = async (conversationId) => {
    const data = await ownerAIRequest(
      projectId,
      `/${encodeURIComponent(conversationId)}/execution-logs`
    );

    setLogs(Array.isArray(data) ? data : []);
  };

  const openConversation = async (conversationId) => {
    setSelectedId(conversationId);
    setMessages([]);
    setProposals({});
    setLogs([]);
    setError("");

    try {
      const [messageData] = await Promise.all([
        ownerAIRequest(
          projectId,
          `/${encodeURIComponent(conversationId)}/messages`
        ),
        loadProposals(conversationId),
        loadLogs(conversationId),
      ]);

      setMessages(
        Array.isArray(messageData) ? messageData : []
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const loadConversations = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError("");

    try {
      const data = await ownerAIRequest(projectId);
      const list = Array.isArray(data) ? data : [];

      setConversations(list);

      if (list.length > 0) {
        await openConversation(list[0].id);
      } else {
        setSelectedId(null);
        setMessages([]);
        setProposals({});
        setLogs([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const createConversation = async () => {
    setCreating(true);
    setError("");

    try {
      const conversation = await ownerAIRequest(
        projectId,
        "",
        {
          method: "POST",
          body: JSON.stringify({
            title: `Cuộc trò chuyện ${new Date().toLocaleDateString("vi-VN")}`,
          }),
        }
      );

      setConversations(prev => [
        conversation,
        ...prev.filter(item => item.id !== conversation.id),
      ]);

      await openConversation(conversation.id);

      inputRef.current?.focus();

      return conversation;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();

    const content = input.trim();

    if (!content || !selectedId || sending) {
      return;
    }

    setSending(true);
    setError("");
    setInput("");

    const conversationId = selectedId;

    const optimisticMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const data = await ownerAIRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: content }),
        }
      );

      setMessages(prev => [
        ...prev.filter(
          item => item.id !== optimisticMessage.id
        ),
        optimisticMessage,
        ...(data.message ? [data.message] : []),
      ]);

      if (data.proposal) {
        setProposals(prev => ({
          ...prev,
          [data.proposal.id]: data.proposal,
        }));
      }

      setConversations(prev =>
        prev
          .map(item =>
            item.id === conversationId
              ? {
                  ...item,
                  updated_at: new Date().toISOString(),
                }
              : item
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at) -
              new Date(a.updated_at)
          )
      );
    } catch (err) {
      setMessages(prev =>
        prev.filter(
          item => item.id !== optimisticMessage.id
        )
      );

      setInput(content);
      setError(err.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

 const reviewProposal = async (proposal, action) => {
  setBusyId(proposal.id);
  setError("");

  try {
    const response = await ownerAIRequest(
      projectId,
      `/${encodeURIComponent(selectedId)}/proposals/${encodeURIComponent(proposal.id)}/review`,
      {
        method: "POST",
        body: JSON.stringify({ action }),
      }
    );

    const updated = normalizeProposalResponse(
      response,
      proposal,
      action
    );

    setProposals(prev => ({
      ...prev,
      [proposal.id]: updated,
    }));

  } catch (err) {
    setError(err.message);
  } finally {
    setBusyId(null);
  }
};

  const executeProposal = async (proposal) => {
    const confirmed = window.confirm(
      "Bạn xác nhận thực thi đề xuất này?"
    );

    if (!confirmed) return;

    setBusyId(proposal.id);
    setError("");

    try {
      const result = await ownerAIRequest(
        projectId,
        `/${encodeURIComponent(selectedId)}/proposals/${encodeURIComponent(proposal.id)}/execute`,
        { method: "POST" }
      );

      const refreshed = await ownerAIRequest(
        projectId,
        `/${encodeURIComponent(selectedId)}/proposals/${encodeURIComponent(proposal.id)}`
      );

setProposals(prev => ({
  ...prev,
  [proposal.id]: refreshed,
}));

// Đồng bộ Kanban sau khi Owner AI thực thi Task thành công
const finalStatus =
  refreshed?.status ||
  refreshed?.proposal?.status ||
  result?.status;

const isTaskAction = [
  "task_create",
  "task_update",
  "weekly_schedule_create",
].includes(proposal.action_type);

if (finalStatus === "executed" && isTaskAction) {
  window.dispatchEvent(
    new CustomEvent("devtask:project-tasks-updated", {
      detail: {
        projectId,
      },
    })
  );
}

await loadLogs(selectedId);

      if (result?.status === "failed") {
        setError(
          result.message || "Thực thi thất bại."
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const proposalForMessage = (message) => {
    const proposalId = message.sources?.proposal_id;

    if (!proposalId) return null;

    return proposals[proposalId] || null;
  };

  /**
   * Nếu Backend trả nội dung JSON trong message
   * và message đã có ProposalCard tương ứng,
   * ẩn JSON thô để tránh hiển thị trùng lặp.
   */
  const getMessageDisplayContent = (message, proposal) => {
  const content = message.content || "";

  if (typeof content !== "string") {
    return "";
  }

  // Đã có ProposalCard tương ứng thì không hiển thị JSON trong tin nhắn.
  if (proposal) {
    try {
      const parsed = JSON.parse(content);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return "";
      }
    } catch {
      // Nội dung văn bản bình thường vẫn được giữ.
    }
  }

  // Ẩn JSON kết quả tạo Task nếu Backend trả trực tiếp trong message.
  try {
    const parsed = JSON.parse(content);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.title &&
      (
        parsed.task_id ||
        parsed.project_id ||
        parsed.action_type ||
        parsed.tasks
      )
    ) {
      return "";
    }
  } catch {
    // Không phải JSON.
  }

  return content;
};

  const suggestionPrompts = [
    {
      icon: <ListTodo size={17} />,
      title: "Phân tích tiến độ dự án",
      prompt:
        "Hãy phân tích tiến độ hiện tại của dự án, chỉ ra các công việc chậm tiến độ và rủi ro.",
    },
    {
      icon: <Sparkles size={17} />,
      title: "Đề xuất công việc",
      prompt:
        "Dựa trên tình hình dự án, hãy đề xuất các Task cần thực hiện tiếp theo.",
    },
    {
      icon: <Users size={17} />,
      title: "Đánh giá nhân sự",
      prompt:
        "Hãy phân tích tình hình phân công công việc và tải công việc của các thành viên.",
    },
    {
      icon: <CalendarDays size={17} />,
      title: "Lập kế hoạch tuần",
      prompt:
        "Hãy đề xuất kế hoạch Task cho tuần tiếp theo.",
    },
  ];

  if (loading) {
    return (
      <div className="owner-chat-loading">
        <Loader2 className="owner-spin" size={24} />
        Đang tải Owner AI...
      </div>
    );
  }

  return (
    <div className="owner-chat-page">
      <aside
        className={`owner-chat-sidebar ${
          showHistory ? "" : "collapsed"
        }`}
      >
        <div className="owner-sidebar-brand">
          <div className="owner-brand-icon">
            <Bot size={23} />
          </div>

          {showHistory && (
            <div>
              <strong>Owner AI</strong>
              <span>Trợ lý quản lý dự án</span>
            </div>
          )}
        </div>

        {showHistory && (
          <>
            <button
              type="button"
              className="owner-new-chat"
              onClick={createConversation}
              disabled={creating}
            >
              {creating ? (
                <Loader2
                  className="owner-spin"
                  size={17}
                />
              ) : (
                <Plus size={17} />
              )}
              Cuộc trò chuyện mới
            </button>

            <div className="owner-history-label">
              <History size={14} />
              LỊCH SỬ HỘI THOẠI
            </div>

            <div className="owner-history-list">
              {conversations.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`owner-history-item ${
                    selectedId === item.id ? "active" : ""
                  }`}
                  onClick={() => openConversation(item.id)}
                >
                  <MessageSquare size={16} />
                  <span>{item.title}</span>
                </button>
              ))}

              {!conversations.length && (
                <div className="owner-history-empty">
                  Chưa có cuộc hội thoại nào.
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          className="owner-history-toggle"
          onClick={() =>
            setShowHistory(value => !value)
          }
          title={
            showHistory
              ? "Thu gọn lịch sử"
              : "Mở lịch sử"
          }
        >
          {showHistory ? (
            <ChevronDown size={17} />
          ) : (
            <History size={17} />
          )}

          {showHistory ? "Thu gọn" : "Lịch sử"}
        </button>
      </aside>

      <main className="owner-chat-main">
        <header className="owner-chat-header">
          <div className="owner-header-avatar">
            <Bot size={21} />
          </div>

          <div>
            <strong>Trợ lý Owner AI</strong>
            <span>
              <i />
              Đang hỗ trợ: {projectName}
            </span>
          </div>

          <button
            type="button"
            className="owner-icon-button"
            onClick={() =>
              selectedId
                ? openConversation(selectedId)
                : loadConversations()
            }
            title="Tải lại hội thoại"
          >
            <RefreshCw size={17} />
          </button>
        </header>

        {error && (
          <div className="owner-error">
            <AlertCircle size={17} />
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
            >
              Đóng
            </button>
          </div>
        )}

        <section className="owner-chat-messages">
          {!selectedId ? (
            <div className="owner-welcome">
              <div className="owner-welcome-icon">
                <Sparkles size={32} />
              </div>

              <h2>Xin chào, Chủ dự án!</h2>

              <p>
                Tôi là trợ lý AI hỗ trợ phân tích, lập kế hoạch
                và quản lý công việc cho dự án{" "}
                <strong>{projectName}</strong>.
              </p>

              <div className="owner-suggestions">
                {suggestionPrompts.map(item => (
                  <button
                    type="button"
                    key={item.title}
                    onClick={async () => {
                      const conversation =
                        await createConversation();

                      if (conversation) {
                        setInput(item.prompt);
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="owner-button owner-button-primary"
                onClick={createConversation}
                disabled={creating}
              >
                <Plus size={17} />
                Bắt đầu hội thoại
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="owner-welcome">
              <div className="owner-welcome-icon">
                <Bot size={32} />
              </div>

              <h2>Chúng ta bắt đầu nhé!</h2>

              <p>
                Hãy gửi yêu cầu để Owner AI phân tích dự án
                hoặc đề xuất hành động.
              </p>

              <div className="owner-suggestions">
                {suggestionPrompts.map(item => (
                  <button
                    type="button"
                    key={item.title}
                    onClick={() => setInput(item.prompt)}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="owner-message-list">
              {messages.map(message => {
                const proposal =
                  proposalForMessage(message);

                const displayContent =
                  getMessageDisplayContent(
                    message,
                    proposal
                  );

                return (
                  <div
                    className={`owner-message ${message.role}`}
                    key={message.id}
                  >
                    <div className="owner-message-avatar">
                      {message.role === "user" ? (
                        <User size={17} />
                      ) : (
                        <Bot size={18} />
                      )}
                    </div>

                    <div className="owner-message-content">
                      <div className="owner-message-meta">
                        <strong>
                          {message.role === "user"
                            ? "Bạn"
                            : "Owner AI"}
                        </strong>

                        <span>
                          {formatDate(message.created_at)}
                        </span>
                      </div>

                      {displayContent && (
                        <div className="owner-message-text">
                          {displayContent}
                        </div>
                      )}

                      {proposal && (
                        <ProposalCard
                          proposal={proposal}
                          onReview={reviewProposal}
                          onExecute={executeProposal}
                          busy={busyId === proposal.id}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="owner-thinking">
                  <Loader2
                    className="owner-spin"
                    size={17}
                  />
                  Owner AI đang phân tích dự án...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {selectedId && (
          <form
            className="owner-chat-input-area"
            onSubmit={sendMessage}
          >
            <div className="owner-chat-input">
              <textarea
                ref={inputRef}
                value={input}
                onChange={event =>
                  setInput(event.target.value)
                }
                onKeyDown={event => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Nhập yêu cầu cho Owner AI..."
                rows={2}
                disabled={sending}
              />

              <button
                type="submit"
                disabled={!input.trim() || sending}
                title="Gửi tin nhắn"
              >
                {sending ? (
                  <Loader2
                    className="owner-spin"
                    size={19}
                  />
                ) : (
                  <Send size={19} />
                )}
              </button>
            </div>

            <small>
              Enter để gửi · Shift + Enter để xuống dòng
            </small>
          </form>
        )}

        {selectedId && logs.length > 0 && (
          <div className="owner-log-footer">
            <Clock size={14} />
            {logs.length} lượt thực thi đã được ghi nhận
            trong hội thoại này
          </div>
        )}
      </main>
    </div>
  );
}

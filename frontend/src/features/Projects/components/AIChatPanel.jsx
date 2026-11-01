
import React, {
  useState,
  useEffect,
  useRef,
  useCallback
} from 'react';

import {
  Bot,
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  XCircle,
  Save,
  ShieldCheck,
  Clock,
  ListTodo
} from 'lucide-react';

import './AIChatPanel.css';

const API_BASE = 'http://127.0.0.1:8000';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' }
];

// =====================================================
// API REQUEST
// =====================================================

async function aiRequest(projectId, path = '', options = {}) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error(
      'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
    );
  }

  const response = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/ai/conversations${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || `Yêu cầu thất bại (${response.status})`
    );
  }

  return data;
}

// =====================================================
// FORMAT HELPERS
// =====================================================

function formatTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(value) {
  if (!value) return '';

  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getPriorityLabel(priority) {
  return (
    PRIORITY_OPTIONS.find(item => item.value === priority)?.label ||
    'Trung bình'
  );
}

// =====================================================
// PROPOSAL CARD
// =====================================================

function AISubtaskProposalCard({
  proposal,
  draft,
  onChange,
  onSave,
  onConfirm,
  onReject,
  canConfirm,
  busy,
  error
}) {
  if (!proposal) {
    return (
      <div className="ai-proposal-loading">
        <Loader2 size={17} className="ai-spin" />
        Đang tải đề xuất Subtask...
      </div>
    );
  }

  const items = Array.isArray(draft)
    ? draft
    : proposal.items || [];

  const isPending = proposal.status === 'pending';
  const isConfirmed = proposal.status === 'confirmed';
  const isRejected = proposal.status === 'rejected';

  const isDirty =
    JSON.stringify(items) !==
    JSON.stringify(proposal.items || []);

  const hasInvalidTitle = items.some(
    item => !item.title?.trim()
  );

  const statusLabel = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    rejected: 'Đã từ chối'
  };

  return (
    <section className="ai-proposal-card">

      <div className="ai-proposal-header">
        <div className="ai-proposal-title">
          <ListTodo size={19} />

          <div>
            <strong>Đề xuất Subtask</strong>
            <span>
              {items.length} công việc được đề xuất
            </span>
          </div>
        </div>

        <span className={`ai-proposal-status ${proposal.status}`}>
          {isPending && <Clock size={13} />}
          {isConfirmed && <CheckCircle2 size={13} />}
          {isRejected && <XCircle size={13} />}

          {statusLabel[proposal.status] || proposal.status}
        </span>
      </div>

      <div className="ai-proposal-items">
        {items.map((item, index) => (
          <div
            className="ai-proposal-item"
            key={index}
          >
            <div className="ai-proposal-item-heading">
              <strong>Subtask {index + 1}</strong>

              <span>
                {getPriorityLabel(item.priority)}
              </span>
            </div>

            <div className="ai-proposal-field">
              <label>Tên Subtask</label>

              <input
                type="text"
                value={item.title || ''}
                disabled={!isPending || busy}
                maxLength={255}
                onChange={event =>
                  onChange(index, 'title', event.target.value)
                }
                placeholder="Nhập tên Subtask..."
              />
            </div>

            <div className="ai-proposal-field">
              <label>Mô tả</label>

              <textarea
                value={item.description || ''}
                disabled={!isPending || busy}
                rows={2}
                onChange={event =>
                  onChange(
                    index,
                    'description',
                    event.target.value
                  )
                }
                placeholder="Mô tả nội dung công việc..."
              />
            </div>

            <div className="ai-proposal-field">
              <label>Độ ưu tiên</label>

              <select
                value={item.priority || 'medium'}
                disabled={!isPending || busy}
                onChange={event =>
                  onChange(
                    index,
                    'priority',
                    event.target.value
                  )
                }
              >
                {PRIORITY_OPTIONS.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {isConfirmed && (
        <div className="ai-proposal-success">
          <CheckCircle2 size={17} />

          <div>
            <strong>Đã tạo Subtask thành công.</strong>

            <p>
              Số Subtask đã tạo: {
                proposal.created_subtask_ids?.length || items.length
              }
            </p>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="ai-proposal-rejected">
          Đề xuất này đã bị từ chối.
        </div>
      )}

      {isPending && !canConfirm && (
        <div className="ai-proposal-permission">
          <ShieldCheck size={16} />

          Chỉ Owner hoặc Leader của nhóm mới có quyền
          xác nhận và tạo Subtask.
        </div>
      )}

      {error && (
        <div className="ai-proposal-error">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {isPending && (
        <div className="ai-proposal-actions">
          <button
            type="button"
            className="ai-proposal-save"
            onClick={onSave}
            disabled={
              busy ||
              !isDirty ||
              hasInvalidTitle
            }
          >
            {busy
              ? <Loader2 size={15} className="ai-spin" />
              : <Save size={15} />
            }

            Lưu chỉnh sửa
          </button>

          <button
            type="button"
            className="ai-proposal-confirm"
            onClick={onConfirm}
            disabled={
              busy ||
              !canConfirm ||
              hasInvalidTitle ||
              items.length === 0
            }
          >
            {busy
              ? <Loader2 size={15} className="ai-spin" />
              : <CheckCircle2 size={15} />
            }

            Xác nhận tạo Subtask
          </button>

          <button
            type="button"
            className="ai-proposal-reject"
            onClick={onReject}
            disabled={busy}
          >
            <XCircle size={15} />
            Từ chối
          </button>
        </div>
      )}
    </section>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function AIChatPanel({
  projectId,
  projectName = 'Dự án hiện tại',
  groups = [],
  currentUserId = null,
  isProjectOwner = false
}) {
  // =====================================================
  // CHAT STATES
  // =====================================================

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] =
    useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [creatingConversation, setCreatingConversation] =
    useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // =====================================================
  // PROPOSAL STATES
  // =====================================================

  const [proposalRecords, setProposalRecords] = useState({});
  const [proposalDrafts, setProposalDrafts] = useState({});
  const [proposalBusy, setProposalBusy] = useState({});
  const [proposalErrors, setProposalErrors] = useState({});

  const proposalFetchesRef = useRef(new Set());

  // =====================================================
  // REFS
  // =====================================================

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // =====================================================
  // SCROLL
  // =====================================================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // =====================================================
  // PROPOSAL API HELPERS
  // =====================================================

  const setProposalBusyState = (proposalId, value) => {
    setProposalBusy(prev => ({
      ...prev,
      [proposalId]: value
    }));
  };

  const setProposalError = (proposalId, message) => {
    setProposalErrors(prev => ({
      ...prev,
      [proposalId]: message
    }));
  };

  // Tải proposal từ Database
  const loadProposal = useCallback(
    async (conversationId, proposalId) => {
      if (!projectId || !conversationId || !proposalId) {
        return;
      }

      try {
        const data = await aiRequest(
          projectId,
          `/${encodeURIComponent(conversationId)}/proposals/${encodeURIComponent(proposalId)}`
        );

        setProposalRecords(prev => ({
          ...prev,
          [proposalId]: data
        }));

        setProposalDrafts(prev => ({
          ...prev,
          [proposalId]: (data.items || []).map(item => ({
            title: item.title || '',
            description: item.description || '',
            priority: item.priority || 'medium'
          }))
        }));

      } catch (err) {
        setProposalError(proposalId, err.message);
        proposalFetchesRef.current.delete(proposalId);
      }
    },
    [projectId]
  );

  // =====================================================
  // LOAD PROPOSALS FROM MESSAGES
  // =====================================================

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) {
      return;
    }

    let cancelled = false;

    const loadAllProposals = async () => {
      const proposalMessages = messages.filter(
        message =>
          message.role === 'assistant' &&
          message.sources?.type === 'subtask_proposal' &&
          message.sources?.proposal_id
      );

      for (const message of proposalMessages) {
        const proposalId = message.sources.proposal_id;

        if (proposalFetchesRef.current.has(proposalId)) {
          continue;
        }

        proposalFetchesRef.current.add(proposalId);

        if (cancelled) {
          proposalFetchesRef.current.delete(proposalId);
          break;
        }

        await loadProposal(
          selectedConversationId,
          proposalId
        );
      }
    };

    loadAllProposals();

    return () => {
      cancelled = true;
    };
  }, [messages, selectedConversationId, loadProposal]);

  // =====================================================
  // LOAD MESSAGES
  // =====================================================

  const loadMessages = async (conversationId) => {
    if (!projectId || !conversationId) return;

    setSelectedConversationId(conversationId);
    setMessages([]);
    setError('');

    try {
      const data = await aiRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/messages`
      );

      setMessages(Array.isArray(data) ? data : []);

    } catch (err) {
      setError(err.message);
    }
  };

  // =====================================================
  // LOAD CONVERSATIONS
  // =====================================================

  const loadConversations = useCallback(async () => {
    if (!projectId) return;

    setLoadingHistory(true);
    setError('');

    try {
      const data = await aiRequest(projectId);

      const sorted = Array.isArray(data)
        ? [...data].sort(
            (a, b) =>
              new Date(b.updated_at) - new Date(a.updated_at)
          )
        : [];

      setConversations(sorted);

      if (sorted.length > 0) {
        const firstConversation = sorted[0];

        setSelectedConversationId(firstConversation.id);

        const messageData = await aiRequest(
          projectId,
          `/${encodeURIComponent(firstConversation.id)}/messages`
        );

        setMessages(
          Array.isArray(messageData) ? messageData : []
        );

      } else {
        setSelectedConversationId(null);
        setMessages([]);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  // =====================================================
  // RESET WHEN PROJECT CHANGES
  // =====================================================

  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setSelectedConversationId(null);

    setProposalRecords({});
    setProposalDrafts({});
    setProposalBusy({});
    setProposalErrors({});

    proposalFetchesRef.current.clear();

    loadConversations();
  }, [loadConversations]);

  // =====================================================
  // CREATE CONVERSATION
  // =====================================================

  const createConversation = async () => {
    if (!projectId || creatingConversation) return;

    setCreatingConversation(true);
    setError('');

    try {
      const conversation = await aiRequest(
        projectId,
        '',
        {
          method: 'POST',
          body: JSON.stringify({
            title: 'Cuộc trò chuyện mới'
          })
        }
      );

      setConversations(prev => [
        conversation,
        ...prev
      ]);

      setSelectedConversationId(conversation.id);
      setMessages([]);

      textareaRef.current?.focus();

    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingConversation(false);
    }
  };

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  const sendMessage = async (e) => {
    e?.preventDefault();

    const message = input.trim();

    if (!message || sending || !projectId) return;

    setError('');

    let conversationId = selectedConversationId;

    if (!conversationId) {
      setCreatingConversation(true);

      try {
        const conversation = await aiRequest(
          projectId,
          '',
          {
            method: 'POST',
            body: JSON.stringify({
              title: message.slice(0, 60)
            })
          }
        );

        conversationId = conversation.id;

        setSelectedConversationId(conversationId);

        setConversations(prev => [
          conversation,
          ...prev
        ]);

      } catch (err) {
        setError(err.message);
        setCreatingConversation(false);
        return;
      }

      setCreatingConversation(false);
    }

    const temporaryId = `temp-${Date.now()}`;

    const userMessage = {
      id: temporaryId,
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [
      ...prev,
      userMessage
    ]);

    setInput('');
    setSending(true);

    try {
      const assistantMessage = await aiRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            message
          })
        }
      );

      setMessages(prev => [
        ...prev.filter(item => item.id !== temporaryId),
        userMessage,
        assistantMessage
      ]);

      setConversations(prev =>
        prev.map(item =>
          item.id === conversationId
            ? {
                ...item,
                title:
                  item.title === 'Cuộc trò chuyện mới'
                    ? message.slice(0, 60)
                    : item.title,
                updated_at: new Date().toISOString()
              }
            : item
        ).sort(
          (a, b) =>
            new Date(b.updated_at) - new Date(a.updated_at)
        )
      );

    } catch (err) {
      setMessages(prev =>
        prev.filter(item => item.id !== temporaryId)
      );

      setMessages(prev => [
        ...prev,
        userMessage,
        {
          id: `error-${Date.now()}`,
          role: 'error',
          content: err.message,
          created_at: new Date().toISOString()
        }
      ]);

    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // =====================================================
  // EDIT PROPOSAL
  // =====================================================

  const updateProposalDraft = (
    proposalId,
    index,
    field,
    value
  ) => {
    setProposalDrafts(prev => {
      const currentItems = [...(prev[proposalId] || [])];

      if (!currentItems[index]) {
        return prev;
      }

      currentItems[index] = {
        ...currentItems[index],
        [field]: value
      };

      return {
        ...prev,
        [proposalId]: currentItems
      };
    });

    setProposalError(proposalId, '');
  };

  // =====================================================
  // SAVE PROPOSAL
  // =====================================================

  const saveProposal = async (
    conversationId,
    proposalId
  ) => {
    const items = proposalDrafts[proposalId];

    if (!Array.isArray(items) || items.length === 0) {
      setProposalError(
        proposalId,
        'Đề xuất phải có ít nhất một Subtask.'
      );
      return false;
    }

    if (items.some(item => !item.title?.trim())) {
      setProposalError(
        proposalId,
        'Tên Subtask không được để trống.'
      );
      return false;
    }

    setProposalBusyState(proposalId, true);
    setProposalError(proposalId, '');

    try {
      const data = await aiRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/proposals/${encodeURIComponent(proposalId)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            items: items.map(item => ({
              title: item.title.trim(),
              description: item.description || null,
              priority: item.priority || 'medium'
            }))
          })
        }
      );

      setProposalRecords(prev => ({
        ...prev,
        [proposalId]: data
      }));

      setProposalDrafts(prev => ({
        ...prev,
        [proposalId]: (data.items || []).map(item => ({
          title: item.title || '',
          description: item.description || '',
          priority: item.priority || 'medium'
        }))
      }));

      return true;

    } catch (err) {
      setProposalError(proposalId, err.message);
      return false;

    } finally {
      setProposalBusyState(proposalId, false);
    }
  };

  // =====================================================
  // CONFIRM PROPOSAL
  // =====================================================

  const confirmProposal = async (
    conversationId,
    proposalId
  ) => {
    const proposal = proposalRecords[proposalId];

    if (!proposal || proposal.status !== 'pending') {
      return;
    }

    const group = groups.find(
      item => String(item.id) === String(proposal.group_id)
    );

    const canConfirm =
      isProjectOwner ||
      Boolean(
        currentUserId &&
        group &&
        String(group.leader_id) === String(currentUserId)
      );

    if (!canConfirm) {
      setProposalError(
        proposalId,
        'Bạn không có quyền xác nhận đề xuất này.'
      );
      return;
    }

    const draft = proposalDrafts[proposalId] || [];

    if (
      draft.length === 0 ||
      draft.some(item => !item.title?.trim())
    ) {
      setProposalError(
        proposalId,
        'Vui lòng kiểm tra tên các Subtask trước khi xác nhận.'
      );
      return;
    }

    setProposalBusyState(proposalId, true);
    setProposalError(proposalId, '');

    try {
      const isDirty =
        JSON.stringify(draft) !==
        JSON.stringify(proposal.items || []);

      // Lưu chỉnh sửa trước khi xác nhận
      if (isDirty) {
        const updated = await aiRequest(
          projectId,
          `/${encodeURIComponent(conversationId)}/proposals/${encodeURIComponent(proposalId)}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              items: draft.map(item => ({
                title: item.title.trim(),
                description: item.description || null,
                priority: item.priority || 'medium'
              }))
            })
          }
        );

        setProposalRecords(prev => ({
          ...prev,
          [proposalId]: updated
        }));
      }

      // Xác nhận tạo Subtask
      const result = await aiRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/proposals/${encodeURIComponent(proposalId)}/confirm`,
        {
          method: 'POST'
        }
      );

      setProposalRecords(prev => ({
        ...prev,
        [proposalId]: {
          ...prev[proposalId],
          status: result.status,
          created_subtask_ids: result.created_subtask_ids || []
        }
      }));

      setProposalDrafts(prev => ({
        ...prev,
        [proposalId]: [...draft]
      }));

      setProposalError(proposalId, '');

    } catch (err) {
      setProposalError(proposalId, err.message);

    } finally {
      setProposalBusyState(proposalId, false);
    }
  };

  // =====================================================
  // REJECT PROPOSAL
  // =====================================================

  const rejectProposal = async (
    conversationId,
    proposalId
  ) => {
    const proposal = proposalRecords[proposalId];

    if (!proposal || proposal.status !== 'pending') {
      return;
    }

    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn từ chối đề xuất Subtask này?'
    );

    if (!confirmed) return;

    setProposalBusyState(proposalId, true);
    setProposalError(proposalId, '');

    try {
      const result = await aiRequest(
        projectId,
        `/${encodeURIComponent(conversationId)}/proposals/${encodeURIComponent(proposalId)}/reject`,
        {
          method: 'POST'
        }
      );

      setProposalRecords(prev => ({
        ...prev,
        [proposalId]: {
          ...prev[proposalId],
          status: result.status
        }
      }));

    } catch (err) {
      setProposalError(proposalId, err.message);

    } finally {
      setProposalBusyState(proposalId, false);
    }
  };

  // =====================================================
  // KEYBOARD
  // =====================================================

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // =====================================================
  // EMPTY PROJECT
  // =====================================================

  if (!projectId) {
    return (
      <div className="ai-empty-project">
        <AlertCircle size={28} />
        <p>Không tìm thấy dự án.</p>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="ai-chat-layout">

      {/* SIDEBAR */}
      {sidebarOpen && (
        <aside className="ai-sidebar">

          <div className="ai-sidebar-header">
            <div className="ai-brand">
              <div className="ai-brand-icon">
                <Bot size={22} />
              </div>

              <div>
                <h3>Project AI</h3>
                <span>Trợ lý dự án</span>
              </div>
            </div>
          </div>

          <button
            className="ai-new-chat"
            onClick={createConversation}
            disabled={creatingConversation}
          >
            {creatingConversation
              ? <Loader2 size={17} className="ai-spin" />
              : <Plus size={17} />
            }

            Cuộc trò chuyện mới
          </button>

          <div className="ai-history-title">
            LỊCH SỬ HỘI THOẠI
          </div>

          <div className="ai-history-list">
            {loadingHistory ? (
              <div className="ai-loading-history">
                <Loader2 size={18} className="ai-spin" />
                Đang tải hội thoại...
              </div>
            ) : conversations.length > 0 ? (
              conversations.map(item => (
                <button
                  key={item.id}
                  className={`ai-history-item ${
                    selectedConversationId === item.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => loadMessages(item.id)}
                >
                  <MessageSquare size={16} />

                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {formatDate(item.updated_at)}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <div className="ai-no-history">
                Chưa có cuộc trò chuyện nào.
              </div>
            )}
          </div>

          <div className="ai-sidebar-footer">
            <div className="ai-status-dot" />
            <span>AI Assistant</span>
          </div>

        </aside>
      )}

      {/* CHAT CONTENT */}
      <main className="ai-main">

        {/* HEADER */}
        <header className="ai-chat-header">
          <div className="ai-header-left">

            <button
              className="ai-icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Ẩn/hiện lịch sử"
            >
              {sidebarOpen
                ? <PanelLeftClose size={19} />
                : <PanelLeftOpen size={19} />
              }
            </button>

            <div className="ai-header-avatar">
              <Bot size={21} />
            </div>

            <div>
              <h3>Project AI Assistant</h3>

              <span>
                <span className="ai-online-dot" />
                {projectName}
              </span>
            </div>

          </div>

          <button
            className="ai-icon-button"
            onClick={loadConversations}
            title="Làm mới"
            disabled={loadingHistory}
          >
            <RefreshCw size={17} />
          </button>
        </header>

        {/* ERROR */}
        {error && (
          <div className="ai-error-banner">
            <AlertCircle size={17} />
            <span>{error}</span>

            <button onClick={() => setError('')}>
              Đóng
            </button>
          </div>
        )}

        {/* MESSAGES */}
        <section className="ai-messages">

          {messages.length === 0 && !loadingHistory ? (
            <div className="ai-welcome">

              <div className="ai-welcome-icon">
                <Sparkles size={32} />
              </div>

              <h2>Xin chào! Tôi là Project AI</h2>

              <p>
                Tôi có thể giúp bạn phân tích dữ liệu,
                công việc và tiến độ của dự án.
              </p>

              <div className="ai-suggestions">

                <button
                  onClick={() =>
                    setInput(
                      'Hãy phân tích tiến độ hiện tại của dự án.'
                    )
                  }
                >
                  <Sparkles size={16} />
                  Phân tích tiến độ dự án
                </button>

                <button
                  onClick={() =>
                    setInput(
                      'Những công việc nào đang bị quá hạn?'
                    )
                  }
                >
                  <AlertCircle size={16} />
                  Kiểm tra công việc quá hạn
                </button>

                <button
                  onClick={() =>
                    setInput(
                      'Tóm tắt thông tin và mục tiêu dự án.'
                    )
                  }
                >
                  <MessageSquare size={16} />
                  Tóm tắt thông tin dự án
                </button>

              </div>
            </div>
          ) : (
            <div className="ai-message-list">

              {messages.map(msg => {
                const source = msg.sources;

                const isProposalMessage =
                  msg.role === 'assistant' &&
                  source?.type === 'subtask_proposal' &&
                  source?.proposal_id;

                const proposalId = isProposalMessage
                  ? source.proposal_id
                  : null;

                const proposal = proposalId
                  ? proposalRecords[proposalId]
                  : null;

                const draft = proposalId
                  ? proposalDrafts[proposalId] || proposal?.items || []
                  : [];

                const group = proposal
                  ? groups.find(
                      item => String(item.id) === String(proposal.group_id)
                    )
                  : null;

                const canConfirm =
                  isProjectOwner ||
                  Boolean(
                    currentUserId &&
                    group &&
                    String(group.leader_id) === String(currentUserId)
                  );

                return (
                  <div
                    key={msg.id}
                    className={`ai-message-row ${msg.role}`}
                  >

                    <div className="ai-message-avatar">
                      {msg.role === 'user'
                        ? <User size={17} />
                        : <Bot size={18} />
                      }
                    </div>

                    <div className="ai-message-body">

                      <div className="ai-message-name">
                        {msg.role === 'user'
                          ? 'Bạn'
                          : msg.role === 'error'
                            ? 'Thông báo'
                            : 'Project AI'
                        }

                        <span>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>

                      <div className="ai-message-content">
                        {msg.content}
                      </div>

                      {isProposalMessage && (
                        <AISubtaskProposalCard
                          proposal={proposal}
                          draft={draft}
                          canConfirm={canConfirm}
                          busy={Boolean(proposalBusy[proposalId])}
                          error={proposalErrors[proposalId] || ''}

                          onChange={(index, field, value) =>
                            updateProposalDraft(
                              proposalId,
                              index,
                              field,
                              value
                            )
                          }

                          onSave={() =>
                            saveProposal(
                              msg.conversation_id ||
                              selectedConversationId,
                              proposalId
                            )
                          }

                          onConfirm={() =>
                            confirmProposal(
                              msg.conversation_id ||
                              selectedConversationId,
                              proposalId
                            )
                          }

                          onReject={() =>
                            rejectProposal(
                              msg.conversation_id ||
                              selectedConversationId,
                              proposalId
                            )
                          }
                        />
                      )}

                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="ai-message-row assistant">

                  <div className="ai-message-avatar">
                    <Bot size={18} />
                  </div>

                  <div className="ai-message-body">

                    <div className="ai-message-name">
                      Project AI
                    </div>

                    <div className="ai-thinking">
                      <span />
                      <span />
                      <span />
                      <small>AI đang suy nghĩ...</small>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          <div ref={messagesEndRef} />

        </section>

        {/* INPUT */}
        <footer className="ai-input-area">

          <form
            className="ai-input-box"
            onSubmit={sendMessage}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi cho Project AI..."
              rows={2}
              disabled={sending}
            />

            <button
              type="submit"
              disabled={!input.trim() || sending}
              title="Gửi tin nhắn"
            >
              {sending
                ? <Loader2 size={19} className="ai-spin" />
                : <Send size={19} />
              }
            </button>
          </form>

          <div className="ai-input-hint">
            Enter để gửi · Shift + Enter để xuống dòng
          </div>

        </footer>

      </main>
    </div>
  );
}

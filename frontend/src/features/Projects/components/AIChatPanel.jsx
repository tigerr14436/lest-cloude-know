
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, Plus, MessageSquare, Trash2,
  Sparkles, Loader2, RefreshCw, AlertCircle,
  User, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

import './AIChatPanel.css';

const API_BASE = 'http://127.0.0.1:8000';

async function aiRequest(projectId, path = '', options = {}) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
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

export default function AIChatPanel({
  projectId,
  projectName = 'Dự án hiện tại'
}) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Tự cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Lấy danh sách hội thoại
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

  // Tải lại khi thay đổi dự án
  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setSelectedConversationId(null);

    loadConversations();
  }, [loadConversations]);

  // Lấy lịch sử tin nhắn của hội thoại
  const loadMessages = async (conversationId) => {
    if (!projectId || !conversationId) return;

    setSelectedConversationId(conversationId);
    setMessages([]);
    setError('');

    try {
      const data = await aiRequest(
        projectId,
        `/${conversationId}/messages`
      );

      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Tạo hội thoại mới
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

  // Gửi câu hỏi đến AI
  const sendMessage = async (e) => {
    e?.preventDefault();

    const message = input.trim();

    if (!message || sending || !projectId) return;

    setError('');

    let conversationId = selectedConversationId;

    // Nếu chưa có hội thoại, tự động tạo
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

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const assistantMessage = await aiRequest(
        projectId,
        `/${conversationId}/messages`,
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

      // Cập nhật tiêu đề hội thoại bằng câu hỏi đầu tiên
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

      setError('');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // Enter để gửi, Shift + Enter để xuống dòng
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedConversation = conversations.find(
    item => item.id === selectedConversationId
  );

  if (!projectId) {
    return (
      <div className="ai-empty-project">
        <AlertCircle size={28} />
        <p>Không tìm thấy dự án.</p>
      </div>
    );
  }

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
                    <small>{formatDate(item.updated_at)}</small>
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
            <button onClick={() => setError('')}>Đóng</button>
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
                  onClick={() => setInput(
                    'Hãy phân tích tiến độ hiện tại của dự án.'
                  )}
                >
                  <Sparkles size={16} />
                  Phân tích tiến độ dự án
                </button>

                <button
                  onClick={() => setInput(
                    'Những công việc nào đang bị quá hạn?'
                  )}
                >
                  <AlertCircle size={16} />
                  Kiểm tra công việc quá hạn
                </button>

                <button
                  onClick={() => setInput(
                    'Tóm tắt thông tin và mục tiêu dự án.'
                  )}
                >
                  <MessageSquare size={16} />
                  Tóm tắt thông tin dự án
                </button>

              </div>

            </div>
          ) : (
            <div className="ai-message-list">

              {messages.map((msg) => (
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

                  </div>

                </div>
              ))}

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

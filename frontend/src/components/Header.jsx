
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Zap,
  LogIn,
  UserPlus,
  LogOut,
  Bell,
  X,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';
const CV_KEY = 'devtask_cv_profile_v3';

// ============================================================
// HELPERS
// ============================================================

const getToken = () => localStorage.getItem('access_token');

const getInitials = (name) => {
  if (!name) return 'U';

  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
};

const formatNotificationTime = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// ============================================================
// COMPONENT
// ============================================================

export default function Header({
  isSidebarOpen,
  setIsSidebarOpen,
  isAuthenticated,
  onOpenAuthModal,
  onLogout,
}) {
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [userName, setUserName] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [processingInvitation, setProcessingInvitation] = useState(null);

  // ==========================================================
  // API HELPER
  // ==========================================================

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    let result = null;

    if (response.status !== 204) {
      result = await response.json().catch(() => null);
    }

    if (!response.ok) {
      throw new Error(
        result?.detail || 'Không thể thực hiện thao tác.'
      );
    }

    return result;
  }, []);

  // ==========================================================
  // LOAD PROFILE
  // ==========================================================

  const loadProfileAvatar = useCallback(async () => {
    if (!isAuthenticated) {
      setAvatar('');
      setUserName('');
      return;
    }

    try {
      const account = await apiRequest('/users/me');

      setUserName(account.name || '');

      if (!account.id) {
        setAvatar('');
        return;
      }

      const savedProfile = JSON.parse(
        localStorage.getItem(`${CV_KEY}:${account.id}`) || '{}'
      );

      setAvatar(savedProfile.avatar || '');
    } catch (error) {
      console.error('Lỗi tải ảnh đại diện:', error);
      setAvatar('');
    }
  }, [isAuthenticated, apiRequest]);

  useEffect(() => {
    loadProfileAvatar();
  }, [loadProfileAvatar]);

  // ==========================================================
  // LOAD NOTIFICATIONS
  // ==========================================================

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (!isAuthenticated || !getToken()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (showLoading) {
      setLoadingNotifications(true);
    }

    try {
      const result = await apiRequest('/notifications?limit=50');

      setNotifications(
        Array.isArray(result?.items) ? result.items : []
      );

      setUnreadCount(
        Number(result?.unread_count || 0)
      );

      setNotificationError('');
    } catch (error) {
      console.error('Lỗi tải thông báo:', error);
      setNotificationError(error.message);
    } finally {
      if (showLoading) {
        setLoadingNotifications(false);
      }
    }
  }, [isAuthenticated, apiRequest]);

  // Tải thông báo khi đăng nhập.
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setShowNotifications(false);
      return;
    }

    loadNotifications(true);

    // Tự động cập nhật thông báo mỗi 30 giây.
    const interval = setInterval(() => {
      loadNotifications(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  // Khi mở bảng thông báo, tải lại dữ liệu mới nhất.
  const handleToggleNotifications = () => {
    const nextState = !showNotifications;

    setShowNotifications(nextState);

    if (nextState) {
      loadNotifications(true);
    }
  };

  // ==========================================================
  // MARK ONE AS READ
  // ==========================================================

  const markAsRead = async (notification) => {
    if (notification.is_read) return;

    // Cập nhật giao diện trước để phản hồi nhanh.
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true }
          : item
      )
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiRequest(
        `/notifications/${notification.id}/read`,
        { method: 'PATCH' }
      );
    } catch (error) {
      console.error('Lỗi đánh dấu thông báo:', error);
      loadNotifications(false);
    }
  };

  // ==========================================================
  // MARK ALL AS READ
  // ==========================================================

  const markAllAsRead = async () => {
    try {
      await apiRequest('/notifications/read-all', {
        method: 'PATCH',
      });

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error('Lỗi đánh dấu tất cả thông báo:', error);
      setNotificationError(error.message);
    }
  };

  // ==========================================================
  // DELETE NOTIFICATION
  // ==========================================================

  const removeNotification = async (id, event) => {
    event.stopPropagation();

    const previousNotifications = notifications;

    const deletedItem = notifications.find(
      (item) => item.id === id
    );

    setNotifications((prev) =>
      prev.filter((item) => item.id !== id)
    );

    if (deletedItem && !deletedItem.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await apiRequest(`/notifications/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Lỗi xóa thông báo:', error);

      setNotifications(previousNotifications);
      loadNotifications(false);
      setNotificationError(error.message);
    }
  };

  // ==========================================================
  // RESPOND TO GROUP INVITATION
  // ==========================================================

  const handleInvitationResponse = async (
    notification,
    action,
    event
  ) => {
    event.stopPropagation();

    const invitationId =
      notification.data?.invitation_id ||
      notification.data?.invitationId;

    if (!invitationId) {
      setNotificationError(
        'Không tìm thấy mã lời mời trong dữ liệu thông báo.'
      );
      return;
    }

    setProcessingInvitation(notification.id);
    setNotificationError('');

    try {
      await apiRequest(
        `/notifications/invitations/${invitationId}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        }
      );

      await loadNotifications(false);
    } catch (error) {
      console.error('Lỗi xử lý lời mời:', error);
      setNotificationError(error.message);
    } finally {
      setProcessingInvitation(null);
    }
  };

  // ==========================================================
  // NAVIGATE FROM NOTIFICATION
  // ==========================================================

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification);

    const data = notification.data || {};
    const projectId = data.project_id;

    setShowNotifications(false);

    if (projectId) {
      // Chuyển đến trang chi tiết dự án.
      navigate(`/du-an/${projectId}`);
    } else {
      navigate('/du-an');
    }
  };

  // ==========================================================
  // PROFILE EVENTS
  // ==========================================================

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      const updatedAvatar = event.detail?.avatar;

      if (typeof updatedAvatar === 'string') {
        setAvatar(updatedAvatar);
      }

      if (event.detail?.name) {
        setUserName(event.detail.name);
      }
    };

    window.addEventListener(
      'devtask-profile-updated',
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        'devtask-profile-updated',
        handleProfileUpdated
      );
    };
  }, []);

  // Đồng bộ khi hồ sơ thay đổi từ tab khác.
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key?.startsWith(`${CV_KEY}:`)) {
        loadProfileAvatar();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadProfileAvatar]);

  // ==========================================================
  // HEADER ACTIONS
  // ==========================================================

  const handleLogoClick = () => {
    navigate(isAuthenticated ? '/du-an' : '/');
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    setAvatar('');
    setUserName('');
    setNotifications([]);
    setUnreadCount(0);
    setShowNotifications(false);

    if (typeof onLogout === 'function') {
      onLogout();
    }

    navigate('/');
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <header className="main-header">
      <div className="header-left">
        {isAuthenticated && (
          <button
            type="button"
            className="menu-toggle-btn"
            onClick={handleToggleSidebar}
            aria-label="Mở hoặc đóng menu"
          >
            <Menu size={20} />
          </button>
        )}

        <div
          className="brand-logo"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleLogoClick();
            }
          }}
        >
          <Zap size={22} className="brand-icon" />
          <span>DevTask</span>
        </div>
      </div>

      <div className="header-right">
        {isAuthenticated ? (
          <div className="user-profile-section">

            {/* =========================================
                NOTIFICATION
            ========================================== */}

            <div className="notification-wrapper">
              <button
                type="button"
                className="notification-bell-btn"
                onClick={handleToggleNotifications}
                title="Thông báo"
                aria-label={`Thông báo (${unreadCount} chưa đọc)`}
              >
                <Bell size={18} />

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">

                  <div className="notification-header">
                    <h4>Thông báo</h4>

                    <div className="notification-header-actions">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="mark-read-btn"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}

                      <button
                        type="button"
                        className="notification-close-btn"
                        onClick={() => setShowNotifications(false)}
                        aria-label="Đóng thông báo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {notificationError && (
                    <div className="notification-error">
                      <AlertCircle size={15} />
                      <span>{notificationError}</span>
                    </div>
                  )}

                  <div className="notification-list">

                    {loadingNotifications ? (
                      <div className="notification-loading">
                        <Loader2 size={20} className="notification-spinner" />
                        <span>Đang tải thông báo...</span>
                      </div>
                    ) : notifications.length > 0 ? (

                      notifications.map((item) => {
                        const isInvitation =
                          item.type === 'group_invitation';

                        const isProcessing =
                          processingInvitation === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`notification-item ${
                              !item.is_read ? 'unread' : ''
                            }`}
                            onClick={() =>
                              handleNotificationClick(item)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (
                                event.key === 'Enter' &&
                                !isInvitation
                              ) {
                                handleNotificationClick(item);
                              }
                            }}
                          >
                            <div className="notification-content">
                              <h5>{item.title}</h5>

                              <p>{item.message}</p>

                              <span className="notification-time">
                                {formatNotificationTime(item.created_at)}
                              </span>

                              {isInvitation && (
                                <div className="invitation-actions">
                                  <button
                                    type="button"
                                    className="invitation-accept-btn"
                                    disabled={isProcessing}
                                    onClick={(event) =>
                                      handleInvitationResponse(
                                        item,
                                        'accept',
                                        event
                                      )
                                    }
                                  >
                                    {isProcessing ? (
                                      <Loader2 size={13} />
                                    ) : (
                                      <Check size={13} />
                                    )}
                                    Chấp nhận
                                  </button>

                                  <button
                                    type="button"
                                    className="invitation-reject-btn"
                                    disabled={isProcessing}
                                    onClick={(event) =>
                                      handleInvitationResponse(
                                        item,
                                        'reject',
                                        event
                                      )
                                    }
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="notification-delete"
                              onClick={(event) =>
                                removeNotification(item.id, event)
                              }
                              title="Xóa thông báo"
                              aria-label="Xóa thông báo"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })

                    ) : (
                      <div className="notification-empty">
                        <Bell size={24} />
                        <span>Không có thông báo nào</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* =========================================
                AVATAR
            ========================================== */}

            <div
              className="user-avatar-badge"
              title={userName || 'Tài khoản cá nhân'}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt="Ảnh đại diện"
                  className="header-user-avatar"
                />
              ) : (
                <span>{getInitials(userName)}</span>
              )}
            </div>

            {/* =========================================
                LOGOUT
            ========================================== */}

            <button
              type="button"
              onClick={handleLogout}
              className="logout-btn"
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <div className="header-auth-btns">
            <button
              type="button"
              className="header-btn login-btn"
              onClick={onOpenAuthModal}
            >
              <LogIn size={16} />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              className="header-btn register-btn"
              onClick={onOpenAuthModal}
            >
              <UserPlus size={16} />
              <span>Đăng ký</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

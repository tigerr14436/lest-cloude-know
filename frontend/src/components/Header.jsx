
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
  ClipboardList,
  ListChecks,
  Folder,
  Users,
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

// Xác định loại thông báo.
const getNotificationType = (notification) => {
  return notification?.type || notification?.notification_type || '';
};

// Xác định đây có phải lời mời tham gia dự án/nhóm không.
const isInvitationNotification = (notification) => {
  const type = getNotificationType(notification);

  return (
    type === 'group_invitation' ||
    type === 'project_invitation'
  );
};

// Lấy biểu tượng theo loại thông báo.
const getNotificationIcon = (notification) => {
  const type = getNotificationType(notification);

  switch (type) {
    case 'task_assigned':
      return <ClipboardList size={19} />;

    case 'subtask_assigned':
      return <ListChecks size={19} />;

    case 'project_invitation':
      return <Folder size={19} />;

    case 'group_invitation':
      return <Users size={19} />;

    default:
      return <Bell size={19} />;
  }
};

// Lấy API xử lý lời mời tương ứng.
const getInvitationEndpoint = (notification, invitationId) => {
  const type = getNotificationType(notification);

  if (type === 'project_invitation') {
    return `/notifications/project-invitations/${invitationId}/respond`;
  }

  if (type === 'group_invitation') {
    return `/notifications/invitations/${invitationId}/respond`;
  }

  return null;
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
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    let result = null;

    if (response.status !== 204) {
      result = await response.json().catch(() => null);
    }

    if (response.status === 401) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) {
      throw new Error(
        result?.detail ||
        result?.message ||
        'Không thể thực hiện thao tác.'
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

  // Tải thông báo khi đăng nhập và tự cập nhật mỗi 30 giây.
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setShowNotifications(false);
      setNotificationError('');
      return;
    }

    loadNotifications(true);

    const interval = setInterval(() => {
      loadNotifications(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  // ==========================================================
  // TOGGLE NOTIFICATIONS
  // ==========================================================

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
      await loadNotifications(false);
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
      setNotificationError('');
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
      await loadNotifications(false);
      setNotificationError(error.message);
    }
  };

  // ==========================================================
  // RESPOND TO PROJECT / GROUP INVITATION
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

    const endpoint = getInvitationEndpoint(
      notification,
      invitationId
    );

    if (!endpoint) {
      setNotificationError(
        'Loại lời mời không được hỗ trợ.'
      );
      return;
    }

    setProcessingInvitation(notification.id);
    setNotificationError('');

    try {
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });

      // Tải lại danh sách để cập nhật trạng thái thông báo.
      await loadNotifications(false);

      if (action === 'accept') {
        setNotificationError('');

        // Lời mời nhóm và dự án đều trả về project_id.
        const projectId =
          result?.project_id ||
          notification.data?.project_id;

        if (projectId) {
          setShowNotifications(false);
          navigate(`/du-an/${projectId}`);
        }
      }
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

  // Đồng bộ hồ sơ khi thay đổi từ tab khác.
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
    setNotificationError('');

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
                        <Loader2
                          size={20}
                          className="notification-spinner"
                        />
                        <span>Đang tải thông báo...</span>
                      </div>
                    ) : notifications.length > 0 ? (

                      notifications.map((item) => {
                        const type = getNotificationType(item);

                        const isInvitation =
                          isInvitationNotification(item);

                        const isProcessing =
                          processingInvitation === item.id;

                        const isPendingInvitation =
                          isInvitation &&
                          item.data?.invitation_id &&
                          !item.is_read;

                        return (
                          <div
                            key={item.id}
                            className={`notification-item ${
                              !item.is_read ? 'unread' : ''
                            } ${isInvitation ? 'invitation-notification' : ''}`}
                            onClick={() =>
                              handleNotificationClick(item)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (
                                event.key === 'Enter' ||
                                event.key === ' '
                              ) {
                                event.preventDefault();
                                handleNotificationClick(item);
                              }
                            }}
                          >
                            <div className="notification-type-icon">
                              {getNotificationIcon(item)}
                            </div>

                            <div className="notification-content">
                              <h5>{item.title}</h5>

                              <p>{item.message}</p>

                              <span className="notification-time">
                                {formatNotificationTime(item.created_at)}
                              </span>

                              {/* NÚT XỬ LÝ LỜI MỜI */}
                              {isPendingInvitation && (
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
                                      <Loader2
                                        size={13}
                                        className="notification-spinner"
                                      />
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
                                    {isProcessing ? (
                                      'Đang xử lý...'
                                    ) : (
                                      'Từ chối'
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* HIỂN THỊ TRẠNG THÁI */}
                              {isInvitation && item.is_read && (
                                <span className="invitation-processed">
                                  Lời mời đã được xử lý hoặc đã đọc
                                </span>
                              )}

                              {type === 'task_assigned' && (
                                <span className="notification-category">
                                  Công việc được giao
                                </span>
                              )}

                              {type === 'subtask_assigned' && (
                                <span className="notification-category">
                                  Công việc con được giao
                                </span>
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

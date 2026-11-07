
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  ClipboardList,
  CheckCircle2,
  Clock3,
  Target,
  CalendarDays,
  Crown,
  Search,
  UserPlus,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  ArrowUpRight,
  FolderKanban
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Bạn cần đăng nhập lại.');
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : 'Không thể thực hiện yêu cầu.'
    );
  }

  return data;
}

const STATUS_LABEL = {
  todo: 'Cần làm',
  in_progress: 'Đang thực hiện',
  review: 'Đang kiểm tra',
  done: 'Hoàn thành'
};

const PRIORITY_LABEL = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao'
};

function formatDate(value) {
  if (!value) return 'Chưa thiết lập';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('vi-VN');
}

function getStatusColor(status) {
  switch (status) {
    case 'done':
      return '#34d399';
    case 'in_progress':
      return '#38bdf8';
    case 'review':
      return '#a78bfa';
    default:
      return '#94a3b8';
  }
}

const cardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '14px',
  padding: '18px',
  minWidth: 0
};

const sectionTitle = {
  color: '#f8fafc',
  fontSize: '15px',
  fontWeight: 700,
  margin: 0
};

const mutedText = {
  color: '#94a3b8',
  fontSize: '12px'
};

export default function GroupDashboard({
  projectId,
  project,
  group,
  currentUserId,
  isProjectOwner = false,
  onOpenKanban,
  showNotification
}) {
  const [board, setBoard] = useState({
    tasks: [],
    subtasks: []
  });

  const [pendingInvitations, setPendingInvitations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nameTag, setNameTag] = useState('');
  const [foundUser, setFoundUser] = useState(null);

  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const canManageMembers = Boolean(
    isProjectOwner ||
    (
      currentUserId &&
      group?.leader_id === currentUserId
    )
  );

  const loadDashboard = useCallback(async () => {
    if (!projectId || !group?.id) return;

    setLoading(true);
    setError('');

    try {
      const boardData = await apiRequest(
        `/api/projects/${projectId}/groups/${group.id}/kanban`
      );

      setBoard({
        tasks: Array.isArray(boardData?.tasks)
          ? boardData.tasks
          : [],
        subtasks: Array.isArray(boardData?.subtasks)
          ? boardData.subtasks
          : []
      });

      if (canManageMembers) {
        try {
          const invitations = await apiRequest(
            `/api/notifications/invitations?project_id=${projectId}&group_id=${group.id}`
          );

          setPendingInvitations(
            Array.isArray(invitations) ? invitations : []
          );
        } catch {
          setPendingInvitations([]);
        }
      } else {
        setPendingInvitations([]);
      }
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu nhóm.');
    } finally {
      setLoading(false);
    }
  }, [projectId, group?.id, canManageMembers]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const tasks = board.tasks;
  const subtasks = board.subtasks;

  const taskDone = tasks.filter(
    item => item.status === 'done'
  ).length;

  const subtaskDone = subtasks.filter(
    item => item.status === 'done'
  ).length;

  const totalWork = tasks.length + subtasks.length;
  const completedWork = taskDone + subtaskDone;

  const progress = totalWork > 0
    ? Math.round(completedWork / totalWork * 100)
    : 0;

  const members = group?.members || [];

  const projectStatus = {
    active: 'Đang hoạt động',
    completed: 'Đã hoàn thành',
    paused: 'Tạm dừng',
    cancelled: 'Đã hủy'
  };

  const taskStatusCount = useMemo(() => {
    const result = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    };

    for (const task of tasks) {
      if (Object.prototype.hasOwnProperty.call(result, task.status)) {
        result[task.status] += 1;
      }
    }

    return result;
  }, [tasks]);

  const handleLookupUser = async event => {
    event.preventDefault();

    const normalized = nameTag
      .trim()
      .replace(/^#/, '')
      .toUpperCase();

    if (!/^[A-Z0-9]{4}$/.test(normalized)) {
      showNotification?.(
        'loi',
        'Name Tag không hợp lệ',
        'Name Tag phải có dạng #ABCD.'
      );
      return;
    }

    setSearching(true);
    setFoundUser(null);

    try {
      const user = await apiRequest(
        `/api/users/by-tag/${encodeURIComponent(normalized)}`
      );

      const alreadyInGroup = members.some(
        item => item.id === user.id
      );

      if (alreadyInGroup) {
        throw new Error('Tài khoản này đã thuộc nhóm.');
      }

      setFoundUser(user);
    } catch (err) {
      showNotification?.(
        'loi',
        'Không tìm thấy tài khoản',
        err.message
      );
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!foundUser || sending || !canManageMembers) return;

    setSending(true);

    try {
      await apiRequest('/api/notifications/invitations', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          group_id: group.id,
          name_tag: foundUser.name_tag
        })
      });

      showNotification?.(
        'thanh-cong',
        'Đã gửi lời mời',
        `Đã gửi lời mời đến ${foundUser.name}.`
      );

      setNameTag('');
      setFoundUser(null);

      await loadDashboard();
    } catch (err) {
      showNotification?.(
        'loi',
        'Không gửi được lời mời',
        err.message
      );
    } finally {
      setSending(false);
    }
  };

  const statCards = [
    {
      label: 'Task được giao',
      value: tasks.length,
      icon: ClipboardList,
      color: '#38bdf8'
    },
    {
      label: 'Subtask',
      value: subtasks.length,
      icon: Target,
      color: '#a78bfa'
    },
    {
      label: 'Đã hoàn thành',
      value: completedWork,
      icon: CheckCircle2,
      color: '#34d399'
    },
    {
      label: 'Thành viên',
      value: members.length,
      icon: Users,
      color: '#fbbf24'
    }
  ];

  if (loading) {
    return (
      <div style={{
        ...cardStyle,
        textAlign: 'center',
        color: '#94a3b8',
        padding: '40px'
      }}>
        <RefreshCw
          size={22}
          style={{ marginBottom: '10px' }}
        />
        <div>Đang tải dữ liệu tổng quan nhóm...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...cardStyle,
        color: '#f87171',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertCircle size={24} />
        <div>{error}</div>

        <button
          type="button"
          onClick={loadDashboard}
          style={{
            background: '#334155',
            color: '#fff',
            border: '1px solid #475569',
            padding: '9px 14px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} />
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      paddingBottom: '24px'
    }}>

      {/* ================================================= */}
      {/* GROUP HEADER */}
      {/* ================================================= */}

      <div style={{
        ...cardStyle,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '13px',
            background: 'rgba(56,189,248,0.15)',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 800
          }}>
            {(group.name || 'G').charAt(0).toUpperCase()}
          </div>

          <div>
            <h2 style={{
              color: '#f8fafc',
              fontSize: '21px',
              margin: '0 0 5px'
            }}>
              {group.name}
            </h2>

            <div style={mutedText}>
              Tổng quan hoạt động và tiến độ nhóm
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenKanban}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#4f46e5',
            color: '#fff',
            border: '1px solid #6366f1',
            padding: '10px 14px',
            borderRadius: '9px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <LayoutDashboard size={16} />
          Mở Kanban
          <ArrowUpRight size={14} />
        </button>
      </div>

      {/* ================================================= */}
      {/* STATISTICS */}
      {/* ================================================= */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
        gap: '12px'
      }}>
        {statCards.map(item => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              style={{
                ...cardStyle,
                display: 'flex',
                alignItems: 'center',
                gap: '13px'
              }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                flexShrink: 0,
                borderRadius: '11px',
                background: `${item.color}20`,
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={20} />
              </div>

              <div>
                <div style={mutedText}>{item.label}</div>
                <div style={{
                  color: '#f8fafc',
                  fontSize: '23px',
                  fontWeight: 800,
                  marginTop: '3px'
                }}>
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================================================= */}
      {/* PROGRESS + STATUS */}
      {/* ================================================= */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={sectionTitle}>Tiến độ tổng thể</h3>
            <span style={{
              color: '#38bdf8',
              fontSize: '22px',
              fontWeight: 800
            }}>
              {progress}%
            </span>
          </div>

          <div style={{
            height: '11px',
            background: '#0f172a',
            borderRadius: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0ea5e9, #34d399)',
              borderRadius: '20px',
              transition: 'width 0.3s'
            }} />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            ...mutedText
          }}>
            <span>{completedWork} công việc hoàn thành</span>
            <span>{totalWork} công việc</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px'
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: '9px',
              padding: '12px'
            }}>
              <div style={mutedText}>Task hoàn thành</div>
              <strong style={{
                display: 'block',
                color: '#34d399',
                fontSize: '18px',
                marginTop: '5px'
              }}>
                {taskDone}/{tasks.length}
              </strong>
            </div>

            <div style={{
              background: '#0f172a',
              borderRadius: '9px',
              padding: '12px'
            }}>
              <div style={mutedText}>Subtask hoàn thành</div>
              <strong style={{
                display: 'block',
                color: '#34d399',
                fontSize: '18px',
                marginTop: '5px'
              }}>
                {subtaskDone}/{subtasks.length}
              </strong>
            </div>
          </div>
        </div>

        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: '13px'
        }}>
          <h3 style={sectionTitle}>Trạng thái Task</h3>

          {Object.entries(taskStatusCount).map(([status, count]) => (
            <div key={status}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px'
              }}>
                <span style={{
                  color: '#cbd5e1',
                  fontSize: '12px'
                }}>
                  {STATUS_LABEL[status]}
                </span>

                <strong style={{
                  color: getStatusColor(status),
                  fontSize: '12px'
                }}>
                  {count}
                </strong>
              </div>

              <div style={{
                height: '7px',
                background: '#0f172a',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${tasks.length ? count / tasks.length * 100 : 0}%`,
                  height: '100%',
                  background: getStatusColor(status),
                  borderRadius: '10px'
                }} />
              </div>
            </div>
          ))}

          <div style={{
            borderTop: '1px solid #334155',
            paddingTop: '10px',
            color: '#94a3b8',
            fontSize: '11px'
          }}>
            Thống kê dựa trên các Task đang được giao cho nhóm.
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* PROJECT INFORMATION */}
      {/* ================================================= */}

      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          marginBottom: '16px'
        }}>
          <FolderKanban size={19} color="#38bdf8" />
          <h3 style={sectionTitle}>Thông tin dự án</h3>
        </div>

        <h3 style={{
          color: '#f8fafc',
          fontSize: '18px',
          margin: '0 0 8px'
        }}>
          {project?.name || 'Chưa có tên dự án'}
        </h3>

        <p style={{
          color: '#94a3b8',
          fontSize: '13px',
          lineHeight: 1.6,
          margin: '0 0 16px'
        }}>
          {project?.description || 'Dự án chưa có mô tả.'}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <div style={{
            background: '#0f172a',
            borderRadius: '9px',
            padding: '12px'
          }}>
            <div style={{
              ...mutedText,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CalendarDays size={14} />
              Ngày bắt đầu
            </div>

            <strong style={{
              display: 'block',
              color: '#f8fafc',
              fontSize: '13px',
              marginTop: '7px'
            }}>
              {formatDate(project?.start_date)}
            </strong>
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '9px',
            padding: '12px'
          }}>
            <div style={{
              ...mutedText,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CalendarDays size={14} />
              Ngày kết thúc
            </div>

            <strong style={{
              display: 'block',
              color: '#f8fafc',
              fontSize: '13px',
              marginTop: '7px'
            }}>
              {formatDate(project?.end_date)}
            </strong>
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '9px',
            padding: '12px'
          }}>
            <div style={mutedText}>Trạng thái dự án</div>

            <strong style={{
              display: 'block',
              color: '#34d399',
              fontSize: '13px',
              marginTop: '7px'
            }}>
              {projectStatus[project?.status] || project?.status || 'Chưa xác định'}
            </strong>
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '9px',
            padding: '12px'
          }}>
            <div style={mutedText}>Trưởng nhóm</div>

            <strong style={{
              display: 'block',
              color: '#fbbf24',
              fontSize: '13px',
              marginTop: '7px'
            }}>
              {group.leader || 'Chưa phân công'}
            </strong>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* TASKS */}
      {/* ================================================= */}

      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px'
        }}>
          <h3 style={sectionTitle}>Task được giao cho nhóm</h3>

          <button
            type="button"
            onClick={onOpenKanban}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#38bdf8',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Xem Kanban
          </button>
        </div>

        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: '#64748b',
            fontSize: '13px'
          }}>
            Nhóm chưa được giao Task nào.
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '9px'
          }}>
            {tasks.map(task => (
              <div
                key={task.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '9px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{
                    color: '#f8fafc',
                    fontSize: '13px'
                  }}>
                    {task.title}
                  </strong>

                  <div style={{
                    color: '#64748b',
                    fontSize: '11px',
                    marginTop: '5px'
                  }}>
                    Ưu tiên: {PRIORITY_LABEL[task.priority] || task.priority || 'Chưa xác định'}
                  </div>
                </div>

                <span style={{
                  color: getStatusColor(task.status),
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {STATUS_LABEL[task.status] || task.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================= */}
      {/* MEMBERS + INVITATIONS */}
      {/* ================================================= */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={sectionTitle}>Thành viên nhóm</h3>
            <Users size={18} color="#34d399" />
          </div>

          {members.length === 0 ? (
            <p style={mutedText}>Nhóm chưa có thành viên.</p>
          ) : (
            members.map(member => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#0f172a',
                  borderRadius: '9px',
                  padding: '10px'
                }}
              >
                <div style={{
                  width: '35px',
                  height: '35px',
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: '#334155',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {(member.name || 'U').charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {member.name}
                    {member.id === currentUserId ? ' (Bạn)' : ''}
                  </div>

                  <div style={{
                    color: '#94a3b8',
                    fontSize: '10px',
                    marginTop: '3px'
                  }}>
                    {member.name_tag || 'Chưa có Name Tag'}
                  </div>
                </div>

                {member.id === group.leader_id && (
                  <span style={{
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px'
                  }}>
                    <Crown size={13} />
                    Leader
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* INVITATION FORM */}
        <div style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: '13px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <UserPlus size={19} color="#38bdf8" />
            <h3 style={sectionTitle}>Mời thành viên bằng Name Tag</h3>
          </div>

          {canManageMembers ? (
            <>
              <p style={{
                ...mutedText,
                lineHeight: 1.5,
                margin: 0
              }}>
                Nhập Name Tag của bất kỳ tài khoản DevTask nào.
                Người nhận cần chấp nhận lời mời trước khi được
                thêm vào dự án và nhóm.
              </p>

              <form
                onSubmit={handleLookupUser}
                style={{
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <input
                  value={nameTag}
                  onChange={event => {
                    setNameTag(event.target.value);
                    setFoundUser(null);
                  }}
                  placeholder="#ABCD"
                  maxLength={5}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569',
                    padding: '11px',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />

                <button
                  type="submit"
                  disabled={searching || !nameTag.trim()}
                  style={{
                    background: '#334155',
                    border: '1px solid #475569',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '0 13px',
                    cursor: 'pointer'
                  }}
                >
                  {searching
                    ? <RefreshCw size={16} />
                    : <Search size={16} />}
                </button>
              </form>

              {foundUser && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #0ea5e9',
                  borderRadius: '10px',
                  padding: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{
                      color: '#f8fafc',
                      fontSize: '14px',
                      fontWeight: 700
                    }}>
                      {foundUser.name}
                    </div>

                    <div style={{
                      color: '#38bdf8',
                      fontSize: '12px',
                      marginTop: '4px'
                    }}>
                      {foundUser.name_tag}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendInvitation}
                    disabled={sending}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {sending
                      ? 'Đang gửi...'
                      : 'Gửi lời mời tham gia nhóm'}
                  </button>
                </div>
              )}

              <div style={{
                borderTop: '1px solid #334155',
                paddingTop: '12px'
              }}>
                <div style={{
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '9px'
                }}>
                  Lời mời đang chờ ({pendingInvitations.length})
                </div>

                {pendingInvitations.length === 0 ? (
                  <div style={{
                    color: '#64748b',
                    fontSize: '11px'
                  }}>
                    Chưa có lời mời nào đang chờ.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '190px',
                    overflowY: 'auto'
                  }}>
                    {pendingInvitations.map(invitation => (
                      <div
                        key={invitation.id}
                        style={{
                          background: '#0f172a',
                          borderRadius: '8px',
                          padding: '9px'
                        }}
                      >
                        <div style={{
                          color: '#f8fafc',
                          fontSize: '12px'
                        }}>
                          {invitation.name}
                        </div>

                        <div style={{
                          color: '#94a3b8',
                          fontSize: '10px',
                          marginTop: '3px'
                        }}>
                          {invitation.name_tag}
                          {' · '}
                          {formatDate(invitation.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              background: '#0f172a',
              padding: '13px',
              borderRadius: '9px',
              color: '#94a3b8',
              fontSize: '12px',
              lineHeight: 1.5
            }}>
              Chỉ Owner dự án hoặc Leader của nhóm mới có quyền
              gửi lời mời thành viên.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

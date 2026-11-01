
import React, { useCallback, useEffect, useState } from 'react';
import GroupKanbanBoard from './GroupKanbanBoard';
import AIChatPanel from './AIChatPanel';

import {
  Users,
  Plus,
  Lock,
  Crown,
  Trash2,
  Shield,
  Mail,
  CheckCircle,
  Search,
  LayoutGrid,
  List,
  Clock,
  ArrowLeft,
  Bot,
  MessageSquare
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

async function groupRequest(projectId, path = '', options = {}) {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Bạn cần đăng nhập lại.');
  }

  const response = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/groups${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
  );

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : 'Không thể thực hiện thao tác.'
    );
  }

  return data;
}

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  padding: '9px 14px',
  borderRadius: '8px',
  border: '1px solid #334155',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600
};

const cardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '14px',
  padding: '16px'
};

export default function GroupManagement({
  projectId,
  groups = [],
  setGroups,
  projectMembers = [],
  isProjectOwner = false,
  currentUserId,
  currentUserName = '',
  currentUserEmail = '',
  projectTasks = [],
  showNotification
}) {
  const [newGroupName, setNewGroupName] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [kanbanGroupId, setKanbanGroupId] = useState(null);
  const [activeGroupTab, setActiveGroupTab] = useState('discussion');

  const [inviteMemberId, setInviteMemberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const selectedGroup =
    groups.find(group => group.id === selectedGroupId) || null;

  const notifyError = error => {
    showNotification?.(
      'loi',
      'Không thực hiện được',
      error.message || 'Đã xảy ra lỗi.'
    );
  };

  const isLeaderOfGroup = group => {
    return Boolean(
      group &&
      (
        isProjectOwner ||
        (
          currentUserId &&
          group.leader_id === currentUserId
        )
      )
    );
  };

  const reload = useCallback(async () => {
    if (!projectId) return;

    setLoadingGroups(true);

    try {
      const data = await groupRequest(projectId);

      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoadingGroups(false);
    }
  }, [projectId, setGroups]);

  useEffect(() => {
    setSelectedGroupId(null);
    setKanbanGroupId(null);
    setActiveGroupTab('discussion');
    setInviteMemberId('');

    reload().catch(notifyError);
  }, [projectId]);

  const selectGroup = group => {
    setSelectedGroupId(group?.id || null);
    setKanbanGroupId(null);
    setActiveGroupTab('discussion');
    setInviteMemberId('');
  };

  const mutate = async (callback, successMessage) => {
    if (saving) return;

    setSaving(true);

    try {
      await callback();
      await reload();

      showNotification?.(
        'thanh-cong',
        'Thành công',
        successMessage
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  // Tạo nhóm
  const handleCreateGroup = async event => {
    event.preventDefault();

    const name = newGroupName.trim();

    if (!isProjectOwner || !name) return;

    await mutate(
      async () => {
        await groupRequest(projectId, '', {
          method: 'POST',
          body: JSON.stringify({ name })
        });

        setNewGroupName('');
      },
      `Đã tạo nhóm "${name}".`
    );
  };

  // Chỉ định trưởng nhóm
  const handleAssignLeader = async (groupId, userId) => {
    if (!isProjectOwner) return;

    await mutate(
      () =>
        groupRequest(projectId, `/${groupId}/leader`, {
          method: 'PUT',
          body: JSON.stringify({
            user_id: userId || null
          })
        }),
      'Đã cập nhật trưởng nhóm.'
    );
  };

  // Thêm thành viên
  const handleAddMember = async groupId => {
    const group = groups.find(item => item.id === groupId);

    if (!isLeaderOfGroup(group)) return;

    const member = projectMembers.find(
      item => item.id === inviteMemberId
    );

    if (!member) {
      showNotification?.(
        'loi',
        'Chưa chọn thành viên',
        'Vui lòng chọn thành viên đã tham gia dự án.'
      );
      return;
    }

    await mutate(
      async () => {
        await groupRequest(
          projectId,
          `/${groupId}/members`,
          {
            method: 'POST',
            body: JSON.stringify({
              user_id: member.id
            })
          }
        );

        setInviteMemberId('');
      },
      `Đã thêm ${member.name} vào nhóm.`
    );
  };

  // Gỡ thành viên
  const handleRemoveMember = async (groupId, memberId) => {
    const group = groups.find(item => item.id === groupId);

    if (
      !isLeaderOfGroup(group) ||
      group?.leader_id === memberId
    ) {
      return;
    }

    if (!window.confirm('Bạn có chắc muốn gỡ thành viên này khỏi nhóm?')) {
      return;
    }

    await mutate(
      () =>
        groupRequest(
          projectId,
          `/${groupId}/members/${memberId}`,
          { method: 'DELETE' }
        ),
      'Đã gỡ thành viên khỏi nhóm.'
    );
  };

  // Xóa nhóm
  const handleDeleteGroup = async (groupId, groupName) => {
    if (!isProjectOwner) return;

    if (
      !window.confirm(
        `Bạn có chắc muốn xóa nhóm "${groupName}" không?`
      )
    ) {
      return;
    }

    await mutate(
      async () => {
        await groupRequest(
          projectId,
          `/${groupId}`,
          { method: 'DELETE' }
        );

        if (selectedGroupId === groupId) {
          setSelectedGroupId(null);
          setKanbanGroupId(null);
        }
      },
      `Đã xóa nhóm "${groupName}".`
    );
  };

  // Tìm kiếm và lọc nhóm
  const filteredGroups = groups.filter(group => {
    const keyword = searchKeyword.toLowerCase();

    const matchesKeyword =
      (group.name || '').toLowerCase().includes(keyword) ||
      (group.leader || '').toLowerCase().includes(keyword);

    const matchesRole =
      roleFilter === 'all' ||
      (
        roleFilter === 'leader' &&
        group.leader_id === currentUserId
      ) ||
      (
        roleFilter === 'unassigned' &&
        !group.leader_id
      );

    return matchesKeyword && matchesRole;
  });

  // Thành viên chưa thuộc nhóm
  const availableMembers = selectedGroup
    ? projectMembers.filter(member =>
        !(selectedGroup.members || []).some(
          item => item.id === member.id
        )
      )
    : [];

  // =====================================================
  // GIAO DIỆN CHI TIẾT NHÓM
  // =====================================================

  if (selectedGroup && kanbanGroupId === selectedGroup.id) {
    return (
      <GroupKanbanBoard
        projectId={projectId}
        group={selectedGroup}
        projectTasks={projectTasks}
        currentUserId={currentUserId}
        isProjectOwner={isProjectOwner}
        showNotification={showNotification}
        onBack={() => setKanbanGroupId(null)}
      />
    );
  }

  if (selectedGroup) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          paddingBottom: '30px'
        }}
      >
        {/* Quay lại danh sách nhóm */}
        <button
          type="button"
          onClick={() => selectGroup(null)}
          style={{
            ...buttonStyle,
            width: 'fit-content',
            background: '#1e293b',
            color: '#38bdf8'
          }}
        >
          <ArrowLeft size={16} />
          Quay lại danh sách nhóm
        </button>

        {/* Header nhóm */}
        <div
          style={{
            ...cardStyle,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px'
              }}
            >
              {(selectedGroup.name || 'G').charAt(0).toUpperCase()}
            </div>

            <div>
              <h3
                style={{
                  color: '#f8fafc',
                  fontSize: '20px',
                  margin: '0 0 5px'
                }}
              >
                {selectedGroup.name}
              </h3>

              <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                Quản lý nhóm và trợ lý AI dự án
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => setKanbanGroupId(selectedGroup.id)}
              style={{
                ...buttonStyle,
                background: '#4f46e5',
                borderColor: '#6366f1',
                color: '#fff'
              }}
            >
              <LayoutGrid size={16} />
              Mở Kanban
            </button>

            {isProjectOwner && (
              <button
                type="button"
                onClick={() =>
                  handleDeleteGroup(
                    selectedGroup.id,
                    selectedGroup.name
                  )
                }
                disabled={saving}
                style={{
                  ...buttonStyle,
                  background: 'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#f87171'
                }}
              >
                <Trash2 size={16} />
                Xóa nhóm
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid #334155',
            paddingBottom: '10px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveGroupTab('discussion')}
            style={{
              ...buttonStyle,
              background:
                activeGroupTab === 'discussion'
                  ? '#334155'
                  : 'transparent',
              color:
                activeGroupTab === 'discussion'
                  ? '#fff'
                  : '#94a3b8'
            }}
          >
            <Users size={16} />
            Thành viên và phân quyền
          </button>

          <button
            type="button"
            onClick={() => setActiveGroupTab('ai')}
            style={{
              ...buttonStyle,
              background:
                activeGroupTab === 'ai'
                  ? '#4f46e5'
                  : 'transparent',
              borderColor:
                activeGroupTab === 'ai'
                  ? '#6366f1'
                  : '#334155',
              color:
                activeGroupTab === 'ai'
                  ? '#fff'
                  : '#94a3b8'
            }}
          >
            <Bot size={16} />
            AI Chat
          </button>
        </div>

        {/* TAB AI CHAT */}
{activeGroupTab === 'ai' && (
  <AIChatPanel
    projectId={projectId}
    projectName={selectedGroup.name}
    groups={groups}
    currentUserId={currentUserId}
    isProjectOwner={isProjectOwner}
  />
)}

        {/* TAB QUẢN LÝ THÀNH VIÊN */}
        {activeGroupTab === 'discussion' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '18px'
            }}
          >
            {/* Trưởng nhóm */}
            <div
              style={{
                ...cardStyle,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fbbf24',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                <Crown size={17} />
                Trưởng nhóm phụ trách
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#0f172a',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #334155'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#38bdf8',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedGroup.leader
                    ? selectedGroup.leader.charAt(0).toUpperCase()
                    : '?'}
                </div>

                <div>
                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    {selectedGroup.leader || 'Chưa phân công'}
                  </div>

                  {selectedGroup.leaderEmail && (
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px'
                      }}
                    >
                      {selectedGroup.leaderEmail}
                    </div>
                  )}
                </div>
              </div>

              {isProjectOwner && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      color: '#94a3b8',
                      fontSize: '12px',
                      marginBottom: '7px'
                    }}
                  >
                    Chỉ định trưởng nhóm mới
                  </label>

                  <select
                    value={selectedGroup.leader_id || ''}
                    onChange={event =>
                      handleAssignLeader(
                        selectedGroup.id,
                        event.target.value
                      )
                    }
                    disabled={saving}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      color: '#fff',
                      border: '1px solid #334155',
                      padding: '10px',
                      borderRadius: '8px'
                    }}
                  >
                    <option value="">
                      -- Chọn thành viên --
                    </option>

                    {projectMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.email ? ` (${member.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Thành viên */}
            <div
              style={{
                ...cardStyle,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#34d399',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                <Users size={17} />
                Thành viên ({selectedGroup.members?.length || 0})
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}
              >
                {selectedGroup.members?.length > 0 ? (
                  selectedGroup.members.map(member => {
                    const isMe = member.id === currentUserId;

                    return (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#0f172a',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid #334155'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                            minWidth: 0
                          }}
                        >
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              flexShrink: 0,
                              borderRadius: '50%',
                              background: '#475569',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {(member.name || 'U')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: '#f8fafc',
                                fontSize: '12px'
                              }}
                            >
                              {member.name}
                              {isMe ? ' (Tôi)' : ''}
                            </div>

                            <div
                              style={{
                                color: '#94a3b8',
                                fontSize: '10px'
                              }}
                            >
                              {member.email}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {member.status === 'accepted' ? (
                            <span
                              style={{
                                color: '#34d399',
                                fontSize: '10px'
                              }}
                            >
                              <CheckCircle size={13} />
                            </span>
                          ) : member.status === 'pending_invite' ? (
                            <span
                              style={{
                                color: '#fbbf24',
                                fontSize: '10px'
                              }}
                            >
                              <Clock size={13} />
                            </span>
                          ) : null}

                          {isLeaderOfGroup(selectedGroup) &&
                            member.id !== selectedGroup.leader_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(
                                    selectedGroup.id,
                                    member.id
                                  )
                                }
                                disabled={saving}
                                title="Gỡ thành viên"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p
                    style={{
                      color: '#64748b',
                      fontSize: '12px'
                    }}
                  >
                    Nhóm chưa có thành viên.
                  </p>
                )}
              </div>

              {/* Thêm thành viên */}
              {isLeaderOfGroup(selectedGroup) && (
                <div
                  style={{
                    borderTop: '1px solid #334155',
                    paddingTop: '12px'
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#94a3b8',
                      fontSize: '12px',
                      marginBottom: '8px'
                    }}
                  >
                    <Mail size={14} />
                    Thêm thành viên dự án
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <select
                      value={inviteMemberId}
                      onChange={event =>
                        setInviteMemberId(event.target.value)
                      }
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        background: '#0f172a',
                        color: '#fff',
                        border: '1px solid #334155',
                        padding: '9px',
                        borderRadius: '8px'
                      }}
                    >
                      <option value="">
                        -- Chọn thành viên --
                      </option>

                      {availableMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                          {member.email ? ` (${member.email})` : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddMember(selectedGroup.id)
                      }
                      disabled={saving || !inviteMemberId}
                      style={{
                        ...buttonStyle,
                        background: '#38bdf8',
                        color: '#0f172a',
                        borderColor: '#38bdf8'
                      }}
                    >
                      <Plus size={15} />
                      Thêm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Thông tin thảo luận */}
            <div
              style={{
                ...cardStyle,
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <MessageSquare size={20} color="#38bdf8" />

              <div>
                <div
                  style={{
                    color: '#f8fafc',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Thảo luận nội bộ
                </div>

                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    marginTop: '4px'
                  }}
                >
                  Chức năng chat nội bộ nhóm chưa được kết nối API.
                  Bạn có thể sử dụng AI Chat ở tab bên cạnh.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================================
  // GIAO DIỆN DANH SÁCH NHÓM
  // =====================================================

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        paddingBottom: '30px'
      }}
    >
      {/* Tạo nhóm */}
      <div style={cardStyle}>
        <h3
          style={{
            color: '#f8fafc',
            fontSize: '16px',
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={19} color="#38bdf8" />
          Khởi tạo nhóm làm việc mới
        </h3>

        {isProjectOwner ? (
          <form
            onSubmit={handleCreateGroup}
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <input
              type="text"
              value={newGroupName}
              onChange={event =>
                setNewGroupName(event.target.value)
              }
              placeholder="Nhập tên nhóm..."
              required
              style={{
                flex: 1,
                minWidth: '220px',
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #334155',
                padding: '11px',
                borderRadius: '8px'
              }}
            />

            <button
              type="submit"
              disabled={saving || !newGroupName.trim()}
              style={{
                ...buttonStyle,
                background: '#4f46e5',
                color: '#fff'
              }}
            >
              <Plus size={16} />
              Tạo nhóm
            </button>
          </form>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8',
              fontSize: '13px'
            }}
          >
            <Lock size={16} color="#fbbf24" />
            Chỉ Owner mới có quyền tạo nhóm.
          </div>
        )}
      </div>

      {/* Danh sách nhóm */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          <h3
            style={{
              color: '#f8fafc',
              fontSize: '18px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Shield size={19} color="#34d399" />
            Danh sách nhóm ({filteredGroups.length})
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 10px'
              }}
            >
              <Search size={15} color="#94a3b8" />

              <input
                value={searchKeyword}
                onChange={event =>
                  setSearchKeyword(event.target.value)
                }
                placeholder="Tìm nhóm..."
                style={{
                  width: '150px',
                  background: 'transparent',
                  color: '#fff',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px'
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={event =>
                setRoleFilter(event.target.value)
              }
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                padding: '9px',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            >
              <option value="all">Tất cả nhóm</option>
              <option value="leader">Nhóm tôi phụ trách</option>
              <option value="unassigned">
                Chưa có trưởng nhóm
              </option>
            </select>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                ...buttonStyle,
                padding: '8px',
                background:
                  viewMode === 'grid' ? '#334155' : '#1e293b',
                color: '#fff'
              }}
              title="Dạng lưới"
            >
              <LayoutGrid size={16} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                ...buttonStyle,
                padding: '8px',
                background:
                  viewMode === 'list' ? '#334155' : '#1e293b',
                color: '#fff'
              }}
              title="Dạng danh sách"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {loadingGroups ? (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              color: '#94a3b8'
            }}
          >
            Đang tải danh sách nhóm...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              color: '#94a3b8',
              padding: '40px'
            }}
          >
            <Users size={32} />
            <p>Không tìm thấy nhóm nào.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(280px, 1fr))'
                  : '1fr',
              gap: '14px'
            }}
          >
            {filteredGroups.map(group => (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                onClick={() => selectGroup(group)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    selectGroup(group);
                  }
                }}
                style={{
                  ...cardStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      flexShrink: 0,
                      background: 'rgba(56,189,248,0.15)',
                      color: '#38bdf8',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}
                  >
                    {(group.name || 'G')
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h4
                      style={{
                        color: '#f8fafc',
                        fontSize: '14px',
                        margin: '0 0 5px'
                      }}
                    >
                      {group.name}
                    </h4>

                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '11px'
                      }}
                    >
                      Trưởng nhóm: {group.leader || 'Chưa phân công'}
                    </div>

                    <div
                      style={{
                        color: '#64748b',
                        fontSize: '11px',
                        marginTop: '4px'
                      }}
                    >
                      {group.members?.length || 0} thành viên
                    </div>
                  </div>
                </div>

                {isProjectOwner && (
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();

                      handleDeleteGroup(group.id, group.name);
                    }}
                    title="Xóa nhóm"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#f87171',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'pointer'
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
    </div>
  );
}

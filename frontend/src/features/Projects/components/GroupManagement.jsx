
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
  MessageSquare,
  FolderKanban,
  ClipboardList,
  CircleCheck,
  CircleDot,
  UserPlus,
  Send,
  RefreshCw,
  CalendarDays,
  Target,
  Activity,
  User,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const STATUS_COLUMNS = [
  {
    id: 'todo',
    label: 'Cần làm',
    color: '#94a3b8',
  },
  {
    id: 'in_progress',
    label: 'Đang làm',
    color: '#38bdf8',
  },
  {
    id: 'review',
    label: 'Kiểm tra',
    color: '#fbbf24',
  },
  {
    id: 'done',
    label: 'Hoàn thành',
    color: '#34d399',
  },
];

const cardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 14,
  padding: 18,
  minWidth: 0,
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '9px 14px',
  borderRadius: 8,
  border: '1px solid #334155',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  transition: '0.2s',
};

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #334155',
  padding: '10px 12px',
  borderRadius: 8,
  outline: 'none',
  fontSize: 13,
};

function getToken() {
  return localStorage.getItem('access_token');
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : `Yêu cầu thất bại (HTTP ${response.status}).`,
    );
  }

  return data;
}

function getInitial(name) {
  return (name || 'U').trim().charAt(0).toUpperCase();
}

function formatDate(value) {
  if (!value) return 'Chưa thiết lập';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Không xác định';
  }

  return date.toLocaleDateString('vi-VN');
}

function getStatusLabel(status) {
  const found = STATUS_COLUMNS.find(
    item => item.id === status,
  );

  return found?.label || status || 'Chưa xác định';
}

function getPriorityLabel(priority) {
  const labels = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Khẩn cấp',
  };

  return labels[priority] || priority || 'Trung bình';
}

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  color = '#38bdf8',
}) {
  return (
    <div
      style={{
        ...cardStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 12,
          background: `${color}20`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: '#94a3b8',
            fontSize: 12,
            marginBottom: 5,
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: '#f8fafc',
            fontSize: 25,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>

        {description && (
          <div
            style={{
              color: '#64748b',
              fontSize: 11,
              marginTop: 5,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  color = '#38bdf8',
  height = 9,
}) {
  const safeValue = Math.min(
    100,
    Math.max(0, Number(value) || 0),
  );

  return (
    <div
      style={{
        width: '100%',
        height,
        background: '#0f172a',
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${safeValue}%`,
          height: '100%',
          background: color,
          borderRadius: 20,
          transition: 'width 0.3s',
        }}
      />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
  right,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 15,
      }}
    >
      <div>
        <h3
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#f8fafc',
            fontSize: 15,
            margin: 0,
          }}
        >
          {Icon && <Icon size={18} color="#38bdf8" />}
          {title}
        </h3>

        {description && (
          <p
            style={{
              color: '#94a3b8',
              fontSize: 12,
              margin: '5px 0 0',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {right}
    </div>
  );
}

export default function GroupManagement({
  projectId,
  project,
  groups = [],
  setGroups,
  projectMembers = [],
  isProjectOwner = false,
  currentUserId,
  currentUserName = '',
  currentUserEmail = '',
  projectTasks = [],
  showNotification,
}) {
  // ============================================================
  // STATE
  // ============================================================

  const [newGroupName, setNewGroupName] = useState('');

  const [searchKeyword, setSearchKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [kanbanGroupId, setKanbanGroupId] = useState(null);

  const [activeGroupTab, setActiveGroupTab] = useState('dashboard');

  const [saving, setSaving] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Dữ liệu Kanban của nhóm đang xem.
  const [groupBoard, setGroupBoard] = useState({
    tasks: [],
    subtasks: [],
  });

  const [loadingBoard, setLoadingBoard] = useState(false);

  // Mời tài khoản bằng Name Tag.
  const [nameTagInput, setNameTagInput] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState(false);

  // Thêm thành viên đã thuộc dự án vào nhóm.
  const [inviteMemberId, setInviteMemberId] = useState('');

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const selectedGroup = useMemo(
    () =>
      groups.find(
        group => String(group.id) === String(selectedGroupId),
      ) || null,
    [groups, selectedGroupId],
  );

  const selectedGroupMembers = selectedGroup?.members || [];

  const isLeaderOfGroup = useCallback(
    group =>
      Boolean(
        group &&
        (
          isProjectOwner ||
          (
            currentUserId &&
            String(group.leader_id) === String(currentUserId)
          )
        ),
      ),
    [isProjectOwner, currentUserId],
  );

  const canManageSelectedGroup = selectedGroup
    ? isLeaderOfGroup(selectedGroup)
    : false;

  const notifyError = useCallback(
    error => {
      showNotification?.(
        'loi',
        'Không thực hiện được',
        error?.message || 'Đã xảy ra lỗi.',
      );
    },
    [showNotification],
  );

  const notifySuccess = useCallback(
    message => {
      showNotification?.(
        'thanh-cong',
        'Thành công',
        message,
      );
    },
    [showNotification],
  );

  // ============================================================
  // API GROUP
  // ============================================================

  const groupRequest = useCallback(
    (path = '', options = {}) =>
      apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/groups${path}`,
        options,
      ),
    [projectId],
  );

  const reloadGroups = useCallback(async () => {
    if (!projectId) return;

    setLoadingGroups(true);

    try {
      const data = await groupRequest();

      setGroups(Array.isArray(data) ? data : []);
    } finally {
      setLoadingGroups(false);
    }
  }, [projectId, groupRequest, setGroups]);

  const reloadGroupBoard = useCallback(async groupId => {
    if (!projectId || !groupId) return;

    setLoadingBoard(true);

    try {
      const data = await apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(groupId)}/kanban`,
      );

      setGroupBoard({
        tasks: Array.isArray(data?.tasks) ? data.tasks : [],
        subtasks: Array.isArray(data?.subtasks)
          ? data.subtasks
          : [],
      });
    } catch (error) {
      setGroupBoard({
        tasks: [],
        subtasks: [],
      });

      throw error;
    } finally {
      setLoadingBoard(false);
    }
  }, [projectId]);

  useEffect(() => {
    setSelectedGroupId(null);
    setKanbanGroupId(null);
    setActiveGroupTab('dashboard');

    setNameTagInput('');
    setFoundUser(null);
    setInviteMemberId('');

    reloadGroups().catch(notifyError);
  }, [projectId]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      setGroupBoard({
        tasks: [],
        subtasks: [],
      });

      return;
    }

    reloadGroupBoard(selectedGroup.id).catch(notifyError);
  }, [selectedGroup?.id, reloadGroupBoard, notifyError]);

  // ============================================================
  // MUTATION HELPER
  // ============================================================

  const mutate = async (callback, successMessage) => {
    if (saving) return;

    setSaving(true);

    try {
      await callback();
      await reloadGroups();

      notifySuccess(successMessage);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CREATE GROUP
  // ============================================================

  const handleCreateGroup = async event => {
    event.preventDefault();

    const name = newGroupName.trim();

    if (!isProjectOwner || !name) return;

    await mutate(
      async () => {
        await groupRequest('', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });

        setNewGroupName('');
      },
      `Đã tạo nhóm "${name}".`,
    );
  };

  // ============================================================
  // ASSIGN LEADER
  // ============================================================

  const handleAssignLeader = async (groupId, userId) => {
    if (!isProjectOwner) return;

    await mutate(
      () =>
        groupRequest(`/${groupId}/leader`, {
          method: 'PUT',
          body: JSON.stringify({
            user_id: userId || null,
          }),
        }),
      'Đã cập nhật trưởng nhóm.',
    );
  };

  // ============================================================
  // ADD EXISTING PROJECT MEMBER
  // ============================================================

  const availableMembers = selectedGroup
    ? projectMembers.filter(member =>
        !selectedGroupMembers.some(
          item => String(item.id) === String(member.id),
        ),
      )
    : [];

  const handleAddMember = async () => {
    if (!selectedGroup || !canManageSelectedGroup) return;

    const member = availableMembers.find(
      item => String(item.id) === String(inviteMemberId),
    );

    if (!member) {
      notifyError(
        new Error('Vui lòng chọn thành viên chưa thuộc nhóm.'),
      );
      return;
    }

    await mutate(
      async () => {
        await groupRequest(
          `/${selectedGroup.id}/members`,
          {
            method: 'POST',
            body: JSON.stringify({
              user_id: member.id,
            }),
          },
        );

        setInviteMemberId('');
      },
      `Đã thêm ${member.name} vào nhóm.`,
    );
  };

  // ============================================================
  // REMOVE MEMBER
  // ============================================================

  const handleRemoveMember = async (groupId, memberId) => {
    const group = groups.find(
      item => String(item.id) === String(groupId),
    );

    if (
      !isLeaderOfGroup(group) ||
      String(group?.leader_id) === String(memberId)
    ) {
      return;
    }

    if (
      !window.confirm(
        'Bạn có chắc muốn gỡ thành viên này khỏi nhóm không?',
      )
    ) {
      return;
    }

    await mutate(
      () =>
        groupRequest(
          `/${groupId}/members/${memberId}`,
          {
            method: 'DELETE',
          },
        ),
      'Đã gỡ thành viên khỏi nhóm.',
    );
  };

  // ============================================================
  // DELETE GROUP
  // ============================================================

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!isProjectOwner) return;

    if (
      !window.confirm(
        `Bạn có chắc muốn xóa nhóm "${groupName}" không?`,
      )
    ) {
      return;
    }

    await mutate(
      async () => {
        await groupRequest(`/${groupId}`, {
          method: 'DELETE',
        });

        if (String(selectedGroupId) === String(groupId)) {
          setSelectedGroupId(null);
          setKanbanGroupId(null);
        }
      },
      `Đã xóa nhóm "${groupName}".`,
    );
  };

  // ============================================================
  // SEARCH USER BY NAME TAG
  // ============================================================

  const handleSearchNameTag = async event => {
    event.preventDefault();

    const tag = nameTagInput.trim().replace(/^#+/, '').toUpperCase();

    if (!tag) {
      notifyError(new Error('Vui lòng nhập Name Tag.'));
      return;
    }

    if (tag.length !== 4) {
      notifyError(
        new Error('Name Tag phải gồm dấu # và 4 ký tự.'),
      );
      return;
    }

    setSearchingUser(true);
    setFoundUser(null);

    try {
      const user = await apiRequest(
        `/api/users/by-tag/${encodeURIComponent(tag)}`,
      );

      if (String(user.id) === String(currentUserId)) {
        throw new Error('Bạn không thể tự mời chính mình.');
      }

      const alreadyInGroup = selectedGroupMembers.some(
        member => String(member.id) === String(user.id),
      );

      if (alreadyInGroup) {
        throw new Error('Tài khoản này đã là thành viên của nhóm.');
      }

      setFoundUser(user);
    } catch (error) {
      setFoundUser(null);
      notifyError(error);
    } finally {
      setSearchingUser(false);
    }
  };

  // ============================================================
  // SEND GROUP INVITATION
  // ============================================================

  const handleSendInvitation = async () => {
    if (!selectedGroup || !foundUser || !canManageSelectedGroup) {
      return;
    }

    if (
      String(foundUser.id) === String(currentUserId)
    ) {
      notifyError(new Error('Bạn không thể tự mời chính mình.'));
      return;
    }

    setSendingInvitation(true);

    try {
      /*
       * API backend cần triển khai:
       *
       * POST /api/notifications/invitations
       *
       * Body:
       * {
       *   "project_id": "...",
       *   "group_id": "...",
       *   "name_tag": "#AB12"
       * }
       *
       * Backend phải:
       * - Tìm tài khoản theo Name Tag.
       * - Cho phép tài khoản chưa thuộc dự án.
       * - Kiểm tra người gửi là Owner hoặc Leader nhóm.
       * - Tạo GroupInvitation.
       * - Tạo Notification cho người được mời.
       */
      await apiRequest('/api/notifications/invitations', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          group_id: selectedGroup.id,
          name_tag: foundUser.name_tag || nameTagInput.trim(),
        }),
      });

      notifySuccess(
        `Đã gửi lời mời tham gia nhóm đến ${foundUser.name}.`,
      );

      setNameTagInput('');
      setFoundUser(null);
    } catch (error) {
      notifyError(error);
    } finally {
      setSendingInvitation(false);
    }
  };

  // ============================================================
  // SELECT GROUP
  // ============================================================

  const selectGroup = group => {
    setSelectedGroupId(group?.id || null);
    setKanbanGroupId(null);
    setActiveGroupTab('dashboard');

    setNameTagInput('');
    setFoundUser(null);
    setInviteMemberId('');
  };

  // ============================================================
  // GROUP FILTERING
  // ============================================================

  const filteredGroups = groups.filter(group => {
    const keyword = searchKeyword.toLowerCase().trim();

    const matchesKeyword =
      (group.name || '').toLowerCase().includes(keyword) ||
      (group.leader || '').toLowerCase().includes(keyword);

    const matchesRole =
      roleFilter === 'all' ||
      (
        roleFilter === 'leader' &&
        String(group.leader_id) === String(currentUserId)
      ) ||
      (
        roleFilter === 'unassigned' &&
        !group.leader_id
      );

    return matchesKeyword && matchesRole;
  });

  // ============================================================
  // GROUP STATISTICS
  // ============================================================

  const groupTasks = groupBoard.tasks || [];
  const groupSubtasks = groupBoard.subtasks || [];

  const totalTasks = groupTasks.length;
  const totalSubtasks = groupSubtasks.length;

  const completedTasks = groupTasks.filter(
    task => task.status === 'done',
  ).length;

  const completedSubtasks = groupSubtasks.filter(
    subtask => subtask.status === 'done',
  ).length;

  const inProgressTasks = groupTasks.filter(
    task => task.status === 'in_progress',
  ).length;

  const inProgressSubtasks = groupSubtasks.filter(
    subtask => subtask.status === 'in_progress',
  ).length;

  const totalWorkItems = totalTasks + totalSubtasks;
  const completedWorkItems =
    completedTasks + completedSubtasks;

  const completionRate = totalWorkItems > 0
    ? Math.round(
        (completedWorkItems / totalWorkItems) * 100,
      )
    : 0;

  const projectName =
    project?.name ||
    project?.project_name ||
    'Dự án hiện tại';

  const projectDescription =
    project?.description ||
    'Chưa có mô tả cho dự án này.';

  const projectStartDate =
    project?.start_date ||
    project?.startDate;

  const projectEndDate =
    project?.end_date ||
    project?.endDate;

  const projectStatus =
    project?.status ||
    project?.project_status ||
    'Đang thực hiện';

  const statusCounts = STATUS_COLUMNS.map(status => {
    const taskCount = groupTasks.filter(
      task => task.status === status.id,
    ).length;

    const subtaskCount = groupSubtasks.filter(
      subtask => subtask.status === status.id,
    ).length;

    return {
      ...status,
      count: taskCount + subtaskCount,
    };
  });

  const recentTasks = [...groupTasks]
    .sort((a, b) => {
      const dateA = new Date(
        a.updated_at || a.created_at || 0,
      ).getTime();

      const dateB = new Date(
        b.updated_at || b.created_at || 0,
      ).getTime();

      return dateB - dateA;
    })
    .slice(0, 5);

  // ============================================================
  // GROUP KANBAN SCREEN
  // ============================================================

  if (
    selectedGroup &&
    String(kanbanGroupId) === String(selectedGroup.id)
  ) {
    return (
      <GroupKanbanBoard
        projectId={projectId}
        group={selectedGroup}
        projectTasks={projectTasks}
        currentUserId={currentUserId}
        isProjectOwner={isProjectOwner}
        showNotification={showNotification}
        onBack={() => {
          setKanbanGroupId(null);
          reloadGroupBoard(selectedGroup.id).catch(notifyError);
        }}
      />
    );
  }

  // ============================================================
  // GROUP DETAIL / DASHBOARD
  // ============================================================

  if (selectedGroup) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          paddingBottom: 30,
          color: '#f8fafc',
          minWidth: 0,
        }}
      >
        {/* BACK */}
        <button
          type="button"
          onClick={() => selectGroup(null)}
          style={{
            ...buttonStyle,
            width: 'fit-content',
            background: '#1e293b',
            color: '#38bdf8',
          }}
        >
          <ArrowLeft size={16} />
          Quay lại danh sách nhóm
        </button>

        {/* GROUP HEADER */}
        <div
          style={{
            ...cardStyle,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            background:
              'linear-gradient(120deg, #1e293b 0%, #172554 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                flexShrink: 0,
                background: 'rgba(56,189,248,0.15)',
                color: '#38bdf8',
                borderRadius: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 25,
                fontWeight: 800,
              }}
            >
              {getInitial(selectedGroup.name)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 11,
                  marginBottom: 5,
                }}
              >
                TRANG CHỦ NHÓM
              </div>

              <h2
                style={{
                  color: '#f8fafc',
                  fontSize: 23,
                  margin: 0,
                  overflowWrap: 'anywhere',
                }}
              >
                {selectedGroup.name}
              </h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  color: '#94a3b8',
                  fontSize: 12,
                  marginTop: 7,
                }}
              >
                <span>
                  <Users
                    size={13}
                    style={{
                      verticalAlign: 'middle',
                      marginRight: 4,
                    }}
                  />
                  {selectedGroupMembers.length} thành viên
                </span>

                <span>
                  <Crown
                    size={13}
                    style={{
                      verticalAlign: 'middle',
                      marginRight: 4,
                      color: '#fbbf24',
                    }}
                  />
                  {selectedGroup.leader || 'Chưa có trưởng nhóm'}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setKanbanGroupId(selectedGroup.id)}
              style={{
                ...buttonStyle,
                background: '#4f46e5',
                borderColor: '#6366f1',
                color: '#fff',
              }}
            >
              <LayoutGrid size={16} />
              Mở Kanban
            </button>

            <button
              type="button"
              onClick={() =>
                reloadGroupBoard(selectedGroup.id).catch(notifyError)
              }
              disabled={loadingBoard}
              style={{
                ...buttonStyle,
                background: '#334155',
                color: '#f8fafc',
              }}
            >
              <RefreshCw
                size={15}
                style={{
                  animation: loadingBoard
                    ? 'group-spin 1s linear infinite'
                    : 'none',
                }}
              />
              Làm mới
            </button>

            {isProjectOwner && (
              <button
                type="button"
                onClick={() =>
                  handleDeleteGroup(
                    selectedGroup.id,
                    selectedGroup.name,
                  )
                }
                disabled={saving}
                style={{
                  ...buttonStyle,
                  background: 'rgba(239,68,68,0.1)',
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#f87171',
                }}
              >
                <Trash2 size={15} />
                Xóa nhóm
              </button>
            )}
          </div>
        </div>

        {/* GROUP TABS */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            borderBottom: '1px solid #334155',
            paddingBottom: 10,
          }}
        >
          {[
            {
              id: 'dashboard',
              label: 'Tổng quan',
              icon: Activity,
            },
            {
              id: 'members',
              label: 'Thành viên',
              icon: Users,
            },
            {
              id: 'ai',
              label: 'AI Chat',
              icon: Bot,
            },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeGroupTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveGroupTab(tab.id)}
                style={{
                  ...buttonStyle,
                  background: active ? '#334155' : 'transparent',
                  borderColor: active ? '#475569' : 'transparent',
                  color: active ? '#fff' : '#94a3b8',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ================================================== */}
        {/* DASHBOARD TAB */}
        {/* ================================================== */}

        {activeGroupTab === 'dashboard' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* PROJECT INFORMATION */}
            <div style={cardStyle}>
              <SectionTitle
                icon={FolderKanban}
                title="Thông tin dự án"
                description="Thông tin dự án mà nhóm đang tham gia."
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 11,
                      marginBottom: 6,
                    }}
                  >
                    Tên dự án
                  </div>

                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {projectName}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 11,
                      marginBottom: 6,
                    }}
                  >
                    Trạng thái
                  </div>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '5px 9px',
                      borderRadius: 20,
                      background: 'rgba(56,189,248,0.12)',
                      color: '#38bdf8',
                      fontSize: 12,
                    }}
                  >
                    {projectStatus}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 11,
                      marginBottom: 6,
                    }}
                  >
                    Ngày bắt đầu
                  </div>

                  <div
                    style={{
                      color: '#e2e8f0',
                      fontSize: 13,
                    }}
                  >
                    <CalendarDays
                      size={14}
                      style={{
                        verticalAlign: 'middle',
                        marginRight: 5,
                      }}
                    />
                    {formatDate(projectStartDate)}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: 11,
                      marginBottom: 6,
                    }}
                  >
                    Ngày kết thúc
                  </div>

                  <div
                    style={{
                      color: '#e2e8f0',
                      fontSize: 13,
                    }}
                  >
                    <CalendarDays
                      size={14}
                      style={{
                        verticalAlign: 'middle',
                        marginRight: 5,
                      }}
                    />
                    {formatDate(projectEndDate)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 13,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  Mô tả dự án
                </div>

                <p
                  style={{
                    color: '#cbd5e1',
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {projectDescription}
                </p>
              </div>
            </div>

            {/* STATISTICS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              <StatCard
                icon={ClipboardList}
                title="Task được giao cho nhóm"
                value={totalTasks}
                description="Task cấp dự án được phân công"
                color="#38bdf8"
              />

              <StatCard
                icon={LayersIcon}
                title="Tổng Subtask"
                value={totalSubtasks}
                description="Subtask thuộc các Task của nhóm"
                color="#a78bfa"
              />

              <StatCard
                icon={CircleCheck}
                title="Công việc hoàn thành"
                value={completedWorkItems}
                description={`${completedTasks} Task và ${completedSubtasks} Subtask`}
                color="#34d399"
              />

              <StatCard
                icon={Users}
                title="Thành viên"
                value={selectedGroupMembers.length}
                description="Số tài khoản trong nhóm"
                color="#fbbf24"
              />
            </div>

            {/* PROGRESS */}
            <div style={cardStyle}>
              <SectionTitle
                icon={Target}
                title="Tiến độ thực hiện"
                description="Tỷ lệ hoàn thành dựa trên Task và Subtask được giao cho nhóm."
                right={
                  <span
                    style={{
                      fontSize: 24,
                      color: '#34d399',
                      fontWeight: 800,
                    }}
                  >
                    {completionRate}%
                  </span>
                }
              />

              <ProgressBar
                value={completionRate}
                color="#34d399"
                height={12}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 10,
                  color: '#94a3b8',
                  fontSize: 12,
                }}
              >
                <span>
                  Đã hoàn thành: {completedWorkItems}
                </span>

                <span>
                  Tổng công việc: {totalWorkItems}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                  marginTop: 20,
                }}
              >
                {statusCounts.map(status => (
                  <div
                    key={status.id}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 9,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        color: status.color,
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    >
                      <CircleDot size={13} />
                      {status.label}
                    </div>

                    <div
                      style={{
                        color: '#f8fafc',
                        fontSize: 21,
                        fontWeight: 700,
                      }}
                    >
                      {status.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TASK LIST */}
            <div style={cardStyle}>
              <SectionTitle
                icon={ClipboardList}
                title="Task đang được giao"
                description="Danh sách Task cấp dự án đã được phân công cho nhóm."
                right={
                  <button
                    type="button"
                    onClick={() => setKanbanGroupId(selectedGroup.id)}
                    style={{
                      ...buttonStyle,
                      background: '#334155',
                      color: '#f8fafc',
                    }}
                  >
                    Xem Kanban
                    <ExternalLink size={14} />
                  </button>
                }
              />

              {loadingBoard ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#94a3b8',
                    padding: 25,
                  }}
                >
                  <Loader2
                    size={22}
                    style={{
                      animation: 'group-spin 1s linear infinite',
                    }}
                  />
                  <p>Đang tải dữ liệu nhóm...</p>
                </div>
              ) : groupTasks.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#64748b',
                    padding: 25,
                    background: '#0f172a',
                    borderRadius: 9,
                  }}
                >
                  <ClipboardList size={28} />
                  <p>Nhóm chưa được giao Task nào.</p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                  }}
                >
                  {recentTasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 9,
                        padding: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: '#f8fafc',
                            fontSize: 13,
                            fontWeight: 600,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {task.title || 'Task không có tiêu đề'}
                        </div>

                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: 11,
                            marginTop: 6,
                          }}
                        >
                          Người thực hiện:{' '}
                          {task.assignee_name || 'Chưa phân công'}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            padding: '5px 8px',
                            background: '#1e293b',
                            borderRadius: 6,
                            color: '#cbd5e1',
                            fontSize: 11,
                          }}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>

                        <span
                          style={{
                            padding: '5px 8px',
                            background: '#1e293b',
                            borderRadius: 6,
                            color:
                              STATUS_COLUMNS.find(
                                item => item.id === task.status,
                              )?.color || '#94a3b8',
                            fontSize: 11,
                          }}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TEAM PREVIEW */}
            <div style={cardStyle}>
              <SectionTitle
                icon={Users}
                title="Thành viên nhóm"
                description="Các tài khoản hiện đang tham gia nhóm."
                right={
                  <button
                    type="button"
                    onClick={() => setActiveGroupTab('members')}
                    style={{
                      ...buttonStyle,
                      background: '#334155',
                      color: '#f8fafc',
                    }}
                  >
                    Quản lý thành viên
                  </button>
                }
              />

              {selectedGroupMembers.length === 0 ? (
                <p
                  style={{
                    color: '#64748b',
                    fontSize: 13,
                  }}
                >
                  Nhóm chưa có thành viên.
                </p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: 10,
                  }}
                >
                  {selectedGroupMembers.slice(0, 8).map(member => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 9,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          flexShrink: 0,
                          borderRadius: '50%',
                          background: '#334155',
                          color: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {getInitial(member.name)}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: '#f8fafc',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {member.name}
                        </div>

                        <div
                          style={{
                            color: '#64748b',
                            fontSize: 10,
                            marginTop: 3,
                          }}
                        >
                          {member.id === selectedGroup.leader_id
                            ? 'Trưởng nhóm'
                            : member.name_tag || 'Thành viên'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* MEMBERS TAB */}
        {/* ================================================== */}

        {activeGroupTab === 'members' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {/* LEADER */}
            <div
              style={{
                ...cardStyle,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <SectionTitle
                icon={Crown}
                title="Trưởng nhóm phụ trách"
                description="Người chịu trách nhiệm quản lý nhóm."
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#0f172a',
                  padding: 13,
                  borderRadius: 10,
                  border: '1px solid #334155',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#fbbf24',
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 17,
                  }}
                >
                  {getInitial(selectedGroup.leader)}
                </div>

                <div>
                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {selectedGroup.leader || 'Chưa phân công'}
                  </div>

                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {selectedGroup.leaderEmail || 'Trưởng nhóm'}
                  </div>
                </div>
              </div>

              {isProjectOwner && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      color: '#94a3b8',
                      fontSize: 12,
                      marginBottom: 7,
                    }}
                  >
                    Chỉ định trưởng nhóm mới
                  </label>

                  <select
                    value={selectedGroup.leader_id || ''}
                    onChange={event =>
                      handleAssignLeader(
                        selectedGroup.id,
                        event.target.value,
                      )
                    }
                    disabled={saving}
                    style={fieldStyle}
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

              {!isProjectOwner && (
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                  }}
                >
                  <Lock
                    size={14}
                    style={{
                      verticalAlign: 'middle',
                      marginRight: 5,
                    }}
                  />
                  Chỉ Owner dự án được thay đổi trưởng nhóm.
                </div>
              )}
            </div>

            {/* MEMBER LIST */}
            <div
              style={{
                ...cardStyle,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <SectionTitle
                icon={Users}
                title={`Danh sách thành viên (${selectedGroupMembers.length})`}
                description="Thông tin tài khoản và Name Tag."
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 420,
                  overflowY: 'auto',
                }}
              >
                {selectedGroupMembers.length > 0 ? (
                  selectedGroupMembers.map(member => {
                    const isLeader =
                      String(member.id) ===
                      String(selectedGroup.leader_id);

                    const isMe =
                      String(member.id) ===
                      String(currentUserId);

                    return (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          background: '#0f172a',
                          padding: 11,
                          borderRadius: 9,
                          border: '1px solid #334155',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 35,
                              height: 35,
                              flexShrink: 0,
                              borderRadius: '50%',
                              background: isLeader
                                ? '#854d0e'
                                : '#334155',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                            }}
                          >
                            {getInitial(member.name)}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: '#f8fafc',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {member.name}
                              {isMe ? ' (Tôi)' : ''}
                            </div>

                            <div
                              style={{
                                color: '#94a3b8',
                                fontSize: 10,
                                marginTop: 4,
                              }}
                            >
                              {member.email || 'Không có email'}
                            </div>

                            <div
                              style={{
                                color: '#38bdf8',
                                fontSize: 10,
                                marginTop: 3,
                              }}
                            >
                              {member.name_tag || 'Chưa có Name Tag'}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                          }}
                        >
                          {isLeader && (
                            <span
                              style={{
                                color: '#fbbf24',
                                fontSize: 10,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Crown
                                size={13}
                                style={{
                                  verticalAlign: 'middle',
                                  marginRight: 3,
                                }}
                              />
                              Leader
                            </span>
                          )}

                          {isLeaderOfGroup(selectedGroup) &&
                            !isLeader && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(
                                    selectedGroup.id,
                                    member.id,
                                  )
                                }
                                disabled={saving}
                                title="Gỡ thành viên khỏi nhóm"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: 5,
                                }}
                              >
                                <Trash2 size={15} />
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
                      fontSize: 12,
                    }}
                  >
                    Nhóm chưa có thành viên.
                  </p>
                )}
              </div>

              {/* ADD EXISTING PROJECT MEMBER */}
              {canManageSelectedGroup && (
                <div
                  style={{
                    borderTop: '1px solid #334155',
                    paddingTop: 14,
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      color: '#94a3b8',
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    <UserPlus size={15} />
                    Thêm thành viên đã thuộc dự án
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <select
                      value={inviteMemberId}
                      onChange={event =>
                        setInviteMemberId(event.target.value)
                      }
                      style={{
                        ...fieldStyle,
                        flex: 1,
                        minWidth: 150,
                      }}
                    >
                      <option value="">
                        -- Chọn thành viên --
                      </option>

                      {availableMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={saving || !inviteMemberId}
                      style={{
                        ...buttonStyle,
                        background: '#0284c7',
                        color: '#fff',
                        borderColor: '#0284c7',
                        opacity:
                          saving || !inviteMemberId ? 0.5 : 1,
                      }}
                    >
                      <Plus size={15} />
                      Thêm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* INVITE BY NAME TAG */}
            {canManageSelectedGroup && (
              <div
                style={{
                  ...cardStyle,
                  gridColumn: '1 / -1',
                }}
              >
                <SectionTitle
                  icon={Mail}
                  title="Mời tài khoản DevTask bằng Name Tag"
                  description="Có thể mời tài khoản chưa tham gia dự án. Khi người nhận chấp nhận, hệ thống sẽ thêm họ vào cả dự án và nhóm."
                />

                <form
                  onSubmit={handleSearchNameTag}
                  style={{
                    display: 'flex',
                    gap: 9,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 220,
                      position: 'relative',
                    }}
                  >
                    <input
                      value={nameTagInput}
                      onChange={event => {
                        setNameTagInput(
                          event.target.value.toUpperCase(),
                        );
                        setFoundUser(null);
                      }}
                      placeholder="Nhập Name Tag, ví dụ #A1B2"
                      maxLength={5}
                      style={fieldStyle}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={searchingUser || !nameTagInput.trim()}
                    style={{
                      ...buttonStyle,
                      background: '#334155',
                      color: '#f8fafc',
                      opacity:
                        searchingUser || !nameTagInput.trim()
                          ? 0.5
                          : 1,
                    }}
                  >
                    {searchingUser ? (
                      <Loader2
                        size={15}
                        style={{
                          animation:
                            'group-spin 1s linear infinite',
                        }}
                      />
                    ) : (
                      <Search size={15} />
                    )}
                    Tìm tài khoản
                  </button>
                </form>

                {foundUser && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginTop: 14,
                      padding: 14,
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: '#334155',
                          color: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 17,
                        }}
                      >
                        {getInitial(foundUser.name)}
                      </div>

                      <div>
                        <div
                          style={{
                            color: '#f8fafc',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {foundUser.name}
                        </div>

                        <div
                          style={{
                            color: '#38bdf8',
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {foundUser.name_tag}
                        </div>

                        <div
                          style={{
                            color: '#94a3b8',
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          Tài khoản DevTask đã được tìm thấy
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendInvitation}
                      disabled={sendingInvitation}
                      style={{
                        ...buttonStyle,
                        background: '#059669',
                        borderColor: '#059669',
                        color: '#fff',
                        opacity: sendingInvitation ? 0.6 : 1,
                      }}
                    >
                      {sendingInvitation ? (
                        <Loader2
                          size={15}
                          style={{
                            animation:
                              'group-spin 1s linear infinite',
                          }}
                        />
                      ) : (
                        <Send size={15} />
                      )}
                      Gửi lời mời
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginTop: 13,
                    padding: 11,
                    background: 'rgba(56,189,248,0.07)',
                    border: '1px solid rgba(56,189,248,0.18)',
                    borderRadius: 8,
                    color: '#94a3b8',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  <AlertCircle
                    size={15}
                    color="#38bdf8"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />

                  Người được mời sẽ nhận thông báo trong DevTask.
                  Họ chỉ được thêm vào dự án và nhóm sau khi chấp nhận
                  lời mời. Việc từ chối không làm thay đổi thành viên
                  hiện tại.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* AI CHAT TAB */}
        {/* ================================================== */}

        {activeGroupTab === 'ai' && (
          <div style={cardStyle}>
            <SectionTitle
              icon={Bot}
              title="Trợ lý AI dự án"
              description="Trao đổi với AI về công việc, Task và kiến thức của dự án."
            />

            <AIChatPanel
              projectId={projectId}
              projectName={projectName}
              groups={groups}
              currentUserId={currentUserId}
              isProjectOwner={isProjectOwner}
            />
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // GROUP LIST SCREEN
  // ============================================================

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        paddingBottom: 30,
        color: '#f8fafc',
      }}
    >
      <style>
        {`
          @keyframes group-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* PAGE INTRO */}
      <div>
        <h2
          style={{
            color: '#f8fafc',
            fontSize: 22,
            margin: '0 0 7px',
          }}
        >
          Không gian làm việc nhóm
        </h2>

        <p
          style={{
            color: '#94a3b8',
            fontSize: 13,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Quản lý nhóm, theo dõi tiến độ và phối hợp công việc
          trong dự án.
        </p>
      </div>

      {/* CREATE GROUP */}
      <div style={cardStyle}>
        <SectionTitle
          icon={Users}
          title="Khởi tạo nhóm làm việc mới"
          description="Tạo nhóm để phân chia công việc theo từng bộ phận."
        />

        {isProjectOwner ? (
          <form
            onSubmit={handleCreateGroup}
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <input
              type="text"
              value={newGroupName}
              onChange={event =>
                setNewGroupName(event.target.value)
              }
              placeholder="Nhập tên nhóm..."
              maxLength={255}
              required
              style={{
                ...fieldStyle,
                flex: 1,
                minWidth: 220,
              }}
            />

            <button
              type="submit"
              disabled={saving || !newGroupName.trim()}
              style={{
                ...buttonStyle,
                background: '#4f46e5',
                color: '#fff',
                borderColor: '#4f46e5',
                opacity:
                  saving || !newGroupName.trim() ? 0.5 : 1,
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
              gap: 8,
              color: '#94a3b8',
              fontSize: 13,
            }}
          >
            <Lock size={16} color="#fbbf24" />
            Chỉ Owner dự án mới có quyền tạo nhóm.
          </div>
        )}
      </div>

      {/* GROUP LIST HEADER */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 15,
          }}
        >
          <h3
            style={{
              color: '#f8fafc',
              fontSize: 17,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
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
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 10px',
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
                  width: 140,
                  background: 'transparent',
                  color: '#fff',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={event =>
                setRoleFilter(event.target.value)
              }
              style={{
                ...fieldStyle,
                width: 'auto',
                padding: '9px',
                fontSize: 12,
              }}
            >
              <option value="all">Tất cả nhóm</option>
              <option value="leader">Nhóm tôi phụ trách</option>
              <option value="unassigned">Chưa có trưởng nhóm</option>
            </select>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Dạng lưới"
              style={{
                ...buttonStyle,
                padding: 8,
                background:
                  viewMode === 'grid' ? '#334155' : '#1e293b',
                color: '#fff',
              }}
            >
              <LayoutGrid size={16} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Dạng danh sách"
              style={{
                ...buttonStyle,
                padding: 8,
                background:
                  viewMode === 'list' ? '#334155' : '#1e293b',
                color: '#fff',
              }}
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
              color: '#94a3b8',
              padding: 35,
            }}
          >
            <Loader2
              size={25}
              style={{
                animation: 'group-spin 1s linear infinite',
              }}
            />
            <p>Đang tải danh sách nhóm...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              color: '#94a3b8',
              padding: 40,
            }}
          >
            <Users size={35} />
            <p>
              {groups.length === 0
                ? 'Dự án chưa có nhóm nào.'
                : 'Không tìm thấy nhóm phù hợp.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(270px, 1fr))'
                  : '1fr',
              gap: 14,
            }}
          >
            {filteredGroups.map(group => (
              <div
                key={group.id}
                role="button"
                tabIndex={0}
                onClick={() => selectGroup(group)}
                onKeyDown={event => {
                  if (
                    event.key === 'Enter' ||
                    event.key === ' '
                  ) {
                    event.preventDefault();
                    selectGroup(group);
                  }
                }}
                style={{
                  ...cardStyle,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      background: 'rgba(56,189,248,0.15)',
                      color: '#38bdf8',
                      borderRadius: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 19,
                      fontWeight: 800,
                    }}
                  >
                    {getInitial(group.name)}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <h4
                      style={{
                        color: '#f8fafc',
                        fontSize: 14,
                        margin: '0 0 6px',
                      }}
                    >
                      {group.name}
                    </h4>

                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: 11,
                      }}
                    >
                      Trưởng nhóm: {group.leader || 'Chưa phân công'}
                    </div>

                    <div
                      style={{
                        color: '#64748b',
                        fontSize: 11,
                        marginTop: 5,
                      }}
                    >
                      <Users
                        size={12}
                        style={{
                          verticalAlign: 'middle',
                          marginRight: 4,
                        }}
                      />
                      {group.members?.length || 0} thành viên
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      color: '#38bdf8',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Xem nhóm
                  </span>

                  {isProjectOwner && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();

                        handleDeleteGroup(
                          group.id,
                          group.name,
                        );
                      }}
                      disabled={saving}
                      title="Xóa nhóm"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        padding: 8,
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Alias để dùng biểu tượng Layers mà không phụ thuộc import khác.
function LayersIcon(props) {
  return <ClipboardList {...props} />;
}

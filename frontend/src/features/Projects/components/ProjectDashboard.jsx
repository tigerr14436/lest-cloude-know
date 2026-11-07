import React, { useState } from 'react';
import { 
  FolderKanban, CheckCircle2, Clock, 
  Users, DollarSign, Calendar, ArrowUpRight, 
  CheckSquare, Layers, ShieldAlert, TrendingUp, Mail, UserPlus 
} from 'lucide-react';
import './ProjectDashboard.css';

export default function ProjectDashboard({ projectList = [], projectTasks = [], groups = [], showNotification }) {
  // Thống kê công việc
  const totalTasks = projectTasks.length || 12;
  const completedTasks = projectTasks.filter(t => t.status === 'done').length || 5;
  const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length || 4;
  const pendingTasks = projectTasks.filter(t => t.status === 'todo').length || 3;

  // Tính tỷ lệ hoàn thành
  const completionRate = Math.round((completedTasks / totalTasks) * 100);

  // Tính toán ngân sách
  const totalBudget = 50000000;
  const spentBudget = 32500000;
  const remainingBudget = totalBudget - spentBudget;
  const budgetSpentPercentage = Math.round((spentBudget / totalBudget) * 100);

  // Trạng thái mời thành viên
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedMembers, setInvitedMembers] = useState([
    { id: 1, email: 'shutheast@devtask.vn', status: 'Đã tham gia' },
    { id: 2, email: 'vana@gmail.com', status: 'Chờ phản hồi' }
  ]);

  const handleSendInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.trim()) {
      showNotification?.("loi", "Lỗi", "Vui lòng nhập email trước khi mời.");
      return;
    }

    const trimmedEmail = inviteEmail.trim().toLowerCase();
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    
    if (!gmailRegex.test(trimmedEmail)) {
      showNotification?.("loi", "Sai định dạng", "Email mời phải có đúng định dạng Gmail (vd: tentaikhoan@gmail.com)!");
      return;
    }

    const isExisting = invitedMembers.some(m => m.email.toLowerCase() === trimmedEmail);
    if (isExisting) {
      showNotification?.("can-bao", "Thông báo", "Email này đã nằm trong danh sách mời.");
      return;
    }

    const newMember = {
      id: Date.now(),
      email: trimmedEmail,
      status: 'Chờ phản hồi'
    };

    setInvitedMembers(prev => [...prev, newMember]);
    setInviteEmail('');
    showNotification?.("thanh-cong", "Gửi lời mời thành công", `Đã gửi thiệp mời đến ${trimmedEmail}`);
  };

  const formatVND = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">📊 Dashboard Tổng Quan Dự Án</h2>
          <p className="dashboard-subtitle">Theo dõi các chỉ số hiệu suất (KPI), tiến độ công việc, phân bổ nhóm và ngân sách dự án.</p>
        </div>
        <div className="dashboard-timestamp">
          <Calendar size={16} />
          <span>Cập nhật: {new Date().toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      {/* METRIC CARDS GRID */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Tổng Công Việc</span>
            <div className="metric-icon indigo"><FolderKanban size={20} /></div>
          </div>
          <div className="metric-value">{totalTasks}</div>
          <div className="metric-subtext green">
            <ArrowUpRight size={14} /> <span>+12% so với tuần trước</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Tỷ Lệ Hoàn Thành</span>
            <div className="metric-icon emerald"><CheckCircle2 size={20} /></div>
          </div>
          <div className="metric-value">{completionRate}%</div>
          <div className="progress-bar-mini">
            <div className="progress-fill-mini" style={{ width: `${completionRate}%` }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Đang Thực Hiện</span>
            <div className="metric-icon amber"><Clock size={20} /></div>
          </div>
          <div className="metric-value">{inProgressTasks}</div>
          <div className="metric-subtext text-amber">
            <span>Cần tập trung giải quyết</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Chi Phí Đã Dùng</span>
            <div className="metric-icon sky"><DollarSign size={20} /></div>
          </div>
          <div className="metric-value">{budgetSpentPercentage}%</div>
          <div className="metric-subtext text-sky">
            <span>{formatVND(spentBudget)} / {formatVND(totalBudget)}</span>
          </div>
        </div>
      </div>

      {/* DETAILED PROGRESS & BUDGET GRID */}
      <div className="dashboard-two-column-grid">
        {/* Phân bổ trạng thái Task */}
        <div className="dashboard-content-box">
          <h4 className="content-box-title">
            <Layers size={18} className="icon-emerald" /> Phân Bổ Trạng Thái Công Việc
          </h4>
          
          <div className="status-list">
            <div className="status-item">
              <div className="status-label">
                <span className="dot-indicator emerald"></span>
                <span>Đã hoàn thành (Done)</span>
              </div>
              <span className="status-badge emerald">{completedTasks} tasks</span>
            </div>

            <div className="status-item">
              <div className="status-label">
                <span className="dot-indicator amber"></span>
                <span>Đang thực hiện (In Progress)</span>
              </div>
              <span className="status-badge amber">{inProgressTasks} tasks</span>
            </div>

            <div className="status-item">
              <div className="status-label">
                <span className="dot-indicator slate"></span>
                <span>Chờ xử lý (To Do)</span>
              </div>
              <span className="status-badge slate">{pendingTasks} tasks</span>
            </div>
          </div>

          <div className="overall-progress-box">
            <div className="progress-info">
              <span>Tỷ lệ hoàn thành tổng thể</span>
              <strong>{completionRate}%</strong>
            </div>
            <div className="progress-bar-large">
              <div className="progress-fill-large" style={{ width: `${completionRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Tổng quan ngân sách */}
        <div className="dashboard-content-box">
          <h4 className="content-box-title">
            <TrendingUp size={18} className="icon-sky" /> Tổng Quan Ngân Sách
          </h4>

          <div className="budget-details-grid">
            <div className="budget-card">
              <span className="budget-label">Ngân sách còn lại</span>
              <span className="budget-value green">{formatVND(remainingBudget)}</span>
            </div>
            <div className="budget-card">
              <span className="budget-label">Tổng ngân sách dự kiến</span>
              <span className="budget-value text-white">{formatVND(totalBudget)}</span>
            </div>
          </div>

          <div className="risk-warning-box">
            <ShieldAlert size={20} className="warning-icon" />
            <div>
              <h5 className="warning-title">Cảnh Báo Lịch Trình & Ngân Sách</h5>
              <p className="warning-description">
                Dự án đã sử dụng {budgetSpentPercentage}% ngân sách. Hãy tập trung hoàn thành các task đang thực hiện để đảm bảo deadline!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MEMBER INVITATION & HIGH PRIORITY TASKS GRID */}
      <div className="dashboard-two-column-grid">
        
        {/* Mời thành viên */}
        <div className="dashboard-content-box">
          <h4 className="content-box-title">
            <UserPlus size={18} className="icon-indigo" /> Mời Thành Viên (@gmail.com)
          </h4>

          <form onSubmit={handleSendInvite} className="invite-form">
            <div className="invite-input-group">
              <Mail size={16} className="invite-input-icon" />
              <input
                type="email"
                placeholder="Nhập gmail (vd: user@gmail.com)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="invite-text-input"
              />
            </div>
            <button type="submit" className="invite-submit-button">
              Gửi Lời Mời
            </button>
          </form>

          <div className="invited-members-list">
            <span className="invited-list-title">Danh Sách Đã Mời ({invitedMembers.length})</span>
            <div className="invited-items-container">
              {invitedMembers.map((member) => (
                <div key={member.id} className="invited-member-row">
                  <span className="member-email">{member.email}</span>
                  <span className={`member-status-badge ${member.status === 'Đã tham gia' ? 'accepted' : 'pending'}`}>
                    {member.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task ưu tiên cao */}
        <div className="dashboard-content-box">
          <h4 className="content-box-title">
            <CheckSquare size={18} className="icon-amber" /> Công Việc Ưu Tiên Cao (High Priority)
          </h4>
          <div className="priority-task-list">
            {projectTasks.filter(t => t.priority === 'high').length > 0 ? (
              projectTasks.filter(t => t.priority === 'high').map(task => (
                <div key={task.id} className="priority-task-item">
                  <span className="task-title">{task.title}</span>
                  <span className="high-priority-tag">Cao</span>
                </div>
              ))
            ) : (
              <p className="empty-text">Không có công việc ưu tiên cao nào cần xử lý.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
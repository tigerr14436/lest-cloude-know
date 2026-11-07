
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Send,
  Users,
  ClipboardList,
  Loader2,
  AlertCircle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';

function displayDate(value) {
  if (!value) return 'Chưa đặt hạn';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : date.toLocaleDateString('vi-VN');
}

// Định dạng thời gian dự kiến theo ngày
function displayEstimatedDays(value) {
  if (value === null || value === undefined || value === '') {
    return 'Chưa ước lượng';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'Không xác định';
  }

  return `${number.toLocaleString('vi-VN')} ngày`;
}

const priorities = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
};

const statuses = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  review: 'Kiểm thử / Review',
  done: 'Hoàn thành'
};

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [taskComments, setTaskComments] = useState([]);
  const [newTaskComment, setNewTaskComment] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadTask() {
      setLoading(true);
      setError('');
      setTask(null);
      setTaskComments([]);

      try {
        const token = localStorage.getItem('access_token');

        if (!token) {
          throw new Error('Bạn chưa đăng nhập.');
        }

        const response = await fetch(
          `${API_BASE}/tasks/${encodeURIComponent(taskId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const detail = data?.detail;

          throw new Error(
            typeof detail === 'string'
              ? detail
              : `Không tải được công việc (HTTP ${response.status}).`
          );
        }

        setTask(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(
            err.message || 'Không thể kết nối Backend.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTask();

    return () => controller.abort();
  }, [taskId]);

  function handleSendComment(event) {
    event.preventDefault();

    if (!newTaskComment.trim()) return;

    setTaskComments((previous) => [
      ...previous,
      {
        id: Date.now(),
        author: localStorage.getItem('user_email') || 'Bạn',
        content: newTaskComment.trim(),
        time: 'Vừa xong'
      }
    ]);

    setNewTaskComment('');
  }

  return (
    <div
      className="khung-quan-ly-du-an"
      style={{
        padding: '24px',
        maxWidth: '900px',
        margin: '0 auto'
      }}
    >
      <button
        onClick={() =>
          navigate('/project', {
            state: {
              returnProjectId: task?.project_id,
              returnTab: 'kanban'
            }
          })
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#1e293b',
          color: '#94a3b8',
          border: '1px solid #334155',
          padding: '8px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 20
        }}
      >
        <ArrowLeft size={16} />
        Quay lại nhóm / Kanban
      </button>

      <style>
        {`
          @media (max-width: 720px) {
            .task-detail-layout {
              grid-template-columns: minmax(0, 1fr) !important;
            }
          }
        `}
      </style>

      {loading && (
        <div className="trang-thai-trong">
          <Loader2 size={24} className="icon-quay" />
          Đang tải nội dung Task...
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: 18,
            color: '#fca5a5',
            background: '#1e293b',
            borderRadius: 10
          }}
        >
          <AlertCircle
            size={18}
            style={{
              verticalAlign: 'middle',
              marginRight: 8
            }}
          />
          {error}
        </div>
      )}

      {!loading && !error && task && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: 24
          }}
        >
          {/* Tiêu đề Task */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              borderBottom: '1px solid #334155',
              paddingBottom: 16,
              flexWrap: 'wrap'
            }}
          >
            <span
              className={`nhan-muc-do ${
                task.priority === 'high'
                  ? 'cao'
                  : task.priority === 'medium'
                    ? 'trung-binh'
                    : 'thap'
              }`}
            >
              {priorities[task.priority] || 'Chưa xác định'}
            </span>

            <h2
              style={{
                color: '#f8fafc',
                fontSize: 20,
                margin: 0
              }}
            >
              {task.title}
            </h2>

            <span
              style={{
                fontSize: 12,
                color: '#94a3b8'
              }}
            >
              {statuses[task.status] || task.status}
            </span>
          </div>

          <div
            className="task-detail-layout"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 300px',
              gap: 20
            }}
          >
            {/* Cột thông tin chính */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {/* Mô tả */}
              <div>
                <label
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                    display: 'block',
                    marginBottom: 6
                  }}
                >
                  Mô tả chi tiết
                </label>

                <p
                  style={{
                    background: '#0f172a',
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 14,
                    margin: 0,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {task.description || 'Chưa có mô tả chi tiết'}
                </p>
              </div>

              {/* Người thực hiện và hạn hoàn thành */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  background: '#0f172a',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #334155'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      display: 'block',
                      marginBottom: 2
                    }}
                  >
                    Người thực hiện
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      color: '#cbd5e1',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <User
                      size={14}
                      style={{ color: '#38bdf8' }}
                    />
                    {task.assignee || 'Chưa phân công'}
                  </span>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      display: 'block',
                      marginBottom: 2
                    }}
                  >
                    Hạn hoàn thành
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      color: '#cbd5e1',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Clock
                      size={14}
                      style={{ color: '#fbbf24' }}
                    />
                    {displayDate(task.deadline)}
                  </span>
                </div>
              </div>

              {/* Thời gian dự kiến của Task */}
              <div
                style={{
                  background: '#0f172a',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #334155'
                }}
              >
                <h4
                  style={{
                    color: '#38bdf8',
                    fontSize: 13,
                    margin: '0 0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7
                  }}
                >
                  <Clock size={15} />
                  Thời gian thực hiện dự kiến
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      padding: 12,
                      background: '#1e293b',
                      borderRadius: 8,
                      border: '1px solid #334155'
                    }}
                  >
                    <span
                      style={{
                        color: '#34d399',
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 8
                      }}
                    >
                      Tốt nhất
                    </span>

                    <strong
                      style={{
                        color: '#f8fafc',
                        fontSize: 14
                      }}
                    >
                      {displayEstimatedDays(
                        task.estimated_best_days
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      background: '#1e293b',
                      borderRadius: 8,
                      border: '1px solid #334155'
                    }}
                  >
                    <span
                      style={{
                        color: '#38bdf8',
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 8
                      }}
                    >
                      Trung bình
                    </span>

                    <strong
                      style={{
                        color: '#f8fafc',
                        fontSize: 14
                      }}
                    >
                      {displayEstimatedDays(
                        task.estimated_average_days
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      background: '#1e293b',
                      borderRadius: 8,
                      border: '1px solid #334155'
                    }}
                  >
                    <span
                      style={{
                        color: '#fbbf24',
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 8
                      }}
                    >
                      Tệ nhất
                    </span>

                    <strong
                      style={{
                        color: '#f8fafc',
                        fontSize: 14
                      }}
                    >
                      {displayEstimatedDays(
                        task.estimated_worst_days
                      )}
                    </strong>
                  </div>
                </div>

                <p
                  style={{
                    color: '#64748b',
                    fontSize: 11,
                    margin: '12px 0 0',
                    lineHeight: 1.5
                  }}
                >
                  Đây là thời gian ước lượng, không phải thời
                  gian thực tế đã sử dụng. Thời gian dự kiến
                  tối đa là 7 ngày.
                </p>
              </div>

              {/* Thảo luận */}
              <div
                style={{
                  background: '#0f172a',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #334155'
                }}
              >
                <h5
                  style={{
                    fontSize: 13,
                    color: '#34d399',
                    margin: '0 0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <MessageSquare size={14} />
                  Thảo luận về Task ({taskComments.length})
                </h5>

                {taskComments.length === 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: '#94a3b8'
                    }}
                  >
                    Chưa có bình luận trong phiên này.
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 12
                  }}
                >
                  {taskComments.map((comment) => (
                    <div
                      key={comment.id}
                      style={{
                        background: '#1e293b',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #334155'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          marginBottom: 4
                        }}
                      >
                        <strong style={{ color: '#818cf8' }}>
                          {comment.author}
                        </strong>

                        <span style={{ color: '#64748b' }}>
                          {comment.time}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: '#f8fafc'
                        }}
                      >
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSendComment}
                  style={{
                    display: 'flex',
                    gap: 8
                  }}
                >
                  <input
                    type="text"
                    placeholder="Viết bình luận..."
                    value={newTaskComment}
                    onChange={(event) =>
                      setNewTaskComment(event.target.value)
                    }
                    className="o-nhap-lieu"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      padding: '8px 12px'
                    }}
                    required
                  />

                  <button
                    type="submit"
                    className="nut-chinh"
                    style={{
                      padding: '8px 14px',
                      fontSize: 13
                    }}
                  >
                    <Send size={12} />
                    Gửi
                  </button>
                </form>

                <p
                  style={{
                    color: '#64748b',
                    fontSize: 11,
                    marginBottom: 0
                  }}
                >
                  Bình luận hiện chỉ lưu tạm trên trang; Backend
                  chưa được kết nối API bình luận.
                </p>
              </div>
            </div>

            {/* Cột thông tin nhóm */}
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 16,
                height: 'fit-content'
              }}
            >
              <h3
                style={{
                  color: '#38bdf8',
                  fontSize: 14,
                  margin: '0 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Users size={17} />
                Nhóm chịu trách nhiệm
              </h3>

              <p
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: '0 0 16px'
                }}
              >
                Chưa phân công nhóm. Thông tin nhóm và trưởng
                nhóm sẽ hiển thị tại đây sau khi hoàn thiện chức
                năng Nhóm &amp; Phân quyền.
              </p>

              <div
                style={{
                  borderTop: '1px solid #334155',
                  paddingTop: 14
                }}
              >
                <h4
                  style={{
                    color: '#cbd5e1',
                    fontSize: 13,
                    margin: '0 0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7
                  }}
                >
                  <ClipboardList size={15} />
                  Phân chia công việc
                </h4>

                <p
                  style={{
                    color: '#64748b',
                    fontSize: 12,
                    lineHeight: 1.6,
                    margin: 0
                  }}
                >
                  Trưởng nhóm sẽ phân chia Task này thành các
                  công việc nhỏ và giao cho thành viên trên
                  Kanban nhóm.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

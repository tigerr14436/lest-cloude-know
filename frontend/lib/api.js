/**
 * Tiện ích gọi API dùng chung cho toàn bộ app.
 * Đặt file này tại: frontend/src/lib/api.js
 *
 * Tự động:
 * - Gắn Authorization: Bearer <token> vào mọi request (nếu đã đăng nhập)
 * - Nếu server trả về 401 (hết hạn/ chưa đăng nhập) → tự xóa token và
 *   chuyển về trang /login
 */

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '') + '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Token hết hạn hoặc không hợp lệ → đưa về trang đăng nhập
  if (res.status === 401) {
    localStorage.removeItem('access_token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail || `Có lỗi xảy ra (mã lỗi ${res.status})`);
  }

  // DELETE thường trả về 204 No Content, không có JSON để đọc
  if (res.status === 204) {
    return null;
  }

  return res.json();
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),

  post: (path, body) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),

  put: (path, body) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),

  del: (path) => request(path, { method: 'DELETE' }),
};
// Gọi API Backend có kèm token đăng nhập
export async function sendAuthenticatedRequest(apiPath, options = {}) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Người dùng chưa đăng nhập");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`http://127.0.0.1:8000/api${apiPath}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string" ? data.detail : "Đã có lỗi xảy ra",
    );
  }

  return data;
}

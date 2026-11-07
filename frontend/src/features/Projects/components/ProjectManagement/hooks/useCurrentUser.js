import { useState, useEffect } from "react";
import { sendAuthenticatedRequest } from "../api";

// Lấy thông tin người dùng đang đăng nhập
export default function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    sendAuthenticatedRequest("/users/me")
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  return currentUser;
}

import { useState, useCallback } from "react";

// Quản lý danh sách thông báo (toast)
export default function useToast() {
  const [toastList, setToastList] = useState([]);

  const removeToast = useCallback((id) => {
    setToastList((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showNotification = useCallback(
    (type, title, message) => {
      const id = `${Date.now()}-${Math.random()}`;

      setToastList((prev) => [...prev, { id, type, title, message }]);

      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast],
  );

  return { toastList, showNotification, removeToast };
}

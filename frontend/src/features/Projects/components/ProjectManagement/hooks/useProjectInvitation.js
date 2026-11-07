import { useState } from "react";
import { sendAuthenticatedRequest } from "../api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_TAG_PATTERN = /^#?[A-Za-z0-9]{4}$/;

// Gửi lời mời tham gia dự án bằng Name Tag hoặc email
export default function useProjectInvitation(projectId, showNotification) {
  const [isSending, setIsSending] = useState(false);

  // method: "name_tag" | "email"  → trả về true nếu gửi thành công
  const sendInvitation = async ({ method, value }) => {
    const text = (value || "").trim();

    if (!projectId || isSending) return false;

    if (method === "name_tag" && !NAME_TAG_PATTERN.test(text)) {
      showNotification(
        "loi",
        "Name Tag không hợp lệ",
        "Name Tag gồm 4 ký tự chữ hoặc số, ví dụ #A1B2.",
      );
      return false;
    }

    if (method === "email" && !EMAIL_PATTERN.test(text)) {
      showNotification(
        "loi",
        "Email không hợp lệ",
        "Vui lòng nhập đúng định dạng email.",
      );
      return false;
    }

    const body =
      method === "name_tag"
        ? {
            project_id: projectId,
            name_tag: `#${text.replace(/^#/, "").toUpperCase()}`,
          }
        : { project_id: projectId, email: text.toLowerCase() };

    setIsSending(true);

    try {
      const data = await sendAuthenticatedRequest(
        "/notifications/project-invitations",
        { method: "POST", body: JSON.stringify(body) },
      );

      const invitee = data?.invitee;

      showNotification(
        "thanh-cong",
        "Đã gửi lời mời",
        invitee
          ? `Đã gửi đến ${invitee.name} (${invitee.name_tag}). Người này cần chấp nhận trong mục thông báo.`
          : "Lời mời đã được gửi.",
      );

      return true;
    } catch (error) {
      showNotification("loi", "Không gửi được lời mời", error.message);
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { sendInvitation, isSending };
}

import React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

const TOAST_ICONS = {
  "thanh-cong": CheckCircle2,
  loi: AlertCircle,
  "thong-tin": Info,
  "can-bao": AlertTriangle,
};

export default function ToastContainer({ toastList, removeToast }) {
  return (
    <div className="khung-chua-toast">
      {toastList.map((toast) => {
        const Icon = TOAST_ICONS[toast.type];

        return (
          <div key={toast.id} className={`thong-bao-item ${toast.type}`}>
            <div className="bieu-tuong-toast">
              {Icon && <Icon size={20} />}
            </div>

            <div className="noi-dung-toast">
              <div className="tieu-de-thong-bao">{toast.title}</div>
              <div className="chi-tiet-thong-bao">{toast.message}</div>
            </div>

            <button
              className="nut-dong-toast"
              onClick={() => removeToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

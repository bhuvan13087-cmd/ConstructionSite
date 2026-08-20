import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";

/**
 * Dedicated Logout Confirmation Modal for Admin Portal.
 * Renders via createPortal to document.body to ensure a clean, centered
 * production-level modal overlay above all dashboard layers with scroll locking.
 */
export default function AdminLogoutModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Sign Out of Workspace?",
  message = "Are you sure you want to sign out of your account?",
  confirmText = "Sign Out",
  cancelText = "Stay Signed In",
  isLoading = false
}) {
  const [loading, setLoading] = useState(false);

  // Lock body scrolling and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setLoading(false);

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, isLoading, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const isBusy = loading || isLoading;

  const handleConfirmClick = async (e) => {
    if (e) e.preventDefault();
    if (isBusy) return;
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      console.error("Logout confirmation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isBusy) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="admin-logout-overlay"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box"
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-logout-modal-title"
    >
      <style>{`
        @keyframes adminLogoutModalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .admin-logout-card {
          animation: adminLogoutModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .admin-logout-cancel-btn:hover {
          background-color: #f8fafc !important;
          border-color: #94a3b8 !important;
        }
        .admin-logout-confirm-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(234, 88, 12, 0.4) !important;
        }
        .admin-logout-close-btn:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
      `}</style>

      <div
        className="admin-logout-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          width: "100%",
          maxWidth: "430px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 22px 16px 22px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            position: "relative",
            borderBottom: "1px solid #f1f5f9"
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "#fff7ed",
              color: "#ea580c",
              border: "1.5px solid #ffedd5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <LogOut size={22} style={{ transform: "translateX(1px)" }} />
          </div>

          <div style={{ flex: 1, paddingRight: "28px" }}>
            <h3
              id="admin-logout-modal-title"
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: "800",
                color: "#0f172a",
                lineHeight: "1.3",
                letterSpacing: "-0.01em"
              }}
            >
              {title}
            </h3>
          </div>

          <button
            type="button"
            className="admin-logout-close-btn"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: isBusy ? "not-allowed" : "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              outline: "none",
              transition: "all 0.15s ease"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#475569",
              lineHeight: "1.55",
              fontWeight: "500"
            }}
          >
            {message}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 22px 18px 22px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <button
            type="button"
            className="admin-logout-cancel-btn"
            onClick={onClose}
            disabled={isBusy}
            style={{
              padding: "9px 18px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "13.5px",
              fontWeight: "700",
              cursor: isBusy ? "not-allowed" : "pointer",
              outline: "none",
              transition: "all 0.15s ease"
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="admin-logout-confirm-btn"
            onClick={handleConfirmClick}
            disabled={isBusy}
            style={{
              padding: "9px 22px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              color: "#ffffff",
              fontSize: "13.5px",
              fontWeight: "700",
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.75 : 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              outline: "none",
              boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)",
              transition: "all 0.15s ease"
            }}
          >
            {isBusy && (
              <span
                style={{
                  width: "13px",
                  height: "13px",
                  border: "2px solid #ffffff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block"
                }}
              />
            )}
            {isBusy ? "Signing Out..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

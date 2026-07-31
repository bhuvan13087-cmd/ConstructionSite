import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, Lock, X, HelpCircle, ShieldAlert, FileText, UserX, LogOut } from 'lucide-react';

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  details = null,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // "danger", "warning", "lock", "success", "primary"
  icon = null,
  isLoading = false,
  ...props
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setLoading(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();
    if (loading || isLoading) return;
    setLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      console.error("Confirmation action error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Determine Icon and styles based on variant
  let IconComponent = icon;
  let iconBg = "#fef2f2";
  let iconColor = "#dc2626";
  let confirmBg = "#dc2626";

  if (variant === "danger") {
    IconComponent = IconComponent || Trash2;
    iconBg = "#fef2f2";
    iconColor = "#dc2626";
    confirmBg = "#dc2626";
  } else if (variant === "warning") {
    IconComponent = IconComponent || ShieldAlert;
    iconBg = "#fff7ed";
    iconColor = "#d97706";
    confirmBg = "#d97706";
  } else if (variant === "lock") {
    IconComponent = IconComponent || Lock;
    iconBg = "#fff7ed";
    iconColor = "#ea580c";
    confirmBg = "#ea580c";
  } else if (variant === "success") {
    IconComponent = IconComponent || CheckCircle2;
    iconBg = "#f0fdf4";
    iconColor = "#16a34a";
    confirmBg = "#16a34a";
  } else if (variant === "primary") {
    IconComponent = IconComponent || HelpCircle;
    iconBg = "#eff6ff";
    iconColor = "#2563eb";
    confirmBg = "#2563eb";
  }

  const isBusy = loading || isLoading;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
      {...props}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: '460px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '22px 24px 16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            backgroundColor: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {IconComponent && <IconComponent size={24} />}
          </div>

          <div style={{ flex: 1, paddingRight: '24px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a',
              lineHeight: '1.3'
            }}>
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{
            margin: 0,
            fontSize: '14.5px',
            color: '#334155',
            lineHeight: '1.5',
            fontWeight: '600'
          }}>
            {message}
          </p>

          {details && (
            <div style={{
              marginTop: '12px',
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#475569',
              fontWeight: '500',
              lineHeight: '1.4'
            }}>
              {details}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px 20px 24px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              outline: 'none'
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: confirmBg,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '750',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {isBusy && (
              <span style={{
                width: '14px',
                height: '14px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block'
              }} />
            )}
            {isBusy ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

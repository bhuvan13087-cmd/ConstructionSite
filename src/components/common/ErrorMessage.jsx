import React from "react";

export default function ErrorMessage({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="info-alert" style={{ borderColor: "var(--accent-danger)", backgroundColor: "rgba(239, 68, 68, 0.1)" }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-danger)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginRight: "12px", flexShrink: 0 }}
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="info-text" style={{ color: "var(--text-primary)" }}>
        <strong>Error:</strong> {message}
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

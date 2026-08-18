import React from "react";
import { LayoutGrid, List } from "lucide-react";

export default function ViewToggle({ viewMode, onChange, style }) {
  return (
    <div 
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "#f1f5f9",
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        padding: "2px",
        gap: "2px",
        flexShrink: 0,
        ...style
      }}
      role="group"
      aria-label="View mode toggle"
    >
      <button
        type="button"
        onClick={() => onChange("normal")}
        title="Normal / List View"
        aria-label="Normal / List View"
        aria-pressed={viewMode === "normal"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "30px",
          borderRadius: "6px",
          border: "none",
          backgroundColor: viewMode === "normal" ? "#ffffff" : "transparent",
          color: viewMode === "normal" ? "#0f172a" : "#64748b",
          boxShadow: viewMode === "normal" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        <List size={16} />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Grid View"
        aria-label="Grid View"
        aria-pressed={viewMode === "grid"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "30px",
          borderRadius: "6px",
          border: "none",
          backgroundColor: viewMode === "grid" ? "#ffffff" : "transparent",
          color: viewMode === "grid" ? "#0f172a" : "#64748b",
          boxShadow: viewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        <LayoutGrid size={16} />
      </button>
    </div>
  );
}

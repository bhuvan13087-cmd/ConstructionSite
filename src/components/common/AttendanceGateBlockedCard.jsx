import React from "react";
import { 
  ShieldAlert, 
  ClipboardCheck, 
  MapPin, 
  Calendar, 
  Lock, 
  ArrowRight,
  AlertTriangle
} from "lucide-react";

/**
 * Production Attendance Verification Gate Blocked Card
 * Displayed when an engineer has not marked verified attendance for the active Site + Date.
 */
export default function AttendanceGateBlockedCard({
  siteName = "Selected Worksite",
  dateStr = new Date().toISOString().split("T")[0],
  sectionTitle = "Labour & Material Logs",
  onMarkAttendance,
  isToday = true
}) {
  // Format date for display
  const formatDateDisplay = (dStr) => {
    if (!dStr) return "Today";
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  const displayDate = formatDateDisplay(dateStr);

  return (
    <div 
      className="attendance-gate-container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px 40px 16px",
        maxWidth: "520px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <div 
        className="attendance-gate-card"
        style={{
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          border: "1.5px solid #fed7aa",
          boxShadow: "0 10px 25px -5px rgba(234, 88, 12, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          padding: "28px 20px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box"
        }}
      >
        {/* Top Accent Stripe */}
        <div 
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #ea580c 0%, #f97316 50%, #fb923c 100%)"
          }}
        />

        {/* Security Shield Icon Badge */}
        <div 
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            backgroundColor: "#fff7ed",
            border: "2px solid #ffedd5",
            color: "#ea580c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(234, 88, 12, 0.15)",
            marginTop: "4px"
          }}
        >
          <ShieldAlert size={34} strokeWidth={2.2} />
        </div>

        {/* Header & Subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <Lock size={15} style={{ color: "#ea580c" }} />
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Prerequisite Verification
            </span>
          </div>

          <h3 
            id="attendance-gate-title"
            style={{ 
              margin: 0, 
              fontSize: "21px", 
              fontWeight: "800", 
              color: "#0f172a",
              letterSpacing: "-0.3px"
            }}
          >
            Attendance Required
          </h3>

          <p 
            id="attendance-gate-prompt"
            style={{ 
              margin: "4px 0 0 0", 
              fontSize: "14px", 
              fontWeight: "600",
              color: "#475569", 
              lineHeight: "1.45"
            }}
          >
            Please mark your attendance before accessing this section.
          </p>
        </div>

        {/* Context Information Box */}
        <div 
          style={{
            width: "100%",
            backgroundColor: "#f8fafc",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            textAlign: "left",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}>
            <span style={{ color: "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px" }}>
              <MapPin size={14} style={{ color: "#ea580c" }} /> Worksite:
            </span>
            <strong style={{ color: "#0f172a", fontWeight: "750", textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {siteName}
            </strong>
          </div>

          <div style={{ height: "1px", backgroundColor: "#e2e8f0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}>
            <span style={{ color: "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px" }}>
              <Calendar size={14} style={{ color: "#ea580c" }} /> Date:
            </span>
            <strong style={{ color: "#0f172a", fontWeight: "750" }}>
              {displayDate}
            </strong>
          </div>

          <div style={{ height: "1px", backgroundColor: "#e2e8f0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>
              Section:
            </span>
            <span style={{ 
              fontSize: "11px", 
              fontWeight: "750", 
              color: "#ea580c", 
              backgroundColor: "#fff7ed", 
              padding: "2px 8px", 
              borderRadius: "6px",
              border: "1px solid #ffedd5"
            }}>
              {sectionTitle}
            </span>
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div 
          style={{
            width: "100%",
            backgroundColor: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "12px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "9px",
            textAlign: "left",
            fontSize: "12px",
            color: "#9a3412",
            lineHeight: "1.4",
            boxSizing: "border-box"
          }}
        >
          <AlertTriangle size={16} style={{ color: "#ea580c", flexShrink: 0, marginTop: "2px" }} />
          <span>
            To ensure data integrity, site activity and material records can only be accessed after completing GPS-verified attendance on-site.
          </span>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          id="btn-mark-attendance-gate"
          onClick={onMarkAttendance}
          style={{
            width: "100%",
            height: "48px",
            padding: "0 20px",
            borderRadius: "14px",
            backgroundColor: "#ea580c",
            color: "#ffffff",
            border: "none",
            fontSize: "15px",
            fontWeight: "750",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            boxShadow: "0 4px 14px rgba(234, 88, 12, 0.35)",
            transition: "all 0.2s ease",
            outline: "none",
            marginTop: "4px",
            fontFamily: "inherit"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#c2410c";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ea580c";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <ClipboardCheck size={20} />
          <span>Mark Attendance</span>
          <ArrowRight size={17} style={{ opacity: 0.85 }} />
        </button>
      </div>
    </div>
  );
}

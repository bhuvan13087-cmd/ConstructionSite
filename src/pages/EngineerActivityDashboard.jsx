import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import { 
  getSiteEngineers,
  getSites,
  getDailyUpdatesForEngineer,
  getSitePhotos,
  formatPhotoTimestamp,
  getEngineerAttendanceHistory,
  getEngineerAttendanceAndLeaveStats,
  getEngineerLeaves
} from "../services/firebaseService";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  Building2, 
  MapPin, 
  Camera, 
  FileText, 
  Activity,
  ClipboardCheck,
  CalendarCheck,
  ShieldCheck,
  LogIn,
  LogOut,
  X,
  Eye
} from "lucide-react";

// Date formatting helpers for 30-day range and ISO conversions
const formatDateForInput = (d) => {
  if (!d || isNaN(new Date(d).getTime())) return "";
  const dateObj = new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitial30DayRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: formatDateForInput(from),
    to: formatDateForInput(to)
  };
};

const formatDisplayDate = (dateVal) => {
  if (!dateVal) return "--";
  const s = String(dateVal).trim();
  const parts = s.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  const slashParts = s.split("/");
  if (slashParts.length === 3) {
    const d = new Date(Number(slashParts[2]), Number(slashParts[1]) - 1, Number(slashParts[0]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return s;
};

const normalizeDateToISO = (dateVal) => {
  if (!dateVal) return "";
  const s = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
};

export default function EngineerActivityDashboard({ engineerId, onBack }) {
  const [engineer, setEngineer] = useState(null);
  const [sites, setSites] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [leaves, setLeaves] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [activeSubTab, setActiveSubTab] = useState("attendance");
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);

  // 30-Day Attendance History Modal State
  const [showAttendanceHistoryModal, setShowAttendanceHistoryModal] = useState(false);
  const [modalFromDate, setModalFromDate] = useState(() => getInitial30DayRange().from);
  const [modalToDate, setModalToDate] = useState(() => getInitial30DayRange().to);
  const [appliedModalRange, setAppliedModalRange] = useState(() => getInitial30DayRange());

  // Filters State
  const [siteFilter, setSiteFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        fetchedEngineers,
        fetchedSites,
        progress,
        pts,
        attend,
        engLeaves
      ] = await Promise.all([
        getSiteEngineers(),
        getSites(),
        getDailyUpdatesForEngineer(engineerId),
        getSitePhotos(engineerId),
        getEngineerAttendanceHistory(engineerId),
        getEngineerLeaves(engineerId)
      ]);

      const currentEng = fetchedEngineers.find(e => e.id === engineerId || e.uid === engineerId);
      if (!currentEng) {
        showToast("Engineer not found.", "error");
        onBack();
        return;
      }
      setEngineer(currentEng);
      setSites(fetchedSites);
      setProgressUpdates(progress);
      setPhotos(pts);
      setAttendance(attend);
      setLeaves(engLeaves);

      const engStats = await getEngineerAttendanceAndLeaveStats(engineerId, currentEng.holidayAllowance || 24);
      setStats(engStats);

    } catch (err) {
      console.error("Error loading engineer activity data:", err);
      showToast(`Failed to load engineer dashboard: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [engineerId]);

  if (loading) {
    return (
      <Layout title="Engineer Dashboard" description="Loading detailed engineer activity logs...">
        <Loading show={true} text="Compiling engineer activity records..." />
      </Layout>
    );
  }

  if (!engineer) return null;

  const filteredProgress = progressUpdates.filter(up => {
    const matchesSite = !siteFilter || String(up.siteId || "").trim() === String(siteFilter || "").trim();
    const matchesDate = !dateFilter || (up.createdAt?.seconds 
      ? new Date(up.createdAt.seconds * 1000).toISOString().split("T")[0] === dateFilter
      : (up.createdAt ? new Date(up.createdAt).toISOString().split("T")[0] === dateFilter : true));
    return matchesSite && matchesDate;
  });

  const filteredPhotos = photos.filter(pt => {
    const matchesSite = !siteFilter || String(pt.siteId || "").trim() === String(siteFilter || "").trim();
    const matchesDate = !dateFilter || (pt.capturedAt?.seconds 
      ? new Date(pt.capturedAt.seconds * 1000).toISOString().split("T")[0] === dateFilter
      : (pt.capturedAt ? new Date(pt.capturedAt).toISOString().split("T")[0] === dateFilter : true));
    return matchesSite && matchesDate;
  });

  const filteredAttendance = attendance.filter(att => {
    const matchesSite = !siteFilter || String(att.siteId || "").trim() === String(siteFilter || "").trim();
    const recDate = att.date || att.attendanceDate || "";
    const matchesDate = !dateFilter || recDate === dateFilter;
    return matchesSite && matchesDate;
  });

  // Canonical attendance filtered by site selection
  const siteFilteredAttendance = attendance.filter(att => {
    return !siteFilter || String(att.siteId || "").trim() === String(siteFilter || "").trim();
  });

  // Sorted attendance descending by canonical date / timestamp
  const sortedSiteAttendance = [...siteFilteredAttendance].sort((a, b) => {
    const dateA = normalizeDateToISO(a.date || a.attendanceDate || "");
    const dateB = normalizeDateToISO(b.date || b.attendanceDate || "");
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const timeA = a.timestamp?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const timeB = b.timestamp?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return timeB - timeA;
  });

  // The latest attendance record across the engineer's assigned site(s)
  const latestAttendanceRecord = sortedSiteAttendance.length > 0 ? sortedSiteAttendance[0] : null;

  // Latest 3 active days of attendance records directly shown in the attendance register
  const distinctDates = [];
  sortedSiteAttendance.forEach(att => {
    const normDate = normalizeDateToISO(att.date || att.attendanceDate || "");
    if (normDate && !distinctDates.includes(normDate)) {
      distinctDates.push(normDate);
    }
  });
  const top3Dates = distinctDates.slice(0, 3);
  const latest3DaysAttendanceRecords = sortedSiteAttendance.filter(att => {
    const normDate = normalizeDateToISO(att.date || att.attendanceDate || "");
    return top3Dates.includes(normDate);
  });

  // Filtered attendance for the 30-day (or custom date range) modal
  const modalAttendanceRecords = sortedSiteAttendance.filter(att => {
    const normDate = normalizeDateToISO(att.date || att.attendanceDate || "");
    if (!normDate) return false;
    if (appliedModalRange.from && normDate < appliedModalRange.from) return false;
    if (appliedModalRange.to && normDate > appliedModalRange.to) return false;
    return true;
  });

  // Calculate site-wise activities counts across assigned sites and all attendance records
  const siteActivitySummary = {};
  engineer.assignedSites?.forEach(assignedId => {
    const siteObj = sites.find(s => s.id === assignedId);
    siteActivitySummary[assignedId] = {
      siteName: siteObj ? siteObj.siteName : `Site (ID: ${assignedId})`,
      status: siteObj ? siteObj.status : "Planning",
      daysAttended: 0,
      entries: 0,
      exits: 0
    };
  });

  attendance.forEach(att => {
    const sid = att.siteId || "_general";
    if (!siteActivitySummary[sid]) {
      const siteObj = sites.find(s => s.id === sid);
      siteActivitySummary[sid] = {
        siteName: att.siteName || (siteObj ? siteObj.siteName : `Site (ID: ${sid})`),
        status: siteObj ? siteObj.status : "Active",
        daysAttended: 0,
        entries: 0,
        exits: 0
      };
    }
    siteActivitySummary[sid].daysAttended += 1;
    if (att.time || att.checkInTime || att.checkInTimeFormatted) {
      siteActivitySummary[sid].entries += 1;
    }
    if (att.isCheckedOut || att.checkOutTime || att.checkOutTimeFormatted) {
      siteActivitySummary[sid].exits += 1;
    }
  });

  const subTabs = [
    { id: "attendance", label: "Attendance Marks", icon: ClipboardCheck },
    { id: "progress", label: "Progress Reports", icon: FileText },
    { id: "photos", label: "Uploaded Photos", icon: Camera }
  ];

  const renderAttendanceTable = (records = []) => {
    if (!records || records.length === 0) {
      return (
        <div style={{ padding: "32px 16px", textAlign: "center", backgroundColor: "var(--primary-50)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
          <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
            No attendance records found.
          </p>
        </div>
      );
    }

    return (
      <div style={{ 
        overflowX: "auto", 
        border: "1px solid var(--border-color)", 
        borderRadius: "8px", 
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "10px 12px", width: "56px", textAlign: "center", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Photo</th>
              <th style={{ padding: "10px 12px", width: "160px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Site Engineer</th>
              <th style={{ padding: "10px 12px", width: "125px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
              <th style={{ padding: "10px 12px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Site</th>
              <th style={{ padding: "10px 12px", width: "115px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Check-in</th>
              <th style={{ padding: "10px 12px", width: "115px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Check-out</th>
              <th style={{ padding: "10px 12px", width: "120px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</th>
              <th style={{ padding: "10px 12px", width: "130px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Verification</th>
            </tr>
          </thead>
          <tbody>
            {records.map((att, idx) => {
              const siteObj = sites.find(s => s.id === att.siteId);
              const resolvedSiteName = att.siteName || (siteObj ? siteObj.siteName : (att.siteId ? `Site (ID: ${att.siteId})` : "General Site"));
              const resolvedEngName = att.engineerName || engineer.fullName || "Site Engineer";
              const recDate = att.date || att.attendanceDate || "--";
              const checkInTime = att.checkInTimeFormatted || att.time || "--";
              const checkOutTime = att.checkOutTimeFormatted;
              const isCheckedOut = att.isCheckedOut || att.status === "checked_out" || Boolean(checkOutTime);
              const photoUrl = att.photoUrl || att.checkInPhotoUrl;
              const isVerified = att.verificationStatus === "verified" || att.isVerified;

              return (
                <tr 
                  key={att.id || `att_row_${att.siteId}_${recDate}_${idx}`} 
                  style={{ 
                    borderBottom: idx < records.length - 1 ? "1px solid #f1f5f9" : "none",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {/* Photo Column */}
                  <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                    {photoUrl ? (
                      <img 
                        src={photoUrl} 
                        alt="Selfie"
                        onClick={() => setSelectedPhotoModal({ url: photoUrl, title: `Selfie Verification - ${resolvedEngName} (${recDate})` })}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "6px",
                          objectFit: "cover",
                          border: "1px solid #cbd5e1",
                          cursor: "pointer",
                          display: "inline-block",
                          verticalAlign: "middle"
                        }}
                        title="Click to expand verification selfie"
                      />
                    ) : (
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #e2e8f0",
                        verticalAlign: "middle",
                        margin: "0 auto"
                      }}>
                        <Building2 size={16} />
                      </div>
                    )}
                  </td>

                  {/* Site Engineer Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <strong style={{ fontSize: "13px", color: "var(--primary-950)", fontWeight: "750" }}>
                      {resolvedEngName}
                    </strong>
                  </td>

                  {/* Date Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <span className="font-mono" style={{ fontWeight: "700", color: "#0f172a", fontSize: "13px" }}>
                      {formatDisplayDate(recDate)}
                    </span>
                    {recDate !== formatDisplayDate(recDate) && (
                      <span className="font-mono" style={{ display: "block", fontSize: "10.5px", color: "#64748b" }}>
                        {recDate}
                      </span>
                    )}
                  </td>

                  {/* Site Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                    <strong style={{ color: "#1e293b", fontSize: "13px", display: "block" }}>
                      {resolvedSiteName}
                    </strong>
                    {att.distance !== undefined && att.distance !== null && (
                      <span style={{ fontSize: "10.5px", color: Number(att.distance) <= 500 ? "#15803d" : "#b45309", fontWeight: "600" }}>
                        🎯 {Math.round(att.distance)}m from site
                      </span>
                    )}
                  </td>

                  {/* Check-in Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <LogIn size={13} style={{ color: "#16a34a" }} />
                      <span className="font-mono" style={{ fontWeight: "700", color: "#15803d", fontSize: "12.5px" }}>
                        {checkInTime}
                      </span>
                    </div>
                  </td>

                  {/* Check-out Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    {checkOutTime ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <LogOut size={13} style={{ color: "#4338ca" }} />
                        <span className="font-mono" style={{ fontWeight: "700", color: "#3730a3", fontSize: "12.5px" }}>
                          {checkOutTime}
                        </span>
                      </div>
                    ) : isCheckedOut ? (
                      <span style={{ fontSize: "12px", color: "#4338ca", fontWeight: "600" }}>
                        Logged Out
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Status Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <Badge status={isCheckedOut ? "info" : "success"}>
                      {isCheckedOut ? "Checked Out" : "Present"}
                    </Badge>
                  </td>

                  {/* Verification Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    {isVerified ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#059669",
                        backgroundColor: "#ecfdf5",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid #a7f3d0"
                      }}>
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#64748b",
                        backgroundColor: "#f1f5f9",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0"
                      }}>
                        Logged
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Layout 
      title={`Activity Dashboard: ${engineer.fullName}`}
      description="Supervise field supervisor clock-in locations, geocoded entry exits, and uploaded logs."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Back Button and Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <Button variant="outline" icon={ArrowLeft} onClick={onBack}>
          Back to Engineers
        </Button>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
          Status: <Badge status={engineer.status || "active"} />
        </span>
      </div>

      {/* Main Grid: Left is Profile & Stats, Right is Logs & Tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "flex-start" }} className="engineer-dashboard-layout">
        
        {/* Left Column: Profile Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Profile Card */}
          <Card title="Engineer Profile">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center", marginBottom: "20px" }}>
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-50)",
                color: "var(--accent-700)",
                border: "2px solid var(--accent-200)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "900",
                fontSize: "22px",
                boxShadow: "var(--shadow-sm)"
              }}>
                {engineer.fullName ? engineer.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "SE"}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-900)" }}>{engineer.fullName}</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Site Engineer</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <Mail size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: "13.5px", color: "var(--primary-950)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{engineer.email}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <Phone size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: "13.5px", color: "var(--primary-950)" }}>{engineer.phoneNumber || "--"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CalendarCheck size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: "13.5px", color: "var(--primary-950)" }}>
                  Holiday Allowance: <strong>{engineer.holidayAllowance || 24} days</strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Site-wise Activity Card */}
          <Card title="Assigned Site-wise Activities">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.keys(siteActivitySummary).length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>No assigned construction sites.</p>
              ) : (
                Object.keys(siteActivitySummary).map(sid => {
                  const summary = siteActivitySummary[sid];
                  return (
                    <div key={sid} style={{
                      backgroundColor: "var(--primary-50)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950)" }}>{summary.siteName}</strong>
                        <Badge status={summary.status} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center", borderTop: "1px dashed var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                        <div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Check-Ins</span>
                          <strong style={{ fontSize: "13px", color: "var(--primary-800)" }}>{summary.entries}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Check-Outs</span>
                          <strong style={{ fontSize: "13px", color: "var(--primary-800)" }}>{summary.exits}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Days Pres</span>
                          <strong style={{ fontSize: "13px", color: "var(--success-700)" }}>{summary.daysAttended}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

        </div>

        {/* Right Column: Filters and Details Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Filters Card */}
          <Card title="Activity Search Filter">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="filter-site">Select Site</label>
                <select
                  id="filter-site"
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "#ffffff",
                    marginTop: "4px",
                    outline: "none"
                  }}
                >
                  <option value="">All Assigned Sites</option>
                  {engineer.assignedSites?.map(sid => {
                    const siteObj = sites.find(s => s.id === sid);
                    return <option key={sid} value={sid}>{siteObj ? siteObj.siteName : sid}</option>;
                  })}
                  {Object.keys(siteActivitySummary).filter(sid => !engineer.assignedSites?.includes(sid) && sid !== "_general").map(sid => {
                    const siteObj = sites.find(s => s.id === sid);
                    return <option key={sid} value={sid}>{siteObj ? siteObj.siteName : sid}</option>;
                  })}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="filter-date">Select Date</label>
                <input
                  type="date"
                  id="filter-date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    marginTop: "4px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
            {(siteFilter || dateFilter) && (
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <Button variant="outline" size="sm" onClick={() => { setSiteFilter(""); setDateFilter(""); }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </Card>

          {/* Sub-Tabs Selector */}
          <div style={{ display: "flex", gap: "4px", borderBottom: "2px solid var(--border-color)", overflowX: "auto" }}>
            {subTabs.map(st => {
              const Icon = st.icon;
              const isActive = activeSubTab === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveSubTab(st.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 16px",
                    border: "none",
                    backgroundColor: isActive ? "var(--primary-50)" : "transparent",
                    color: isActive ? "var(--primary-750)" : "var(--text-muted)",
                    fontSize: "13.5px",
                    fontWeight: isActive ? "800" : "600",
                    cursor: "pointer",
                    borderBottom: isActive ? "2.5px solid var(--primary-600)" : "2.5px solid transparent",
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  <Icon size={15} />
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Sub-Tab Contents */}
          <div>
            
            {/* 2. Sub-Tab: Progress Reports */}
            {activeSubTab === "progress" && (
              <Card title="Submitted Progress Milestones">
                {filteredProgress.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                    No progress updates matching this query.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {filteredProgress.map(up => {
                      const siteObj = sites.find(s => s.id === up.siteId);
                      const dateStr = up.createdAt?.seconds 
                        ? new Date(up.createdAt.seconds * 1000).toLocaleString()
                        : (up.createdAt ? new Date(up.createdAt).toLocaleString() : "--");

                      return (
                        <div key={up.id} style={{
                          padding: "14px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          backgroundColor: "#ffffff"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <strong style={{ fontSize: "13.5px", color: "var(--primary-900)" }}>{siteObj ? siteObj.siteName : "Site Update"}</strong>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{dateStr}</span>
                          </div>
                          <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#334155", lineHeight: "1.4" }}>
                            {up.description}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Category: Progress Milestones</span>
                            <Badge status="pending">{up.progress}% Completed</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* 3. Sub-Tab: Photos */}
            {activeSubTab === "photos" && (
              <Card title="Visual Field Submissions">
                {filteredPhotos.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                    No photos matching this query.
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                    {filteredPhotos.map((photo, idx) => {
                      const siteObj = sites.find(s => s.id === photo.siteId);
                      const { date, time } = formatPhotoTimestamp(photo.uploadedAt || photo.capturedAt);

                      return (
                        <div key={photo.id || idx} style={{
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          overflow: "hidden",
                          backgroundColor: "#ffffff"
                        }}>
                          <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                            <img 
                              src={photo.imageUrl} 
                              alt="Engineer field upload" 
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?auto=format&fit=crop&w=400&q=80";
                              }}
                              style={{ width: "100%", height: "120px", objectFit: "cover" }}
                            />
                          </a>
                          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                            <strong style={{ fontSize: "11.5px", color: "var(--primary-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={photo.siteName || (siteObj ? siteObj.siteName : "Inspection Photo")}>
                              {photo.siteName || (siteObj ? siteObj.siteName : "Inspection Photo")}
                            </strong>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{date} at {time}</span>
                            {photo.photoType && (
                              <span style={{ fontSize: "9px", color: "var(--accent-600)", fontWeight: "600" }}>{photo.photoType}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* 4. Sub-Tab: Attendance Register */}
            {activeSubTab === "attendance" && (
              <Card 
                title="Recent Attendance (Latest 3 Days)"
                subtitle="Direct verification logs for the engineer across assigned worksites."
              >
                {/* 1. If user filtered by a specific date via the top filter */}
                {dateFilter ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>
                        Showing Filtered Date: <span className="font-mono" style={{ color: "var(--primary-700)", backgroundColor: "var(--primary-100)", padding: "2px 8px", borderRadius: "4px" }}>{formatDisplayDate(dateFilter)}</span>
                      </span>
                      <Button size="sm" variant="outline" icon={Calendar} onClick={() => setShowAttendanceHistoryModal(true)}>
                        View 30-Day History
                      </Button>
                    </div>
                    {filteredAttendance.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", backgroundColor: "var(--primary-50)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                        <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
                          No attendance record logged on {formatDisplayDate(dateFilter)}.
                        </p>
                      </div>
                    ) : (
                      renderAttendanceTable(filteredAttendance)
                    )}
                  </div>
                ) : (
                  /* 2. Direct Latest 3 Days Attendance Table */
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: "750", color: "var(--primary-950)" }}>
                          Recent Attendance Logs
                        </span>
                        <span style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)" }}>
                          Showing latest 3 days of canonical attendance for <strong>{engineer.fullName}</strong>
                        </span>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Calendar}
                        onClick={() => setShowAttendanceHistoryModal(true)}
                        style={{
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: "750"
                        }}
                      >
                        View Full Attendance History
                      </Button>
                    </div>

                    {latest3DaysAttendanceRecords.length === 0 ? (
                      <div style={{
                        padding: "32px 16px",
                        textAlign: "center",
                        backgroundColor: "var(--primary-50)",
                        borderRadius: "10px",
                        border: "1px dashed var(--border-color)"
                      }}>
                        <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
                        <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", margin: "0 0 14px 0" }}>
                          No attendance records found for this engineer.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Calendar}
                          onClick={() => setShowAttendanceHistoryModal(true)}
                        >
                          View Attendance
                        </Button>
                      </div>
                    ) : (
                      renderAttendanceTable(latest3DaysAttendanceRecords)
                    )}
                  </div>
                )}
              </Card>
            )}

          </div>

        </div>

      </div>

      {/* 30-Day Attendance History Responsive Modal */}
      {showAttendanceHistoryModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAttendanceHistoryModal(false)}
          title="Attendance History — Last 30 Days"
          subtitle={`Canonical verified attendance logs for ${engineer.fullName}${siteFilter ? ` at ${sites.find(s => s.id === siteFilter)?.siteName || siteFilter}` : ""}`}
          maxWidth="900px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Filter Date Range Control Strip */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              backgroundColor: "var(--primary-50)",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="modal-from-date" style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>From:</label>
                  <input
                    type="date"
                    id="modal-from-date"
                    value={modalFromDate}
                    onChange={(e) => setModalFromDate(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      fontSize: "12.5px",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="modal-to-date" style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>To:</label>
                  <input
                    type="date"
                    id="modal-to-date"
                    value={modalToDate}
                    onChange={(e) => setModalToDate(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      fontSize: "12.5px",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAppliedModalRange({ from: modalFromDate, to: modalToDate })}
                >
                  Apply / View
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const r = getInitial30DayRange();
                    setModalFromDate(r.from);
                    setModalToDate(r.to);
                    setAppliedModalRange(r);
                  }}
                >
                  Last 30 Days
                </Button>
              </div>

              {/* Range Badge Summary */}
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Range: <strong style={{ color: "#0f172a" }}>{formatDisplayDate(appliedModalRange.from)}</strong> to <strong style={{ color: "#0f172a" }}>{formatDisplayDate(appliedModalRange.to)}</strong>
                <span style={{ marginLeft: "8px", backgroundColor: "#e2e8f0", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", color: "#334155" }}>
                  {modalAttendanceRecords.length} record{modalAttendanceRecords.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Attendance Records Table */}
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {renderAttendanceTable(modalAttendanceRecords)}
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
              <Button variant="outline" onClick={() => setShowAttendanceHistoryModal(false)}>
                Close
              </Button>
            </div>

          </div>
        </Modal>
      )}

      {/* Modal for viewing expanded verification photo */}
      {selectedPhotoModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPhotoModal(null)}
          title={selectedPhotoModal.title || "Verification Photo"}
          maxWidth="500px"
        >
          <div style={{ textAlign: "center", padding: "8px" }}>
            <img 
              src={selectedPhotoModal.url} 
              alt="Verification selfie preview" 
              style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--border-color)" }}
            />
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setSelectedPhotoModal(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

    </Layout>
  );
}

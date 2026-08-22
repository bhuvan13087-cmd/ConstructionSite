import React, { useState, useEffect } from "react";
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
  X
} from "lucide-react";

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
              <Card title="Daily Attendance Logs">
                {filteredAttendance.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", margin: 0 }}>
                      No attendance records logged for this query.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {filteredAttendance.map((att, idx) => {
                      const siteObj = sites.find(s => s.id === att.siteId);
                      const resolvedSiteName = att.siteName || (siteObj ? siteObj.siteName : (att.siteId ? `Site (ID: ${att.siteId})` : "General Site"));
                      const resolvedEngName = att.engineerName || engineer.fullName || "Site Engineer";
                      const recDate = att.date || att.attendanceDate || "--";
                      const checkInTime = att.checkInTimeFormatted || att.time || "--";
                      const checkOutTime = att.checkOutTimeFormatted;
                      const isCheckedOut = att.isCheckedOut || att.status === "checked_out" || Boolean(checkOutTime);
                      const photoUrl = att.photoUrl || att.checkInPhotoUrl;
                      const checkOutPhotoUrl = att.checkOutPhotoUrl;

                      return (
                        <div key={att.id || `att_${att.siteId}_${recDate}_${idx}`} style={{
                          padding: "16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--border-color)",
                          borderRadius: "10px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          transition: "border-color 0.15s ease"
                        }}>
                          {/* Row 1: Header - Site Name, Engineer Name, Date, Status */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                              {photoUrl ? (
                                <img 
                                  src={photoUrl} 
                                  alt="Check-in Verification" 
                                  onClick={() => setSelectedPhotoModal({ url: photoUrl, title: `Selfie Verification - ${resolvedEngName} (${recDate})` })}
                                  style={{ 
                                    width: "48px", 
                                    height: "48px", 
                                    borderRadius: "8px", 
                                    objectFit: "cover", 
                                    flexShrink: 0, 
                                    border: "1.5px solid var(--border-color)",
                                    cursor: "pointer" 
                                  }} 
                                  title="Click to expand selfie verification"
                                />
                              ) : (
                                <div style={{
                                  width: "48px",
                                  height: "48px",
                                  borderRadius: "8px",
                                  backgroundColor: "var(--primary-100)",
                                  color: "var(--primary-700)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  fontWeight: "800",
                                  fontSize: "13px"
                                }}>
                                  <Building2 size={20} />
                                </div>
                              )}
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <strong style={{ fontSize: "14px", fontWeight: "750", color: "var(--primary-950)" }}>
                                    {resolvedSiteName}
                                  </strong>
                                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--primary-50)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                                    {resolvedEngName}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", color: "var(--text-muted)", fontSize: "11.5px" }}>
                                  <Calendar size={13} style={{ flexShrink: 0 }} />
                                  <span className="font-mono" style={{ fontWeight: "600", color: "#334155" }}>{recDate}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {isCheckedOut ? (
                                <Badge status="info">Checked Out</Badge>
                              ) : (
                                <Badge status="success">Present / On Site</Badge>
                              )}
                              {(att.verificationStatus === "verified" || att.isVerified) && (
                                <span style={{ 
                                  display: "inline-flex", 
                                  alignItems: "center", 
                                  gap: "3px", 
                                  fontSize: "10.5px", 
                                  fontWeight: "700", 
                                  color: "#059669", 
                                  backgroundColor: "#ecfdf5", 
                                  padding: "2px 8px", 
                                  borderRadius: "12px",
                                  border: "1px solid #a7f3d0"
                                }}>
                                  <ShieldCheck size={12} />
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Check-in & Check-out details strip */}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: "10px",
                            backgroundColor: "var(--primary-50)",
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-color)",
                            fontSize: "12px"
                          }}>
                            {/* Check-In */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <LogIn size={13} />
                              </div>
                              <div>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Check-In Time</span>
                                <strong className="font-mono" style={{ color: "var(--primary-900)", fontSize: "12px" }}>{checkInTime}</strong>
                              </div>
                            </div>

                            {/* Check-Out */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: isCheckedOut ? "#e0e7ff" : "#f1f5f9", color: isCheckedOut ? "#4338ca" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <LogOut size={13} />
                              </div>
                              <div>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Check-Out Time</span>
                                <strong className="font-mono" style={{ color: isCheckedOut ? "#1e1b4b" : "var(--text-muted)", fontSize: "12px" }}>
                                  {checkOutTime || (isCheckedOut ? "Logged" : "Not yet checked out")}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Row 3: GPS & Geofence Verification Metadata */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", fontSize: "11px", color: "var(--text-muted)", paddingTop: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <MapPin size={13} style={{ color: "var(--primary-600)", flexShrink: 0 }} />
                              <span>{att.addressDisplay || att.address || "GPS Location Captured"}</span>
                              {att.latitude && att.longitude && (
                                <span className="font-mono" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
                                  ({Number(att.latitude).toFixed(4)}, {Number(att.longitude).toFixed(4)})
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {att.distance !== undefined && att.distance !== null && (
                                <span style={{ fontWeight: "600", color: Number(att.distance) <= 500 ? "#15803d" : "#b45309" }}>
                                  🎯 {Math.round(att.distance)}m from site
                                </span>
                              )}
                              {att.gpsAccuracy && (
                                <span style={{ color: "var(--text-muted)" }}>
                                  Accuracy: ±{Math.round(att.gpsAccuracy)}m
                                </span>
                              )}
                              {checkOutPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhotoModal({ url: checkOutPhotoUrl, title: `Check-out Photo - ${resolvedEngName} (${recDate})` })}
                                  style={{
                                    border: "none",
                                    background: "none",
                                    color: "var(--primary-600)",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    fontSize: "11px",
                                    padding: 0
                                  }}
                                >
                                  View Check-Out Photo
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

          </div>

        </div>

      </div>

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

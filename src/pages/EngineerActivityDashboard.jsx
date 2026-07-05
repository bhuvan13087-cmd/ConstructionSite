import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
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
  CalendarCheck
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
      // Fetch engineer details
      const fetchedEngineers = await getSiteEngineers();
      const currentEng = fetchedEngineers.find(e => e.id === engineerId);
      if (!currentEng) {
        showToast("Engineer not found.", "error");
        onBack();
        return;
      }
      setEngineer(currentEng);

      // Fetch all sites
      const fetchedSites = await getSites();
      setSites(fetchedSites);

      // Fetch other engineer logs in parallel
      const [
        progress,
        pts,
        attend,
        engStats,
        engLeaves
      ] = await Promise.all([
        getDailyUpdatesForEngineer(engineerId),
        getSitePhotos(engineerId),
        getEngineerAttendanceHistory(engineerId),
        getEngineerAttendanceAndLeaveStats(engineerId, currentEng.holidayAllowance || 24),
        getEngineerLeaves(engineerId)
      ]);

      setProgressUpdates(progress);
      setPhotos(pts);
      setAttendance(attend);
      setStats(engStats);
      setLeaves(engLeaves);

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
    const matchesSite = !siteFilter || up.siteId === siteFilter;
    const matchesDate = !dateFilter || (up.createdAt?.seconds 
      ? new Date(up.createdAt.seconds * 1000).toISOString().split("T")[0] === dateFilter
      : (up.createdAt ? new Date(up.createdAt).toISOString().split("T")[0] === dateFilter : true));
    return matchesSite && matchesDate;
  });

  const filteredPhotos = photos.filter(pt => {
    const matchesSite = !siteFilter || pt.siteId === siteFilter;
    const matchesDate = !dateFilter || (pt.capturedAt?.seconds 
      ? new Date(pt.capturedAt.seconds * 1000).toISOString().split("T")[0] === dateFilter
      : (pt.capturedAt ? new Date(pt.capturedAt).toISOString().split("T")[0] === dateFilter : true));
    return matchesSite && matchesDate;
  });

  const filteredAttendance = attendance.filter(att => {
    const matchesSite = !siteFilter || att.siteId === siteFilter;
    const matchesDate = !dateFilter || att.date === dateFilter;
    return matchesSite && matchesDate;
  });

  // Calculate site-wise activities counts
  const siteActivitySummary = {};
  engineer.assignedSites?.forEach(assignedId => {
    const siteObj = sites.find(s => s.id === assignedId);
    siteActivitySummary[assignedId] = {
      siteName: siteObj ? siteObj.siteName : `Site (ID: ${assignedId})`,
      status: siteObj ? siteObj.status : "Planning",
      daysAttended: 0
    };
  });

  attendance.forEach(att => {
    if (siteActivitySummary[att.siteId]) {
      siteActivitySummary[att.siteId].daysAttended += 1;
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
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Entries</span>
                          <strong style={{ fontSize: "13px", color: "var(--primary-800)" }}>{summary.entries}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Exits</span>
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
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                    No attendance records logged for this query.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {filteredAttendance.map(att => {
                      const siteObj = sites.find(s => s.id === att.siteId);
                      return (
                        <div key={att.id} style={{
                          padding: "12px",
                          backgroundColor: "var(--primary-50)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}>
                          <div>
                            <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>
                              {siteObj ? siteObj.siteName : "Registered Site"}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Logged GPS: {att.latitude?.toFixed(5)}, {att.longitude?.toFixed(5)} • {att.address || "No geocoded address"}
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <Badge status="success">Present</Badge>
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "block", marginTop: "2px" }} className="font-mono">
                              {att.date} {att.time || ""}
                            </span>
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

    </Layout>
  );
}

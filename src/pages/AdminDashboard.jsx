import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit,
  doc
} from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import { 
  MapPin, 
  Users, 
  ClipboardCheck, 
  Package, 
  Building2, 
  Activity, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Eye, 
  FolderOpen, 
  HardHat, 
  ArrowRight, 
  ChevronRight, 
  TrendingUp, 
  Search, 
  Bell, 
  Briefcase, 
  FileText, 
  DollarSign, 
  ExternalLink, 
  UserCheck, 
  Navigation, 
  Maximize2, 
  ShieldCheck, 
  X
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Link } from "react-router-dom";
import { deduplicateDailyAttendance, isEngineerAttendanceRecord } from "../services/firebaseService";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [rawAttendance, setRawAttendance] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  
  // Attendance Activity Filter States
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceSiteFilter, setAttendanceSiteFilter] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all"); // 'all' | 'onsite' | 'checkout'
  const [selectedInspectRecord, setSelectedInspectRecord] = useState(null);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Canonical Today Date Keys (UTC and Indian Standard Time)
  const todayDateKeys = useMemo(() => {
    const now = new Date();
    const utcDate = now.toISOString().split("T")[0];
    let istDate = utcDate;
    try {
      istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    } catch (e) {
      istDate = utcDate;
    }
    return Array.from(new Set([utcDate, istDate]));
  }, []);

  const formattedTodayDate = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-IN", { 
        timeZone: "Asia/Kolkata", 
        weekday: "long", 
        day: "numeric", 
        month: "short", 
        year: "numeric" 
      });
    } catch (e) {
      return new Date().toDateString();
    }
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    setLoading(true);

    let sitesLoaded = false;
    let engineersLoaded = false;

    const checkLoadingComplete = () => {
      if (sitesLoaded && engineersLoaded) {
        setLoading(false);
      }
    };

    // 1. Sites Listener
    const adminUid = user?.uid || null;
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
        list.push({ id: docSnap.id, ...data });
      });
      setSites(list);
      sitesLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Sites listener error:", err);
      sitesLoaded = true;
      checkLoadingComplete();
    });

    // 2. Engineers Listener
    let unsubLegacyEngineers = null;
    const unsubEngineers = onSnapshot(collection(db, "siteEngineers"), (snapshot) => {
      if (snapshot.empty) {
        if (unsubLegacyEngineers) unsubLegacyEngineers();
        const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
        unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
          const list = [];
          legacySnap.forEach(docSnap => {
            const data = docSnap.data();
            if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
            list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
          });
          setEngineers(list);
          engineersLoaded = true;
          checkLoadingComplete();
        }, (err) => {
          console.error("Legacy engineers listener error:", err);
          engineersLoaded = true;
          checkLoadingComplete();
        });
      } else {
        if (unsubLegacyEngineers) {
          unsubLegacyEngineers();
          unsubLegacyEngineers = null;
        }
        const list = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }
    }, (err) => {
      console.warn("siteEngineers listener error, falling back to legacy users:", err);
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
      unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
        const list = [];
        legacySnap.forEach(docSnap => {
          const data = docSnap.data();
          if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }, (e) => {
        console.error("Fallback engineers listener error:", e);
        engineersLoaded = true;
        checkLoadingComplete();
      });
    });

    // 3. Single Data Source: Attendance Real-Time Listener
    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawAttendance(list);
    }, (err) => {
      console.error("Attendance listener error on Admin Dashboard:", err);
    });

    // 4. Materials Listener
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawMaterials(list);
    }, (err) => {
      console.error("Materials listener error:", err);
    });

    // 5. Teams / Labour Listener
    const unsubWorkers = onSnapshot(collection(db, "labourTeams"), (snapshot) => {
      const flattenedWorkers = [];
      snapshot.forEach(docSnap => {
        const team = docSnap.data();
        if (adminUid && team.adminId !== adminUid) return;
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            if (cat.members) {
              Object.keys(cat.members).forEach(memberId => {
                const mem = cat.members[memberId];
                flattenedWorkers.push({
                  id: mem.memberId,
                  workerName: mem.name,
                  category: cat.name,
                  teamName: team.teamName,
                  adminId: team.adminId
                });
              });
            }
          });
        }
      });
      setRawWorkers(flattenedWorkers);
    }, (err) => {
      console.error("Labour teams listener error on Dashboard:", err);
    });

    // 6. System Activities Listener
    const qSys = query(collection(db, "activities"), limit(50));
    const unsubSys = onSnapshot(qSys, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSystemActivities(list);
    }, (err) => {
      console.error("System activities listener error:", err);
    });

    // 7. Approvals Listener
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    }, (err) => {
      console.error("Approvals listener error:", err);
    });

    // 8. Documents Listener
    const unsubDocuments = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    }, (err) => {
      console.error("Documents listener error:", err);
    });

    // 9. Expenses Listener
    const unsubExpenses = onSnapshot(doc(db, "expenses", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setRawExpenses(snapshot.data().expenses || []);
      } else {
        setRawExpenses([]);
      }
    }, (err) => {
      console.error("Expenses dashboard listener error:", err);
    });

    return () => {
      unsubSites();
      unsubEngineers();
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      unsubAttendance();
      unsubMaterials();
      unsubWorkers();
      unsubSys();
      unsubApprovals();
      unsubDocuments();
      unsubExpenses();
    };
  }, [user]);

  // Single Source of Truth: Canonical Today's Engineer Attendance List
  const todayAttendanceList = useMemo(() => {
    const todaySet = new Set(todayDateKeys);
    
    // 1. Deduplicate via canonical service function (filters non-engineer records and duplicate entries)
    const deduplicated = deduplicateDailyAttendance(rawAttendance);

    // 2. Filter for today's date
    const todayRecords = deduplicated.filter(r => {
      const d = r.date || r.attendanceDate;
      return d && todaySet.has(d);
    });

    // 3. Enrich with live engineer & site details
    return todayRecords.map(rec => {
      const engId = rec.engineerId || rec.userId;
      const engineer = engineers.find(e => e.id === engId || e.uid === engId);
      const site = sites.find(s => s.id === rec.siteId);

      const checkInTime = rec.time || (rec.checkInTime?.seconds 
        ? new Date(rec.checkInTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
        : (rec.timestamp?.seconds 
            ? new Date(rec.timestamp.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
            : "--"));

      const checkOutTime = rec.checkOutTime?.seconds 
        ? new Date(rec.checkOutTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
        : (rec.checkOutTime ? String(rec.checkOutTime) : null);

      const isCheckedOut = rec.status === "checked_out" || !!checkOutTime;
      const isVerified = rec.verificationStatus === "verified" || rec.verificationStatus === "success" || rec.status === "present" || rec.status === "checked_out";

      return {
        ...rec,
        resolvedEngineerId: engId,
        engineerName: engineer?.fullName || engineer?.name || rec.engineerName || "Site Engineer",
        engineerEmail: engineer?.email || "",
        engineerPhone: engineer?.phone || engineer?.mobile || "",
        engineerAvatar: engineer?.photoUrl || engineer?.avatarUrl || null,
        resolvedSiteId: rec.siteId,
        siteName: site?.siteName || rec.siteName || "Assigned Site",
        clientName: site?.clientName || "",
        siteLocation: site?.location || site?.city || "",
        checkInTimeFormatted: checkInTime,
        checkOutTimeFormatted: checkOutTime,
        isCheckedOut,
        isVerified,
        photoUrl: rec.photoUrl || rec.checkInPhotoUrl || null,
        checkOutPhotoUrl: rec.checkOutPhotoUrl || null,
        distance: rec.distance !== undefined && rec.distance !== null ? Number(rec.distance) : null,
        gpsAccuracy: rec.gpsAccuracy ? Number(rec.gpsAccuracy) : null,
        addressDisplay: rec.address && rec.address !== "GPS Captured" 
          ? rec.address 
          : (rec.latitude && rec.longitude ? `${Number(rec.latitude).toFixed(5)}, ${Number(rec.longitude).toFixed(5)}` : "GPS Captured")
      };
    }).sort((a, b) => {
      const tA = a.checkInTime?.seconds ? a.checkInTime.seconds * 1000 : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
      const tB = b.checkInTime?.seconds ? b.checkInTime.seconds * 1000 : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
      return tB - tA;
    });
  }, [rawAttendance, todayDateKeys, engineers, sites]);

  // Filtered Today Attendance based on search and tab selections
  const filteredTodayAttendance = useMemo(() => {
    return todayAttendanceList.filter(rec => {
      // 1. Site filter
      if (attendanceSiteFilter && rec.resolvedSiteId !== attendanceSiteFilter) {
        return false;
      }
      // 2. Status filter
      if (attendanceStatusFilter === "onsite" && rec.isCheckedOut) {
        return false;
      }
      if (attendanceStatusFilter === "checkout" && !rec.isCheckedOut) {
        return false;
      }
      // 3. Search query
      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase().trim();
        const matchName = (rec.engineerName || "").toLowerCase().includes(q);
        const matchEmail = (rec.engineerEmail || "").toLowerCase().includes(q);
        const matchPhone = (rec.engineerPhone || "").toLowerCase().includes(q);
        const matchSite = (rec.siteName || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchSite) return false;
      }
      return true;
    });
  }, [todayAttendanceList, attendanceSiteFilter, attendanceStatusFilter, attendanceSearchQuery]);

  // Derived KPI Metrics
  const activeEngineersCount = useMemo(() => {
    return engineers.filter(e => e.status === "active").length || engineers.length;
  }, [engineers]);

  const presentCount = todayAttendanceList.length;
  const onSiteCount = todayAttendanceList.filter(r => !r.isCheckedOut).length;
  const checkedOutCount = todayAttendanceList.filter(r => r.isCheckedOut).length;
  const verifiedCount = todayAttendanceList.filter(r => r.isVerified).length;
  const attendanceRate = activeEngineersCount > 0 ? Math.round((presentCount / activeEngineersCount) * 100) : 0;

  const totalMaterialsCount = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    return rawMaterials.filter(m => siteIds.has(m.siteId)).length;
  }, [sites, rawMaterials]);

  const activeWorkersCount = useMemo(() => {
    return rawWorkers.length;
  }, [rawWorkers]);

  const runningProjectsCount = useMemo(() => {
    return sites.filter(s => {
      const st = (s.status || "active").toLowerCase();
      return st === "active" || st === "running" || st === "in progress";
    }).length;
  }, [sites]);

  const completedProjectsCount = useMemo(() => {
    return sites.filter(s => (s.status || "").toLowerCase() === "completed").length;
  }, [sites]);

  const onHoldProjectsCount = useMemo(() => {
    return sites.filter(s => {
      const st = (s.status || "").toLowerCase();
      return st === "on hold" || st === "planning" || st === "pending";
    }).length;
  }, [sites]);

  const delayedProjectsCount = useMemo(() => {
    return sites.filter(s => (s.status || "").toLowerCase() === "delayed" || s.isSiteDelayed).length;
  }, [sites]);

  // Today Expenses Sum
  const todayExpensesSum = useMemo(() => {
    const todayStr = todayDateKeys[0];
    return rawExpenses
      .filter(e => todayDateKeys.includes(e.date) || (e.createdAt?.seconds && todayDateKeys.includes(new Date(e.createdAt.seconds * 1000).toISOString().split("T")[0])))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [rawExpenses, todayDateKeys]);

  // Expenses breakdown by category
  const expenseCategoryBreakdown = useMemo(() => {
    const categories = { "Material": 0, "Labour": 0, "Fuel & Equipment": 0, "Other": 0 };
    rawExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const cat = exp.category || exp.expenseType || "Other";
      if (cat.toLowerCase().includes("mat")) categories["Material"] += amt;
      else if (cat.toLowerCase().includes("lab")) categories["Labour"] += amt;
      else if (cat.toLowerCase().includes("fuel") || cat.toLowerCase().includes("equip")) categories["Fuel & Equipment"] += amt;
      else categories["Other"] += amt;
    });
    return categories;
  }, [rawExpenses]);

  const totalExpenseAllTime = useMemo(() => {
    return Object.values(expenseCategoryBreakdown).reduce((a, b) => a + b, 0);
  }, [expenseCategoryBreakdown]);

  // Upcoming Deadlines
  const upcomingDeadlines = useMemo(() => {
    return sites
      .filter(s => s.expectedEndDate || s.startDate)
      .sort((a, b) => {
        const dA = new Date(a.expectedEndDate || a.startDate).getTime() || Infinity;
        const dB = new Date(b.expectedEndDate || b.startDate).getTime() || Infinity;
        return dA - dB;
      })
      .slice(0, 4);
  }, [sites]);

  return (
    <Layout 
      title="Overall Admin ERP Dashboard" 
      description="Executive Construction Control Center, Workforce Operations & Financial Analytics"
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── MAIN DASHBOARD CONTAINER ── */}
      <div className="admin-dashboard-container">
        
        {/* ── 1. TOP SUMMARY CARDS (6 CARDS) ── */}
        <div className="admin-summary-grid">
          
          {/* KPI 1: Active Sites */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{sites.filter(s => (s.status || "active").toLowerCase() === "active").length}</div>
              <div className="admin-summary-label">Active Sites</div>
            </div>
          </div>

          {/* KPI 2: Running Projects */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Activity size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{runningProjectsCount}</div>
              <div className="admin-summary-label">Running Projects</div>
            </div>
          </div>

          {/* KPI 3: Today's Engineer Attendance (Single Source of Truth) */}
          <div className="admin-summary-card" style={{ borderColor: presentCount > 0 ? "#bbf7d0" : "var(--border-color)" }}>
            <div className="admin-summary-icon" style={{ backgroundColor: "#f0fdf4", color: "#16a34a" }}>
              <UserCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span>{presentCount} / {activeEngineersCount}</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
                  ({attendanceRate}%)
                </span>
              </div>
              <div className="admin-summary-label">Today's Attendance</div>
            </div>
          </div>

          {/* KPI 4: Today's Labour */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{activeWorkersCount}</div>
              <div className="admin-summary-label">Today's Labour</div>
            </div>
          </div>

          {/* KPI 5: Today's Expense */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">₹{todayExpensesSum.toLocaleString()}</div>
              <div className="admin-summary-label">Today's Expense</div>
            </div>
          </div>

          {/* KPI 6: Monthly Completed Projects */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <TrendingUp size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{completedProjectsCount}</div>
              <div className="admin-summary-label">Completed Projects</div>
            </div>
          </div>

        </div>

        {/* ── 2. SECOND ROW: CONSTRUCTION STATUS & EXPENSE OVERVIEW ── */}
        <div className="admin-middle-grid">
          
          {/* CONSTRUCTION STATUS CARD */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <Building2 size={16} style={{ color: "var(--brand-orange)" }} />
                Construction Site Status
              </h3>
              <span className="admin-card-subtitle">Total Sites: {sites.length}</span>
            </div>

            <div className="admin-status-grid">
              <div className="admin-status-box running">
                <div className="status-num">{runningProjectsCount}</div>
                <div className="status-lbl">Running</div>
              </div>
              <div className="admin-status-box completed">
                <div className="status-num">{completedProjectsCount}</div>
                <div className="status-lbl">Completed</div>
              </div>
              <div className="admin-status-box on-hold">
                <div className="status-num">{onHoldProjectsCount}</div>
                <div className="status-lbl">On Hold</div>
              </div>
              <div className="admin-status-box delayed">
                <div className="status-num">{delayedProjectsCount}</div>
                <div className="status-lbl">Delayed</div>
              </div>
            </div>
          </div>

          {/* EXPENSE OVERVIEW */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <DollarSign size={16} style={{ color: "var(--brand-orange)" }} />
                Expense Overview
              </h3>
              <span className="admin-card-subtitle">Total Logged: ₹{totalExpenseAllTime.toLocaleString()}</span>
            </div>

            <div className="admin-expense-list">
              {Object.entries(expenseCategoryBreakdown).map(([catName, amount]) => {
                const pct = totalExpenseAllTime > 0 ? Math.round((amount / totalExpenseAllTime) * 100) : 0;
                return (
                  <div key={catName} className="admin-expense-item">
                    <div className="admin-expense-item-header">
                      <span className="admin-expense-cat">{catName}</span>
                      <span className="admin-expense-val">₹{amount.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="admin-progress-track">
                      <div 
                        className="admin-progress-fill"
                        style={{ 
                          width: `${Math.max(3, pct)}%`, 
                          backgroundColor: catName === "Material" ? "#f97316" : catName === "Labour" ? "#ea580c" : catName === "Fuel & Equipment" ? "#16a34a" : "#64748b" 
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── 3. DEDICATED SECTION: TODAY'S ATTENDANCE ACTIVITY (SINGLE SOURCE OF TRUTH) ── */}
        <div className="admin-attendance-card" id="today-attendance-activity-section">
          
          {/* Attendance Section Header */}
          <div className="admin-attendance-header">
            <div className="admin-attendance-title-group">
              <h3 className="admin-attendance-title">
                <ClipboardCheck size={18} style={{ color: "var(--brand-orange)" }} />
                Today's Attendance Activity
              </h3>
              <div className="admin-attendance-live-badge">
                <span className="admin-attendance-live-dot" />
                Live Sync
              </div>
              <span style={{ fontSize: "12px", color: "var(--primary-600)", fontWeight: "600" }}>
                • {formattedTodayDate}
              </span>
            </div>

            {/* Live Metrics Summary Strip */}
            <div className="admin-attendance-metrics">
              <div className="admin-attendance-metric-pill present">
                <UserCheck size={14} />
                <span>Present: {presentCount}/{activeEngineersCount}</span>
              </div>
              <div className="admin-attendance-metric-pill onsite">
                <Clock size={14} />
                <span>On-Site: {onSiteCount}</span>
              </div>
              <div className="admin-attendance-metric-pill checkout">
                <CheckCircle2 size={14} />
                <span>Checked Out: {checkedOutCount}</span>
              </div>
              <div className="admin-attendance-metric-pill verified">
                <ShieldCheck size={14} />
                <span>GPS Verified: {verifiedCount}</span>
              </div>
              <Link 
                to="/admin/engineers" 
                style={{ 
                  fontSize: "12px", 
                  fontWeight: "700", 
                  color: "var(--brand-orange)", 
                  textDecoration: "none",
                  marginLeft: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px"
                }}
              >
                All Engineers →
              </Link>
            </div>
          </div>

          {/* Interactive Toolbar: Search, Site Filter & Status Tabs */}
          <div className="admin-attendance-controls-bar">
            <div className="admin-attendance-search-group">
              <div className="admin-attendance-search-input-wrap">
                <Search size={14} className="admin-attendance-search-icon" />
                <input 
                  type="text"
                  placeholder="Search engineer name, email or site..."
                  value={attendanceSearchQuery}
                  onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  className="admin-attendance-search-input"
                />
              </div>

              <select
                value={attendanceSiteFilter}
                onChange={(e) => setAttendanceSiteFilter(e.target.value)}
                className="admin-attendance-select"
              >
                <option value="">All Sites ({sites.length})</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            <div className="admin-attendance-tabs">
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "all" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("all")}
              >
                All Checked-In ({todayAttendanceList.length})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "onsite" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("onsite")}
              >
                On-Site Now ({onSiteCount})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "checkout" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("checkout")}
              >
                Checked Out ({checkedOutCount})
              </button>
            </div>
          </div>

          {/* Attendance Activity Table / List */}
          <div className="admin-attendance-table-wrap">
            {filteredTodayAttendance.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "100px", backgroundColor: "#ffedd5", color: "#ea580c", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                  <ClipboardCheck size={22} />
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                  {todayAttendanceList.length === 0 ? "No Attendance Marked Yet Today" : "No Attendance Matching Selected Filters"}
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", maxWidth: "420px", marginInline: "auto" }}>
                  {todayAttendanceList.length === 0 
                    ? "When site engineers check in via the mobile or web portal with GPS verification and photo proof, their records will sync here in real-time."
                    : "Try clearing search keywords or site filters to view all recorded attendance for today."}
                </p>
                {todayAttendanceList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceSearchQuery("");
                      setAttendanceSiteFilter("");
                      setAttendanceStatusFilter("all");
                    }}
                    className="erp-btn-secondary"
                    style={{ marginTop: "12px", fontSize: "11.5px", padding: "5px 12px" }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="admin-attendance-table">
                <colgroup>
                  <col className="col-att-engineer" />
                  <col className="col-att-site" />
                  <col className="col-att-in" />
                  <col className="col-att-out" />
                  <col className="col-att-gps" />
                  <col className="col-att-photo" />
                  <col className="col-att-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-att-engineer">Engineer</th>
                    <th className="col-att-site">Assigned Site</th>
                    <th className="col-att-in">Check-In Time</th>
                    <th className="col-att-out">Check-Out / Status</th>
                    <th className="col-att-gps">Location & Geofence</th>
                    <th className="col-att-photo">Photo Proof</th>
                    <th className="col-att-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTodayAttendance.map((rec) => {
                    const hasDistance = rec.distance !== null && rec.distance !== undefined;
                    const isOnSiteGeofence = hasDistance && rec.distance <= 150;

                    return (
                      <tr key={rec.id}>
                        {/* Engineer Info */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {rec.engineerAvatar ? (
                              <img 
                                src={rec.engineerAvatar} 
                                alt={rec.engineerName} 
                                className="admin-attendance-avatar"
                              />
                            ) : (
                              <div className="admin-attendance-avatar">
                                {(rec.engineerName || "E").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>
                                {rec.engineerName}
                              </strong>
                              <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block" }}>
                                {rec.engineerPhone || rec.engineerEmail || "Site Engineer"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Site */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Building2 size={14} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
                            <div>
                              <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>
                                {rec.siteName}
                              </strong>
                              {rec.clientName && (
                                <span style={{ fontSize: "10.5px", color: "var(--primary-600)", display: "block" }}>
                                  Client: {rec.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Check-In Time */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
                            <div>
                              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#15803d", display: "block" }}>
                                {rec.checkInTimeFormatted}
                              </span>
                              <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                                Checked In
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Check-Out / Active Status */}
                        <td>
                          {rec.isCheckedOut ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <CheckCircle2 size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
                              <div>
                                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#1d4ed8", display: "block" }}>
                                  {rec.checkOutTimeFormatted || "Completed"}
                                </span>
                                <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                                  Checked Out
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "5px",
                              backgroundColor: "#f0fdf4", 
                              color: "#16a34a", 
                              border: "1px solid #bbf7d0", 
                              padding: "3px 8px", 
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700"
                            }}>
                              <span style={{ width: "6px", height: "6px", backgroundColor: "#22c55e", borderRadius: "50%" }} />
                              Active On-Site
                            </span>
                          )}
                        </td>

                        {/* Location & Geofence Details */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                              <span className="admin-attendance-gps-badge">
                                <MapPin size={11} />
                                {rec.latitude && rec.longitude 
                                  ? `${Number(rec.latitude).toFixed(4)}, ${Number(rec.longitude).toFixed(4)}`
                                  : "GPS Logged"}
                              </span>

                              {hasDistance && (
                                <span className={`admin-attendance-distance-badge ${isOnSiteGeofence ? "on-site" : "off-site"}`}>
                                  <Navigation size={10} />
                                  {rec.distance < 1000 
                                    ? `${Math.round(rec.distance)}m from site` 
                                    : `${(rec.distance / 1000).toFixed(1)}km from site`}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={rec.addressDisplay}>
                              {rec.addressDisplay}
                            </span>
                          </div>
                        </td>

                        {/* Photo Proof */}
                        <td style={{ textAlign: "center" }}>
                          {rec.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedInspectRecord(rec)}
                              className="admin-attendance-thumb-btn"
                              title="Click to view full photo verification"
                            >
                              <img 
                                src={rec.photoUrl} 
                                alt="Check-in Selfie" 
                                className="admin-attendance-thumb-img"
                              />
                              <div className="admin-attendance-thumb-overlay">
                                <Eye size={12} />
                              </div>
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                              No Photo
                            </span>
                          )}
                        </td>

                        {/* Action: Inspect */}
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedInspectRecord(rec)}
                            className="erp-btn-secondary"
                            style={{ padding: "4px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Eye size={12} />
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── 4. FOURTH ROW: ACTIVE PROJECTS TABLE + UPCOMING DEADLINES ── */}
        <div className="admin-bottom-grid">
          
          {/* ACTIVE PROJECTS TABLE */}
          <div className="admin-table-card">
            <div className="admin-table-header">
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Active Projects Overview</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Detailed site progress, supervision, and daily costs</p>
              </div>
              <Link to="/admin/sites" style={{ fontSize: "12px", fontWeight: "700", color: "var(--brand-orange)", textDecoration: "none" }}>
                View All ({sites.length}) →
              </Link>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-table">
                <colgroup>
                  <col className="col-site" />
                  <col className="col-engineer" />
                  <col className="col-progress" />
                  <col className="col-workers" />
                  <col className="col-expense" />
                  <col className="col-status" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-site">Site Name</th>
                    <th className="col-engineer">Engineer</th>
                    <th className="col-progress">Progress</th>
                    <th className="col-workers">Workers</th>
                    <th className="col-expense">Today's Expense</th>
                    <th className="col-status">Status</th>
                    <th className="col-action">View</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="erp-empty-state">
                          <div className="erp-empty-icon"><Building2 size={22} /></div>
                          <span style={{ fontSize: "13px", fontWeight: "600" }}>No active construction sites registered.</span>
                          <Link to="/admin/sites" className="erp-btn-primary" style={{ marginTop: "4px" }}>+ Add Site</Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sites.map(site => {
                      const progVal = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0));
                      
                      // Engineer name lookup
                      const assignedEngNames = (site.assignedEngineers || []).map(uid => {
                        const e = engineers.find(eng => eng.id === uid);
                        return e ? e.fullName : "Engineer";
                      });

                      // Calculate site's today expense
                      const siteExpenseToday = rawExpenses
                        .filter(e => e.siteId === site.id && (todayDateKeys.includes(e.date) || (e.createdAt?.seconds && todayDateKeys.includes(new Date(e.createdAt.seconds * 1000).toISOString().split("T")[0]))))
                        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                      // Count workers at this site today
                      const siteWorkerCount = todayAttendanceList.filter(a => a.resolvedSiteId === site.id).length;

                      return (
                        <tr key={site.id}>
                          <td className="col-site">
                            <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block", lineHeight: "1.3" }}>{site.siteName}</strong>
                            <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {site.clientName || site.location || "Site Project"}
                            </span>
                          </td>
                          <td className="col-engineer">
                            {assignedEngNames.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {assignedEngNames.map((name, idx) => (
                                  <span key={idx} style={{ fontSize: "10.5px", fontWeight: "700", backgroundColor: "#f1f5f9", color: "var(--primary-800)", padding: "2px 6px", borderRadius: "4px" }}>
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Unassigned</span>
                            )}
                          </td>
                          <td className="col-progress">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                                <div style={{ width: `${progVal}%`, height: "100%", backgroundColor: progVal >= 80 ? "#16a34a" : (progVal >= 40 ? "#f97316" : "#ea580c"), borderRadius: "100px" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-950)", minWidth: "28px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {progVal}%
                              </span>
                            </div>
                          </td>
                          <td className="col-workers" style={{ fontSize: "12px", color: "var(--primary-800)", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                            {siteWorkerCount > 0 ? `${siteWorkerCount} Eng Present` : "--"}
                          </td>
                          <td className="col-expense" style={{ fontSize: "12px", color: "var(--primary-950)", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                            {siteExpenseToday > 0 ? `₹${siteExpenseToday.toLocaleString()}` : "₹0"}
                          </td>
                          <td className="col-status">
                            <Badge status={site.status || "active"} />
                          </td>
                          <td className="col-action">
                            <Link to="/admin/sites" className="erp-btn-secondary" style={{ padding: "4px 10px", fontSize: "11px" }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* UPCOMING DEADLINES CARD */}
          <div className="admin-deadlines-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <Calendar size={16} style={{ color: "var(--brand-orange)" }} />
                Upcoming Deadlines
              </h3>
              <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: "#fff7ed", color: "#f97316", padding: "2px 8px", borderRadius: "100px" }}>
                Schedule
              </span>
            </div>

            <div className="admin-deadlines-list">
              {upcomingDeadlines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--primary-600)" }}>No deadlines configured.</p>
                </div>
              ) : (
                upcomingDeadlines.map(site => (
                  <div key={site.id} className="admin-deadline-item">
                    <div className="admin-deadline-info">
                      <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {site.siteName}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Client: {site.clientName || "Internal"}
                      </span>
                    </div>
                    <div className="admin-deadline-meta">
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#c2410c", fontFamily: "var(--font-family-mono, monospace)" }}>
                        {site.expectedEndDate || site.startDate || "TBD"}
                      </span>
                      <Badge status={site.status || "active"} style={{ fontSize: "10px", padding: "1px 6px" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── ATTENDANCE VERIFICATION & PHOTO INSPECTION MODAL ── */}
      <Modal
        isOpen={Boolean(selectedInspectRecord)}
        onClose={() => setSelectedInspectRecord(null)}
        title={selectedInspectRecord ? `Attendance Proof: ${selectedInspectRecord.engineerName}` : "Attendance Verification"}
        maxWidth="680px"
      >
        {selectedInspectRecord && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="admin-attendance-inspect-grid">
              
              {/* Photo Box */}
              <div className="admin-attendance-inspect-photo-box">
                {selectedInspectRecord.photoUrl ? (
                  <img 
                    src={selectedInspectRecord.photoUrl} 
                    alt="Engineer Check-in" 
                    className="admin-attendance-inspect-photo"
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#94a3b8" }}>
                    <HardHat size={36} style={{ marginBottom: "6px" }} />
                    <span style={{ fontSize: "11px", display: "block" }}>No photo proof</span>
                  </div>
                )}
              </div>

              {/* Details List */}
              <div className="admin-attendance-inspect-details">
                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Site Engineer</span>
                  <span className="admin-attendance-inspect-val" style={{ fontSize: "14px", fontWeight: "800" }}>
                    {selectedInspectRecord.engineerName}
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    {selectedInspectRecord.engineerEmail} {selectedInspectRecord.engineerPhone ? `• ${selectedInspectRecord.engineerPhone}` : ""}
                  </span>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Assigned Site</span>
                  <span className="admin-attendance-inspect-val" style={{ color: "var(--brand-orange)" }}>
                    {selectedInspectRecord.siteName}
                  </span>
                  {selectedInspectRecord.clientName && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Client: {selectedInspectRecord.clientName}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="admin-attendance-inspect-row">
                    <span className="admin-attendance-inspect-label">Check-In Time</span>
                    <span className="admin-attendance-inspect-val" style={{ color: "#16a34a" }}>
                      {selectedInspectRecord.checkInTimeFormatted}
                    </span>
                  </div>
                  <div className="admin-attendance-inspect-row">
                    <span className="admin-attendance-inspect-label">Check-Out Time</span>
                    <span className="admin-attendance-inspect-val" style={{ color: selectedInspectRecord.isCheckedOut ? "#2563eb" : "#f97316" }}>
                      {selectedInspectRecord.checkOutTimeFormatted || "Active On-Site"}
                    </span>
                  </div>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">GPS Geofence Distance</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    {selectedInspectRecord.distance !== null && selectedInspectRecord.distance !== undefined ? (
                      <span className={`admin-attendance-distance-badge ${selectedInspectRecord.distance <= 150 ? "on-site" : "off-site"}`}>
                        <Navigation size={11} />
                        {selectedInspectRecord.distance < 1000 
                          ? `${Math.round(selectedInspectRecord.distance)} meters from site boundary` 
                          : `${(selectedInspectRecord.distance / 1000).toFixed(2)} km from site`}
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Standard GPS Logged</span>
                    )}

                    <span className="admin-attendance-gps-badge">
                      <ShieldCheck size={11} />
                      Verified
                    </span>
                  </div>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Captured Location & Address</span>
                  <span className="admin-attendance-inspect-val" style={{ fontSize: "12px", lineHeight: "1.4" }}>
                    {selectedInspectRecord.addressDisplay}
                  </span>
                </div>
              </div>

            </div>

            {/* Check-Out Photo Preview if present */}
            {selectedInspectRecord.checkOutPhotoUrl && (
              <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span className="admin-attendance-inspect-label" style={{ display: "block", marginBottom: "8px" }}>
                  Check-Out Verification Photo
                </span>
                <div style={{ width: "100px", height: "100px", borderRadius: "6px", overflow: "hidden" }}>
                  <img 
                    src={selectedInspectRecord.checkOutPhotoUrl} 
                    alt="Check-out proof" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              {selectedInspectRecord.latitude && selectedInspectRecord.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${selectedInspectRecord.latitude},${selectedInspectRecord.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="erp-btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                >
                  <MapPin size={14} style={{ color: "#0284c7" }} />
                  Open in Google Maps
                  <ExternalLink size={12} />
                </a>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedInspectRecord(null)}
                className="erp-btn-primary"
                style={{ padding: "6px 18px", fontSize: "12.5px" }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Loading show={loading} text="Loading Construction ERP..." />
    </Layout>
  );
}

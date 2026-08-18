import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import { useAuth } from "../context/AuthContext";
import { onSnapshot, collection, query, where, doc } from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import {
  getLabourMaster,
  subscribeAllLabourAttendance,
  subscribeAllEngineerAttendance,
  subscribeAllEngineerLeaves,
  subscribePayrollStatuses,
  subscribeGeneralExpenses
} from "../services/firebaseService";
import {
  calculatePlannedProgress,
  getSiteFinancials,
  isSiteDelayed
} from "../services/businessLogic";
import { 
  Building2, 
  Users, 
  MapPin, 
  ClipboardCheck, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  Printer, 
  DollarSign, 
  Download, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Eye,
  ChevronRight,
  TrendingDown,
  PieChart,
  BarChart,
  LineChart,
  Grid,
  FileText,
  Package
} from "lucide-react";
import { Link } from "react-router-dom";

// Universal date string normalizer (handles strings, numbers, Date objects, and Firestore Timestamps)
const normalizeDateStr = (dateVal) => {
  if (dateVal === null || dateVal === undefined) return "";
  if (typeof dateVal === "string") return dateVal;
  if (typeof dateVal === "number") return new Date(dateVal).toISOString().split("T")[0];
  if (dateVal instanceof Date) return dateVal.toISOString().split("T")[0];
  if (typeof dateVal === "object") {
    if (typeof dateVal.toDate === "function") {
      try {
        return dateVal.toDate().toISOString().split("T")[0];
      } catch (e) {
        return "";
      }
    }
    if (typeof dateVal.seconds === "number") {
      return new Date(dateVal.seconds * 1000).toISOString().split("T")[0];
    }
  }
};

// Universal DD-MM-YYYY date formatter
const formatDDMMYYYY = (dateVal) => {
  if (dateVal === null || dateVal === undefined || dateVal === "") return "";
  const cleanStr = normalizeDateStr(dateVal);
  if (!cleanStr) return "";
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    // If format is YYYY-MM-DD
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    }
    // If format is DD-MM-YYYY
    if (parts[2].length === 4) {
      return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
    }
  }
  return cleanStr;
};

// Safe JSX child renderer to prevent "Objects are not valid as a React child" errors
const safeRender = (val, fallback = "--") => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return val;
  }
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      try {
        return val.toDate().toLocaleDateString();
      } catch (e) {
        return fallback;
      }
    }
    if (typeof val.seconds === "number") {
      return new Date(val.seconds * 1000).toLocaleDateString();
    }
    if (val.name) return String(val.name);
    if (val.label) return String(val.label);
    if (val.title) return String(val.title);
    return fallback;
  }
  return String(val);
};

// ==========================================================================
// SVG CHART COMPONENTS (No external library dependencies)
// ==========================================================================

// Donut Chart Component
function DonutChart({ data }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  let accumulatedAngle = 0;
  
  if (total === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px", color: "var(--text-muted)", fontSize: "13px" }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "16px", padding: "12px 0" }}>
      <svg width="160" height="160" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
        {data.map((slice, index) => {
          const percentage = slice.value / total;
          const strokeLength = percentage * 2 * Math.PI * 45;
          const strokeOffset = (1 - accumulatedAngle) * 2 * Math.PI * 45;
          accumulatedAngle += percentage;
          
          return (
            <circle
              key={index}
              cx="60"
              cy="60"
              r="45"
              fill="transparent"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${strokeLength} 283`}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          );
        })}
        <circle cx="60" cy="60" r="32" fill="#ffffff" />
        <text x="60" y="62" textAnchor="middle" style={{ fontSize: "9px", fontWeight: "800", fill: "var(--primary-900)" }}>
          ₹{(total / 100000).toFixed(1)}L
        </text>
        <text x="60" y="72" textAnchor="middle" style={{ fontSize: "6.5px", fontWeight: "600", fill: "var(--text-muted)", textTransform: "uppercase" }}>
          Expenses
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {data.map((slice, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: slice.color }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)" }}>
                {slice.name}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                ₹{(slice.value / 100000).toFixed(2)} Lakhs ({((slice.value / total) * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Side-by-side Bar Chart Component (Budget vs Spent)
function BarChartComponent({ data }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.budget, d.expense)), 100000);
  
  if (data.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "240px", color: "var(--text-muted)", fontSize: "13px" }}>
        No site comparison data
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {data.map((item, index) => {
          const budgetPercent = (item.budget / maxVal) * 100;
          const expensePercent = (item.expense / maxVal) * 100;
          return (
            <div key={index} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-950)" }}>
                  {item.label}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Spent: ₹{(item.expense / 100000).toFixed(1)}L / Budget: ₹{(item.budget / 100000).toFixed(1)}L
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                {/* Budget Bar */}
                <div style={{ height: "10px", width: "100%", backgroundColor: "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${budgetPercent}%`, backgroundColor: "#94a3b8", borderRadius: "5px" }} />
                </div>
                {/* Expense Bar */}
                <div style={{ height: "10px", width: "100%", backgroundColor: "#fee2e2", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${expensePercent}%`, backgroundColor: item.expense > item.budget ? "var(--danger-500)" : "var(--primary-600)", borderRadius: "5px" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "16px", fontSize: "11px", color: "var(--text-muted)", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", backgroundColor: "#94a3b8", borderRadius: "2px" }} />
          <span>Project Budget</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", backgroundColor: "var(--primary-600)", borderRadius: "2px" }} />
          <span>Actual Expenses</span>
        </div>
      </div>
    </div>
  );
}

// Line Chart Component (Monthly Expense Trend)
function LineChartComponent({ data }) {
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 20;

  const maxVal = Math.max(...data.map(d => d.amount), 50000);
  
  if (data.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px", color: "var(--text-muted)", fontSize: "13px" }}>
        No monthly historical data
      </div>
    );
  }

  // Calculate points
  const points = data.map((item, index) => {
    const x = padding + (index * (chartWidth - 2 * padding)) / Math.max(1, data.length - 1);
    const y = chartHeight - padding - (item.amount / maxVal) * (chartHeight - 2 * padding);
    return { x, y, label: item.month, amount: item.amount };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0" }}>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
        <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#cbd5e1" strokeWidth="1.5" />
        
        {/* Trend Polyline */}
        {points.length > 1 && (
          <polyline
            fill="transparent"
            stroke="var(--primary-600)"
            strokeWidth="3"
            points={polylinePoints}
          />
        )}

        {/* Data points */}
        {points.map((p, index) => (
          <g key={index}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill="#ffffff"
              stroke="var(--primary-600)"
              strokeWidth="2.5"
            />
            {/* Amount overlay text */}
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              style={{ fontSize: "8px", fontWeight: "700", fill: "var(--primary-900)" }}
            >
              ₹{(p.amount / 1000).toFixed(0)}k
            </text>
            {/* Month label */}
            <text
              x={p.x}
              y={chartHeight - 4}
              textAnchor="middle"
              style={{ fontSize: "8.5px", fontWeight: "600", fill: "var(--text-muted)" }}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ==========================================================================
// CENTRAL REPORTS DASHBOARD PAGE
// ==========================================================================
export default function ReportsDashboard() {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role || "admin";
  const isSuperAdmin = userRole === "super_admin" || userRole === "superadmin";

  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Datasets state
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labourHistoryMap, setLaborHistoryMap] = useState({});
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [labourMaster, setLabourMaster] = useState({});
  const [allDprs, setAllDprs] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);

  // New states for complete reporting
  const [teams, setTeams] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [labourAttendance, setLabourAttendance] = useState([]);
  const [engineerAttendance, setEngineerAttendance] = useState([]);
  const [engineerLeaves, setEngineerLeaves] = useState([]);
  const [payrollStatuses, setPayrollStatuses] = useState({});

  // Navigation tabs: overview, attendance_report, labour_report, salary_report, expense_report, budget_report
  const [activeTab, setActiveTab] = useState("overview");

  // PDF Template selection state
  const [reportTemplate, setReportTemplate] = useState("daily_attendance");

  // Filters State
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [filterEngineerId, setFilterEngineerId] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMonthVal, setFilterMonthVal] = useState("all");
  const [filterYearVal, setFilterYearVal] = useState("all");

  // Enforce role-based access to sites
  const userSites = useMemo(() => {
    if (isSuperAdmin) return sites;
    if (userRole === "admin") {
      const adminId = userProfile?.uid || userProfile?.id || null;
      return sites.filter(s => s.createdByAdmin === adminId);
    }
    if (userRole === "site_engineer") {
      const assigned = userProfile?.assignedSites || [];
      return sites.filter(s => assigned.includes(s.id));
    }
    return [];
  }, [sites, userRole, userProfile, isSuperAdmin]);

  const allowedSiteIds = useMemo(() => {
    return new Set(userSites.map(s => s.id));
  }, [userSites]);

  useEffect(() => {
    const db = getFirebaseDb();
    setLoading(true);

    let sitesLoaded = false;
    let teamsLoaded = false;
    let engineersLoaded = false;

    const checkLoadingComplete = () => {
      if (sitesLoaded && teamsLoaded && engineersLoaded) {
        setLoading(false);
      }
    };

    // 1. Sites
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSites(list);
      sitesLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Sites load error:", err);
      sitesLoaded = true;
      checkLoadingComplete();
    });

    // 2. Teams
    const unsubTeams = onSnapshot(collection(db, "labourTeams"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTeams(list);
      teamsLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Teams load error:", err);
      teamsLoaded = true;
      checkLoadingComplete();
    });

    // 3. Site Engineers
    const unsubEngineers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === "site_engineer") {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setEngineers(list);
      engineersLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Engineers load error:", err);
      engineersLoaded = true;
      checkLoadingComplete();
    });

    // 4. Materials
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id.startsWith("lock_") || docSnap.id === "__material_master__" || data.type === "material_lock" || data.type === "labour_attendance_lock") {
          return;
        }
        list.push({ id: docSnap.id, ...data });
      });
      setMaterials(list);
    });

    // 5. Labour Daily Count (legacy / timeline)
    const unsubLabourCount = onSnapshot(collection(db, "labourDailyCount"), (snapshot) => {
      const map = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const sId = data.siteId;
        if (sId) {
          if (!map[sId]) map[sId] = [];
          map[sId].push({ id: docSnap.id, ...data });
        }
      });
      setLaborHistoryMap(map);
    });

    // 6. Reports / DPRs
    const unsubDprs = onSnapshot(collection(db, "reports"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllDprs(list);
    });

    // 7. Approvals
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    });

    // 8. Documents
    const unsubDocs = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    });

    // 9. Labour Payments
    const unsubLabourPayments = onSnapshot(collection(db, "labourPayments"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLabourPayments(list);
    });

    // 10. Labour Attendance (Member-level)
    const unsubLabourAtt = subscribeAllLabourAttendance(setLabourAttendance);

    // 11. Engineer Attendance
    const unsubEngAtt = subscribeAllEngineerAttendance(setEngineerAttendance);

    // 12. Engineer Leaves
    const unsubEngLeaves = subscribeAllEngineerLeaves(setEngineerLeaves);

    // 13. Payroll Statuses
    const unsubPayroll = subscribePayrollStatuses(setPayrollStatuses);

    // 14. General Expenses
    const unsubExpenses = subscribeGeneralExpenses(setGeneralExpenses);

    // Load Labour Master categories
    getLabourMaster().then(master => {
      setLabourMaster(master.categories || {});
    });

    return () => {
      unsubSites();
      unsubTeams();
      unsubEngineers();
      unsubMaterials();
      unsubLabourCount();
      unsubDprs();
      unsubApprovals();
      unsubDocs();
      unsubLabourPayments();
      unsubLabourAtt();
      unsubEngAtt();
      unsubEngLeaves();
      unsubPayroll();
      unsubExpenses();
    };
  }, []);

  // Format Currency
  const formatINR = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Map engineers for quick lookups
  const engineersMap = useMemo(() => {
    const map = {};
    engineers.forEach(eng => {
      map[eng.id] = eng.fullName;
    });
    return map;
  }, [engineers]);

  // Filtered Sites list matching user role scope
  const filteredSites = useMemo(() => {
    return userSites.filter(s => filterSiteId === "all" || s.id === filterSiteId);
  }, [userSites, filterSiteId]);

  // Apply Date Range, Month, and Year Filter helper
  const matchesDateFilters = (dateInput) => {
    const cleanDate = normalizeDateStr(dateInput);
    if (!cleanDate) return false;
    
    // 1. Date Range
    if (filterStartDate && cleanDate < filterStartDate) return false;
    if (filterEndDate && cleanDate > filterEndDate) return false;
    
    // 2. Month
    if (filterMonthVal !== "all") {
      const parts = cleanDate.split("-");
      if (parts[1] !== filterMonthVal) return false;
    }
    
    // 3. Year
    if (filterYearVal !== "all") {
      const parts = cleanDate.split("-");
      if (parts[0] !== filterYearVal) return false;
    }
    
    return true;
  };

  const isWithinDateRange = (dateInput) => {
    return matchesDateFilters(dateInput);
  };

  // Helper date utilities
  const isDateInWeek = (dateInput, anchorInput) => {
    const dateStr = normalizeDateStr(dateInput);
    const anchorStr = normalizeDateStr(anchorInput);
    if (!dateStr || !anchorStr) return false;
    const date = new Date(dateStr);
    const anchor = new Date(anchorStr);
    if (isNaN(date.getTime()) || isNaN(anchor.getTime())) return false;
    
    // Find monday of the anchor week
    const day = anchor.getDay();
    const diff = anchor.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(anchor.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return date >= monday && date <= sunday;
  };

  const isDateInMonth = (dateInput, anchorInput) => {
    const dateStr = normalizeDateStr(dateInput);
    const anchorStr = normalizeDateStr(anchorInput);
    if (!dateStr || !anchorStr) return false;
    return dateStr.substring(0, 7) === anchorStr.substring(0, 7);
  };

  // Site Financials calculations
  const siteFinancialsList = useMemo(() => {
    return filteredSites.map(site => {
      const siteMats = materials.filter(m => m.siteId === site.id);
      const siteLabour = labourHistoryMap[site.id] || [];
      const siteDprs = allDprs.filter(d => d.siteId === site.id);
      
      const financials = getSiteFinancials(
        site,
        siteMats,
        siteLabour,
        siteDprs,
        labourMaster,
        generalExpenses,
        labourPayments
      );

      const plannedProgress = calculatePlannedProgress(site.startDate, site.expectedEndDate);

      return {
        site,
        financials,
        plannedProgress
      };
    });
  }, [filteredSites, materials, labourHistoryMap, allDprs, labourMaster, generalExpenses, labourPayments]);

  // Aggregated Overall Metrics for Management Overview
  const overallMetrics = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let paymentsReceived = 0;
    let pendingAmount = 0;
    let progressSum = 0;

    let activeCount = 0;
    let completedCount = 0;
    let delayedCount = 0;

    siteFinancialsList.forEach(({ site, financials }) => {
      totalBudget += financials.budget;
      totalSpent += financials.totalSpent;
      paymentsReceived += financials.paymentsReceived;
      pendingAmount += financials.pendingAmount;
      progressSum += financials.progressPercent;

      if (site.status === "Completed") {
        completedCount++;
      } else if (site.status !== "Planning") {
        activeCount++;
      }

      if (isSiteDelayed(site)) {
        delayedCount++;
      }
    });

    const averageProgress = siteFinancialsList.length > 0 ? Math.round(progressSum / siteFinancialsList.length) : 0;
    const pendingApprovalsCount = approvals.filter(a => (a.status || "").toLowerCase() === "pending").length;

    return {
      totalSites: siteFinancialsList.length,
      activeSites: activeCount,
      completedSites: completedCount,
      delayedSites: delayedCount,
      overallProgress: averageProgress,
      totalBudget,
      totalExpenses: totalSpent,
      pendingPayments: pendingAmount,
      paymentsReceived,
      pendingApprovals: pendingApprovalsCount
    };
  }, [siteFinancialsList, approvals]);

  // Dedicated Management Overview Data computation (Single Site or Portfolio)
  const managementOverviewData = useMemo(() => {
    if (filterSiteId !== "all") {
      const site = sites.find(s => s.id === filterSiteId) || filteredSites[0] || {};
      const siteId = site.id || filterSiteId;
      const siteName = site.siteName || "Selected Project";
      const siteStatus = site.status || "Active";

      // Resolve assigned engineers
      let assignedEngineers = "Not Assigned";
      const assignedIds = site.assignedEngineers || [];
      const assignedNames = assignedIds.map(id => engineersMap[id]).filter(Boolean);
      if (assignedNames.length > 0) {
        assignedEngineers = assignedNames.join(", ");
      } else {
        const matchingEngs = engineers.filter(e => e.assignedSites && e.assignedSites.includes(siteId)).map(e => e.fullName).filter(Boolean);
        if (matchingEngs.length > 0) {
          assignedEngineers = matchingEngs.join(", ");
        }
      }

      // Calculate Progress from canonical DPR records or site
      const siteDprs = allDprs.filter(d => d.siteId === siteId);
      let progressPercent = 0;
      if (site.status === "Completed") {
        progressPercent = 100;
      } else if (siteDprs.length > 0) {
        const sortedDprs = [...siteDprs].sort((a, b) => {
          const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tB - tA;
        });
        const rawProg = sortedDprs[0].progress || sortedDprs[0].completionPercent || "0";
        progressPercent = Math.min(100, Math.max(0, Number(rawProg.toString().replace(/%/g, '')) || 0));
      } else if (site.progress !== undefined) {
        progressPercent = Math.min(100, Math.max(0, Number(site.progress.toString().replace(/%/g, '')) || 0));
      }

      // Financials
      const projectValue = Number(site.budget || site.totalBudget || site.contractValue) || 0;
      
      const siteMats = materials.filter(m => m.siteId === siteId);
      const siteLabour = labourHistoryMap[siteId] || [];
      const siteFin = getSiteFinancials(site, siteMats, siteLabour, siteDprs, labourMaster, generalExpenses, labourPayments);
      const totalCostSoFar = siteFin.totalSpent;
      const remainingBudget = projectValue - totalCostSoFar;

      // Timeline & Milestones
      const startDate = site.startDate ? formatDDMMYYYY(site.startDate) : "Not Configured";
      const expectedCompletion = (site.expectedEndDate || site.endDate || site.completionDate) 
        ? formatDDMMYYYY(site.expectedEndDate || site.endDate || site.completionDate) 
        : "Not Configured";
      
      const plannedProgress = calculatePlannedProgress(site.startDate, site.expectedEndDate || site.endDate);
      const isDelayed = site.status !== "Completed" && (isSiteDelayed(site) || (plannedProgress > 0 && progressPercent < plannedProgress - 5));
      const milestonesDelayed = isDelayed ? 1 : 0;
      const timelineStatus = site.status === "Completed" ? "Completed" : (isDelayed ? "Delayed" : "On Schedule");

      // Approvals for this site
      const sitePendingApprovals = approvals.filter(a => 
        (a.siteId === siteId || a.site === siteName) && (a.status || "").toLowerCase() === "pending"
      ).length;

      return {
        isSingleSite: true,
        siteName,
        assignedEngineers,
        projectStatus: siteStatus,
        projectProgress: progressPercent,
        milestonesDelayed,
        projectValue,
        totalCostSoFar,
        remainingBudget,
        startDate,
        expectedCompletion,
        timelineStatus,
        plannedProgress,
        pendingApprovals: sitePendingApprovals
      };
    } else {
      // Portfolio (All Sites) Context
      const totalSites = filteredSites.length;
      let totalBudget = 0;
      let totalSpent = 0;
      let progressSum = 0;
      let delayedSitesCount = 0;

      siteFinancialsList.forEach(({ site, financials, plannedProgress }) => {
        totalBudget += financials.budget;
        totalSpent += financials.totalSpent;
        progressSum += financials.progressPercent;
        if (site.status !== "Completed" && (isSiteDelayed(site) || (plannedProgress > 0 && financials.progressPercent < plannedProgress - 5))) {
          delayedSitesCount++;
        }
      });

      const avgProgress = totalSites > 0 ? Math.round(progressSum / totalSites) : 0;
      const pendingApprovalsCount = approvals.filter(a => (a.status || "").toLowerCase() === "pending").length;

      return {
        isSingleSite: false,
        siteName: "All Construction Sites (Portfolio Overview)",
        assignedEngineers: "All Assigned Engineers",
        projectStatus: `${overallMetrics.activeSites} Active, ${overallMetrics.completedSites} Completed`,
        projectProgress: avgProgress,
        milestonesDelayed: delayedSitesCount,
        projectValue: totalBudget,
        totalCostSoFar: totalSpent,
        remainingBudget: totalBudget - totalSpent,
        startDate: "Multi-Project Portfolio",
        expectedCompletion: "Multi-Project Timeline",
        timelineStatus: delayedSitesCount > 0 ? "Delayed" : "On Schedule",
        plannedProgress: avgProgress,
        pendingApprovals: pendingApprovalsCount
      };
    }
  }, [filterSiteId, sites, filteredSites, engineers, engineersMap, allDprs, materials, labourHistoryMap, labourMaster, generalExpenses, labourPayments, approvals, siteFinancialsList, overallMetrics]);

  // Cost analysis stats (Breakdowns & Monthly trends)
  const costAnalysisData = useMemo(() => {
    let materialCost = 0;
    let labourCost = 0;
    let otherCost = 0;

    const monthlyMap = {};

    filteredSites.forEach(site => {
      const siteMats = materials.filter(m => m.siteId === site.id);
      const siteLabour = labourAttendance.filter(l => l.siteId === site.id);
      const siteGenExpenses = generalExpenses.filter(g => g.siteId === site.id);

      // Materials Cost aggregation
      siteMats.forEach(m => {
        if (m.status === "approved" || m.status === "Approved" || m.status === undefined) {
          let cost = Number(m.totalAmount) || (Number(m.quantity) * 500);
          materialCost += cost;
          
          if (m.purchaseDate && isWithinDateRange(m.purchaseDate)) {
            const mKey = m.purchaseDate.substring(0, 7); // YYYY-MM
            monthlyMap[mKey] = (monthlyMap[mKey] || 0) + cost;
          }
        }
      });

      // Labour Cost aggregation
      siteLabour.forEach(l => {
        if (!isWithinDateRange(l.attendanceDate)) return;

        const teamObj = teams.find(t => t.id === l.teamId);
        const categoryObj = teamObj?.categories?.[l.categoryId];
        const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
        const count = Number(l.workerCount) || 1;
        const factor = l.attendanceType === "Half Day" ? 0.5 : 1.0;
        const wages = count * factor * dailyWage;

        labourCost += wages;
        const mKey = l.attendanceDate.substring(0, 7);
        monthlyMap[mKey] = (monthlyMap[mKey] || 0) + wages;
      });

      // General Expenses aggregation
      siteGenExpenses.forEach(g => {
        if (g.status === "Approved" || g.status === "approved") {
          otherCost += g.amount;
          if (g.date && isWithinDateRange(g.date)) {
            const mKey = g.date.substring(0, 7);
            monthlyMap[mKey] = (monthlyMap[mKey] || 0) + g.amount;
          }
        }
      });
    });

    const donutData = [
      { name: "Material Cost", value: materialCost, color: "#f97316" },
      { name: "Labour Cost", value: labourCost, color: "#16a34a" },
      { name: "Other Expenses", value: otherCost, color: "#f59e0b" }
    ];

    // Sorted monthly trend
    const trendData = Object.keys(monthlyMap)
      .sort()
      .slice(-6) // last 6 months
      .map(key => {
        let mLabel = key;
        try {
          const [year, month] = key.split("-").map(Number);
          const dObj = new Date(year, month - 1, 1);
          mLabel = dObj.toLocaleDateString("en-US", { month: "short" });
        } catch(e) {}
        return { month: mLabel, amount: monthlyMap[key] };
      });

    return {
      donutData,
      trendData
    };
  }, [filteredSites, materials, labourAttendance, generalExpenses, teams, filterStartDate, filterEndDate, filterMonthVal, filterYearVal]);

  // Combined site progress updates (Daily, Weekly, Monthly lists)
  const dprsCombinedSorted = useMemo(() => {
    const list = [];
    filteredSites.forEach(site => {
      const siteDprs = allDprs.filter(d => d.siteId === site.id);
      siteDprs.forEach(d => {
        const dDate = d.date || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
        if (isWithinDateRange(dDate)) {
          list.push({
            ...d,
            siteName: site.siteName,
            resolvedDate: dDate
          });
        }
      });
    });
    return list.sort((a, b) => b.resolvedDate.localeCompare(a.resolvedDate));
  }, [filteredSites, allDprs, filterStartDate, filterEndDate, filterMonthVal, filterYearVal]);

  // Dynamic Salary Calculations
  const salaryReportData = useMemo(() => {
    const anchor = filterStartDate || new Date().toISOString().split("T")[0];
    const monthKey = anchor.substring(0, 7); // e.g. "2026-07"
    
    let engineerSalaryTotal = 0;
    let labourSalaryTotal = 0;
    let paidTotal = 0;
    let pendingTotal = 0;

    // 1. Labour Payouts
    labourAttendance.forEach(r => {
      if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
      if (filterTeamId !== "all" && r.teamId !== filterTeamId) return;
      if (!isDateInMonth(r.attendanceDate, anchor)) return;

      // Enforce site engineer project assignment boundary
      if (!allowedSiteIds.has(r.siteId)) return;

      const teamObj = teams.find(t => t.id === r.teamId);
      const categoryObj = teamObj?.categories?.[r.categoryId];
      const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
      const count = Number(r.workerCount) || 1;
      const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
      const wages = count * factor * dailyWage;

      labourSalaryTotal += wages;
    });

    // 2. Site Engineer Salary Payouts
    engineers.forEach(eng => {
      if (filterEngineerId !== "all" && eng.id !== filterEngineerId) return;
      
      // Enforce boundary logic
      const siteBound = eng.assignedSites || [];
      const hasMatch = siteBound.some(sid => allowedSiteIds.has(sid));
      if (!hasMatch && !isSuperAdmin) return;
      if (filterSiteId !== "all" && !siteBound.includes(filterSiteId)) return;

      const monthlySalary = Number(eng.monthlySalary) || Number(eng.salary) || 30000;
      const workingDays = Number(eng.workingDaysPerMonth) || Number(eng.workingDays) || 30;
      const dailySalary = monthlySalary / workingDays;

      const atts = engineerAttendance.filter(a => a.engineerId === eng.id);
      const lvs = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));

      atts.forEach(a => {
        if (isDateInMonth(a.date, anchor)) {
          engineerSalaryTotal += dailySalary;
        }
      });

      lvs.forEach(l => {
        if (l.type === "half_day" && isDateInMonth(l.date, anchor)) {
          engineerSalaryTotal += dailySalary * 0.5;
        }
      });
    });

    // 3. Paid vs Pending Split
    teams.forEach(t => {
      if (filterTeamId !== "all" && t.id !== filterTeamId) return;
      Object.keys(t.categories || {}).forEach(catId => {
        let amount = 0;
        labourAttendance.forEach(r => {
          if (r.teamId === t.id && r.categoryId === catId && isDateInMonth(r.attendanceDate, anchor)) {
            if (!allowedSiteIds.has(r.siteId)) return;
            const teamObj = teams.find(team => team.id === r.teamId);
            const categoryObj = teamObj?.categories?.[r.categoryId];
            const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
            const count = Number(r.workerCount) || 1;
            const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
            amount += count * factor * dailyWage;
          }
        });

        const statusKey = `labour_${t.id}_${catId}_${monthKey}`;
        const record = payrollStatuses[statusKey] || {};
        if (record.status === "Paid") {
          paidTotal += amount;
        } else {
          pendingTotal += amount;
        }
      });
    });

    engineers.forEach(eng => {
      if (filterEngineerId !== "all" && eng.id !== filterEngineerId) return;
      const siteBound = eng.assignedSites || [];
      const hasMatch = siteBound.some(sid => allowedSiteIds.has(sid));
      if (!hasMatch && !isSuperAdmin) return;
      if (filterSiteId !== "all" && !siteBound.includes(filterSiteId)) return;

      let amount = 0;
      const monthlySalary = Number(eng.monthlySalary) || Number(eng.salary) || 30000;
      const workingDays = Number(eng.workingDaysPerMonth) || Number(eng.workingDays) || 30;
      const dailySalary = monthlySalary / workingDays;

      const atts = engineerAttendance.filter(a => a.engineerId === eng.id);
      const lvs = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));

      atts.forEach(a => {
        if (isDateInMonth(a.date, anchor)) {
          amount += dailySalary;
        }
      });

      lvs.forEach(l => {
        if (l.type === "half_day" && isDateInMonth(l.date, anchor)) {
          amount += dailySalary * 0.5;
        }
      });

      const statusKey = `engineer_${eng.id}_${monthKey}`;
      const record = payrollStatuses[statusKey] || {};
      if (record.status === "Paid") {
        paidTotal += amount;
      } else {
        pendingTotal += amount;
      }
    });

    const totalPayroll = engineerSalaryTotal + labourSalaryTotal;

    return {
      engineerSalaryTotal,
      labourSalaryTotal,
      paidTotal,
      pendingTotal,
      totalPayroll
    };
  }, [labourAttendance, engineerAttendance, engineerLeaves, payrollStatuses, teams, engineers, filterStartDate, filterSiteId, filterTeamId, filterEngineerId, allowedSiteIds, isSuperAdmin]);

  // Dynamic Expense Report Data
  const expenseReportData = useMemo(() => {
    let siteExpense = 0;
    let materialExpense = 0;
    let labourExpense = 0;
    let otherExpense = 0;

    materials.forEach(m => {
      if (filterSiteId !== "all" && m.siteId !== filterSiteId) return;
      if (!allowedSiteIds.has(m.siteId)) return;
      if (!matchesDateFilters(m.purchaseDate)) return;
      
      const isApproved = m.status === "approved" || m.status === "Approved" || m.status === undefined;
      if (isApproved) {
        let cost = 0;
        if (m.totalAmount !== undefined && m.totalAmount !== null) {
          cost = Number(m.totalAmount) || 0;
        } else {
          let unitCost = 500;
          if (m.category === "Steel") fillUnitCost = 5000;
          cost = (Number(m.quantity) || 0) * unitCost;
        }
        materialExpense += cost;
      }
    });

    labourAttendance.forEach(r => {
      if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
      if (filterTeamId !== "all" && r.teamId !== filterTeamId) return;
      if (!allowedSiteIds.has(r.siteId)) return;
      if (!matchesDateFilters(r.attendanceDate)) return;

      const teamObj = teams.find(t => t.id === r.teamId);
      const categoryObj = teamObj?.categories?.[r.categoryId];
      const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
      const count = Number(r.workerCount) || 1;
      const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
      
      labourExpense += count * factor * dailyWage;
    });

    generalExpenses.forEach(g => {
      if (filterSiteId !== "all" && g.siteId !== filterSiteId) return;
      if (!allowedSiteIds.has(g.siteId)) return;
      if (!matchesDateFilters(g.date)) return;

      const isApproved = g.status === "Approved" || g.status === "approved";
      if (isApproved) {
        if (g.category === "Site Expense") {
          siteExpense += g.amount;
        } else {
          otherExpense += g.amount;
        }
      }
    });

    const totalExpense = siteExpense + materialExpense + labourExpense + otherExpense;

    return {
      siteExpense,
      materialExpense,
      labourExpense,
      otherExpense,
      totalExpense
    };
  }, [materials, labourAttendance, generalExpenses, teams, filterSiteId, filterTeamId, filterStartDate, filterEndDate, filterMonthVal, filterYearVal, allowedSiteIds]);

  // Dynamic Budget Report Data
  const budgetReportData = useMemo(() => {
    let budgetTotal = 0;
    let expenseTotal = 0;

    filteredSites.forEach(site => {
      budgetTotal += Number(site.budget) || 0;
      
      const siteExpenses = generalExpenses.filter(e => e.siteId === site.id && (e.status === "Approved" || e.status === "approved"));
      const totalExpense = siteExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      expenseTotal += totalExpense;
    });

    const remainingBudget = budgetTotal - expenseTotal;
    const usagePercent = budgetTotal > 0 ? (expenseTotal / budgetTotal) * 100 : 0;

    return {
      budget: budgetTotal,
      expense: expenseTotal,
      remainingBudget,
      usagePercent
    };
  }, [filteredSites, generalExpenses]);

  // Calculate Labour Date Range Report Data from canonical production records (labourAttendance state)
  const labourDateRangeReportData = useMemo(() => {
    // 1. Deduplicate by doc ID to prevent double counting
    const uniqueRecordsMap = new Map();
    labourAttendance.forEach(r => {
      if (!r || !r.id) return;
      if (uniqueRecordsMap.has(r.id)) return;
      uniqueRecordsMap.set(r.id, r);
    });

    // 2. Filter records by Site and Date Range only (automatic team and engineer resolution)
    const filteredRecords = Array.from(uniqueRecordsMap.values()).filter((r) => {
      if (filterSiteId !== "all" && r.siteId !== filterSiteId) return false;
      if (!allowedSiteIds.has(r.siteId)) return false;

      const rDate = normalizeDateStr(r.attendanceDate || r.date || "");
      if (!rDate) return false;
      if (filterStartDate && rDate < filterStartDate) return false;
      if (filterEndDate && rDate > filterEndDate) return false;

      return true;
    });

    // 3. Group by Date -> Team -> Categories
    const dateMap = {};

    filteredRecords.forEach((r) => {
      const rDate = normalizeDateStr(r.attendanceDate || r.date || "");
      if (!dateMap[rDate]) {
        dateMap[rDate] = {
          dateStr: rDate,
          teamMap: {},
          dailyWorkers: 0,
          dailyCost: 0
        };
      }

      // Resolve team
      const teamObj = teams.find(t => t.id === r.teamId);
      const teamId = r.teamId || "default_team";
      const teamName = teamObj?.teamName || r.teamName || "General Labour";

      // Resolve engineer
      let engineerName = "";
      const creatorId = r.createdBy || r.markedBy;
      if (creatorId && engineersMap[creatorId]) {
        engineerName = engineersMap[creatorId];
      } else {
        const siteObj = sites.find(s => s.id === r.siteId);
        const assignedIds = siteObj?.assignedEngineers || [];
        const assignedNames = assignedIds.map(id => engineersMap[id]).filter(Boolean);
        if (assignedNames.length > 0) {
          engineerName = assignedNames.join(", ");
        } else {
          const matchingEngs = engineers.filter(e => e.assignedSites && e.assignedSites.includes(r.siteId)).map(e => e.fullName).filter(Boolean);
          engineerName = matchingEngs.length > 0 ? matchingEngs.join(", ") : "Site Engineer";
        }
      }

      if (!dateMap[rDate].teamMap[teamId]) {
        dateMap[rDate].teamMap[teamId] = {
          teamId,
          teamName,
          engineerName,
          categories: []
        };
      }

      // Resolve Category Name
      let catName = r.categoryName;
      if (!catName && teamObj?.categories) {
        if (Array.isArray(teamObj.categories)) {
          const c = teamObj.categories.find(x => x.id === r.categoryId);
          if (c) catName = c.name;
        } else if (teamObj.categories[r.categoryId]) {
          catName = teamObj.categories[r.categoryId].name;
        }
      }
      if (!catName && labourMaster[r.categoryId]) {
        catName = labourMaster[r.categoryId].name;
      }
      if (!catName) {
        catName = r.categoryId || "Worker";
      }

      // Resolve Daily Wage from canonical config
      let dailyWage = Number(r.dailyWage !== undefined ? r.dailyWage : (r.wage !== undefined ? r.wage : 0));
      if (!dailyWage && teamObj?.categories) {
        if (Array.isArray(teamObj.categories)) {
          const c = teamObj.categories.find(x => x.id === r.categoryId);
          if (c) dailyWage = Number(c.baseWage || c.wage || c.salaryAmount || 0);
        } else if (teamObj.categories[r.categoryId]) {
          dailyWage = Number(teamObj.categories[r.categoryId].baseWage || teamObj.categories[r.categoryId].wage || 0);
        }
      }
      if (!dailyWage && labourMaster[r.categoryId]) {
        dailyWage = Number(labourMaster[r.categoryId].dailyWage || 0);
      }

      const workerCount = Number(r.workerCount) || (r.attendanceValue !== undefined ? Number(r.attendanceValue) : 1);
      const customWorkUnits = Number(
        r.customWorkUnits !== undefined 
          ? r.customWorkUnits 
          : (r.units !== undefined 
              ? r.units 
              : (r.attendanceType === "Half Day" ? 0.5 : 1.0))
      ) || 1.0;

      const categoryTotal = Number(r.calculatedAmount) || Number(r.totalAmount) || (workerCount * customWorkUnits * dailyWage);

      dateMap[rDate].teamMap[teamId].categories.push({
        recordId: r.id,
        categoryId: r.categoryId,
        categoryName: catName,
        workerCount,
        customWorkUnits,
        dailyWage,
        categoryTotal
      });

      dateMap[rDate].dailyWorkers += workerCount;
      dateMap[rDate].dailyCost += categoryTotal;
    });

    // 4. Sort dates chronologically
    const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

    let grandTotalWorkers = 0;
    let grandTotalLabourCost = 0;

    const dailySections = sortedDates.map(dateStr => {
      const d = dateMap[dateStr];
      const teamsList = Object.values(d.teamMap).map(t => {
        t.categories.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
        const teamWorkers = t.categories.reduce((sum, c) => sum + c.workerCount, 0);
        const teamCost = t.categories.reduce((sum, c) => sum + c.categoryTotal, 0);
        return {
          ...t,
          teamWorkers,
          teamCost
        };
      });

      grandTotalWorkers += d.dailyWorkers;
      grandTotalLabourCost += d.dailyCost;

      return {
        dateStr,
        teams: teamsList,
        dailyWorkers: d.dailyWorkers,
        dailyCost: d.dailyCost
      };
    });

    // Resolve site name display & assigned engineers
    let siteNameDisplay = "All Sites";
    let assignedEngineersDisplay = "";
    if (filterSiteId !== "all") {
      const selectedSite = sites.find(s => s.id === filterSiteId);
      siteNameDisplay = selectedSite?.siteName || "Selected Site";
      const assignedEngIds = selectedSite?.assignedEngineers || [];
      const names = assignedEngIds.map(id => engineersMap[id]).filter(Boolean);
      if (names.length > 0) {
        assignedEngineersDisplay = names.join(", ");
      }
    }

    return {
      dailySections,
      totalWorkingDays: dailySections.length,
      grandTotalWorkers,
      grandTotalLabourCost,
      siteNameDisplay,
      assignedEngineersDisplay,
      startDate: filterStartDate,
      endDate: filterEndDate
    };
  }, [labourAttendance, filterSiteId, allowedSiteIds, filterTeamId, filterEngineerId, filterStartDate, filterEndDate, sites, teams, engineers, engineersMap, labourMaster]);

  // Calculate Material Date Range Report Data from canonical production records (materials state)
  const materialDateRangeReportData = useMemo(() => {
    // 1. Deduplicate by doc ID to prevent double counting
    const uniqueRecordsMap = new Map();
    materials.forEach(m => {
      if (!m || !m.id) return;
      if (m.id.startsWith("lock_") || m.id === "__material_master__" || m.type === "material_lock" || m.type === "labour_attendance_lock") {
        return;
      }
      if (uniqueRecordsMap.has(m.id)) return;
      uniqueRecordsMap.set(m.id, m);
    });

    // 2. Filter records by Site and Date Range only (automatic team and engineer resolution)
    const filteredRecords = Array.from(uniqueRecordsMap.values()).filter((m) => {
      if (filterSiteId !== "all" && m.siteId !== filterSiteId) return false;
      if (!allowedSiteIds.has(m.siteId)) return false;

      const mDate = normalizeDateStr(m.purchaseDate || m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      if (!mDate) return false;
      if (filterStartDate && mDate < filterStartDate) return false;
      if (filterEndDate && mDate > filterEndDate) return false;

      return true;
    });

    // 3. Group by Date -> Team / Supplier -> Materials
    const dateMap = {};
    const materialSummaryMap = {};

    filteredRecords.forEach((m) => {
      const mDate = normalizeDateStr(m.purchaseDate || m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      if (!dateMap[mDate]) {
        dateMap[mDate] = {
          dateStr: mDate,
          teamMap: {},
          dailyItems: 0,
          dailyCost: 0
        };
      }

      // Resolve team / supplier
      const teamId = m.teamId || m.supplierName || m.category || "general_material";
      const teamName = m.teamName || m.category || m.supplierName || "General Materials";

      // Resolve engineer
      let engineerName = "";
      const creatorId = m.engineerId || m.createdBy || m.markedBy;
      if (creatorId && engineersMap[creatorId]) {
        engineerName = engineersMap[creatorId];
      } else {
        const siteObj = sites.find(s => s.id === m.siteId);
        const assignedIds = siteObj?.assignedEngineers || [];
        const assignedNames = assignedIds.map(id => engineersMap[id]).filter(Boolean);
        if (assignedNames.length > 0) {
          engineerName = assignedNames.join(", ");
        } else {
          const matchingEngs = engineers.filter(e => e.assignedSites && e.assignedSites.includes(m.siteId)).map(e => e.fullName).filter(Boolean);
          engineerName = matchingEngs.length > 0 ? matchingEngs.join(", ") : "Site Engineer";
        }
      }

      if (!dateMap[mDate].teamMap[teamId]) {
        dateMap[mDate].teamMap[teamId] = {
          teamId,
          teamName,
          engineerName,
          items: []
        };
      }

      const matName = (m.materialName || m.name || "General Material").trim();
      const isCustom = m.isCustom || m.isCustomType || false;
      const qty = Number(m.quantity !== undefined ? m.quantity : (m.receivedQuantity !== undefined ? m.receivedQuantity : 0)) || 0;
      const unit = m.unit || (isCustom ? "--" : "Unit");
      const unitPrice = Number(m.unitPrice !== undefined ? m.unitPrice : (m.rate !== undefined ? m.rate : (m.unitCost !== undefined ? m.unitCost : 0))) || 0;
      
      let totalAmount = Number(m.totalAmount !== undefined ? m.totalAmount : (m.totalCost !== undefined ? m.totalCost : 0));
      if (!totalAmount && qty && unitPrice) {
        totalAmount = qty * unitPrice;
      }

      dateMap[mDate].teamMap[teamId].items.push({
        recordId: m.id,
        materialName: matName,
        quantity: qty,
        unit,
        unitPrice,
        totalAmount,
        isCustom,
        notes: m.notes || ""
      });

      dateMap[mDate].dailyItems += 1;
      dateMap[mDate].dailyCost += totalAmount;

      // Aggregate into material-wise summary
      if (!materialSummaryMap[matName]) {
        materialSummaryMap[matName] = {
          materialName: matName,
          totalQuantity: 0,
          unit,
          unitPrice,
          totalAmount: 0,
          isCustom
        };
      }
      materialSummaryMap[matName].totalQuantity += qty;
      materialSummaryMap[matName].totalAmount += totalAmount;
      if (unitPrice > 0) {
        materialSummaryMap[matName].unitPrice = unitPrice;
      }
    });

    // 4. Sort dates chronologically
    const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

    let grandTotalMaterialCost = 0;
    let grandTotalMaterialItems = 0;

    const dailySections = sortedDates.map(dateStr => {
      const d = dateMap[dateStr];
      const teamsList = Object.values(d.teamMap).map(t => {
        t.items.sort((a, b) => a.materialName.localeCompare(b.materialName));
        const teamCost = t.items.reduce((sum, item) => sum + item.totalAmount, 0);
        return {
          ...t,
          teamCost
        };
      });

      grandTotalMaterialCost += d.dailyCost;
      grandTotalMaterialItems += d.dailyItems;

      return {
        dateStr,
        teams: teamsList,
        dailyItems: d.dailyItems,
        dailyCost: d.dailyCost
      };
    });

    // Material-wise sorted summary
    const materialSummaryList = Object.values(materialSummaryMap).map(row => {
      const effectiveUnitPrice = row.unitPrice > 0 ? row.unitPrice : (row.totalQuantity > 0 ? (row.totalAmount / row.totalQuantity) : 0);
      return {
        ...row,
        unitPrice: effectiveUnitPrice
      };
    });
    materialSummaryList.sort((a, b) => a.materialName.localeCompare(b.materialName));

    // Resolve site name display & assigned engineers
    let siteNameDisplay = "All Sites";
    let assignedEngineersDisplay = "";
    if (filterSiteId !== "all") {
      const selectedSite = sites.find(s => s.id === filterSiteId);
      siteNameDisplay = selectedSite?.siteName || "Selected Site";
      const assignedEngIds = selectedSite?.assignedEngineers || [];
      const names = assignedEngIds.map(id => engineersMap[id]).filter(Boolean);
      if (names.length > 0) {
        assignedEngineersDisplay = names.join(", ");
      }
    }

    return {
      dailySections,
      materialSummary: materialSummaryList,
      totalWorkingDays: dailySections.length,
      grandTotalMaterialCost,
      grandTotalMaterialItems,
      siteNameDisplay,
      assignedEngineersDisplay,
      startDate: filterStartDate,
      endDate: filterEndDate
    };
  }, [materials, filterSiteId, allowedSiteIds, filterStartDate, filterEndDate, sites, engineers, engineersMap]);

  // Calculate Expense Date Range Report Data from canonical production records (generalExpenses state)
  const expenseDateRangeReportData = useMemo(() => {
    // 1. Deduplicate by record ID to prevent double counting
    const uniqueRecordsMap = new Map();
    generalExpenses.forEach(exp => {
      if (!exp) return;
      const recId = exp.id || `exp_${exp.siteId}_${exp.date}_${exp.amount}_${exp.description}`;
      if (uniqueRecordsMap.has(recId)) return;
      uniqueRecordsMap.set(recId, { ...exp, id: recId });
    });

    // 2. Filter records by Site and Date Range only (automatic engineer resolution)
    const filteredRecords = Array.from(uniqueRecordsMap.values()).filter((exp) => {
      if (filterSiteId !== "all" && exp.siteId !== filterSiteId) return false;
      if (!allowedSiteIds.has(exp.siteId)) return false;

      const expDate = normalizeDateStr(exp.date || (exp.createdAt?.seconds ? new Date(exp.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      if (!expDate) return false;
      if (filterStartDate && expDate < filterStartDate) return false;
      if (filterEndDate && expDate > filterEndDate) return false;

      return true;
    });

    // 3. Group by Date -> Items
    const dateMap = {};
    const categorySummaryMap = {};

    filteredRecords.forEach((exp) => {
      const expDate = normalizeDateStr(exp.date || (exp.createdAt?.seconds ? new Date(exp.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      if (!dateMap[expDate]) {
        dateMap[expDate] = {
          dateStr: expDate,
          items: [],
          dailyItems: 0,
          dailyCost: 0
        };
      }

      // Resolve engineer
      let engineerName = exp.createdBy || "";
      if (!engineerName || engineerName === "Engineer") {
        const creatorId = exp.engineerId || exp.userId;
        if (creatorId && engineersMap[creatorId]) {
          engineerName = engineersMap[creatorId];
        } else {
          const siteObj = sites.find(s => s.id === exp.siteId);
          const assignedIds = siteObj?.assignedEngineers || [];
          const assignedNames = assignedIds.map(id => engineersMap[id]).filter(Boolean);
          if (assignedNames.length > 0) {
            engineerName = assignedNames.join(", ");
          } else {
            const matchingEngs = engineers.filter(e => e.assignedSites && e.assignedSites.includes(exp.siteId)).map(e => e.fullName).filter(Boolean);
            engineerName = matchingEngs.length > 0 ? matchingEngs.join(", ") : "Site Engineer";
          }
        }
      }

      const catName = (exp.category || "General Expense").trim();
      const amount = Number(exp.amount) || 0;
      const desc = exp.description || exp.name || exp.notes || "Expense Item";
      const status = exp.status || "Approved";

      dateMap[expDate].items.push({
        recordId: exp.id,
        category: catName,
        description: desc,
        amount,
        status,
        engineerName,
        notes: exp.notes || ""
      });

      dateMap[expDate].dailyItems += 1;
      dateMap[expDate].dailyCost += amount;

      // Aggregate into category summary map
      if (!categorySummaryMap[catName]) {
        categorySummaryMap[catName] = {
          categoryName: catName,
          totalEntries: 0,
          totalAmount: 0
        };
      }
      categorySummaryMap[catName].totalEntries += 1;
      categorySummaryMap[catName].totalAmount += amount;
    });

    // 4. Sort dates chronologically
    const sortedDates = Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

    let grandTotalExpenseCost = 0;
    let grandTotalExpenseItems = 0;

    const dailySections = sortedDates.map(dateStr => {
      const d = dateMap[dateStr];
      d.items.sort((a, b) => a.category.localeCompare(b.category));

      grandTotalExpenseCost += d.dailyCost;
      grandTotalExpenseItems += d.dailyItems;

      return {
        dateStr,
        items: d.items,
        dailyItems: d.dailyItems,
        dailyCost: d.dailyCost
      };
    });

    // Category-wise sorted summary list
    const categorySummaryList = Object.values(categorySummaryMap).map(row => ({
      ...row,
      percentage: grandTotalExpenseCost > 0 ? (row.totalAmount / grandTotalExpenseCost) * 100 : 0
    }));
    categorySummaryList.sort((a, b) => b.totalAmount - a.totalAmount);

    // Resolve site name display & assigned engineers
    let siteNameDisplay = "All Sites";
    let assignedEngineersDisplay = "";
    if (filterSiteId !== "all") {
      const selectedSite = sites.find(s => s.id === filterSiteId);
      siteNameDisplay = selectedSite?.siteName || "Selected Site";
      const assignedEngIds = selectedSite?.assignedEngineers || [];
      const names = assignedEngIds.map(id => engineersMap[id]).filter(Boolean);
      if (names.length > 0) {
        assignedEngineersDisplay = names.join(", ");
      }
    }

    return {
      dailySections,
      categorySummary: categorySummaryList,
      totalWorkingDays: dailySections.length,
      grandTotalExpenseCost,
      grandTotalExpenseItems,
      siteNameDisplay,
      assignedEngineersDisplay,
      startDate: filterStartDate,
      endDate: filterEndDate
    };
  }, [generalExpenses, filterSiteId, allowedSiteIds, filterStartDate, filterEndDate, sites, engineers, engineersMap]);

  // Calculate Progress Date Range Report Data from canonical production records (allDprs state)
  const progressDateRangeReportData = useMemo(() => {
    // 1. Deduplicate by doc ID
    const uniqueRecordsMap = new Map();
    allDprs.forEach(d => {
      if (!d || !d.id) return;
      if (uniqueRecordsMap.has(d.id)) return;
      uniqueRecordsMap.set(d.id, d);
    });

    // 2. Filter records by Site and Date Range
    const filteredRecords = Array.from(uniqueRecordsMap.values()).filter((d) => {
      if (filterSiteId !== "all" && d.siteId !== filterSiteId) return false;
      if (!allowedSiteIds.has(d.siteId)) return false;

      const dDate = normalizeDateStr(d.date || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      if (!dDate) return false;
      if (filterStartDate && dDate < filterStartDate) return false;
      if (filterEndDate && dDate > filterEndDate) return false;

      return true;
    });

    // 3. Sort chronologically
    filteredRecords.sort((a, b) => {
      const dateA = normalizeDateStr(a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      const dateB = normalizeDateStr(b.date || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      return dateA.localeCompare(dateB);
    });

    // 4. Parse progress values and track trends
    let previousProgress = null;
    const dailyEntries = [];

    filteredRecords.forEach((d) => {
      const dDate = normalizeDateStr(d.date || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().split('T')[0] : ''));
      
      // Parse progress number from "65%" or 65
      let rawProg = d.progress;
      if (typeof rawProg === "string") {
        rawProg = parseFloat(rawProg.replace("%", ""));
      }
      const progressPercent = isNaN(rawProg) ? 0 : Math.min(100, Math.max(0, Number(rawProg)));

      // Calculate progress change from previous entry
      let progressChange = null;
      if (previousProgress !== null) {
        progressChange = progressPercent - previousProgress;
      }
      previousProgress = progressPercent;

      // Resolve engineer
      let engineerName = "";
      const creatorId = d.engineerId || d.userId;
      if (creatorId && engineersMap[creatorId]) {
        engineerName = engineersMap[creatorId];
      } else {
        const siteObj = sites.find(s => s.id === d.siteId);
        const assignedIds = siteObj?.assignedEngineers || [];
        const assignedNames = assignedIds.map(id => engineersMap[id]).filter(Boolean);
        if (assignedNames.length > 0) {
          engineerName = assignedNames.join(", ");
        } else {
          const matchingEngs = engineers.filter(e => e.assignedSites && e.assignedSites.includes(d.siteId)).map(e => e.fullName).filter(Boolean);
          engineerName = matchingEngs.length > 0 ? matchingEngs.join(", ") : "Site Engineer";
        }
      }

      const workDetails = d.currentlyRunning || d.workCompleted || d.notes || d.pendingWork || "Daily progress logged";
      const remarks = d.problemsFaced || d.nextActivity || d.materialsStatus || "--";

      dailyEntries.push({
        id: d.id,
        dateStr: dDate,
        engineerName,
        progressPercent,
        progressChange,
        workDetails,
        remarks,
        raw: d
      });
    });

    const totalReportingDays = dailyEntries.length;
    const startingProgress = totalReportingDays > 0 ? dailyEntries[0].progressPercent : 0;
    const latestProgress = totalReportingDays > 0 ? dailyEntries[totalReportingDays - 1].progressPercent : 0;
    const progressAchieved = Math.max(0, latestProgress - startingProgress);
    const remainingProgress = Math.max(0, 100 - latestProgress);

    // Average progress rate per reporting day
    const averageProgressRate = totalReportingDays > 1 
      ? (progressAchieved / (totalReportingDays - 1))
      : (totalReportingDays === 1 ? progressAchieved : 0);

    // Estimated completion date calculation
    let estimatedCompletionDate = null;
    let estimatedDaysRemaining = null;
    let isEstimateReliable = false;

    if (latestProgress >= 100) {
      isEstimateReliable = true;
      estimatedCompletionDate = "Completed (100%)";
      estimatedDaysRemaining = 0;
    } else if (averageProgressRate > 0 && totalReportingDays >= 2) {
      isEstimateReliable = true;
      estimatedDaysRemaining = Math.ceil(remainingProgress / averageProgressRate);
      const lastEntryDate = new Date(dailyEntries[dailyEntries.length - 1].dateStr);
      if (!isNaN(lastEntryDate.getTime())) {
        const estDate = new Date(lastEntryDate.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000);
        const yyyy = estDate.getFullYear();
        const mm = String(estDate.getMonth() + 1).padStart(2, '0');
        const dd = String(estDate.getDate()).padStart(2, '0');
        estimatedCompletionDate = `${dd}-${mm}-${yyyy}`;
      }
    }

    // Resolve site & project health status
    let siteNameDisplay = "All Sites";
    let assignedEngineersDisplay = "";
    let projectStatus = "On Track";
    let selectedSiteObj = null;

    if (filterSiteId !== "all") {
      selectedSiteObj = sites.find(s => s.id === filterSiteId);
      siteNameDisplay = selectedSiteObj?.siteName || "Selected Site";
      const assignedEngIds = selectedSiteObj?.assignedEngineers || [];
      const names = assignedEngIds.map(id => engineersMap[id]).filter(Boolean);
      if (names.length > 0) {
        assignedEngineersDisplay = names.join(", ");
      }

      // Check planned schedule if target dates exist
      if (selectedSiteObj?.startDate && selectedSiteObj?.endDate) {
        const startTs = new Date(selectedSiteObj.startDate).getTime();
        const endTs = new Date(selectedSiteObj.endDate).getTime();
        const nowTs = Date.now();
        if (endTs > startTs) {
          const expectedPct = Math.min(100, Math.max(0, ((nowTs - startTs) / (endTs - startTs)) * 100));
          if (latestProgress >= 100) {
            projectStatus = "Completed";
          } else if (latestProgress >= expectedPct + 5) {
            projectStatus = "Ahead of Schedule";
          } else if (latestProgress >= expectedPct - 8) {
            projectStatus = "On Track";
          } else {
            projectStatus = "Behind / Delayed";
          }
        }
      } else if (latestProgress >= 100) {
        projectStatus = "Completed";
      } else if (totalReportingDays > 0) {
        projectStatus = averageProgressRate > 0 ? "On Track" : "Pacing Slow";
      } else {
        projectStatus = "No Activity";
      }
    } else {
      if (latestProgress >= 100) projectStatus = "Completed";
      else if (totalReportingDays > 0) projectStatus = "On Track";
      else projectStatus = "No Activity";
    }

    // AI Management Insights generation purely from real data
    let aiAnalysis = "";
    if (totalReportingDays === 0) {
      aiAnalysis = "No progress records have been logged for this period. Recommend scheduling regular daily progress submissions with the site team.";
    } else {
      const paceText = averageProgressRate > 1.5 
        ? "demonstrating strong velocity" 
        : (averageProgressRate > 0.5 ? "advancing at a steady, consistent pace" : "experiencing a plateau or slower execution velocity");
      
      const completionText = isEstimateReliable && estimatedCompletionDate !== "Completed (100%)"
        ? `At the current average rate of ${averageProgressRate.toFixed(1)}% per reporting log, the milestone completion is projected for ${estimatedCompletionDate} (~${estimatedDaysRemaining} working days).`
        : (latestProgress >= 100 ? "Project works are fully completed (100%)." : "Insufficient progress history for reliable completion estimate.");

      const healthObservation = projectStatus === "Ahead of Schedule"
        ? "Field operations are currently running ahead of the planned timeline."
        : (projectStatus === "Behind / Delayed" 
            ? "Site progress is lagging behind planned benchmarks; consider expediting material dispatch or increasing trade labor allocation." 
            : "Execution milestones are tracking satisfactorily within expected operational parameters.");

      aiAnalysis = `Current recorded progress is ${latestProgress.toFixed(1)}% (net gain of +${progressAchieved.toFixed(1)}% across ${totalReportingDays} daily logs, ${paceText}). ${completionText} ${healthObservation}`;
    }

    return {
      dailyEntries,
      totalReportingDays,
      startingProgress,
      latestProgress,
      progressAchieved,
      remainingProgress,
      averageProgressRate,
      estimatedCompletionDate,
      estimatedDaysRemaining,
      isEstimateReliable,
      projectStatus,
      aiAnalysis,
      siteNameDisplay,
      assignedEngineersDisplay,
      startDate: filterStartDate,
      endDate: filterEndDate
    };
  }, [allDprs, filterSiteId, allowedSiteIds, filterStartDate, filterEndDate, sites, engineers, engineersMap]);

  // Excel and CSV Exporter
  const exportToExcel = (type, extension = "xls") => {
    let headers = [];
    let rows = [];
    let filename = "";

    const anchor = filterStartDate || new Date().toISOString().split("T")[0];

    if (type === "attendance") {
      filename = `Attendance_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Date", "Site Name", "Labour Team", "Labour Category", "Worker Count", "Attendance Type"];
      
      const filtered = labourAttendance.filter(r => {
        if (filterSiteId !== "all" && r.siteId !== filterSiteId) return false;
        if (filterTeamId !== "all" && r.teamId !== filterTeamId) return false;
        if (!allowedSiteIds.has(r.siteId)) return false;
        if (!matchesDateFilters(r.attendanceDate)) return false;
        return true;
      });

      filtered.forEach(r => {
        const siteObj = sites.find(s => s.id === r.siteId) || { siteName: "Unknown Site" };
        const teamObj = teams.find(t => t.id === r.teamId) || { teamName: "Unknown Team" };
        rows.push([
          r.attendanceDate,
          `"${siteObj.siteName}"`,
          `"${teamObj.teamName}"`,
          r.categoryId,
          r.workerCount || 1,
          r.attendanceType || "Full Day"
        ]);
      });
    } else if (type === "labour") {
      const fromStr = formatDDMMYYYY(filterStartDate) || "Start";
      const toStr = formatDDMMYYYY(filterEndDate) || "End";
      const siteClean = (labourDateRangeReportData.siteNameDisplay || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
      filename = `Labour_Report_${siteClean}_${fromStr}_to_${toStr}.${extension}`;
      headers = ["Date", "Site Engineer", "Labour Team", "Category", "Workers", "Daily Wage", "Category Total"];

      labourDateRangeReportData.dailySections.forEach(day => {
        const formattedDayDate = formatDDMMYYYY(day.dateStr);
        day.teams.forEach(team => {
          team.categories.forEach(cat => {
            rows.push([
              formattedDayDate,
              `"${team.engineerName}"`,
              `"${team.teamName}"`,
              `"${cat.categoryName}"`,
              cat.workerCount,
              cat.dailyWage,
              cat.categoryTotal.toFixed(2)
            ]);
          });
        });
        rows.push([
          `"${formattedDayDate} Daily Total"`,
          "",
          "",
          "",
          day.dailyWorkers,
          "",
          day.dailyCost.toFixed(2)
        ]);
        rows.push([]);
      });

      rows.push(["FINAL SUMMARY", "", "", "", "", "", ""]);
      rows.push(["Total Days", labourDateRangeReportData.totalWorkingDays, "", "", "", "", ""]);
      rows.push(["Total Workers", labourDateRangeReportData.grandTotalWorkers, "", "", "", "", ""]);
      rows.push(["Total Labour Cost", labourDateRangeReportData.grandTotalLabourCost.toFixed(2), "", "", "", "", ""]);
    } else if (type === "material") {
      const fromStr = formatDDMMYYYY(filterStartDate) || "Start";
      const toStr = formatDDMMYYYY(filterEndDate) || "End";
      const siteClean = (materialDateRangeReportData.siteNameDisplay || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
      filename = `Material_Report_${siteClean}_${fromStr}_to_${toStr}.${extension}`;
      headers = ["Date", "Site Engineer", "Material Team", "Material", "Qty", "Unit", "Unit Price", "Total Amount"];

      materialDateRangeReportData.dailySections.forEach(day => {
        const formattedDayDate = formatDDMMYYYY(day.dateStr);
        day.teams.forEach(team => {
          team.items.forEach(item => {
            rows.push([
              formattedDayDate,
              `"${team.engineerName}"`,
              `"${team.teamName}"`,
              `"${item.materialName}"`,
              item.quantity || (item.isCustom ? "--" : 0),
              `"${item.unit || '--'}"`,
              item.unitPrice ? item.unitPrice.toFixed(2) : (item.isCustom ? "--" : "0.00"),
              item.totalAmount.toFixed(2)
            ]);
          });
        });
        rows.push([
          `"${formattedDayDate} Daily Total"`,
          "",
          "",
          "",
          "",
          "",
          "",
          day.dailyCost.toFixed(2)
        ]);
        rows.push([]);
      });

      if (materialDateRangeReportData.materialSummary.length > 0) {
        rows.push(["MATERIAL-WISE SUMMARY", "", "", "", "", "", "", ""]);
        rows.push(["Material", "Total Quantity", "Unit", "Avg Unit Price", "Total Amount", "", "", ""]);
        materialDateRangeReportData.materialSummary.forEach(m => {
          rows.push([
            `"${m.materialName}"`,
            m.totalQuantity || (m.isCustom ? "--" : 0),
            `"${m.unit || '--'}"`,
            m.unitPrice ? m.unitPrice.toFixed(2) : "--",
            m.totalAmount.toFixed(2),
            "",
            "",
            ""
          ]);
        });
        rows.push([]);
      }

      rows.push(["FINAL SUMMARY", "", "", "", "", "", "", ""]);
      rows.push(["Total Days", materialDateRangeReportData.totalWorkingDays, "", "", "", "", "", ""]);
      rows.push(["Total Material Cost", materialDateRangeReportData.grandTotalMaterialCost.toFixed(2), "", "", "", "", "", ""]);
    } else if (type === "salary") {
      filename = `Salary_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Site Engineer Salary", "Labour Salary", "Paid Payouts", "Pending Payouts", "Total Payroll"];
      rows.push([
        salaryReportData.engineerSalaryTotal,
        salaryReportData.labourSalaryTotal,
        salaryReportData.paidTotal,
        salaryReportData.pendingTotal,
        salaryReportData.totalPayroll
      ]);
    } else if (type === "expense") {
      const fromStr = formatDDMMYYYY(filterStartDate) || "Start";
      const toStr = formatDDMMYYYY(filterEndDate) || "End";
      const siteClean = (expenseDateRangeReportData.siteNameDisplay || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
      filename = `Expense_Report_${siteClean}_${fromStr}_to_${toStr}.${extension}`;
      headers = ["Date", "Site Engineer", "Category", "Description", "Status", "Amount"];

      expenseDateRangeReportData.dailySections.forEach(day => {
        const formattedDayDate = formatDDMMYYYY(day.dateStr);
        day.items.forEach(item => {
          rows.push([
            formattedDayDate,
            `"${item.engineerName}"`,
            `"${item.category}"`,
            `"${item.description.replace(/"/g, '""')}"`,
            `"${item.status}"`,
            item.amount.toFixed(2)
          ]);
        });
        rows.push([
          `"${formattedDayDate} Daily Total"`,
          "",
          "",
          "",
          "",
          day.dailyCost.toFixed(2)
        ]);
        rows.push([]);
      });

      if (expenseDateRangeReportData.categorySummary.length > 0) {
        rows.push(["CATEGORY-WISE SUMMARY", "", "", "", "", ""]);
        rows.push(["Category", "Total Entries", "Share %", "Total Amount", "", ""]);
        expenseDateRangeReportData.categorySummary.forEach(c => {
          rows.push([
            `"${c.categoryName}"`,
            c.totalEntries,
            `${c.percentage.toFixed(1)}%`,
            c.totalAmount.toFixed(2),
            "",
            ""
          ]);
        });
        rows.push([]);
      }

      rows.push(["FINAL SUMMARY", "", "", "", "", ""]);
      rows.push(["Total Days", expenseDateRangeReportData.totalWorkingDays, "", "", "", ""]);
      rows.push(["Total Expenses Cost", expenseDateRangeReportData.grandTotalExpenseCost.toFixed(2), "", "", "", ""]);
    } else if (type === "progress") {
      const fromStr = formatDDMMYYYY(filterStartDate) || "Start";
      const toStr = formatDDMMYYYY(filterEndDate) || "End";
      const siteClean = (progressDateRangeReportData.siteNameDisplay || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
      filename = `Progress_Report_${siteClean}_${fromStr}_to_${toStr}.${extension}`;
      headers = ["Date", "Site Engineer", "Recorded Progress %", "Change %", "Work Details", "Problems / Remarks"];

      progressDateRangeReportData.dailyEntries.forEach(entry => {
        const formattedDayDate = formatDDMMYYYY(entry.dateStr);
        rows.push([
          formattedDayDate,
          `"${entry.engineerName}"`,
          `${entry.progressPercent.toFixed(1)}%`,
          entry.progressChange !== null ? `${entry.progressChange >= 0 ? '+' : ''}${entry.progressChange.toFixed(1)}%` : "--",
          `"${entry.workDetails.replace(/"/g, '""')}"`,
          `"${entry.remarks.replace(/"/g, '""')}"`
        ]);
      });
      rows.push([]);

      rows.push(["PROGRESS METRICS & CALCULATIONS", "", "", "", "", ""]);
      rows.push(["Starting Progress", `${progressDateRangeReportData.startingProgress.toFixed(1)}%`, "", "", "", ""]);
      rows.push(["Latest Recorded Progress", `${progressDateRangeReportData.latestProgress.toFixed(1)}%`, "", "", "", ""]);
      rows.push(["Progress Achieved in Period", `+${progressDateRangeReportData.progressAchieved.toFixed(1)}%`, "", "", "", ""]);
      rows.push(["Remaining Progress", `${progressDateRangeReportData.remainingProgress.toFixed(1)}%`, "", "", "", ""]);
      rows.push(["Average Progress Rate", `${progressDateRangeReportData.averageProgressRate.toFixed(1)}% per log day`, "", "", "", ""]);
      rows.push(["Estimated Completion Date", progressDateRangeReportData.estimatedCompletionDate || "Insufficient data", "", "", "", ""]);
      rows.push(["Project Health Status", `"${progressDateRangeReportData.projectStatus}"`, "", "", "", ""]);
      rows.push([]);
      rows.push(["AI MANAGEMENT INSIGHTS", `"${progressDateRangeReportData.aiAnalysis.replace(/"/g, '""')}"`, "", "", "", ""]);
      rows.push([]);
      rows.push(["FINAL SUMMARY", "", "", "", "", ""]);
      rows.push(["Total Reporting Days", progressDateRangeReportData.totalReportingDays, "", "", "", ""]);
      rows.push(["Latest Overall Progress", `${progressDateRangeReportData.latestProgress.toFixed(1)}%`, "", "", "", ""]);
    } else if (type === "budget") {
      filename = `Budget_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Total Budget", "Total Expense", "Remaining Budget", "Budget Usage %"];
      rows.push([
        budgetReportData.budget,
        budgetReportData.expense,
        budgetReportData.remainingBudget,
        budgetReportData.usagePercent.toFixed(1) + "%"
      ]);
    }

    let csvContent = "";
    if (extension === "csv") {
      csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    } else {
      csvContent = "data:application/vnd.ms-excel;charset=utf-8," 
        + [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    }
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    setIsPrinting(true);
  };

  useEffect(() => {
    if (isPrinting) {
      const originalTitle = document.title;
      document.title = "";
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
        document.title = originalTitle;
      }, 300);
      return () => {
        clearTimeout(timer);
        document.title = originalTitle;
      };
    }
  }, [isPrinting]);

  if (loading) {
    return (
      <Layout hideNavbar={true}>
        <Loading show={true} text="Assembling Management dashboard..." />
      </Layout>
    );
  }

  // Label resolving for printable header titles
  const getSelectedReportTemplateLabel = () => {
    switch (reportTemplate) {
      case "daily_attendance": return "DAILY ATTENDANCE REPORT";
      case "weekly_attendance": return "WEEKLY ATTENDANCE REPORT";
      case "monthly_attendance": return "MONTHLY ATTENDANCE REPORT";
      case "labour": return "LABOR REPORT";
      case "material": return "MATERIAL REPORT";
      case "salary": return "SALARY & PAYROLL REPORT";
      case "expense": return "EXPENSE REPORT";
      case "progress": return "PROGRESS REPORT";
      case "budget": return "BUDGET REPORT";
      default: return "SITE REPORT";
    }
  };

  return (
    <Layout hideNavbar={true}>
      {/* A4 Portrait Print Stylesheet with browser headers/footers suppression */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, footer, nav, aside, .sidebar, .navbar, .filters-card {
            display: none !important;
          }
          .printable-report-container {
            display: block !important;
            position: relative !important;
            box-sizing: border-box !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm 12mm 12mm 12mm !important;
            background: #ffffff !important;
            z-index: 9999 !important;
          }
        }
        
        .printable-report-container {
          display: none;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
        }
        
        .report-header-block {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        
        .printable-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 10.5px;
        }
        
        .printable-table th {
          background-color: #f1f5f9 !important;
          border: 1px solid #94a3b8;
          padding: 6px 8px;
          font-weight: 700;
          text-align: left;
          color: #0f172a;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .printable-table td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          color: #334155;
        }
      `}</style>

      {/* ── 1. ENTERPRISE PAGE HEADER & ACTIONS ── */}
      <div className="no-print" style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "18px 24px",
        marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}>
        {/* Top Header Row: Left Title & Right-Aligned Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Site Reports Dashboard</h2>
              <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                {activeTab.replace("_report", "").toUpperCase()} REPORT
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Comprehensive audit reports, labor attendance analytics, material consumption logs, expense statements, and project progress metrics.
            </p>
          </div>

          {/* Compact Right-Aligned Controls Group */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap", flexShrink: 0 }}>
            {/* 1. Report Selection Dropdown */}
            <select
              value={reportTemplate}
              onChange={(e) => setReportTemplate(e.target.value)}
              style={{
                height: "36px",
                padding: "0 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
              }}
            >
              <option value="daily_attendance">Daily Attendance Report</option>
              <option value="weekly_attendance">Weekly Attendance Report</option>
              <option value="monthly_attendance">Monthly Attendance Report</option>
              <option value="labour">Labour Allocation Report</option>
              <option value="material">Material Log Report</option>
              <option value="expense">Expense Report</option>
              <option value="progress">Progress Report</option>
              <option value="salary">Salary &amp; Payroll Report</option>
              <option value="budget">Budget Report</option>
            </select>

            {/* 2. Generate PDF Button (Original Orange) */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === "labour_report") setReportTemplate("labour");
                else if (activeTab === "material_report") setReportTemplate("material");
                else if (activeTab === "expense_report") setReportTemplate("expense");
                else if (activeTab === "progress_report") setReportTemplate("progress");
                handlePrint();
              }}
              style={{
                height: "36px",
                padding: "0 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#ea580c",
                backgroundImage: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                transition: "all 0.15s ease"
              }}
            >
              <Printer size={15} />
              <span>Generate PDF</span>
            </button>

            {/* 3. Export CSV Button */}
            <button
              type="button"
              onClick={() => exportToExcel(activeTab.replace("_report", ""), "csv")}
              style={{
                height: "36px",
                padding: "0 14px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: "12.5px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease"
              }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── ADVANCED FILTER PANEL ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
          
          {/* Site Filter */}
          <div>
            <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Construction Site</label>
            <select
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", fontWeight: "600", outline: "none" }}
            >
              <option value="all">All Sites Scope</option>
              {userSites.map(s => (
                <option key={s.id} value={s.id}>{s.siteName}</option>
              ))}
            </select>
          </div>

          {/* Report Category Filter */}
          <div>
            <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Report Category</label>
            <select
              value={activeTab}
              onChange={(e) => {
                const tab = e.target.value;
                setActiveTab(tab);
                if (tab === "labour_report") setReportTemplate("labour");
                else if (tab === "material_report") setReportTemplate("material");
                else if (tab === "expense_report") setReportTemplate("expense");
                else if (tab === "progress_report") setReportTemplate("progress");
              }}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", fontWeight: "600", outline: "none" }}
            >
              <option value="overview">Management Overview</option>
              <option value="labour_report">Labour Reports</option>
              <option value="material_report">Material Reports</option>
              <option value="expense_report">Expense Reports</option>
              <option value="progress_report">Progress Reports</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>From Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }}
            />
          </div>

          {/* To Date */}
          <div>
            <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>To Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }}
            />
          </div>



        </div>
      </div>

      {/* ── 2. COMPACT KPI SUMMARY CARDS (EXACTLY 4 COMPACT CARDS) ── */}
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
        
        {/* KPI 1: Sites In Scope */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Sites In Scope</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{overallMetrics.totalSites}</div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>{overallMetrics.activeSites} active • {overallMetrics.completedSites} completed</span>
        </div>

        {/* KPI 2: Total Accrued Expenses */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Accrued Expenses</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(overallMetrics.totalExpenses)}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Total site cost accrued</span>
        </div>

        {/* KPI 3: Labour Workforce Units */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Labour Headcount</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#ffedd5", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>
            {labourDateRangeReportData.grandTotalWorkers || 0}
          </div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Attendance units logged</span>
        </div>

        {/* KPI 4: Avg Progress */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Avg Site Progress</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{overallMetrics.overallProgress}%</div>
          <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block", fontWeight: "600" }}>Overall completion standing</span>
        </div>

      </div>

      {/* ── 3. CLEAR REPORT CATEGORIES TABS ── */}
      <div className="no-print" style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid #e2e8f0", paddingBottom: "0", overflowX: "auto" }}>
        {[
          { id: "overview", label: "Management Overview", icon: Grid },
          { id: "labour_report", label: "Labour Reports", icon: Users },
          { id: "material_report", label: "Material Reports", icon: Package },
          { id: "expense_report", label: "Expense Reports", icon: TrendingUp },
          { id: "progress_report", label: "Progress Reports", icon: Activity }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "labour_report") setReportTemplate("labour");
                else if (tab.id === "material_report") setReportTemplate("material");
                else if (tab.id === "expense_report") setReportTemplate("expense");
                else if (tab.id === "progress_report") setReportTemplate("progress");
              }}
              style={{
                padding: "10px 18px",
                border: "none",
                backgroundColor: "transparent",
                borderBottom: isActive ? "3px solid #f97316" : "3px solid transparent",
                color: isActive ? "#ea580c" : "#64748b",
                fontWeight: isActive ? "700" : "600",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease"
              }}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1. MANAGEMENT OVERVIEW TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
          
          {/* TOP 5 SUMMARY CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            
            {/* 1. Project Progress */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Project Progress</span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#16a34a", marginTop: "4px" }}>
                {managementOverviewData.projectProgress}%
              </div>
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>Current completion</span>
            </div>

            {/* 2. Milestones Delayed */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Milestones Delayed</span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: managementOverviewData.milestonesDelayed > 0 ? "#dc2626" : "#16a34a", marginTop: "4px" }}>
                {managementOverviewData.milestonesDelayed}
              </div>
              <span style={{ fontSize: "11px", color: managementOverviewData.milestonesDelayed > 0 ? "#dc2626" : "#16a34a", marginTop: "2px", display: "block", fontWeight: "600" }}>
                {managementOverviewData.milestonesDelayed > 0 ? "Delayed" : "On Track"}
              </span>
            </div>

            {/* 3. Project Value */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Project Value</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginTop: "4px", fontFamily: "monospace" }}>
                {formatINR(managementOverviewData.projectValue)}
              </div>
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>Approved budget</span>
            </div>

            {/* 4. Total Cost So Far */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Cost So Far</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#ea580c", marginTop: "4px", fontFamily: "monospace" }}>
                {formatINR(managementOverviewData.totalCostSoFar)}
              </div>
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>Recorded expenses</span>
            </div>

            {/* 5. Remaining Budget */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Remaining Budget</span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: managementOverviewData.remainingBudget < 0 ? "#dc2626" : "#2563eb", marginTop: "4px", fontFamily: "monospace" }}>
                {formatINR(managementOverviewData.remainingBudget)}
              </div>
              <span style={{ fontSize: "11px", color: managementOverviewData.remainingBudget < 0 ? "#dc2626" : "#64748b", marginTop: "2px", display: "block" }}>
                {managementOverviewData.remainingBudget < 0 ? "Budget exceeded" : "Available balance"}
              </span>
            </div>

          </div>

          {/* PROJECT PROGRESS VISUAL BAR */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "800", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.3px" }}>
                Project Progress
              </span>
              <span style={{ fontSize: "15px", fontWeight: "800", color: "#16a34a" }}>
                {managementOverviewData.projectProgress}%
              </span>
            </div>
            <div style={{ height: "12px", width: "100%", backgroundColor: "#e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${managementOverviewData.projectProgress}%`,
                background: "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
                borderRadius: "6px",
                transition: "width 0.4s ease"
              }} />
            </div>
          </Card>

          {/* PROJECT SUMMARY & PROJECT UPDATES GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            
            {/* Simple Project Summary */}
            <Card title="Project Summary">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Project</span>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a", marginTop: "2px", display: "block" }}>{managementOverviewData.siteName}</strong>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Site Engineer</span>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a", marginTop: "2px", display: "block" }}>{managementOverviewData.assignedEngineers}</strong>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Project Status</span>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a", marginTop: "2px", display: "block" }}>{managementOverviewData.projectStatus}</strong>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Project Progress</span>
                  <strong style={{ fontSize: "13.5px", color: "#16a34a", marginTop: "2px", display: "block" }}>{managementOverviewData.projectProgress}%</strong>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Project Value</span>
                  <strong style={{ fontSize: "13.5px", color: "#0f172a", fontFamily: "monospace", marginTop: "2px", display: "block" }}>{formatINR(managementOverviewData.projectValue)}</strong>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Total Cost So Far</span>
                  <strong style={{ fontSize: "13.5px", color: "#ea580c", fontFamily: "monospace", marginTop: "2px", display: "block" }}>{formatINR(managementOverviewData.totalCostSoFar)}</strong>
                </div>

                <div style={{ gridColumn: "span 2", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Remaining Budget</span>
                  <strong style={{ fontSize: "14px", color: managementOverviewData.remainingBudget < 0 ? "#dc2626" : "#2563eb", fontFamily: "monospace", marginTop: "2px", display: "block" }}>
                    {formatINR(managementOverviewData.remainingBudget)}
                  </strong>
                </div>
              </div>
            </Card>

            {/* Project Updates (Health & Alerts) */}
            <Card title="Project Updates">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                
                {/* 1. Approvals Update */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "10px 12px",
                  backgroundColor: managementOverviewData.pendingApprovals > 0 ? "#fffbeb" : "#f0fdf4",
                  borderRadius: "6px",
                  border: `1px solid ${managementOverviewData.pendingApprovals > 0 ? "#fef3c7" : "#dcfce7"}`
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {managementOverviewData.pendingApprovals > 0 ? (
                      <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: managementOverviewData.pendingApprovals > 0 ? "#92400e" : "#166534" }}>
                      {managementOverviewData.pendingApprovals > 0 
                        ? `${managementOverviewData.pendingApprovals} Requisition(s) pending approval`
                        : "No pending approvals"
                      }
                    </span>
                  </div>
                  {managementOverviewData.pendingApprovals > 0 && (
                    <Link to="/superadmin/approvals" style={{ fontSize: "11.5px", fontWeight: "700", color: "#ea580c", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Go to Approval Center →
                    </Link>
                  )}
                </div>

                {/* 2. Timeline Schedule Update */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  backgroundColor: managementOverviewData.timelineStatus === "Delayed" ? "#fef2f2" : "#f0fdf4",
                  borderRadius: "6px",
                  border: `1px solid ${managementOverviewData.timelineStatus === "Delayed" ? "#fee2e2" : "#dcfce7"}`
                }}>
                  {managementOverviewData.timelineStatus === "Delayed" ? (
                    <AlertTriangle size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: managementOverviewData.timelineStatus === "Delayed" ? "#991b1b" : "#166534" }}>
                    {managementOverviewData.timelineStatus === "Delayed"
                      ? "Project timeline is delayed"
                      : "Project timeline is on schedule"
                    }
                  </span>
                </div>

                {/* 3. Milestones Update */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  backgroundColor: managementOverviewData.milestonesDelayed > 0 ? "#fef2f2" : "#f0fdf4",
                  borderRadius: "6px",
                  border: `1px solid ${managementOverviewData.milestonesDelayed > 0 ? "#fee2e2" : "#dcfce7"}`
                }}>
                  {managementOverviewData.milestonesDelayed > 0 ? (
                    <AlertTriangle size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: managementOverviewData.milestonesDelayed > 0 ? "#991b1b" : "#166534" }}>
                    {managementOverviewData.milestonesDelayed > 0
                      ? `${managementOverviewData.milestonesDelayed} milestone(s) delayed`
                      : "All project milestones are on track"
                    }
                  </span>
                </div>

                {/* 4. Budget Usage Update */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  backgroundColor: managementOverviewData.remainingBudget < 0 
                    ? "#fef2f2" 
                    : (managementOverviewData.projectValue > 0 && managementOverviewData.totalCostSoFar > managementOverviewData.projectValue * 0.85 ? "#fffbeb" : "#f0fdf4"),
                  borderRadius: "6px",
                  border: `1px solid ${managementOverviewData.remainingBudget < 0 
                    ? "#fee2e2" 
                    : (managementOverviewData.projectValue > 0 && managementOverviewData.totalCostSoFar > managementOverviewData.projectValue * 0.85 ? "#fef3c7" : "#dcfce7")}`
                }}>
                  {managementOverviewData.remainingBudget < 0 ? (
                    <AlertTriangle size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
                  ) : (
                    managementOverviewData.projectValue > 0 && managementOverviewData.totalCostSoFar > managementOverviewData.projectValue * 0.85 ? (
                      <AlertTriangle size={16} style={{ color: "#d97706", flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                    )
                  )}
                  <span style={{
                    fontSize: "12.5px",
                    fontWeight: "700",
                    color: managementOverviewData.remainingBudget < 0 
                      ? "#991b1b" 
                      : (managementOverviewData.projectValue > 0 && managementOverviewData.totalCostSoFar > managementOverviewData.projectValue * 0.85 ? "#92400e" : "#166534")
                  }}>
                    {managementOverviewData.remainingBudget < 0
                      ? `Budget exceeded by ${formatINR(Math.abs(managementOverviewData.remainingBudget))}`
                      : (managementOverviewData.projectValue > 0 && managementOverviewData.totalCostSoFar > managementOverviewData.projectValue * 0.85
                          ? `Budget usage is high (${Math.round((managementOverviewData.totalCostSoFar / managementOverviewData.projectValue) * 100)}% utilized)`
                          : (managementOverviewData.projectValue > 0
                              ? `Budget usage is within approved limits (${Math.round((managementOverviewData.totalCostSoFar / managementOverviewData.projectValue) * 100)}% utilized)`
                              : "Budget not configured for this project"
                            )
                        )
                    }
                  </span>
                </div>

              </div>
            </Card>

          </div>

          {/* PROJECT TIMELINE */}
          <Card title="Project Timeline">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Start Date</span>
                <strong style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px", display: "block" }}>{managementOverviewData.startDate}</strong>
              </div>
              <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Expected Completion</span>
                <strong style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px", display: "block" }}>{managementOverviewData.expectedCompletion}</strong>
              </div>
              <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Current Progress</span>
                <strong style={{ fontSize: "13px", color: "#16a34a", marginTop: "2px", display: "block" }}>{managementOverviewData.projectProgress}%</strong>
              </div>
              <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", display: "block" }}>Status</span>
                <strong style={{ fontSize: "13px", color: managementOverviewData.timelineStatus === "Delayed" ? "#dc2626" : "#16a34a", marginTop: "2px", display: "block" }}>
                  {managementOverviewData.timelineStatus === "Delayed" ? "⚠ Delayed" : "✓ On Schedule"}
                </strong>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. ATTENDANCE REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "attendance_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Attendance Report</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Consolidated supervisor check-in logs and labour counters</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button onClick={() => exportToExcel("attendance", "xls")} variant="outline" icon={Download}>Export Excel</Button>
              <Button onClick={() => exportToExcel("attendance", "csv")} variant="outline" icon={Download}>Export CSV</Button>
            </div>
          </div>
          
          <Card title="Labour Site Attendance Logs" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Attendance Date</th>
                    <th>Site Name</th>
                    <th>Labour Team</th>
                    <th>Labour Category</th>
                    <th style={{ textAlign: "right" }}>Worker Count</th>
                    <th>Attendance Type</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = labourAttendance.filter(r => {
                      if (filterSiteId !== "all" && r.siteId !== filterSiteId) return false;
                      if (filterTeamId !== "all" && r.teamId !== filterTeamId) return false;
                      if (!allowedSiteIds.has(r.siteId)) return false;
                      if (!matchesDateFilters(r.attendanceDate)) return false;
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                            No labour attendance records found matching filters.
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((r) => {
                      const siteObj = sites.find(s => s.id === r.siteId) || { siteName: "Unknown Site" };
                      const teamObj = teams.find(t => t.id === r.teamId) || { teamName: "Unknown Team" };
                      return (
                        <tr key={r.id}>
                          <td className="font-mono">{normalizeDateStr(r.attendanceDate) || "--"}</td>
                          <td style={{ fontWeight: "700" }}>{safeRender(siteObj.siteName)}</td>
                          <td>{safeRender(teamObj.teamName)}</td>
                          <td>{safeRender(r.categoryId)}</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{r.workerCount || 1}</td>
                          <td>
                            <Badge status={r.attendanceType === "Full Day" ? "success" : "warning"}>
                              {safeRender(r.attendanceType, "Full Day")}
                            </Badge>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Site Engineer Attendance &amp; Check-In Logs" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Site Engineer Name</th>
                    <th>Check-in / Entry Time</th>
                    <th>Status</th>
                    <th>Attendance Check-In Photo</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const records = [];
                    engineers.forEach(eng => {
                      if (filterEngineerId !== "all" && eng.id !== filterEngineerId) return;
                      
                      const atts = engineerAttendance.filter(a => a.engineerId === eng.id);
                      atts.forEach(a => {
                        const normDate = normalizeDateStr(a.date);
                        if (filterSiteId !== "all" && a.siteId !== filterSiteId) return;
                        if (!allowedSiteIds.has(a.siteId)) return;
                        if (!matchesDateFilters(normDate)) return;
                        records.push({
                          id: `att_${eng.id}_${normDate}`,
                          date: normDate,
                          name: eng.fullName,
                          time: a.checkInTime || "--",
                          status: "Present",
                          photoUrl: a.checkInPhotoUrl || a.photoUrl || null
                        });
                      });

                      const leavesList = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));
                      leavesList.forEach(l => {
                        const normDate = normalizeDateStr(l.date);
                        if (!matchesDateFilters(normDate)) return;
                        records.push({
                          id: `lv_${eng.id}_${normDate}`,
                          date: normDate,
                          name: eng.fullName,
                          time: "--",
                          status: l.type === "half_day" ? "Half Day Leave" : "Approved Leave",
                          photoUrl: null
                        });
                      });
                    });

                    records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

                    if (records.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                            No supervisor attendance logs found matching filters.
                          </td>
                        </tr>
                      );
                    }

                    return records.map((rec) => (
                      <tr key={rec.id}>
                        <td className="font-mono">{safeRender(rec.date)}</td>
                        <td style={{ fontWeight: "700" }}>{safeRender(rec.name)}</td>
                        <td className="font-mono">{safeRender(rec.time)}</td>
                        <td>
                          <Badge status={rec.status === "Present" ? "success" : "danger"}>
                            {rec.status}
                          </Badge>
                        </td>
                        <td>
                          {rec.photoUrl ? (
                            <img 
                              src={rec.photoUrl} 
                              alt="Check-in Photo" 
                              style={{ width: "45px", height: "45px", borderRadius: "4px", objectFit: "cover", border: "1px solid var(--border-color)", cursor: "pointer" }}
                              onClick={() => window.open(rec.photoUrl, "_blank")}
                            />
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>No Photo</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. LABOUR REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "labour_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
          <div style={{ display: "flex", gap: "16px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Labour Report</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Canonical daily production records for {labourDateRangeReportData.siteNameDisplay} ({formatDDMMYYYY(filterStartDate) || "Beginning"} to {formatDDMMYYYY(filterEndDate) || "Today"})
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setReportTemplate("labour"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => { setReportTemplate("labour"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#ea580c",
                  backgroundImage: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                  transition: "all 0.15s ease"
                }}
              >
                <FileText size={15} />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel("labour", "xls")}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Download size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {labourDateRangeReportData.dailySections.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                <Users size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary-950)" }}>
                  No labor records found for the selected site and date range.
                </div>
              </div>
            </Card>
          ) : (
            labourDateRangeReportData.dailySections.map((day, dIdx) => (
              <Card key={dIdx} variant="default" style={{ overflow: "hidden", padding: 0 }}>
                {day.teams.map((team, tIdx) => (
                  <div key={tIdx} style={{ borderBottom: tIdx < day.teams.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                    {/* Daily Section Meta Header */}
                    <div style={{
                      backgroundColor: "#f8fafc",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      borderBottom: "1px solid var(--border-color)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>DATE:</span>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>
                          {formatDDMMYYYY(day.dateStr)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>SITE ENGINEER:</span>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                          {team.engineerName || labourDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>LABOUR TEAM:</span>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#ea580c" }}>
                          {team.teamName}
                        </span>
                      </div>
                    </div>

                    {/* Category Level Calculation Table */}
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#ffffff", borderBottom: "1px solid var(--border-color)" }}>
                            <th style={{ textAlign: "left", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Category</th>
                            <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Workers</th>
                            <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Daily Wage</th>
                            <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Category Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.categories.map((cat, cIdx) => (
                            <tr key={cIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ fontWeight: "700", padding: "10px 16px", color: "#0f172a", fontSize: "13px" }}>{cat.categoryName}</td>
                              <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "600", fontSize: "13px" }}>{cat.workerCount}</td>
                              <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontSize: "13px" }}>₹{cat.dailyWage.toLocaleString("en-IN")}</td>
                              <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#16a34a", fontSize: "13px" }}>
                                ₹{cat.categoryTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Daily Total Summary Footer */}
                <div style={{
                  backgroundColor: "#f1f5f9",
                  padding: "10px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  borderTop: "1px solid var(--border-color)",
                  fontWeight: "800",
                  fontSize: "13px"
                }}>
                  <span style={{ color: "#334155" }}>
                    Daily Total Workers: <span style={{ color: "#0f172a", fontFamily: "monospace" }}>{day.dailyWorkers}</span>
                  </span>
                  <span style={{ color: "#334155" }}>
                    Daily Labour Cost: <span style={{ color: "#16a34a", fontFamily: "monospace", fontSize: "14px" }}>
                      ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                </div>
              </Card>
            ))
          )}

          {/* FINAL SUMMARY */}
          {labourDateRangeReportData.dailySections.length > 0 && (
            <Card style={{ backgroundColor: "#ffffff", border: "2px solid #0f172a", borderRadius: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#0f172a", marginBottom: "12px", letterSpacing: "0.5px" }}>
                REPORT SUMMARY
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Days</span>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                    {labourDateRangeReportData.totalWorkingDays}
                  </div>
                </div>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Workers</span>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                    {labourDateRangeReportData.grandTotalWorkers}
                  </div>
                </div>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Labour Cost</span>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a", marginTop: "4px", fontFamily: "monospace" }}>
                    ₹{labourDateRangeReportData.grandTotalLabourCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MATERIAL REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "material_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
          <div style={{ display: "flex", gap: "16px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Material Report</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Canonical daily production records for {materialDateRangeReportData.siteNameDisplay} ({formatDDMMYYYY(filterStartDate) || "Beginning"} to {formatDDMMYYYY(filterEndDate) || "Today"})
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setReportTemplate("material"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => { setReportTemplate("material"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#ea580c",
                  backgroundImage: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                  transition: "all 0.15s ease"
                }}
              >
                <FileText size={15} />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel("material", "xls")}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Download size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {materialDateRangeReportData.dailySections.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                <Building2 size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary-950)" }}>
                  No material records found for the selected site and date range.
                </div>
              </div>
            </Card>
          ) : (
            <>
              {materialDateRangeReportData.dailySections.map((day, dIdx) => (
                <Card key={dIdx} variant="default" style={{ overflow: "hidden", padding: 0 }}>
                  {day.teams.map((team, tIdx) => (
                    <div key={tIdx} style={{ borderBottom: tIdx < day.teams.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                      {/* Daily Section Meta Header */}
                      <div style={{
                        backgroundColor: "#f8fafc",
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                        borderBottom: "1px solid var(--border-color)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>DATE:</span>
                          <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>
                            {formatDDMMYYYY(day.dateStr)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>SITE ENGINEER:</span>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                            {team.engineerName || materialDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>MATERIAL TEAM:</span>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#2563eb" }}>
                            {team.teamName}
                          </span>
                        </div>
                      </div>

                      {/* Material Breakdown Table */}
                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#ffffff", borderBottom: "1px solid var(--border-color)" }}>
                              <th style={{ textAlign: "left", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Material</th>
                              <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Quantity</th>
                              <th style={{ textAlign: "center", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Unit</th>
                              <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Unit Price</th>
                              <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Total Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.items.map((item, iIdx) => (
                              <tr key={iIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ fontWeight: "700", padding: "10px 16px", color: "#0f172a", fontSize: "13px" }}>{item.materialName}</td>
                                <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "600", fontSize: "13px" }}>
                                  {item.quantity ? item.quantity.toLocaleString("en-IN") : (item.isCustom ? "--" : "0")}
                                </td>
                                <td style={{ textAlign: "center", padding: "10px 16px", fontSize: "12px", color: "#64748b" }}>{item.unit || "--"}</td>
                                <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontSize: "13px" }}>
                                  {item.unitPrice ? `₹${item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (item.isCustom ? "--" : "₹0.00")}
                                </td>
                                <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#16a34a", fontSize: "13px" }}>
                                  ₹{item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  {/* Daily Total Summary Footer */}
                  <div style={{
                    backgroundColor: "#f1f5f9",
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    borderTop: "1px solid var(--border-color)",
                    fontWeight: "800",
                    fontSize: "13px"
                  }}>
                    <span style={{ color: "#334155" }}>
                      Daily Total Entries: <span style={{ color: "#0f172a", fontFamily: "monospace" }}>{day.dailyItems}</span>
                    </span>
                    <span style={{ color: "#334155" }}>
                      Daily Material Cost: <span style={{ color: "#16a34a", fontFamily: "monospace", fontSize: "14px" }}>
                        ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                </Card>
              ))}

              {/* MATERIAL-WISE AGGREGATED SUMMARY TABLE */}
              {materialDateRangeReportData.materialSummary.length > 0 && (
                <Card title="Material Wise Cost & Quantity Summary" variant="table">
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid var(--border-color)" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Material</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Total Qty</th>
                          <th style={{ textAlign: "center", padding: "10px 16px" }}>Unit</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Avg Unit Price</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialDateRangeReportData.materialSummary.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <td style={{ fontWeight: "700", padding: "10px 16px", color: "var(--primary-950)" }}>{row.materialName}</td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "700" }}>
                              {row.totalQuantity ? row.totalQuantity.toLocaleString("en-IN") : (row.isCustom ? "--" : "0")}
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 16px", color: "#64748b" }}>{row.unit || "--"}</td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace" }}>
                              {row.unitPrice ? `₹${row.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#16a34a" }}>
                              ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* REPORT SUMMARY */}
              <Card style={{ backgroundColor: "#ffffff", border: "2px solid #0f172a", borderRadius: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#0f172a", marginBottom: "12px", letterSpacing: "0.5px" }}>
                  REPORT SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Days</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                      {materialDateRangeReportData.totalWorkingDays}
                    </div>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Material Cost</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a", marginTop: "4px", fontFamily: "monospace" }}>
                      ₹{materialDateRangeReportData.grandTotalMaterialCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SALARY REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "salary_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Salary &amp; Payroll Report</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Breakdowns of Supervisor vs Labour accrued payroll payouts, and Paid / Pending ledger statuses</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button onClick={() => exportToExcel("salary", "xls")} variant="outline" icon={Download}>Export Excel</Button>
              <Button onClick={() => exportToExcel("salary", "csv")} variant="outline" icon={Download}>Export CSV</Button>
            </div>
          </div>
          
          <Card title="Corporate Monthly Payroll Ledger" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "right" }}>Site Engineer Salaries</th>
                    <th style={{ textAlign: "right" }}>Labour Accrued Salaries</th>
                    <th style={{ textAlign: "right", color: "var(--success-700)" }}>Paid Payouts</th>
                    <th style={{ textAlign: "right", color: "var(--warning-700)" }}>Pending Payouts</th>
                    <th style={{ textAlign: "right", fontWeight: "700" }}>Total Payroll value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(salaryReportData.engineerSalaryTotal)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(salaryReportData.labourSalaryTotal)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--success-700)", fontWeight: "700" }}>{formatINR(salaryReportData.paidTotal)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--warning-700)", fontWeight: "700" }}>{formatINR(salaryReportData.pendingTotal)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "800", fontSize: "14px" }}>{formatINR(salaryReportData.totalPayroll)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. EXPENSE REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "expense_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
          <div style={{ display: "flex", gap: "16px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Expense Report</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Canonical daily production records for {expenseDateRangeReportData.siteNameDisplay} ({formatDDMMYYYY(filterStartDate) || "Beginning"} to {formatDDMMYYYY(filterEndDate) || "Today"})
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setReportTemplate("expense"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => { setReportTemplate("expense"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#ea580c",
                  backgroundImage: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                  transition: "all 0.15s ease"
                }}
              >
                <FileText size={15} />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel("expense", "xls")}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Download size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {expenseDateRangeReportData.dailySections.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                <Building2 size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary-950)" }}>
                  No expense records found for the selected site and date range.
                </div>
              </div>
            </Card>
          ) : (
            <>
              {expenseDateRangeReportData.dailySections.map((day, dIdx) => (
                <Card key={dIdx} variant="default" style={{ overflow: "hidden", padding: 0 }}>
                  {/* Daily Section Meta Header */}
                  <div style={{
                    backgroundColor: "#f8fafc",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    borderBottom: "1px solid var(--border-color)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>DATE:</span>
                      <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>
                        {formatDDMMYYYY(day.dateStr)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>SITE ENGINEER / LOGGED BY:</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                        {day.items[0]?.engineerName || expenseDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>DAILY ENTRIES:</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#ea580c" }}>
                        {day.dailyItems}
                      </span>
                    </div>
                  </div>

                  {/* Expense Breakdown Table */}
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#ffffff", borderBottom: "1px solid var(--border-color)" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Category</th>
                          <th style={{ textAlign: "left", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Description / Details</th>
                          <th style={{ textAlign: "center", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Status</th>
                          <th style={{ textAlign: "right", padding: "10px 16px", fontSize: "12px", color: "#475569" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.items.map((item, iIdx) => (
                          <tr key={iIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ fontWeight: "700", padding: "10px 16px", color: "#0f172a", fontSize: "13px" }}>{item.category}</td>
                            <td style={{ padding: "10px 16px", fontSize: "13px", color: "#334155" }}>
                              {item.description}
                              {item.notes && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{item.notes}</div>}
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 16px" }}>
                              <span style={{
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontSize: "11px",
                                fontWeight: "700",
                                backgroundColor: item.status === "Approved" || item.status === "approved" || item.status === "Paid" ? "#dcfce7" : (item.status === "Rejected" ? "#fee2e2" : "#fef9c3"),
                                color: item.status === "Approved" || item.status === "approved" || item.status === "Paid" ? "#15803d" : (item.status === "Rejected" ? "#b91c1c" : "#a16207")
                              }}>
                                {item.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#16a34a", fontSize: "13px" }}>
                              ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Daily Total Summary Footer */}
                  <div style={{
                    backgroundColor: "#f1f5f9",
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    borderTop: "1px solid var(--border-color)",
                    fontWeight: "800",
                    fontSize: "13px"
                  }}>
                    <span style={{ color: "#334155" }}>
                      Daily Total Entries: <span style={{ color: "#0f172a", fontFamily: "monospace" }}>{day.dailyItems}</span>
                    </span>
                    <span style={{ color: "#334155" }}>
                      Daily Expense Total: <span style={{ color: "#16a34a", fontFamily: "monospace", fontSize: "14px" }}>
                        ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                </Card>
              ))}

              {/* CATEGORY-WISE AGGREGATED SUMMARY TABLE */}
              {expenseDateRangeReportData.categorySummary.length > 0 && (
                <Card title="Category Wise Expense Summary" variant="table">
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid var(--border-color)" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Category</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Total Entries</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Share %</th>
                          <th style={{ textAlign: "right", padding: "10px 16px" }}>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseDateRangeReportData.categorySummary.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <td style={{ fontWeight: "700", padding: "10px 16px", color: "var(--primary-950)" }}>{row.categoryName}</td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "700" }}>{row.totalEntries}</td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", color: "#64748b" }}>{row.percentage.toFixed(1)}%</td>
                            <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#16a34a" }}>
                              ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* REPORT SUMMARY */}
              <Card style={{ backgroundColor: "#ffffff", border: "2px solid #0f172a", borderRadius: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#0f172a", marginBottom: "12px", letterSpacing: "0.5px" }}>
                  REPORT SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Days</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                      {expenseDateRangeReportData.totalWorkingDays}
                    </div>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Expenses Cost</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a", marginTop: "4px", fontFamily: "monospace" }}>
                      ₹{expenseDateRangeReportData.grandTotalExpenseCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. PROGRESS REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "progress_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
          <div style={{ display: "flex", gap: "16px", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Progress Report</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Canonical daily production records for {progressDateRangeReportData.siteNameDisplay} ({formatDDMMYYYY(filterStartDate) || "Beginning"} to {formatDDMMYYYY(filterEndDate) || "Today"})
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "nowrap", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setReportTemplate("progress"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Printer size={15} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => { setReportTemplate("progress"); handlePrint(); }}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#ea580c",
                  backgroundImage: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(234, 88, 12, 0.2)",
                  transition: "all 0.15s ease"
                }}
              >
                <FileText size={15} />
                <span>Export PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel("progress", "xls")}
                style={{
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <Download size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {progressDateRangeReportData.dailyEntries.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                <Activity size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary-950)" }}>
                  No progress records found for the selected site and date range.
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* 4 Metric Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Latest Recorded Progress</span>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                    {progressDateRangeReportData.latestProgress.toFixed(1)}%
                  </div>
                  <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "2px", display: "block", fontWeight: "600" }}>Current standing</span>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Progress Achieved</span>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#2563eb", marginTop: "4px" }}>
                    +{progressDateRangeReportData.progressAchieved.toFixed(1)}%
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>Net gain in period</span>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Remaining Progress</span>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#ea580c", marginTop: "4px" }}>
                    {progressDateRangeReportData.remainingProgress.toFixed(1)}%
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>To completion</span>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Average Daily Rate</span>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                    {progressDateRangeReportData.averageProgressRate.toFixed(1)}%
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>Per reporting log</span>
                </div>
              </div>

              {/* Daily Progress DPR Log Table */}
              <Card title="Daily Progress DPR Log & Work Details" variant="table">
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid var(--border-color)" }}>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>Date</th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>Site Engineer</th>
                        <th style={{ textAlign: "right", padding: "10px 16px" }}>Progress %</th>
                        <th style={{ textAlign: "right", padding: "10px 16px" }}>Change</th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>Work Completed / Running</th>
                        <th style={{ textAlign: "left", padding: "10px 16px" }}>Problems / Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressDateRangeReportData.dailyEntries.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ fontWeight: "700", padding: "10px 16px", color: "var(--primary-950)", whiteSpace: "nowrap" }}>
                            {formatDDMMYYYY(row.dateStr)}
                          </td>
                          <td style={{ padding: "10px 16px", color: "#334155" }}>{row.engineerName}</td>
                          <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "800", color: "#0f172a" }}>
                            {row.progressPercent.toFixed(1)}%
                          </td>
                          <td style={{ textAlign: "right", padding: "10px 16px", fontFamily: "monospace", fontWeight: "700", color: row.progressChange && row.progressChange > 0 ? "#16a34a" : "#64748b" }}>
                            {row.progressChange !== null ? `${row.progressChange >= 0 ? '+' : ''}${row.progressChange.toFixed(1)}%` : "--"}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "12.5px", color: "#0f172a" }}>{row.workDetails}</td>
                          <td style={{ padding: "10px 16px", fontSize: "12px", color: "#64748b" }}>{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* AI ANALYTICS & EXECUTION FORECAST */}
              <Card style={{ backgroundColor: "#f8fafc", border: "1.5px solid #6366f1", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#e0e7ff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #c7d2fe" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Activity size={18} style={{ color: "#4338ca" }} />
                    <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#312e81", letterSpacing: "0.5px" }}>
                      AI MANAGEMENT INSIGHTS &amp; EXECUTION FORECAST
                    </span>
                  </div>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "800",
                    backgroundColor: progressDateRangeReportData.projectStatus === "Ahead of Schedule" ? "#dcfce7" : (progressDateRangeReportData.projectStatus === "Behind / Delayed" ? "#fee2e2" : "#e0f2fe"),
                    color: progressDateRangeReportData.projectStatus === "Ahead of Schedule" ? "#15803d" : (progressDateRangeReportData.projectStatus === "Behind / Delayed" ? "#b91c1c" : "#0369a1")
                  }}>
                    STATUS: {progressDateRangeReportData.projectStatus.toUpperCase()}
                  </span>
                </div>
                <div style={{ padding: "16px" }}>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13.5px", lineHeight: "1.6", color: "#1e1b4b" }}>
                    {progressDateRangeReportData.aiAnalysis}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", borderTop: "1px solid #e0e7ff", paddingTop: "12px" }}>
                    <div>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Project Health Status</span>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                        {progressDateRangeReportData.projectStatus}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Estimated Completion</span>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#4338ca", marginTop: "2px" }}>
                        {progressDateRangeReportData.estimatedCompletionDate || "Insufficient progress history"}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Estimated Days Remaining</span>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                        {progressDateRangeReportData.estimatedDaysRemaining !== null ? `~${progressDateRangeReportData.estimatedDaysRemaining} days` : "--"}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* FINAL REPORT SUMMARY */}
              <Card style={{ backgroundColor: "#ffffff", border: "2px solid #0f172a", borderRadius: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#0f172a", marginBottom: "12px", letterSpacing: "0.5px" }}>
                  FINAL PROGRESS SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Total Reporting Days</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                      {progressDateRangeReportData.totalReportingDays}
                    </div>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Starting Progress</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", marginTop: "4px" }}>
                      {progressDateRangeReportData.startingProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Latest Recorded Progress</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a", marginTop: "4px" }}>
                      {progressDateRangeReportData.latestProgress.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Remaining Work</span>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#ea580c", marginTop: "4px" }}>
                      {progressDateRangeReportData.remainingProgress.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. BUDGET REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "budget_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Project Budget Monitoring Report</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Dynamic budget utilization audit showing remaining reserves and progress indicators</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button onClick={() => exportToExcel("budget", "xls")} variant="outline" icon={Download}>Export Excel</Button>
              <Button onClick={() => exportToExcel("budget", "csv")} variant="outline" icon={Download}>Export CSV</Button>
            </div>
          </div>
          
          <Card title="Corporate Budget Allocation Ledger" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "right" }}>Total Budget</th>
                    <th style={{ textAlign: "right" }}>Total Approved Expense</th>
                    <th style={{ textAlign: "right" }}>Remaining Budget Reserves</th>
                    <th style={{ textAlign: "right", fontWeight: "700" }}>Corporate Budget Usage %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(budgetReportData.budget)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(budgetReportData.expense)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", color: budgetReportData.remainingBudget < 0 ? "var(--danger-700)" : "var(--success-700)", fontWeight: "700" }}>{formatINR(budgetReportData.remainingBudget)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "800", fontSize: "14px", color: budgetReportData.usagePercent > 100 ? "var(--danger-700)" : (budgetReportData.usagePercent > 80 ? "var(--warning-700)" : "var(--success-700)") }}>
                      {budgetReportData.usagePercent.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. DYNAMIC PRINTABLE PDF REPORT CONTAINER */}
      {/* ==================================================================== */}
      <div className="printable-report-container" id="pdf-report-print-container">
        
        {/* Company header details */}
        <div className="report-header-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/app-icon.png" alt="Visvas Builders" width="36" height="36" style={{ borderRadius: "6px", objectFit: "contain", display: "inline-block" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a", fontFamily: "Outfit, sans-serif" }}>Visvas Builders</h2>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {getSelectedReportTemplateLabel()}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "10px", color: "#475569" }}>
            <div><strong>Report Date:</strong> {formatDDMMYYYY(new Date())}</div>
            {userProfile?.fullName && <div><strong>Generated By:</strong> {userProfile.fullName}</div>}
          </div>
        </div>

        {/* Clean Unified Report Information Area (Single Source of Truth, no duplicate labels) */}
        <div style={{ marginBottom: "14px", padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", color: "#0f172a" }}>
            <div>
              <strong>Site:</strong> {
                reportTemplate === "labour" 
                  ? labourDateRangeReportData.siteNameDisplay 
                  : (filterSiteId === "all" ? "All Sites" : (sites.find(s => s.id === filterSiteId)?.siteName || "Selected Site"))
              }
            </div>
            <div>
              <strong>Report Period:</strong> {
                (filterStartDate && filterEndDate)
                  ? `${formatDDMMYYYY(filterStartDate)} to ${formatDDMMYYYY(filterEndDate)}`
                  : (filterStartDate ? `From ${formatDDMMYYYY(filterStartDate)}` : (filterEndDate ? `Up to ${formatDDMMYYYY(filterEndDate)}` : "All Dates"))
              }
            </div>
            {/* Show Site Engineer once if applicable and available */}
            {(() => {
              const engDisplay = reportTemplate === "labour"
                ? labourDateRangeReportData.assignedEngineersDisplay
                : (filterEngineerId !== "all" 
                    ? engineersMap[filterEngineerId] 
                    : (filterSiteId !== "all" 
                        ? (sites.find(s => s.id === filterSiteId)?.assignedEngineers || []).map(id => engineersMap[id]).filter(Boolean).join(", ") 
                        : ""));
              if (!engDisplay) return null;
              return (
                <div style={{ gridColumn: "span 2" }}>
                  <strong>Site Engineer:</strong> {engDisplay}
                </div>
              );
            })()}
          </div>
        </div>

        {/* PDF TEMPLATE: DAILY ATTENDANCE */}
        {reportTemplate === "daily_attendance" && (
          <div>
            <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#0f172a", margin: "14px 0 6px 0" }}>Site Engineer Check-In Logs</h4>
            <table className="printable-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Engineer Name</th>
                  <th>Check-In Time</th>
                  <th>Status</th>
                  <th>Photo Attachment</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const records = [];
                  engineers.forEach(eng => {
                    if (filterEngineerId !== "all" && eng.id !== filterEngineerId) return;
                    const atts = engineerAttendance.filter(a => a.engineerId === eng.id);
                    atts.forEach(a => {
                      const normDate = normalizeDateStr(a.date);
                      if (filterSiteId !== "all" && a.siteId !== filterSiteId) return;
                      if (!matchesDateFilters(normDate)) return;
                      records.push({
                        id: `att_${eng.id}_${normDate}`,
                        date: normDate,
                        name: eng.fullName,
                        time: a.checkInTime || "--",
                        status: "Present",
                        photoUrl: a.checkInPhotoUrl || a.photoUrl || null
                      });
                    });
                    const leavesList = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));
                    leavesList.forEach(l => {
                      const normDate = normalizeDateStr(l.date);
                      if (!matchesDateFilters(normDate)) return;
                      records.push({
                        id: `lv_${eng.id}_${normDate}`,
                        date: normDate,
                        name: eng.fullName,
                        time: "--",
                        status: l.type === "half_day" ? "Half Day Leave" : "Approved Leave",
                        photoUrl: null
                      });
                    });
                  });
                  records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                  if (records.length === 0) {
                    return <tr><td colSpan={5} style={{ textAlign: "center" }}>No check-in logs registered.</td></tr>;
                  }
                  return records.map(r => (
                    <tr key={r.id}>
                      <td>{safeRender(r.date)}</td>
                      <td>{safeRender(r.name)}</td>
                      <td>{safeRender(r.time)}</td>
                      <td>{safeRender(r.status)}</td>
                      <td>{r.photoUrl ? "Photo Captured" : "No Photo"}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>

            <h4 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#0f172a", margin: "20px 0 6px 0" }}>Labour Allocation Summaries</h4>
            <table className="printable-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site Name</th>
                  <th>Labour Team</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Worker Count</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const list = labourAttendance.filter(r => {
                    if (filterSiteId !== "all" && r.siteId !== filterSiteId) return false;
                    if (filterTeamId !== "all" && r.teamId !== filterTeamId) return false;
                    if (!allowedSiteIds.has(r.siteId)) return false;
                    if (!matchesDateFilters(r.attendanceDate)) return false;
                    return true;
                  });
                  if (list.length === 0) return <tr><td colSpan={6} style={{ textAlign: "center" }}>No labour logs.</td></tr>;
                  return list.map(r => {
                    const siteObj = sites.find(s => s.id === r.siteId) || { siteName: "Unknown Site" };
                    const teamObj = teams.find(t => t.id === r.teamId) || { teamName: "Unknown Team" };
                    return (
                      <tr key={r.id}>
                        <td>{normalizeDateStr(r.attendanceDate) || "--"}</td>
                        <td>{safeRender(siteObj.siteName)}</td>
                        <td>{safeRender(teamObj.teamName)}</td>
                        <td>{safeRender(r.categoryId)}</td>
                        <td style={{ textAlign: "right" }}>{r.workerCount || 1}</td>
                        <td>{safeRender(r.attendanceType, "Full Day")}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF TEMPLATE: WEEKLY ATTENDANCE */}
        {reportTemplate === "weekly_attendance" && (
          <div>
            <table className="printable-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Week Starting</th>
                  <th style={{ textAlign: "right" }}>Total Workers Logged</th>
                  <th style={{ textAlign: "right" }}>Total Accrued Payouts</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const anchor = filterStartDate || new Date().toISOString().split("T")[0];
                  const weeklySummary = {};
                  
                  labourAttendance.forEach(r => {
                    if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
                    if (!allowedSiteIds.has(r.siteId)) return;
                    if (!isDateInWeek(r.attendanceDate, anchor)) return;
                    
                    const weekKey = r.siteId;
                    if (!weeklySummary[weekKey]) {
                      weeklySummary[weekKey] = {
                        siteId: r.siteId,
                        totalWorkers: 0,
                        totalWages: 0
                      };
                    }
                    
                    const count = Number(r.workerCount) || 1;
                    const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
                    const teamObj = teams.find(t => t.id === r.teamId);
                    const categoryObj = teamObj?.categories?.[r.categoryId];
                    const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
                    
                    weeklySummary[weekKey].totalWorkers += count;
                    weeklySummary[weekKey].totalWages += count * factor * dailyWage;
                  });
                  
                  const rows = Object.values(weeklySummary);
                  if (rows.length === 0) return <tr><td colSpan={4} style={{ textAlign: "center" }}>No weekly records found.</td></tr>;
                  return rows.map((row, idx) => {
                    const siteObj = sites.find(s => s.id === row.siteId) || { siteName: "Unknown Site" };
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: "700" }}>{siteObj.siteName}</td>
                        <td>{anchor} (Week of)</td>
                        <td style={{ textAlign: "right" }}>{row.totalWorkers}</td>
                        <td style={{ textAlign: "right" }}>{formatINR(row.totalWages)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF TEMPLATE: MONTHLY ATTENDANCE */}
        {reportTemplate === "monthly_attendance" && (
          <div>
            <table className="printable-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Month</th>
                  <th style={{ textAlign: "right" }}>Working Days</th>
                  <th style={{ textAlign: "right" }}>Total Labor Headcount</th>
                  <th style={{ textAlign: "right" }}>Total Accrued Payouts</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const anchor = filterStartDate || new Date().toISOString().split("T")[0];
                  const monthlySummary = {};
                  
                  labourAttendance.forEach(r => {
                    if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
                    if (!allowedSiteIds.has(r.siteId)) return;
                    if (!isDateInMonth(r.attendanceDate, anchor)) return;
                    
                    const monthKey = r.siteId;
                    if (!monthlySummary[monthKey]) {
                      monthlySummary[monthKey] = {
                        siteId: r.siteId,
                        days: new Set(),
                        totalWorkers: 0,
                        totalWages: 0
                      };
                    }
                    
                    const count = Number(r.workerCount) || 1;
                    const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
                    const teamObj = teams.find(t => t.id === r.teamId);
                    const categoryObj = teamObj?.categories?.[r.categoryId];
                    const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
                    
                    monthlySummary[monthKey].days.add(r.attendanceDate);
                    monthlySummary[monthKey].totalWorkers += count;
                    monthlySummary[monthKey].totalWages += count * factor * dailyWage;
                  });
                  
                  const rows = Object.values(monthlySummary);
                  if (rows.length === 0) return <tr><td colSpan={5} style={{ textAlign: "center" }}>No monthly records found.</td></tr>;
                  return rows.map((row, idx) => {
                    const siteObj = sites.find(s => s.id === row.siteId) || { siteName: "Unknown Site" };
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: "700" }}>{siteObj.siteName}</td>
                        <td>{anchor.substring(0, 7)}</td>
                        <td style={{ textAlign: "right" }}>{row.days.size}</td>
                        <td style={{ textAlign: "right" }}>{row.totalWorkers}</td>
                        <td style={{ textAlign: "right" }}>{formatINR(row.totalWages)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* PDF TEMPLATE: LABOUR REPORT */}
        {reportTemplate === "labour" && (
          <div>
            {labourDateRangeReportData.dailySections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px" }}>
                No labor records found for the selected site and date range.
              </div>
            ) : (
              labourDateRangeReportData.dailySections.map((day, dIdx) => (
                <div key={dIdx} style={{ pageBreakInside: "avoid", breakInside: "avoid", marginBottom: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                  {day.teams.map((team, tIdx) => (
                    <div key={tIdx} style={{ borderBottom: tIdx < day.teams.length - 1 ? "1px solid #cbd5e1" : "none" }}>
                      <div style={{
                        backgroundColor: "#f1f5f9",
                        padding: "5px 8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10.5px",
                        fontWeight: "700",
                        color: "#0f172a",
                        borderBottom: "1px solid #cbd5e1"
                      }}>
                        <span>DATE: {formatDDMMYYYY(day.dateStr)}</span>
                        <span>SITE ENGINEER: {team.engineerName || labourDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}</span>
                        <span>LABOUR TEAM: {team.teamName}</span>
                      </div>
                      <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "5px 8px", textAlign: "left", width: "40%", fontSize: "10px" }}>Category</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "18%", fontSize: "10px" }}>Workers</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Daily Wage</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "22%", fontSize: "10px" }}>Category Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.categories.map((cat, cIdx) => (
                            <tr key={cIdx}>
                              <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{cat.categoryName}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>{cat.workerCount}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>₹{cat.dailyWage.toLocaleString("en-IN")}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>
                                ₹{cat.categoryTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <div style={{
                    backgroundColor: "#e2e8f0",
                    padding: "5px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    color: "#0f172a"
                  }}>
                    <span>Daily Total Workers: {day.dailyWorkers}</span>
                    <span>Daily Labour Cost: ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))
            )}

            {/* FINAL SUMMARY */}
            {labourDateRangeReportData.dailySections.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "14px", border: "1.5px solid #0f172a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "6px 10px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
                  FINAL SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Days</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{labourDateRangeReportData.totalWorkingDays}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Workers</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{labourDateRangeReportData.grandTotalWorkers}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Labour Cost</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                      ₹{labourDateRangeReportData.grandTotalLabourCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF TEMPLATE: MATERIAL REPORT */}
        {reportTemplate === "material" && (
          <div>
            {materialDateRangeReportData.dailySections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px" }}>
                No material records found for the selected site and date range.
              </div>
            ) : (
              materialDateRangeReportData.dailySections.map((day, dIdx) => (
                <div key={dIdx} style={{ pageBreakInside: "avoid", breakInside: "avoid", marginBottom: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                  {day.teams.map((team, tIdx) => (
                    <div key={tIdx} style={{ borderBottom: tIdx < day.teams.length - 1 ? "1px solid #cbd5e1" : "none" }}>
                      <div style={{
                        backgroundColor: "#f1f5f9",
                        padding: "5px 8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10.5px",
                        fontWeight: "700",
                        color: "#0f172a",
                        borderBottom: "1px solid #cbd5e1"
                      }}>
                        <span>DATE: {formatDDMMYYYY(day.dateStr)}</span>
                        <span>SITE ENGINEER: {team.engineerName || materialDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}</span>
                        <span>MATERIAL TEAM: {team.teamName}</span>
                      </div>
                      <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "5px 8px", textAlign: "left", width: "35%", fontSize: "10px" }}>Material</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "15%", fontSize: "10px" }}>Quantity</th>
                            <th style={{ padding: "5px 8px", textAlign: "center", width: "12%", fontSize: "10px" }}>Unit</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "18%", fontSize: "10px" }}>Unit Price</th>
                            <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.items.map((item, iIdx) => (
                            <tr key={iIdx}>
                              <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{item.materialName}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>
                                {item.quantity ? item.quantity.toLocaleString("en-IN") : (item.isCustom ? "--" : "0")}
                              </td>
                              <td style={{ padding: "5px 8px", textAlign: "center", fontSize: "10px" }}>{item.unit || "--"}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>
                                {item.unitPrice ? `₹${item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (item.isCustom ? "--" : "₹0.00")}
                              </td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>
                                ₹{item.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <div style={{
                    backgroundColor: "#e2e8f0",
                    padding: "5px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    color: "#0f172a"
                  }}>
                    <span>Daily Total Entries: {day.dailyItems}</span>
                    <span>Daily Material Cost: ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))
            )}

            {/* MATERIAL-WISE AGGREGATED SUMMARY TABLE IN PRINT */}
            {materialDateRangeReportData.materialSummary.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#f1f5f9", padding: "5px 8px", fontSize: "10.5px", fontWeight: "700", color: "#0f172a", borderBottom: "1px solid #cbd5e1" }}>
                  MATERIAL WISE COST & QUANTITY SUMMARY
                </div>
                <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "35%", fontSize: "10px" }}>Material</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "15%", fontSize: "10px" }}>Total Qty</th>
                      <th style={{ padding: "5px 8px", textAlign: "center", width: "12%", fontSize: "10px" }}>Unit</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "18%", fontSize: "10px" }}>Avg Unit Price</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialDateRangeReportData.materialSummary.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{row.materialName}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>
                          {row.totalQuantity ? row.totalQuantity.toLocaleString("en-IN") : (row.isCustom ? "--" : "0")}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontSize: "10px" }}>{row.unit || "--"}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>
                          {row.unitPrice ? `₹${row.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>
                          ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FINAL SUMMARY */}
            {materialDateRangeReportData.dailySections.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "14px", border: "1.5px solid #0f172a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "6px 10px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
                  FINAL SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Days</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{materialDateRangeReportData.totalWorkingDays}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Material Cost</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                      ₹{materialDateRangeReportData.grandTotalMaterialCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF TEMPLATE: SALARY REPORT */}
        {reportTemplate === "salary" && (
          <div>
            <table className="printable-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "right" }}>Site Engineer Salaries</th>
                  <th style={{ textAlign: "right" }}>Labour Salaries</th>
                  <th style={{ textAlign: "right" }}>Paid Payouts</th>
                  <th style={{ textAlign: "right" }}>Pending Payouts</th>
                  <th style={{ textAlign: "right" }}>Total Payroll Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: "right" }}>{formatINR(salaryReportData.engineerSalaryTotal)}</td>
                  <td style={{ textAlign: "right" }}>{formatINR(salaryReportData.labourSalaryTotal)}</td>
                  <td style={{ textAlign: "right", color: "var(--success-700)" }}>{formatINR(salaryReportData.paidTotal)}</td>
                  <td style={{ textAlign: "right", color: "var(--warning-700)" }}>{formatINR(salaryReportData.pendingTotal)}</td>
                  <td style={{ textAlign: "right", fontWeight: "700" }}>{formatINR(salaryReportData.totalPayroll)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* PDF TEMPLATE: EXPENSE REPORT */}
        {reportTemplate === "expense" && (
          <div>
            {expenseDateRangeReportData.dailySections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px" }}>
                No expense records found for the selected site and date range.
              </div>
            ) : (
              expenseDateRangeReportData.dailySections.map((day, dIdx) => (
                <div key={dIdx} style={{ pageBreakInside: "avoid", breakInside: "avoid", marginBottom: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{
                    backgroundColor: "#f1f5f9",
                    padding: "5px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10.5px",
                    fontWeight: "700",
                    color: "#0f172a",
                    borderBottom: "1px solid #cbd5e1"
                  }}>
                    <span>DATE: {formatDDMMYYYY(day.dateStr)}</span>
                    <span>SITE ENGINEER: {day.items[0]?.engineerName || expenseDateRangeReportData.assignedEngineersDisplay || "Site Engineer"}</span>
                    <span>ENTRIES: {day.dailyItems}</span>
                  </div>
                  <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "5px 8px", textAlign: "left", width: "25%", fontSize: "10px" }}>Category</th>
                        <th style={{ padding: "5px 8px", textAlign: "left", width: "45%", fontSize: "10px" }}>Description</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", width: "12%", fontSize: "10px" }}>Status</th>
                        <th style={{ padding: "5px 8px", textAlign: "right", width: "18%", fontSize: "10px" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.items.map((item, iIdx) => (
                        <tr key={iIdx}>
                          <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{item.category}</td>
                          <td style={{ padding: "5px 8px", fontSize: "10px" }}>{item.description}</td>
                          <td style={{ padding: "5px 8px", textAlign: "center", fontSize: "10px" }}>{item.status}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>
                            ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{
                    backgroundColor: "#e2e8f0",
                    padding: "5px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    color: "#0f172a"
                  }}>
                    <span>Daily Total Entries: {day.dailyItems}</span>
                    <span>Daily Expense Total: ₹{day.dailyCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))
            )}

            {/* CATEGORY-WISE AGGREGATED SUMMARY TABLE IN PRINT */}
            {expenseDateRangeReportData.categorySummary.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#f1f5f9", padding: "5px 8px", fontSize: "10.5px", fontWeight: "700", color: "#0f172a", borderBottom: "1px solid #cbd5e1" }}>
                  CATEGORY WISE EXPENSE SUMMARY
                </div>
                <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "40%", fontSize: "10px" }}>Category</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Total Entries</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Share %</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "20%", fontSize: "10px" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseDateRangeReportData.categorySummary.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{row.categoryName}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>{row.totalEntries}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>{row.percentage.toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>
                          ₹{row.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FINAL SUMMARY */}
            {expenseDateRangeReportData.dailySections.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "14px", border: "1.5px solid #0f172a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "6px 10px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
                  FINAL SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Days</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{expenseDateRangeReportData.totalWorkingDays}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Expenses Cost</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                      ₹{expenseDateRangeReportData.grandTotalExpenseCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF TEMPLATE: PROGRESS REPORT */}
        {reportTemplate === "progress" && (
          <div>
            {progressDateRangeReportData.dailyEntries.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px" }}>
                No progress records found for the selected site and date range.
              </div>
            ) : (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginBottom: "12px", border: "1px solid #94a3b8", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  backgroundColor: "#f1f5f9",
                  padding: "5px 8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "10.5px",
                  fontWeight: "700",
                  color: "#0f172a",
                  borderBottom: "1px solid #cbd5e1"
                }}>
                  <span>SITE: {progressDateRangeReportData.siteNameDisplay}</span>
                  <span>RECORDED ENTRIES: {progressDateRangeReportData.totalReportingDays}</span>
                  <span>CURRENT PROGRESS: {progressDateRangeReportData.latestProgress.toFixed(1)}%</span>
                </div>
                <table className="printable-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "15%", fontSize: "10px" }}>Date</th>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "20%", fontSize: "10px" }}>Site Engineer</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "12%", fontSize: "10px" }}>Progress %</th>
                      <th style={{ padding: "5px 8px", textAlign: "right", width: "10%", fontSize: "10px" }}>Change</th>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "25%", fontSize: "10px" }}>Work Details</th>
                      <th style={{ padding: "5px 8px", textAlign: "left", width: "18%", fontSize: "10px" }}>Problems / Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressDateRangeReportData.dailyEntries.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "5px 8px", fontWeight: "600", fontSize: "10px" }}>{formatDDMMYYYY(row.dateStr)}</td>
                        <td style={{ padding: "5px 8px", fontSize: "10px" }}>{row.engineerName}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "700", fontSize: "10px" }}>{row.progressPercent.toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px" }}>
                          {row.progressChange !== null ? `${row.progressChange >= 0 ? '+' : ''}${row.progressChange.toFixed(1)}%` : "--"}
                        </td>
                        <td style={{ padding: "5px 8px", fontSize: "10px" }}>{row.workDetails}</td>
                        <td style={{ padding: "5px 8px", fontSize: "10px" }}>{row.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* AI MANAGEMENT INSIGHTS IN PRINT */}
            {progressDateRangeReportData.dailyEntries.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "12px", border: "1px solid #6366f1", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#e0e7ff", padding: "5px 8px", fontSize: "10.5px", fontWeight: "800", color: "#312e81", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #c7d2fe" }}>
                  <span>AI MANAGEMENT INSIGHTS &amp; EXECUTION FORECAST</span>
                  <span>STATUS: {progressDateRangeReportData.projectStatus.toUpperCase()}</span>
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "#f8fafc", fontSize: "10.5px", lineHeight: "1.5", color: "#1e1b4b" }}>
                  <p style={{ margin: "0 0 6px 0" }}>{progressDateRangeReportData.aiAnalysis}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", borderTop: "1px solid #e0e7ff", paddingTop: "6px", fontSize: "10px" }}>
                    <div><strong>Project Health:</strong> {progressDateRangeReportData.projectStatus}</div>
                    <div><strong>Est. Completion:</strong> {progressDateRangeReportData.estimatedCompletionDate || "Insufficient history"}</div>
                    <div><strong>Est. Days Remaining:</strong> {progressDateRangeReportData.estimatedDaysRemaining !== null ? `~${progressDateRangeReportData.estimatedDaysRemaining} days` : "--"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* FINAL SUMMARY */}
            {progressDateRangeReportData.dailyEntries.length > 0 && (
              <div style={{ pageBreakInside: "avoid", breakInside: "avoid", marginTop: "14px", border: "1.5px solid #0f172a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "6px 10px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
                  FINAL PROGRESS SUMMARY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", padding: "8px 12px", backgroundColor: "#f8fafc" }}>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Total Reporting Days</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{progressDateRangeReportData.totalReportingDays}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Starting Progress</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{progressDateRangeReportData.startingProgress.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Latest Progress</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#16a34a", marginTop: "2px" }}>{progressDateRangeReportData.latestProgress.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "#64748b" }}>Progress Gain</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#2563eb", marginTop: "2px" }}>+{progressDateRangeReportData.progressAchieved.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF TEMPLATE: BUDGET REPORT */}
        {reportTemplate === "budget" && (
          <div>
            <table className="printable-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "right" }}>Total Site Budget</th>
                  <th style={{ textAlign: "right" }}>Total Approved Expense</th>
                  <th style={{ textAlign: "right" }}>Remaining Budget Reserves</th>
                  <th style={{ textAlign: "right" }}>Corporate Budget Usage %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: "right" }}>{formatINR(budgetReportData.budget)}</td>
                  <td style={{ textAlign: "right" }}>{formatINR(budgetReportData.expense)}</td>
                  <td style={{ textAlign: "right", color: budgetReportData.remainingBudget < 0 ? "var(--danger-700)" : "inherit" }}>{formatINR(budgetReportData.remainingBudget)}</td>
                  <td style={{ textAlign: "right", fontWeight: "700" }}>{budgetReportData.usagePercent.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}



      </div>
    </Layout>
  );
}

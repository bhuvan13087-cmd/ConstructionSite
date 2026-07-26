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
  FileText
} from "lucide-react";
import { Link } from "react-router-dom";

// Helper function to safely format dates/Timestamps to YYYY-MM-DD string
function formatDateToString(dateVal) {
  if (!dateVal) return "";
  
  // 1. If it's a Firestore Timestamp (has seconds property)
  if (typeof dateVal === "object" && dateVal.seconds !== undefined) {
    try {
      return new Date(dateVal.seconds * 1000).toISOString().split("T")[0];
    } catch (e) {
      return "";
    }
  }

  // 2. If it has toDate function (Firestore Timestamp in some SDKs)
  if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
    try {
      return dateVal.toDate().toISOString().split("T")[0];
    } catch (e) {
      return "";
    }
  }

  // 3. If it is a JS Date object
  if (dateVal instanceof Date) {
    try {
      return dateVal.toISOString().split("T")[0];
    } catch (e) {
      return "";
    }
  }

  // 4. If it's a string, clean it
  if (typeof dateVal === "string") {
    return dateVal.split("T")[0];
  }

  // Fallback
  try {
    return String(dateVal).split("T")[0];
  } catch (e) {
    return "";
  }
}


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
        list.push({ id: docSnap.id, ...docSnap.data() });
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
    const cleanDate = formatDateToString(dateInput);
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
    const dateStr = formatDateToString(dateInput);
    const anchorStr = formatDateToString(anchorInput);
    if (!dateStr || !anchorStr) return false;
    const date = new Date(dateStr);
    const anchor = new Date(anchorStr);
    
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
    const dateStr = formatDateToString(dateInput);
    const anchorStr = formatDateToString(anchorInput);
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
          
          const purchaseDateStr = formatDateToString(m.purchaseDate);
          if (purchaseDateStr && isWithinDateRange(purchaseDateStr)) {
            const mKey = purchaseDateStr.substring(0, 7); // YYYY-MM
            monthlyMap[mKey] = (monthlyMap[mKey] || 0) + cost;
          }
        }
      });

      // Labour Cost aggregation
      siteLabour.forEach(l => {
        const attDateStr = formatDateToString(l.attendanceDate);
        if (!attDateStr || !isWithinDateRange(attDateStr)) return;

        const teamObj = teams.find(t => t.id === l.teamId);
        const categoryObj = teamObj?.categories?.[l.categoryId];
        const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;
        const count = Number(l.workerCount) || 1;
        const factor = l.attendanceType === "Half Day" ? 0.5 : 1.0;
        const wages = count * factor * dailyWage;

        labourCost += wages;
        const mKey = attDateStr.substring(0, 7);
        monthlyMap[mKey] = (monthlyMap[mKey] || 0) + wages;
      });

      // General Expenses aggregation
      siteGenExpenses.forEach(g => {
        if (g.status === "Approved" || g.status === "approved") {
          otherCost += g.amount;
          const gDateStr = formatDateToString(g.date);
          if (gDateStr && isWithinDateRange(gDateStr)) {
            const mKey = gDateStr.substring(0, 7);
            monthlyMap[mKey] = (monthlyMap[mKey] || 0) + g.amount;
          }
        }
      });
    });

    const donutData = [
      { name: "Material Cost", value: materialCost, color: "#3b82f6" },
      { name: "Labour Cost", value: labourCost, color: "#22c55e" },
      { name: "Other Expenses", value: otherCost, color: "#8b5cf6" }
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
        const dDate = formatDateToString(d.date || d.createdAt);
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
      const attDateStr = formatDateToString(r.attendanceDate);
      if (!isDateInMonth(attDateStr, anchor)) return;

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
        const attDateStr = formatDateToString(a.date);
        if (isDateInMonth(attDateStr, anchor)) {
          engineerSalaryTotal += dailySalary;
        }
      });

      lvs.forEach(l => {
        const lvDateStr = formatDateToString(l.date);
        if (l.type === "half_day" && isDateInMonth(lvDateStr, anchor)) {
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
          const attDateStr = formatDateToString(r.attendanceDate);
          if (r.teamId === t.id && r.categoryId === catId && isDateInMonth(attDateStr, anchor)) {
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
        const attDateStr = formatDateToString(a.date);
        if (isDateInMonth(attDateStr, anchor)) {
          amount += dailySalary;
        }
      });

      lvs.forEach(l => {
        const lvDateStr = formatDateToString(l.date);
        if (l.type === "half_day" && isDateInMonth(lvDateStr, anchor)) {
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

  // Dynamic Labour Report Data (Date Range, Live Data, Single Data Source)
  const labourReportData = useMemo(() => {
    const categoryMap = {};

    let grandTotalCost = 0;
    let grandTotalUnits = 0;
    let grandTotalFullDays = 0;
    let grandTotalHalfDays = 0;

    labourAttendance.forEach(r => {
      // 1. Site Filter & Security Scope
      if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
      if (!allowedSiteIds.has(r.siteId)) return;

      // 2. Team Filter if selected
      if (filterTeamId !== "all" && r.teamId !== filterTeamId) return;

      // 3. Date Range Filter (From Date -> To Date)
      const recordDate = formatDateToString(r.attendanceDate || r.date);
      if (!recordDate) return;
      if (filterStartDate && recordDate < filterStartDate) return;
      if (filterEndDate && recordDate > filterEndDate) return;

      // Determine category key and display name
      const teamObj = teams.find(t => t.id === r.teamId);
      const categoryKey = r.categoryId || r.categoryName || "Uncategorized";
      let categoryName = r.categoryName || categoryKey;

      if (teamObj?.categories?.[categoryKey]?.name) {
        categoryName = teamObj.categories[categoryKey].name;
      } else if (labourMaster[categoryKey]?.name) {
        categoryName = labourMaster[categoryKey].name;
      }

      // Determine Daily Rate (Wage)
      let dailyRate = 0;
      if (r.wage !== undefined && r.wage !== null && Number(r.wage) > 0) {
        dailyRate = Number(r.wage);
      } else if (teamObj?.categories?.[categoryKey]?.baseWage !== undefined) {
        dailyRate = Number(teamObj.categories[categoryKey].baseWage) || 0;
      } else if (teamObj?.categories?.[categoryKey]?.wage !== undefined) {
        dailyRate = Number(teamObj.categories[categoryKey].wage) || 0;
      } else if (labourMaster[categoryKey]?.wage !== undefined) {
        dailyRate = Number(labourMaster[categoryKey].wage) || 0;
      }

      // Determine worker count, units, full days, half days
      const count = Number(r.workerCount) || 1;
      const isHalfDay = r.attendanceType === "Half Day" || r.units === 0.5;
      const factor = isHalfDay ? 0.5 : 1.0;

      let units = 0;
      let fullDays = 0;
      let halfDays = 0;

      if (r.units !== undefined && r.units !== null && !r.workerCount) {
        units = Number(r.units) || 0;
        if (units === 0.5) {
          halfDays = 1;
        } else {
          fullDays = 1;
        }
      } else {
        units = count * factor;
        if (isHalfDay) {
          halfDays = count;
        } else {
          fullDays = count;
        }
      }

      if (!categoryMap[categoryKey]) {
        categoryMap[categoryKey] = {
          categoryKey,
          categoryName,
          dailyRate,
          fullDays: 0,
          halfDays: 0,
          totalWorkingUnits: 0,
          totalAmount: 0
        };
      }

      if (categoryMap[categoryKey].dailyRate === 0 && dailyRate > 0) {
        categoryMap[categoryKey].dailyRate = dailyRate;
      }

      categoryMap[categoryKey].fullDays += fullDays;
      categoryMap[categoryKey].halfDays += halfDays;
      categoryMap[categoryKey].totalWorkingUnits += units;
    });

    const categoriesList = Object.values(categoryMap).map(cat => {
      const totalAmount = cat.totalWorkingUnits * cat.dailyRate;
      grandTotalCost += totalAmount;
      grandTotalUnits += cat.totalWorkingUnits;
      grandTotalFullDays += cat.fullDays;
      grandTotalHalfDays += cat.halfDays;
      return {
        ...cat,
        totalAmount
      };
    });

    categoriesList.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    let selectedSiteName = "All Sites (Aggregated)";
    if (filterSiteId !== "all") {
      const sObj = sites.find(s => s.id === filterSiteId);
      if (sObj) selectedSiteName = sObj.siteName;
    }

    let periodString = "All Available Dates";
    if (filterStartDate && filterEndDate) {
      periodString = `${filterStartDate} to ${filterEndDate}`;
    } else if (filterStartDate) {
      periodString = `From ${filterStartDate}`;
    } else if (filterEndDate) {
      periodString = `Up to ${filterEndDate}`;
    }

    let totalAdvancePaid = 0;
    labourPayments.forEach(p => {
      if (filterSiteId !== "all" && p.siteId !== filterSiteId) return;
      if (filterTeamId !== "all" && p.teamId && p.teamId !== filterTeamId) return;
      const pDate = formatDateToString(p.date);
      if (filterStartDate && pDate < filterStartDate) return;
      if (filterEndDate && pDate > filterEndDate) return;
      totalAdvancePaid += Number(p.amount) || 0;
    });

    const netPayable = Math.max(0, grandTotalCost - totalAdvancePaid);

    return {
      categories: categoriesList,
      grandTotalCost,
      totalAdvancePaid,
      netPayable,
      grandTotalUnits,
      grandTotalFullDays,
      grandTotalHalfDays,
      selectedSiteName,
      periodString,
      hasRecords: categoriesList.length > 0
    };
  }, [labourAttendance, labourPayments, teams, labourMaster, filterSiteId, filterTeamId, filterStartDate, filterEndDate, allowedSiteIds, sites]);

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
          if (m.category === "Steel") unitCost = 5000;
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

  // Dynamic Material Report Data (Date Range, Live Data, Single Data Source)
  const materialReportData = useMemo(() => {
    let grandTotalCost = 0;
    let totalQuantity = 0;
    const records = [];

    materials.forEach(m => {
      // 1. Site Filter & Security Scope
      if (filterSiteId !== "all" && m.siteId !== filterSiteId) return;
      if (!allowedSiteIds.has(m.siteId)) return;

      // 2. Date Range Filter (From Date -> To Date)
      const recordDate = formatDateToString(m.purchaseDate || m.date);
      if (!recordDate) return;
      if (filterStartDate && recordDate < filterStartDate) return;
      if (filterEndDate && recordDate > filterEndDate) return;

      // 3. Status filter (only approved or valid logs)
      const isApproved = m.status === "approved" || m.status === "Approved" || m.status === undefined;
      if (!isApproved) return;

      const sObj = sites.find(s => s.id === m.siteId);
      const siteName = sObj ? sObj.siteName : "Unknown Site";
      const quantity = Number(m.quantity) || 0;
      let unitPrice = Number(m.unitPrice !== undefined ? m.unitPrice : m.defaultUnitPrice);
      if (isNaN(unitPrice) || unitPrice <= 0) {
        if (m.totalAmount && quantity > 0) {
          unitPrice = Number(m.totalAmount) / quantity;
        } else {
          unitPrice = m.category === "Steel" ? 65000 : (m.category === "Cement" ? 380 : 500);
        }
      }

      let totalAmount = Number(m.totalAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        totalAmount = quantity * unitPrice;
      }

      grandTotalCost += totalAmount;
      totalQuantity += quantity;

      records.push({
        id: m.id,
        purchaseDate: recordDate,
        siteName,
        materialName: m.materialName || "Material",
        unit: m.unit || "Unit",
        quantity,
        unitPrice,
        totalAmount
      });
    });

    records.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));

    let selectedSiteName = "All Sites (Aggregated)";
    if (filterSiteId !== "all") {
      const sObj = sites.find(s => s.id === filterSiteId);
      if (sObj) selectedSiteName = sObj.siteName;
    }

    let periodString = "All Available Dates";
    if (filterStartDate && filterEndDate) {
      periodString = `${filterStartDate} to ${filterEndDate}`;
    } else if (filterStartDate) {
      periodString = `From ${filterStartDate}`;
    } else if (filterEndDate) {
      periodString = `Up to ${filterEndDate}`;
    }

    return {
      records,
      grandTotalCost,
      totalQuantity,
      selectedSiteName,
      periodString,
      hasRecords: records.length > 0
    };
  }, [materials, filterSiteId, filterStartDate, filterEndDate, allowedSiteIds, sites]);

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
      filename = `Labour_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Labour Category", "Daily Rate (INR)", "Full Days (1.0)", "Half Days (0.5)", "Total Working Units", "Total Amount (INR)"];

      if (labourReportData.categories.length === 0) {
        rows.push(["No attendance records found for the selected date range.", "", "", "", "", ""]);
      } else {
        labourReportData.categories.forEach(cat => {
          rows.push([
            `"${cat.categoryName}"`,
            cat.dailyRate,
            cat.fullDays,
            cat.halfDays,
            cat.totalWorkingUnits.toFixed(1),
            cat.totalAmount.toFixed(2)
          ]);
        });
        rows.push([
          '"Grand Total"',
          "-",
          labourReportData.grandTotalFullDays,
          labourReportData.grandTotalHalfDays,
          labourReportData.grandTotalUnits.toFixed(1),
          labourReportData.grandTotalCost.toFixed(2)
        ]);
      }
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
      filename = `Expense_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Site Expenses", "Material Expenses", "Labour Expenses", "Other Expenses", "Total Expenses"];
      rows.push([
        expenseReportData.siteExpense,
        expenseReportData.materialExpense,
        expenseReportData.labourExpense,
        expenseReportData.otherExpense,
        expenseReportData.totalExpense
      ]);
    } else if (type === "budget") {
      filename = `Budget_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Total Budget", "Total Expense", "Remaining Budget", "Budget Usage %"];
      rows.push([
        budgetReportData.budget,
        budgetReportData.expense,
        budgetReportData.remainingBudget,
        budgetReportData.usagePercent.toFixed(1) + "%"
      ]);
    } else if (type === "material_report" || type === "material") {
      filename = `Material_Report_${new Date().toISOString().split("T")[0]}.${extension}`;
      headers = ["Date", "Site Name", "Material Name", "Unit", "Quantity Used", "Unit Price (INR)", "Total Amount (INR)"];
      if (materialReportData.records.length === 0) {
        rows.push(["No material records found for the selected date range.", "", "", "", "", "", ""]);
      } else {
        materialReportData.records.forEach(r => {
          rows.push([
            r.purchaseDate,
            `"${r.siteName}"`,
            `"${r.materialName}"`,
            r.unit,
            r.quantity,
            r.unitPrice,
            r.totalAmount
          ]);
        });
        rows.push(["TOTAL", `"${materialReportData.selectedSiteName}"`, "", "", materialReportData.totalQuantity, "", materialReportData.grandTotalCost]);
      }
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
      const timer = setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isPrinting]);

  if (loading) {
    return (
      <Layout title="BI Console" description="Aggregating corporate datasets...">
        <Loading show={true} text="Assembling Management dashboard..." />
      </Layout>
    );
  }

  // Label resolving for printable header titles
  const getSelectedReportTemplateLabel = () => {
    switch (reportTemplate) {
      case "daily_attendance": return "Daily Attendance Report Summary";
      case "weekly_attendance": return "Weekly Site Attendance Report Summary";
      case "monthly_attendance": return "Monthly Site Attendance Report Summary";
      case "labour": return "Labour Counter Allocation Ledger";
      case "salary": return "Salary &amp; Payroll Cost Ledger";
      case "expense": return "Consolidated Site Expense Breakdowns";
      case "budget": return "Project Budgets &amp; Utilization Standings";
      default: return "Corporate Statement";
    }
  };

  return (
    <Layout
      title="Reports & Analytics Dashboard"
      description="Corporate Business Intelligence monitors, milestone comparisons, and export-ready dynamic tables."
    >
      {/* Dynamic landscape or portrait print stylesheet overrides */}
      {reportTemplate === "weekly_attendance" || reportTemplate === "monthly_attendance" || reportTemplate === "labour" ? (
        <style>{`@media print { @page { size: landscape; } }`}</style>
      ) : (
        <style>{`@media print { @page { size: portrait; } }`}</style>
      )}

      {/* Printable CSS style definitions (modular design) */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff;
            color: #000000;
          }
          .no-print, header, footer, nav, aside, .sidebar, .navbar, .filters-card {
            display: none !important;
          }
          .printable-report-container {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            z-index: 9999;
          }
          @page {
            margin: 15mm 15mm 15mm 15mm;
          }
        }
        
        .printable-report-container {
          display: none;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
          background: #ffffff;
        }
        
        .report-header-block {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        
        .printable-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          font-size: 11px;
        }
        
        .printable-table th {
          background-color: #f1f5f9 !important;
          border: 1px solid #94a3b8;
          padding: 8px 10px;
          font-weight: 700;
          text-align: left;
          color: #0f172a;
        }
        
        .printable-table td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          color: #334155;
        }
      `}</style>

      {/* FILTER & DATE CONTROLS BAR (Hidden in print) */}
      <Card variant="default" className="filters-card no-print" style={{ marginBottom: "24px", padding: "16px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
          
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", flex: 1 }}>
            {/* Site selector dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "150px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Project</label>
              <select
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Assigned Sites</option>
                {userSites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            {/* Team selector dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "150px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Labour Team</label>
              <select
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Labour Teams</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.teamName}</option>
                ))}
              </select>
            </div>

            {/* Site Engineer selector dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "150px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Site Engineer</label>
              <select
                value={filterEngineerId}
                onChange={(e) => setFilterEngineerId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Engineers</option>
                {engineers.map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.fullName}</option>
                ))}
              </select>
            </div>

            {/* Date range inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>From Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>To Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              />
            </div>

            {/* Month selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "100px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Month</label>
              <select
                value={filterMonthVal}
                onChange={(e) => setFilterMonthVal(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            {/* Year selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "95px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Year</label>
              <select
                value={filterYearVal}
                onChange={(e) => setFilterYearVal(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Years</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

          </div>

          {/* Report template selector */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-700)", textTransform: "uppercase" }}>PDF Template Select</label>
              <select
                value={reportTemplate}
                onChange={(e) => setReportTemplate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1.5px solid var(--accent-500)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px", fontWeight: "700" }}
              >
                <option value="daily_attendance">Daily Attendance Report</option>
                <option value="weekly_attendance">Weekly Attendance Report</option>
                <option value="monthly_attendance">Monthly Attendance Report</option>
                <option value="labour">Labour Allocation Report</option>
                <option value="salary">Salary &amp; Payroll Report</option>
                <option value="expense">Expense Report</option>
                <option value="budget">Budget Report</option>
              </select>
            </div>

            <Button
              variant="primary"
              icon={Printer}
              onClick={handlePrint}
              style={{ fontSize: "12px", padding: "8px 12.5px", backgroundColor: "var(--accent-600)" }}
            >
              Generate PDF Report
            </Button>
          </div>

        </div>
      </Card>

      {/* TABS NAVIGATION */}
      <div className="no-print" style={{ display: "flex", gap: "10px", marginBottom: "24px", borderBottom: "2px solid var(--border-color)", paddingBottom: "10px", overflowX: "auto" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "overview" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "overview" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Grid size={16} />
          Management Overview
        </button>
        <button
          onClick={() => setActiveTab("attendance_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "attendance_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "attendance_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <ClipboardCheck size={16} />
          Attendance Report
        </button>
        <button
          onClick={() => setActiveTab("labour_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "labour_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "labour_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Users size={16} />
          Labour Report
        </button>
        <button
          onClick={() => setActiveTab("material_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "material_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "material_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <FileText size={16} />
          Material Report
        </button>
        <button
          onClick={() => setActiveTab("salary_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "salary_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "salary_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <DollarSign size={16} />
          Salary Report
        </button>
        <button
          onClick={() => setActiveTab("expense_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "expense_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "expense_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <TrendingUp size={16} />
          Expense Report
        </button>
        <button
          onClick={() => setActiveTab("budget_report")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "budget_report" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "budget_report" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Building2 size={16} />
          Budget Report
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. OVERVIEW TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          {/* Main Key Indicators Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            
            <Card style={{ borderLeft: "4px solid var(--primary-500)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Corporate Projects</span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
                <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary-950)" }}>{overallMetrics.totalSites}</span>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "6px" }}>
                  <span style={{ color: "var(--success-600)", fontWeight: "700" }}>{overallMetrics.completedSites} Done</span>
                  <span>•</span>
                  <span style={{ color: "var(--primary-600)", fontWeight: "700" }}>{overallMetrics.activeSites} Active</span>
                </div>
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--danger-500)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Milestone Delays</span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
                <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--danger-700)" }}>{overallMetrics.delayedSites}</span>
                <Badge status={overallMetrics.delayedSites > 0 ? "warning" : "success"}>
                  {overallMetrics.delayedSites > 0 ? "Risk Flagged" : "On Schedule"}
                </Badge>
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--success-500)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Financial Value</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--success-700)" }}>{formatINR(overallMetrics.totalBudget)}</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Accrued Budget</span>
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--accent-500)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Accumulated Cost</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
                <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--accent-700)" }}>{formatINR(overallMetrics.totalExpenses)}</span>
                <span style={{ fontSize: "11px", color: "var(--danger-600)", fontWeight: "600" }}>Pending payouts: {formatINR(overallMetrics.pendingPayments)}</span>
              </div>
            </Card>

          </div>

          {/* Charts & Deviation Monitor */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            <Card title="Average Corporate Execution Progress">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", gap: "16px" }}>
                <div style={{
                  position: "relative",
                  width: "140px",
                  height: "140px",
                  borderRadius: "50%",
                  background: `conic-gradient(var(--primary-600) ${overallMetrics.overallProgress}%, var(--primary-100) 0)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <div style={{
                    position: "absolute",
                    width: "110px",
                    height: "110px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <span style={{ fontSize: "28px", fontWeight: "900", color: "var(--primary-900)" }}>{overallMetrics.overallProgress}%</span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Avg Complete</span>
                  </div>
                </div>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                    <span>Budget Invoiced (Work completed)</span>
                    <span style={{ fontWeight: "700" }}>{formatINR(overallMetrics.paymentsReceived)}</span>
                  </div>
                  <div style={{ height: "8px", width: "100%", backgroundColor: "var(--primary-100)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${overallMetrics.overallProgress}%`, backgroundColor: "var(--primary-600)", borderRadius: "4px" }} />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Important Actions & Security Operations Ledger" subtitle="Review approvals and delayed schedule warnings.">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", backgroundColor: overallMetrics.pendingApprovals > 0 ? "var(--warning-50)" : "var(--success-50)", borderRadius: "6px", border: `1px solid ${overallMetrics.pendingApprovals > 0 ? "var(--warning-200)" : "var(--success-200)"}` }}>
                  {overallMetrics.pendingApprovals > 0 ? (
                    <>
                      <AlertTriangle size={18} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--warning-800)" }}>
                        {overallMetrics.pendingApprovals} Requisition(s) pending approval
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-800)" }}>
                        No pending approvals in workflow queue
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", backgroundColor: overallMetrics.delayedSites > 0 ? "var(--danger-50)" : "var(--success-50)", borderRadius: "6px", border: `1px solid ${overallMetrics.delayedSites > 0 ? "var(--danger-200)" : "var(--success-200)"}` }}>
                  {overallMetrics.delayedSites > 0 ? (
                    <>
                      <AlertTriangle size={18} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--danger-800)" }}>
                        {overallMetrics.delayedSites} Site(s) has delayed schedule milestones
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-800)" }}>
                        All projects timeline executing on schedule
                      </span>
                    </>
                  )}
                </div>

                <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "12px", marginTop: "4px" }}>
                  <Link to="/superadmin/approvals" style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--primary-700)", textDecoration: "none" }} className="no-print">
                    Go to Approval Center queue →
                  </Link>
                </div>
              </div>
            </Card>

          </div>
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
                          <td className="font-mono">{r.attendanceDate}</td>
                          <td style={{ fontWeight: "700" }}>{siteObj.siteName}</td>
                          <td>{teamObj.teamName}</td>
                          <td>{r.categoryId}</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{r.workerCount || 1}</td>
                          <td>
                            <Badge status={r.attendanceType === "Full Day" ? "success" : "warning"}>
                              {r.attendanceType || "Full Day"}
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
                        if (filterSiteId !== "all" && a.siteId !== filterSiteId) return;
                        if (!allowedSiteIds.has(a.siteId)) return;
                        if (!matchesDateFilters(a.date)) return;
                        records.push({
                          id: `att_${eng.id}_${a.date}`,
                          date: a.date,
                          name: eng.fullName,
                          time: a.checkInTime || "--",
                          status: "Present",
                          photoUrl: a.checkInPhotoUrl || a.photoUrl || null
                        });
                      });

                      const leavesList = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));
                      leavesList.forEach(l => {
                        if (!matchesDateFilters(l.date)) return;
                        records.push({
                          id: `lv_${eng.id}_${l.date}`,
                          date: l.date,
                          name: eng.fullName,
                          time: "--",
                          status: l.type === "half_day" ? "Half Day Leave" : "Approved Leave",
                          photoUrl: null
                        });
                      });
                    });

                    records.sort((a, b) => b.date.localeCompare(a.date));

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
                        <td className="font-mono">{rec.date}</td>
                        <td style={{ fontWeight: "700" }}>{rec.name}</td>
                        <td className="font-mono">{rec.time}</td>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Labour Report (Date Range)</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Accrued labor working units and total cost calculated from live attendance records
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button onClick={() => exportToExcel("labour", "xls")} variant="outline" icon={Download}>Export Excel</Button>
              <Button onClick={() => exportToExcel("labour", "csv")} variant="outline" icon={Download}>Export CSV</Button>
            </div>
          </div>
          
          {/* Professional Summary Section at Top */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <Card style={{ borderLeft: "4px solid var(--primary-600)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Report Period</span>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", marginTop: "8px" }}>
                {labourReportData.periodString}
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--accent-600)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Site Name</span>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", marginTop: "8px" }}>
                {labourReportData.selectedSiteName}
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid #3b82f6" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Gross Amount</span>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#1e40af", marginTop: "6px" }}>
                {formatINR(labourReportData.grandTotalCost)}
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid #eab308" }}>
              <span style={{ fontSize: "11px", color: "#854d0e", fontWeight: "700", textTransform: "uppercase" }}>Advance Paid</span>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#ca8a04", marginTop: "6px" }}>
                {formatINR(labourReportData.totalAdvancePaid)}
              </div>
            </Card>

            <Card style={{ borderLeft: "4px solid #22c55e" }}>
              <span style={{ fontSize: "11px", color: "#15803d", fontWeight: "700", textTransform: "uppercase" }}>Net Payable</span>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#16a34a", marginTop: "6px" }}>
                {formatINR(labourReportData.netPayable)}
              </div>
            </Card>
          </div>

          {/* Validation: If no records exist */}
          {!labourReportData.hasRecords ? (
            <div style={{
              padding: "32px",
              textAlign: "center",
              backgroundColor: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: "8px",
              color: "#854d0e"
            }}>
              <AlertTriangle size={32} style={{ marginBottom: "12px", color: "#ca8a04" }} />
              <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700" }}>No Attendance Records Found</h4>
              <p style={{ margin: 0, fontSize: "13.5px" }}>No attendance records found for the selected date range.</p>
            </div>
          ) : (
            <Card title="Labour Category Cost &amp; Working Units Breakdown" variant="table">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Labour Category</th>
                      <th style={{ textAlign: "right" }}>Daily Rate</th>
                      <th style={{ textAlign: "right" }}>Full Days (1.0)</th>
                      <th style={{ textAlign: "right" }}>Half Days (0.5)</th>
                      <th style={{ textAlign: "right" }}>Total Working Units</th>
                      <th style={{ textAlign: "right" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourReportData.categories.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: "700", color: "var(--primary-900)" }}>{row.categoryName}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(row.dailyRate)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{row.fullDays}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{row.halfDays}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{row.totalWorkingUnits.toFixed(1)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "var(--success-700)" }}>
                          {formatINR(row.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#f8fafc", fontWeight: "800" }}>
                      <td style={{ fontWeight: "800", fontSize: "14px", color: "var(--primary-950)" }}>Gross Labour Cost</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{labourReportData.grandTotalFullDays}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{labourReportData.grandTotalHalfDays}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "14px" }}>{labourReportData.grandTotalUnits.toFixed(1)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "15px", color: "#1e40af" }}>
                        {formatINR(labourReportData.grandTotalCost)}
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: "#fefce8", fontWeight: "800" }}>
                      <td colSpan={5} style={{ color: "#854d0e" }}>Less: Labour Advance Paid</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "14px", color: "#ca8a04" }}>
                        - {formatINR(labourReportData.totalAdvancePaid)}
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: "#f0fdf4", fontWeight: "900" }}>
                      <td colSpan={5} style={{ color: "#15803d", fontSize: "14px" }}>NET PAYABLE TO LABOUR / SUBCONTRACTOR</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "16px", color: "#16a34a" }}>
                        {formatINR(labourReportData.netPayable)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MATERIAL REPORT TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "material_report" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <Card
            title={`Material Consumption & Procurement Report — ${materialReportData.selectedSiteName}`}
            subtitle={`Filtered by Date Range (${materialReportData.periodString}). Single Data Source (Firestore live entries).`}
            headerActions={
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="outline" size="sm" onClick={() => exportToExcel("material_report", "csv")} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Download size={14} />
                  <span>Export CSV</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handlePrintReport("material_report")} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Printer size={14} />
                  <span>Print PDF</span>
                </Button>
              </div>
            }
          >
            {/* Metric Overview Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "24px"
            }}>
              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>Report Period</span>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>{materialReportData.periodString}</div>
              </div>
              <div style={{ backgroundColor: "#f0f9ff", padding: "16px", borderRadius: "12px", border: "1px solid #bae6fd" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "#0369a1", textTransform: "uppercase" }}>Total Logged Records</span>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#0284c7", marginTop: "4px" }}>{materialReportData.records.length}</div>
              </div>
              <div style={{ backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "#15803d", textTransform: "uppercase" }}>Total Material Quantity</span>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>{materialReportData.totalQuantity}</div>
              </div>
              <div style={{ backgroundColor: "#faf5ff", padding: "16px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "#7e22ce", textTransform: "uppercase" }}>Grand Total Cost</span>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#9333ea", marginTop: "4px", fontFamily: "monospace" }}>{formatINR(materialReportData.grandTotalCost)}</div>
              </div>
            </div>

            {!materialReportData.hasRecords ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "40px 0", margin: 0 }}>
                No material records found for the selected date range.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Site Name</th>
                      <th>Material Name</th>
                      <th>Unit</th>
                      <th style={{ textAlign: "right" }}>Quantity Used</th>
                      <th style={{ textAlign: "right" }}>Unit Price</th>
                      <th style={{ textAlign: "right" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialReportData.records.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td className="font-mono">{r.purchaseDate}</td>
                        <td style={{ fontWeight: "700" }}>{r.siteName}</td>
                        <td style={{ fontWeight: "700" }}>{r.materialName}</td>
                        <td><Badge status="pending">{r.unit}</Badge></td>
                        <td style={{ textAlign: "right", fontWeight: "700" }} className="font-mono">{r.quantity}</td>
                        <td style={{ textAlign: "right" }} className="font-mono">₹{r.unitPrice.toLocaleString("en-IN")}</td>
                        <td style={{ textAlign: "right", fontWeight: "800" }} className="font-mono">{formatINR(r.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#f8fafc", fontWeight: "900" }}>
                      <td colSpan={4} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Totals ({materialReportData.selectedSiteName})
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "14px", color: "#16a34a" }}>
                        {materialReportData.totalQuantity}
                      </td>
                      <td style={{ textAlign: "right" }}>—</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "15px", color: "#9333ea" }}>
                        {formatINR(materialReportData.grandTotalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Corporate Expense Report</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Site-wise approved expenses classified by material supply, labor payroll, general, and miscellaneous categories</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <Button onClick={() => exportToExcel("expense", "xls")} variant="outline" icon={Download}>Export Excel</Button>
              <Button onClick={() => exportToExcel("expense", "csv")} variant="outline" icon={Download}>Export CSV</Button>
            </div>
          </div>
          
          <Card title="Approved Project Expenditures Breakdown" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "right" }}>Site Expenses</th>
                    <th style={{ textAlign: "right" }}>Material Expenses</th>
                    <th style={{ textAlign: "right" }}>Labour Expenses</th>
                    <th style={{ textAlign: "right" }}>Other Expenses</th>
                    <th style={{ textAlign: "right", fontWeight: "700" }}>Total Project Expense</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.siteExpense)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.materialExpense)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.labourExpense)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.otherExpense)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "800", fontSize: "14px" }}>{formatINR(expenseReportData.totalExpense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
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
        <div className="report-header-block" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 15L15 45H25V85H75V45H85L50 15Z" fill="#1e293b" />
              <path d="M50 15L85 45H75V85H25V45H15L50 15Z" stroke="#e65100" strokeWidth="6" strokeLinejoin="round" />
              <rect x="42" y="55" width="16" height="30" fill="#ffffff" />
            </svg>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a", fontFamily: "Outfit" }}>Apex Construction Group</h2>
              <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Corporate Field Operations &amp; Auditing Ledger</span>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "10px", color: "#475569" }}>
            <div><strong>Report Date:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
            <div><strong>Generated By:</strong> {userProfile?.fullName || "System Admin"} ({userProfile?.role || "Admin"})</div>
          </div>
        </div>

        {/* Report metadata block */}
        <div style={{ marginBottom: "20px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <h1 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase", borderBottom: "1.5px solid #cbd5e1", paddingBottom: "6px" }}>
            {getSelectedReportTemplateLabel()}
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px", fontSize: "11px", color: "#334155" }}>
            <div><strong>Site Scope:</strong> {filterSiteId === "all" ? "All Corporate Sites" : (sites.find(s => s.id === filterSiteId)?.siteName || "Selected Site")}</div>
            <div><strong>Engineer Selection:</strong> {filterEngineerId === "all" ? "All Engineers" : (engineers.find(e => e.id === filterEngineerId)?.fullName || "Selected Engineer")}</div>
            <div><strong>Filter Date Range:</strong> {filterStartDate ? `${filterStartDate} to ${filterEndDate || "Today"}` : "All Recorded Periods"}</div>
            <div><strong>Target Month / Year:</strong> {filterMonthVal !== "all" ? filterMonthVal : "All Months"} / {filterYearVal !== "all" ? filterYearVal : "All Years"}</div>
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
                      if (filterSiteId !== "all" && a.siteId !== filterSiteId) return;
                      if (!matchesDateFilters(a.date)) return;
                      records.push({
                        id: `att_${eng.id}_${a.date}`,
                        date: a.date,
                        name: eng.fullName,
                        time: a.checkInTime || "--",
                        status: "Present",
                        photoUrl: a.checkInPhotoUrl || a.photoUrl || null
                      });
                    });
                    const leavesList = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));
                    leavesList.forEach(l => {
                      if (!matchesDateFilters(l.date)) return;
                      records.push({
                        id: `lv_${eng.id}_${l.date}`,
                        date: l.date,
                        name: eng.fullName,
                        time: "--",
                        status: l.type === "half_day" ? "Half Day Leave" : "Approved Leave",
                        photoUrl: null
                      });
                    });
                  });
                  records.sort((a, b) => b.date.localeCompare(a.date));
                  if (records.length === 0) {
                    return <tr><td colSpan={5} style={{ textAlign: "center" }}>No check-in logs registered.</td></tr>;
                  }
                  return records.map(r => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{r.name}</td>
                      <td>{r.time}</td>
                      <td>{r.status}</td>
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
                        <td>{r.attendanceDate}</td>
                        <td>{siteObj.siteName}</td>
                        <td>{teamObj.teamName}</td>
                        <td>{r.categoryId}</td>
                        <td style={{ textAlign: "right" }}>{r.workerCount || 1}</td>
                        <td>{r.attendanceType || "Full Day"}</td>
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

        {/* PDF TEMPLATE: MATERIAL REPORT */}
        {(reportTemplate === "material_report" || activeTab === "material_report") && (
          <div>
            <div style={{ marginBottom: "16px", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", backgroundColor: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                <span><strong>Report Period:</strong> {materialReportData.periodString}</span>
                <span><strong>Site Name:</strong> {materialReportData.selectedSiteName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span><strong>Total Material Quantity Used:</strong> {materialReportData.totalQuantity}</span>
                <span><strong>Grand Total Material Cost:</strong> {formatINR(materialReportData.grandTotalCost)}</span>
              </div>
            </div>

            {!materialReportData.hasRecords ? (
              <div style={{ padding: "20px", textAlign: "center", fontStyle: "italic", color: "#64748b" }}>
                No material records found for the selected date range.
              </div>
            ) : (
              <table className="printable-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Site Name</th>
                    <th>Material Name</th>
                    <th>Unit</th>
                    <th style={{ textAlign: "right" }}>Quantity Used</th>
                    <th style={{ textAlign: "right" }}>Unit Price</th>
                    <th style={{ textAlign: "right" }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {materialReportData.records.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.purchaseDate}</td>
                      <td>{row.siteName}</td>
                      <td>{row.materialName}</td>
                      <td>{row.unit}</td>
                      <td style={{ textAlign: "right" }}>{row.quantity}</td>
                      <td style={{ textAlign: "right" }}>₹{row.unitPrice.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right" }}>{formatINR(row.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: "bold", backgroundColor: "#f1f5f9" }}>
                    <td colSpan={4}>Grand Total</td>
                    <td style={{ textAlign: "right" }}>{materialReportData.totalQuantity}</td>
                    <td style={{ textAlign: "right" }}>-</td>
                    <td style={{ textAlign: "right" }}>{formatINR(materialReportData.grandTotalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* PDF TEMPLATE: LABOUR REPORT */}
        {reportTemplate === "labour" && (
          <div>
            <div style={{ marginBottom: "16px", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", backgroundColor: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                <span><strong>Report Period:</strong> {labourReportData.periodString}</span>
                <span><strong>Site Name:</strong> {labourReportData.selectedSiteName}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "8px", fontSize: "12px" }}>
                <div><strong>Gross Amount:</strong> {formatINR(labourReportData.grandTotalCost)}</div>
                <div><strong>Advance Paid:</strong> {formatINR(labourReportData.totalAdvancePaid)}</div>
                <div><strong>Net Payable:</strong> {formatINR(labourReportData.netPayable)}</div>
              </div>
            </div>

            {!labourReportData.hasRecords ? (
              <div style={{ padding: "20px", textAlign: "center", fontStyle: "italic", color: "#64748b" }}>
                No attendance records found for the selected date range.
              </div>
            ) : (
              <table className="printable-table">
                <thead>
                  <tr>
                    <th>Labour Category</th>
                    <th style={{ textAlign: "right" }}>Daily Rate</th>
                    <th style={{ textAlign: "right" }}>Full Days (1.0)</th>
                    <th style={{ textAlign: "right" }}>Half Days (0.5)</th>
                    <th style={{ textAlign: "right" }}>Total Working Units</th>
                    <th style={{ textAlign: "right" }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {labourReportData.categories.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.categoryName}</td>
                      <td style={{ textAlign: "right" }}>{formatINR(row.dailyRate)}</td>
                      <td style={{ textAlign: "right" }}>{row.fullDays}</td>
                      <td style={{ textAlign: "right" }}>{row.halfDays}</td>
                      <td style={{ textAlign: "right" }}>{row.totalWorkingUnits.toFixed(1)}</td>
                      <td style={{ textAlign: "right" }}>{formatINR(row.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: "bold", backgroundColor: "#f1f5f9" }}>
                    <td>Gross Labour Cost</td>
                    <td style={{ textAlign: "right" }}>-</td>
                    <td style={{ textAlign: "right" }}>{labourReportData.grandTotalFullDays}</td>
                    <td style={{ textAlign: "right" }}>{labourReportData.grandTotalHalfDays}</td>
                    <td style={{ textAlign: "right" }}>{labourReportData.grandTotalUnits.toFixed(1)}</td>
                    <td style={{ textAlign: "right" }}>{formatINR(labourReportData.grandTotalCost)}</td>
                  </tr>
                  <tr style={{ fontWeight: "bold", backgroundColor: "#fefce8" }}>
                    <td colSpan={5}>Less: Labour Advance Paid</td>
                    <td style={{ textAlign: "right", color: "#ca8a04" }}>- {formatINR(labourReportData.totalAdvancePaid)}</td>
                  </tr>
                  <tr style={{ fontWeight: "bold", backgroundColor: "#f0fdf4" }}>
                    <td colSpan={5}>Net Payable to Labour / Subcontractor</td>
                    <td style={{ textAlign: "right", color: "#16a34a" }}>{formatINR(labourReportData.netPayable)}</td>
                  </tr>
                </tfoot>
              </table>
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
            <table className="printable-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "right" }}>Site Expenses</th>
                  <th style={{ textAlign: "right" }}>Material Expenses</th>
                  <th style={{ textAlign: "right" }}>Labour Expenses</th>
                  <th style={{ textAlign: "right" }}>Other Expenses</th>
                  <th style={{ textAlign: "right" }}>Total Expense Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: "right" }}>{formatINR(expenseReportData.siteExpense)}</td>
                  <td style={{ textAlign: "right" }}>{formatINR(expenseReportData.materialExpense)}</td>
                  <td style={{ textAlign: "right" }}>{formatINR(expenseReportData.labourExpense)}</td>
                  <td style={{ textAlign: "right" }}>{formatINR(expenseReportData.otherExpense)}</td>
                  <td style={{ textAlign: "right", fontWeight: "700" }}>{formatINR(expenseReportData.totalExpense)}</td>
                </tr>
              </tbody>
            </table>
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

        {/* Signature Verification Block */}
        <div style={{ borderTop: "1.5px solid #94a3b8", marginTop: "40px", paddingTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
          <p>Document Security Verification: APEX-BI-{new Date().getFullYear()}-{Math.floor(Math.random() * 90000) + 10000}</p>
          <div style={{ textAlign: "right" }}>
            <p style={{ borderTop: "1.5px solid #0f172a", width: "160px", display: "inline-block", marginTop: "24px" }}></p>
            <p style={{ margin: "2px 0 0 0" }}>Authorized Signature</p>
          </div>
        </div>

      </div>

      {/* TABS CONTAINER */}
      <div className="no-print">
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Main Key Indicators Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
              
              <Card style={{ borderLeft: "4px solid var(--primary-500)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Corporate Projects</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary-950)" }}>{overallMetrics.totalSites}</span>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "6px" }}>
                    <span style={{ color: "var(--success-600)", fontWeight: "700" }}>{overallMetrics.completedSites} Done</span>
                    <span>•</span>
                    <span style={{ color: "var(--primary-600)", fontWeight: "700" }}>{overallMetrics.activeSites} Active</span>
                  </div>
                </div>
              </Card>

              <Card style={{ borderLeft: "4px solid var(--danger-500)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Milestone Delays</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--danger-700)" }}>{overallMetrics.delayedSites}</span>
                  <Badge status={overallMetrics.delayedSites > 0 ? "warning" : "success"}>
                    {overallMetrics.delayedSites > 0 ? "Risk Flagged" : "On Schedule"}
                  </Badge>
                </div>
              </Card>

              <Card style={{ borderLeft: "4px solid var(--success-500)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Financial Value</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
                  <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--success-700)" }}>{formatINR(overallMetrics.totalBudget)}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Accrued Budget</span>
                </div>
              </Card>

              <Card style={{ borderLeft: "4px solid var(--accent-500)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Accumulated Cost</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
                  <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--accent-700)" }}>{formatINR(overallMetrics.totalExpenses)}</span>
                  <span style={{ fontSize: "11px", color: "var(--danger-600)", fontWeight: "600" }}>Pending payouts: {formatINR(overallMetrics.pendingPayments)}</span>
                </div>
              </Card>

            </div>

            {/* Charts & Deviation Monitor */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
              
              <Card title="Average Corporate Execution Progress">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 0", gap: "16px" }}>
                  <div style={{
                    position: "relative",
                    width: "140px",
                    height: "140px",
                    borderRadius: "50%",
                    background: `conic-gradient(var(--primary-600) ${overallMetrics.overallProgress}%, var(--primary-100) 0)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      width: "110px",
                      height: "110px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <span style={{ fontSize: "28px", fontWeight: "900", color: "var(--primary-900)" }}>{overallMetrics.overallProgress}%</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Avg Complete</span>
                    </div>
                  </div>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>Budget Invoiced (Work completed)</span>
                      <span style={{ fontWeight: "700" }}>{formatINR(overallMetrics.paymentsReceived)}</span>
                    </div>
                    <div style={{ height: "8px", width: "100%", backgroundColor: "var(--primary-100)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${overallMetrics.overallProgress}%`, backgroundColor: "var(--primary-600)", borderRadius: "4px" }} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Important Actions & Security Operations Ledger" subtitle="Review approvals and delayed schedule warnings.">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", backgroundColor: overallMetrics.pendingApprovals > 0 ? "var(--warning-50)" : "var(--success-50)", borderRadius: "6px", border: `1px solid ${overallMetrics.pendingApprovals > 0 ? "var(--warning-200)" : "var(--success-200)"}` }}>
                    {overallMetrics.pendingApprovals > 0 ? (
                      <>
                        <AlertTriangle size={18} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--warning-800)" }}>
                          {overallMetrics.pendingApprovals} Requisition(s) pending approval
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-800)" }}>
                          No pending approvals in workflow queue
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", backgroundColor: overallMetrics.delayedSites > 0 ? "var(--danger-50)" : "var(--success-50)", borderRadius: "6px", border: `1px solid ${overallMetrics.delayedSites > 0 ? "var(--danger-200)" : "var(--success-200)"}` }}>
                    {overallMetrics.delayedSites > 0 ? (
                      <>
                        <AlertTriangle size={18} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--danger-800)" }}>
                          {overallMetrics.delayedSites} Site(s) has delayed schedule milestones
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-800)" }}>
                          All projects timeline executing on schedule
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "12px", marginTop: "4px" }}>
                    <Link to="/superadmin/approvals" style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--primary-700)", textDecoration: "none" }} className="no-print">
                      Go to Approval Center queue →
                    </Link>
                  </div>
                </div>
              </Card>

            </div>
          </div>
        )}

        {/* 2. ATTENDANCE REPORT TAB PANEL */}
        {activeTab === "attendance_report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Attendance Report Summary</h3>
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
                            <td className="font-mono">{r.attendanceDate}</td>
                            <td style={{ fontWeight: "700" }}>{siteObj.siteName}</td>
                            <td>{teamObj.teamName}</td>
                            <td>{r.categoryId}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{r.workerCount || 1}</td>
                            <td>
                              <Badge status={r.attendanceType === "Full Day" ? "success" : "warning"}>
                                {r.attendanceType || "Full Day"}
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
                          if (filterSiteId !== "all" && a.siteId !== filterSiteId) return;
                          if (!allowedSiteIds.has(a.siteId)) return;
                          if (!matchesDateFilters(a.date)) return;
                          records.push({
                            id: `att_${eng.id}_${a.date}`,
                            date: a.date,
                            name: eng.fullName,
                            time: a.checkInTime || "--",
                            status: "Present",
                            photoUrl: a.checkInPhotoUrl || a.photoUrl || null
                          });
                        });

                        const leavesList = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));
                        leavesList.forEach(l => {
                          if (!matchesDateFilters(l.date)) return;
                          records.push({
                            id: `lv_${eng.id}_${l.date}`,
                            date: l.date,
                            name: eng.fullName,
                            time: "--",
                            status: l.type === "half_day" ? "Half Day Leave" : "Approved Leave",
                            photoUrl: null
                          });
                        });
                      });

                      records.sort((a, b) => b.date.localeCompare(a.date));

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
                          <td className="font-mono">{rec.date}</td>
                          <td style={{ fontWeight: "700" }}>{rec.name}</td>
                          <td className="font-mono">{rec.time}</td>
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

        {/* 3. LABOUR REPORT TAB PANEL */}
        {activeTab === "labour_report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Labour Units &amp; Allocation Report</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Accrued units of labor categorized by team, active worker counts, and period totals</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button onClick={() => exportToExcel("labour", "xls")} variant="outline" icon={Download}>Export Excel</Button>
                <Button onClick={() => exportToExcel("labour", "csv")} variant="outline" icon={Download}>Export CSV</Button>
              </div>
            </div>
            
            <Card title="Labour Allocation Summary" variant="table">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Labour Team</th>
                      <th>Labour Category</th>
                      <th style={{ textAlign: "right" }}>Worker Count (Anchor Date)</th>
                      <th style={{ textAlign: "right" }}>Daily Units</th>
                      <th style={{ textAlign: "right" }}>Weekly Units</th>
                      <th style={{ textAlign: "right" }}>Monthly Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const anchor = filterStartDate || new Date().toISOString().split("T")[0];
                      const grouped = {};

                      labourAttendance.forEach(r => {
                        if (filterSiteId !== "all" && r.siteId !== filterSiteId) return;
                        if (filterTeamId !== "all" && r.teamId !== filterTeamId) return;
                        if (!allowedSiteIds.has(r.siteId)) return;
                        
                        const key = `${r.teamId}_${r.categoryId}`;
                        if (!grouped[key]) {
                          grouped[key] = {
                            teamId: r.teamId,
                            categoryId: r.categoryId,
                            dailyUnits: 0,
                            weeklyUnits: 0,
                            monthlyUnits: 0,
                            workerCount: 0
                          };
                        }

                        const count = Number(r.workerCount) || 1;
                        const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
                        const units = count * factor;

                        if (r.attendanceDate === anchor) {
                          grouped[key].dailyUnits += units;
                          grouped[key].workerCount += count;
                        }
                        if (isDateInWeek(r.attendanceDate, anchor)) {
                          grouped[key].weeklyUnits += units;
                        }
                        if (isDateInMonth(r.attendanceDate, anchor)) {
                          grouped[key].monthlyUnits += units;
                        }
                      });

                      const rows = Object.values(grouped);
                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                              No active labor allocation logs found matching the selected parameters.
                            </td>
                          </tr>
                        );
                      }

                      return rows.map((row, i) => {
                        const teamObj = teams.find(t => t.id === row.teamId) || { teamName: "Unknown Team" };
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: "700" }}>{teamObj.teamName}</td>
                            <td style={{ fontWeight: "600", color: "var(--primary-600)" }}>{row.categoryId}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{row.workerCount}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{row.dailyUnits.toFixed(1)}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{row.weeklyUnits.toFixed(1)}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>{row.monthlyUnits.toFixed(1)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 4. SALARY REPORT TAB PANEL */}
        {activeTab === "salary_report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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

        {/* 5. EXPENSE REPORT TAB PANEL */}
        {activeTab === "expense_report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Corporate Expense Report</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Site-wise approved expenses classified by material supply, labor payroll, general, and miscellaneous categories</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button onClick={() => exportToExcel("expense", "xls")} variant="outline" icon={Download}>Export Excel</Button>
                <Button onClick={() => exportToExcel("expense", "csv")} variant="outline" icon={Download}>Export CSV</Button>
              </div>
            </div>
            
            <Card title="Approved Project Expenditures Breakdown" variant="table">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "right" }}>Site Expenses</th>
                      <th style={{ textAlign: "right" }}>Material Expenses</th>
                      <th style={{ textAlign: "right" }}>Labour Expenses</th>
                      <th style={{ textAlign: "right" }}>Other Expenses</th>
                      <th style={{ textAlign: "right", fontWeight: "700" }}>Total Project Expense</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.siteExpense)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.materialExpense)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.labourExpense)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(expenseReportData.otherExpense)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "800", fontSize: "14px" }}>{formatINR(expenseReportData.totalExpense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 6. BUDGET REPORT TAB PANEL */}
        {activeTab === "budget_report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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
      </div>

    </Layout>
  );
}

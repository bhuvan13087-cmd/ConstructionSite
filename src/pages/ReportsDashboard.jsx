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
  const matchesDateFilters = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.split("T")[0];
    
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

  const isWithinDateRange = (dateStr) => {
    return matchesDateFilters(dateStr);
  };

  // Helper date utilities
  const isDateInWeek = (dateStr, anchorStr) => {
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

  const isDateInMonth = (dateStr, anchorStr) => {
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
      headers = ["Labour Team", "Labour Category", "Worker Count", "Daily Units", "Weekly Units", "Monthly Units"];

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

      Object.values(grouped).forEach(row => {
        const teamObj = teams.find(t => t.id === row.teamId) || { teamName: "Unknown Team" };
        rows.push([
          `"${teamObj.teamName}"`,
          row.categoryId,
          row.workerCount,
          row.dailyUnits.toFixed(1),
          row.weeklyUnits.toFixed(1),
          row.monthlyUnits.toFixed(1)
        ]);
      });
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
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>End Date</label>
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

        {/* PDF TEMPLATE: LABOUR REPORT */}
        {reportTemplate === "labour" && (
          <div>
            <table className="printable-table">
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
                  if (rows.length === 0) return <tr><td colSpan={6} style={{ textAlign: "center" }}>No labour logs available.</td></tr>;
                  return rows.map((row, idx) => {
                    const teamObj = teams.find(t => t.id === row.teamId) || { teamName: "Unknown Team" };
                    return (
                      <tr key={idx}>
                        <td>{teamObj.teamName}</td>
                        <td>{row.categoryId}</td>
                        <td style={{ textAlign: "right" }}>{row.workerCount}</td>
                        <td style={{ textAlign: "right" }}>{row.dailyUnits.toFixed(1)}</td>
                        <td style={{ textAlign: "right" }}>{row.weeklyUnits.toFixed(1)}</td>
                        <td style={{ textAlign: "right" }}>{row.monthlyUnits.toFixed(1)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
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

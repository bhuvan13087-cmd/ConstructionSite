import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getMaterialsDetailed,
  getLabourDailyCountsSummary,
  getLabourMaster,
  getGeneralExpenses,
  getLabourPayments,
  getSystemActivities,
  getCentralApprovals,
  getAllDocuments,
  getDailyUpdatesForSite
} from "../services/firebaseService";
import {
  calculatePlannedProgress,
  getSiteFinancials,
  calculateOverallFinancials,
  isSiteDelayed,
  generateWeeklyReportFromDprs,
  generateMonthlyReportFromDprs
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
  Grid
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

  // Navigation tabs: overview, performance, progress, financial
  const [activeTab, setActiveTab] = useState("overview");

  // Filters State
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Progress sub-tabs: daily, weekly, monthly
  const [progressViewType, setProgressViewType] = useState("daily");

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        fetchedSites,
        fetchedMaterials,
        fetchedLabourMaster,
        fetchedGeneralExpenses,
        fetchedLabourPayments,
        fetchedApprovals,
        fetchedDocs
      ] = await Promise.all([
        getSites(),
        getMaterialsDetailed(),
        getLabourMaster(),
        getGeneralExpenses(),
        getLabourPayments(),
        getCentralApprovals(),
        getAllDocuments()
      ]);

      setSites(fetchedSites);
      setMaterials(fetchedMaterials);
      setLabourMaster(fetchedLabourMaster.categories || {});
      setGeneralExpenses(fetchedGeneralExpenses);
      setLabourPayments(fetchedLabourPayments);
      setApprovals(fetchedApprovals);
      setDocuments(fetchedDocs);

      // Fetch DPRs & Labor history for each site in parallel
      const dprsPromises = fetchedSites.map(s => getDailyUpdatesForSite(s.id));
      const laborPromises = fetchedSites.map(s => getLabourDailyCountsSummary(s.id));
      
      const dprsResults = await Promise.all(dprsPromises);
      const laborResults = await Promise.all(laborPromises);

      const combinedDprs = [];
      dprsResults.forEach((siteDprs, index) => {
        const siteId = fetchedSites[index].id;
        siteDprs.forEach(d => {
          combinedDprs.push({ ...d, siteId });
        });
      });
      setAllDprs(combinedDprs);

      const laborMap = {};
      laborResults.forEach((history, index) => {
        const siteId = fetchedSites[index].id;
        laborMap[siteId] = history;
      });
      setLaborHistoryMap(laborMap);

    } catch (err) {
      console.error("Reports dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
    return {}; // Simple lookup placeholder for rendering
  }, []);

  // Filtered Sites list
  const filteredSites = useMemo(() => {
    return sites.filter(s => filterSiteId === "all" || s.id === filterSiteId);
  }, [sites, filterSiteId]);

  // Apply Date Range Filter helper
  const isWithinDateRange = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.split("T")[0];
    if (filterStartDate && cleanDate < filterStartDate) return false;
    if (filterEndDate && cleanDate > filterEndDate) return false;
    return true;
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
      } else if (site.status === "Delayed" || isSiteDelayed(site)) {
        delayedCount++;
      } else {
        activeCount++;
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

    // Group expenses monthly
    const monthlyMap = {};

    filteredSites.forEach(site => {
      const siteMats = materials.filter(m => m.siteId === site.id);
      const siteLabour = labourHistoryMap[site.id] || [];
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
        let dayCost = 0;
        Object.keys(l).forEach(key => {
          if (["date", "total", "engineerId", "id", "siteId"].includes(key)) return;
          let mKey = key;
          if (key === "Masons") mKey = "Mason";
          if (key === "Helpers") mKey = "Helper";
          if (key === "Painters") mKey = "Painter";
          if (key === "Plumbers") mKey = "Plumber";
          if (key === "Electricians") mKey = "Electrician";
          if (key === "Others") mKey = "Other";

          const count = Number(l[key]) || 0;
          const rateObj = labourMaster[mKey] || {};
          const rate = Number(rateObj.wage) || (mKey === "Mason" ? 800 : 500);
          dayCost += count * rate;
        });

        labourCost += dayCost;
        if (l.date && isWithinDateRange(l.date)) {
          const mKey = l.date.substring(0, 7);
          monthlyMap[mKey] = (monthlyMap[mKey] || 0) + dayCost;
        }
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
  }, [filteredSites, materials, labourHistoryMap, generalExpenses, labourMaster, filterStartDate, filterEndDate]);

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
  }, [filteredSites, allDprs, filterStartDate, filterEndDate]);

  // Aggregated Weekly Reports
  const weeklyReportsList = useMemo(() => {
    return generateWeeklyReportFromDprs(dprsCombinedSorted);
  }, [dprsCombinedSorted]);

  // Aggregated Monthly Reports
  const monthlyReportsList = useMemo(() => {
    return generateMonthlyReportFromDprs(dprsCombinedSorted);
  }, [dprsCombinedSorted]);

  // CSV Exporter Action
  const exportToCSV = (type) => {
    let headers = [];
    let rows = [];
    let filename = "";

    if (type === "financial") {
      filename = `Consolidated_Financial_Report_${new Date().toISOString().split("T")[0]}.csv`;
      headers = ["Site Name", "Client", "Total Budget", "Material Spent", "Labour Spent", "Other Spent", "Total Expenses", "Payments Received", "Owed Balance", "Progress Percent", "Schedule Delay"];
      
      siteFinancialsList.forEach(({ site, financials }) => {
        const delay = isSiteDelayed(site) ? "Delayed" : "On Schedule";
        rows.push([
          `"${site.siteName}"`,
          `"${site.clientName || "--"}"`,
          financials.budget,
          financials.materialExpenses,
          financials.labourExpenses,
          financials.otherExpenses,
          financials.totalSpent,
          financials.paymentsReceived,
          financials.remainingBalance,
          `${financials.progressPercent}%`,
          delay
        ]);
      });
    } else {
      filename = `Milestone_Progress_Report_${new Date().toISOString().split("T")[0]}.csv`;
      headers = ["Site Name", "Date", "Progress", "Completed Work Summary", "Problems/Issues Faced", "Pending Works"];
      
      dprsCombinedSorted.forEach(dpr => {
        rows.push([
          `"${dpr.siteName}"`,
          dpr.resolvedDate,
          `"${dpr.progress || dpr.completionPercent || 0}%"`,
          `"${(dpr.completedToday || dpr.description || "").replace(/"/g, '""')}"`,
          `"${(dpr.problemsFaced || "None").replace(/"/g, '""')}"`,
          `"${(dpr.pendingWork || "None").replace(/"/g, '""')}"`
        ]);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Layout title="BI Console" description="Aggregating corporate datasets...">
        <Loading show={true} text="Assembling Management dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout
      title="Reports & Analytics Dashboard"
      description="Corporate Business Intelligence monitors, milestone comparisons, schedule risk tracking, and export-ready logs."
    >
      {/* FILTER & DATE CONTROLS BAR (Hidden in print) */}
      <Card variant="default" className="filters-card no-print" style={{ marginBottom: "24px", padding: "16px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
          
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", flex: 1 }}>
            {/* Site selector dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
              <label style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase" }}>Filter by Project</label>
              <select
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Corporate Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
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
          </div>

          {/* Export and print actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => exportToCSV("financial")}
              style={{ fontSize: "12px", padding: "8px 12px" }}
            >
              CSV Financials
            </Button>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => exportToCSV("progress")}
              style={{ fontSize: "12px", padding: "8px 12px" }}
            >
              CSV DPR logs
            </Button>
            <Button
              variant="primary"
              icon={Printer}
              onClick={handlePrint}
              style={{ fontSize: "12px", padding: "8px 12px", backgroundColor: "var(--primary-800)" }}
            >
              Print / PDF
            </Button>
          </div>

        </div>
      </Card>

      {/* DASHBOARD CONSOLE TABS NAVIGATION (Hidden in print) */}
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
          onClick={() => setActiveTab("performance")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "performance" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "performance" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Building2 size={16} />
          Site Performance
        </button>
        <button
          onClick={() => setActiveTab("progress")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "progress" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "progress" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Activity size={16} />
          Progress Reports
        </button>
        <button
          onClick={() => setActiveTab("financial")}
          style={{
            padding: "8px 16px",
            border: "none",
            backgroundColor: "transparent",
            borderBottom: activeTab === "financial" ? "3px solid var(--primary-600)" : "3px solid transparent",
            color: activeTab === "financial" ? "var(--primary-900)" : "var(--text-muted)",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <DollarSign size={16} />
          Financial Analytics
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. OVERVIEW TAB PANEL */}
      {/* ==================================================================== */}
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

          {/* Overall Company Progress and Action tasks */}
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
      {/* 2. PERFORMANCE TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Site Comparisons rankings */}
          <Card variant="table" title="Project Rankings & Scheduling Deviation Monitor" subtitle="Side-by-side performance ranking by completion rate, budget alignment, and milestone deviations.">
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Project Site</th>
                  <th style={{ textAlign: "right" }}>Actual Progress</th>
                  <th style={{ textAlign: "right" }}>Planned Target</th>
                  <th style={{ textAlign: "right" }}>Gap</th>
                  <th>Schedule status</th>
                  <th>Budget</th>
                  <th>Expenses</th>
                </tr>
              </thead>
              <tbody>
                {siteFinancialsList
                  .sort((a, b) => b.financials.progressPercent - a.financials.progressPercent)
                  .map(({ site, financials, plannedProgress }, index) => {
                    const gap = financials.progressPercent - plannedProgress;
                    const delay = isSiteDelayed(site);
                    return (
                      <tr key={site.id}>
                        <td style={{ fontWeight: "700", color: "var(--text-muted)" }}>#{index + 1}</td>
                        <td style={{ fontWeight: "800", color: "var(--primary-900)" }}>{site.siteName}</td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>{financials.progressPercent}%</td>
                        <td style={{ textAlign: "right" }}>{plannedProgress}%</td>
                        <td style={{ textAlign: "right", fontWeight: "800", color: gap >= 0 ? "var(--success-700)" : "var(--danger-700)" }}>
                          {gap >= 0 ? `+${gap}%` : `${gap}%`}
                        </td>
                        <td>
                          <Badge status={delay ? "danger" : "success"}>
                            {delay ? "Delayed Milestone" : "On Track"}
                          </Badge>
                        </td>
                        <td style={{ fontFamily: "monospace" }}>{formatINR(financials.budget)}</td>
                        <td style={{ fontFamily: "monospace", color: financials.totalSpent > financials.budget ? "var(--danger-600)" : "inherit" }}>
                          {formatINR(financials.totalSpent)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PROGRESS TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "progress" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Progress aggregation type toggle filters */}
          <div className="no-print" style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
            <Button
              variant={progressViewType === "daily" ? "primary" : "outline"}
              onClick={() => setProgressViewType("daily")}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Daily Progress logs
            </Button>
            <Button
              variant={progressViewType === "weekly" ? "primary" : "outline"}
              onClick={() => setProgressViewType("weekly")}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Weekly Consolidations
            </Button>
            <Button
              variant={progressViewType === "monthly" ? "primary" : "outline"}
              onClick={() => setProgressViewType("monthly")}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              Monthly Reports
            </Button>
          </div>

          {/* PROGRESS LOGS LIST */}
          <Card title={`${progressViewType.charAt(0).toUpperCase() + progressViewType.slice(1)} Progress Report Consolidation`}>
            
            {progressViewType === "daily" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {dprsCombinedSorted.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "20px" }}>No progress logs registered for the selected filters.</p>
                ) : (
                  dprsCombinedSorted.map((dpr, idx) => (
                    <div key={dpr.id || idx} style={{ borderBottom: "1.5px solid var(--border-color)", paddingBottom: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "14px", color: "var(--primary-950)" }}>{dpr.siteName}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>Submitted by: {dpr.engineerName || "Site Engineer"}</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-600)" }} className="font-mono">{dpr.resolvedDate}</span>
                      </div>
                      
                      <div style={{ display: "flex", gap: "10px", alignItems: "baseline", marginTop: "4px" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "800", backgroundColor: "var(--primary-50)", color: "var(--primary-800)", padding: "2px 8px", borderRadius: "4px" }}>
                          Progress: {dpr.progress || dpr.completionPercent || 0}%
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginTop: "6px", fontSize: "12.5px" }}>
                        <div>
                          <strong style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Work completed Today</strong>
                          <span>{dpr.completedToday || dpr.description || "--"}</span>
                        </div>
                        <div>
                          <strong style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Delay / Problems Faced</strong>
                          <span style={{ color: dpr.problemsFaced ? "var(--danger-700)" : "inherit", fontWeight: dpr.problemsFaced ? "600" : "normal" }}>{dpr.problemsFaced || "No major issues faced"}</span>
                        </div>
                        <div>
                          <strong style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Pending Tasks</strong>
                          <span>{dpr.pendingWork || "--"}</span>
                        </div>
                      </div>

                      {/* Display Photos if base64 file data URL exists */}
                      {dpr.photoUrl && (
                        <div style={{ marginTop: "10px" }} className="no-print">
                          <strong style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>Photo attachment</strong>
                          <img src={dpr.photoUrl} alt="progress documentation" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "6px", objectFit: "cover", border: "1.5px solid var(--border-color)" }} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {progressViewType === "weekly" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {weeklyReportsList.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "20px" }}>No historical updates available to consolidate weekly milestones.</p>
                ) : (
                  weeklyReportsList.map((week, idx) => (
                    <div key={idx} style={{ borderBottom: "1.5px solid var(--border-color)", paddingBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-900)" }}>{week.weekLabel}</span>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--success-700)" }}>Consolidated Growth: +{week.progressChange}%</span>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
                        <div>
                          <strong style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Aggregated Completed Activities</strong>
                          <p style={{ margin: "2px 0 0 0" }}>{week.completedWork}</p>
                        </div>
                        <div>
                          <strong style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Pending Activities Remaining</strong>
                          <p style={{ margin: "2px 0 0 0" }}>{week.pendingActivities}</p>
                        </div>
                      </div>

                      {week.delayReasons && (
                        <div style={{ fontSize: "13px", padding: "8px 12px", backgroundColor: "var(--danger-50)", borderLeft: "3px solid var(--danger-500)", borderRadius: "4px" }}>
                          <strong>Accrued timeline issues:</strong> {week.delayReasons}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {progressViewType === "monthly" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {monthlyReportsList.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "20px" }}>No historical updates available to compile monthly aggregates.</p>
                ) : (
                  monthlyReportsList.map((month, idx) => (
                    <div key={idx} style={{ borderBottom: "1.5px solid var(--border-color)", paddingBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-900)" }}>{month.monthLabel}</span>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--success-700)" }}>Monthly Progress: +{month.progressChange}%</span>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
                        <div>
                          <strong style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Consolidated Completed Activities</strong>
                          <p style={{ margin: "2px 0 0 0" }}>{month.completedWork}</p>
                        </div>
                        <div>
                          <strong style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Accrued Pending Tasks</strong>
                          <p style={{ margin: "2px 0 0 0" }}>{month.pendingActivities}</p>
                        </div>
                      </div>

                      {month.delayReasons && (
                        <div style={{ fontSize: "13px", padding: "8px 12px", backgroundColor: "var(--danger-50)", borderLeft: "3px solid var(--danger-500)", borderRadius: "4px" }}>
                          <strong>Reported scheduling bottlenecks:</strong> {month.delayReasons}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. FINANCIAL TAB PANEL */}
      {/* ==================================================================== */}
      {activeTab === "financial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Charts Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            <Card title="Corporate Expenditures Breakdown" subtitle="Renders comparative percentage ratios of expenditure channels.">
              <DonutChart data={costAnalysisData.donutData} />
            </Card>

            <Card title="Project Budget vs Actual Cost Accruals" subtitle="Identifies cost overruns side-by-side per active site.">
              <BarChartComponent data={siteFinancialsList.map(item => ({
                label: item.site.siteName,
                budget: item.financials.budget,
                expense: item.financials.totalSpent
              }))} />
            </Card>

            <Card title="Monthly Accrued Expense TrendLine" subtitle="Accrues historical expenditure trends across materials, labour, and payouts.">
              <LineChartComponent data={costAnalysisData.trendData} />
            </Card>

          </div>

          {/* Consolidated Financial ledger details */}
          <Card variant="table" title="Corporate Financial Audits Ledger" subtitle="Aggregation of budgets, materials supply invoice value, accrued daily wages, and owed balances.">
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th style={{ textAlign: "right" }}>Total Budget</th>
                  <th style={{ textAlign: "right" }}>Material Costs</th>
                  <th style={{ textAlign: "right" }}>Labour Accrued</th>
                  <th style={{ textAlign: "right" }}>General Expenses</th>
                  <th style={{ textAlign: "right" }}>Total Spent</th>
                  <th style={{ textAlign: "right" }}>Payments Received</th>
                  <th style={{ textAlign: "right" }}>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {siteFinancialsList.map(({ site, financials }) => (
                  <tr key={site.id}>
                    <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.budget)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.materialExpenses)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.labourExpenses)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.otherExpenses)}</td>
                    <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace" }}>{formatINR(financials.totalSpent)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.paymentsReceived)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.remainingBalance)}</td>
                  </tr>
                ))}
                
                {/* Aggregated sums row */}
                <tr style={{ fontWeight: "800", borderTop: "2px solid #000" }}>
                  <td>Totals</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalBudget)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.materialExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.labourExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.otherExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalExpenses)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.paymentsReceived)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalBudget - overallMetrics.paymentsReceived)}</td>
                </tr>
              </tbody>
            </table>
          </Card>

        </div>
      )}

      {/* ==================================================================== */}
      {/* PRINT-ONLY AUDIT PAPER REPORT CONTAINER */}
      {/* ==================================================================== */}
      <div style={{ display: "none" }} className="print-only-report printable-report">
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e293b", paddingBottom: "16px", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", color: "#0f172a", fontWeight: "900", textTransform: "uppercase" }}>Apex Construction Group</h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b", fontWeight: "700" }}>Corporate Head Office, Chennai, Tamil Nadu</p>
            <h3 style={{ margin: "16px 0 0 0", fontSize: "16px", color: "#1e293b", fontWeight: "800" }}>
              Consolidated Performance, Milestones & Financial Audits Ledger
            </h3>
          </div>
          <div style={{ textAlign: "right", fontSize: "10px", color: "#64748b" }}>
            <p style={{ margin: 0 }}><strong>Report Date:</strong> {new Date().toLocaleDateString()}</p>
            <p style={{ margin: "2px 0 0 0" }}><strong>Run By:</strong> {userProfile?.fullName || "System Administrator"}</p>
          </div>
        </div>

        {/* Financial Summary print table */}
        <h4 style={{ fontSize: "14px", color: "#0f172a", borderBottom: "1.5px solid #cbd5e1", paddingBottom: "4px", margin: "16px 0 8px 0" }}>Financial Auditing Summary</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left", fontWeight: "800" }}>
              <th style={{ padding: "6px 2px" }}>Site Name</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Total Budget</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Material Costs</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Labour Costs</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Other Costs</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Total Spent</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Received (Client)</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Owed Balance</th>
            </tr>
          </thead>
          <tbody>
            {siteFinancialsList.map(({ site, financials }) => (
              <tr key={site.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "6px 2px", fontWeight: "700" }}>{site.siteName}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.budget)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.materialExpenses)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.labourExpenses)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.otherExpenses)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right", fontWeight: "700" }}>{formatINR(financials.totalSpent)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.paymentsReceived)}</td>
                <td style={{ padding: "6px 2px", textAlign: "right" }}>{formatINR(financials.remainingBalance)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: "800", borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000" }}>
              <td style={{ padding: "8px 2px" }}>Grand Aggregated Totals</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(overallMetrics.totalBudget)}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.materialExpenses, 0))}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.labourExpenses, 0))}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(siteFinancialsList.reduce((acc, curr) => acc + curr.financials.otherExpenses, 0))}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(overallMetrics.totalExpenses)}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(overallMetrics.paymentsReceived)}</td>
              <td style={{ padding: "8px 2px", textAlign: "right" }}>{formatINR(overallMetrics.totalBudget - overallMetrics.paymentsReceived)}</td>
            </tr>
          </tbody>
        </table>

        {/* Milestone progress print table */}
        <h4 style={{ fontSize: "14px", color: "#0f172a", borderBottom: "1.5px solid #cbd5e1", paddingBottom: "4px", margin: "24px 0 8px 0" }}>Scheduling & Progress Status</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left", fontWeight: "800" }}>
              <th style={{ padding: "6px 2px" }}>Site Name</th>
              <th style={{ padding: "6px 2px" }}>Status</th>
              <th style={{ padding: "6px 2px" }}>Start Date</th>
              <th style={{ padding: "6px 2px" }}>End Date</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Actual Progress</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Planned Target</th>
              <th style={{ padding: "6px 2px", textAlign: "right" }}>Progress Gap</th>
              <th style={{ padding: "6px 2px" }}>Delay status</th>
            </tr>
          </thead>
          <tbody>
            {siteFinancialsList.map(({ site, financials, plannedProgress }) => {
              const delay = isSiteDelayed(site);
              const gap = financials.progressPercent - plannedProgress;
              return (
                <tr key={site.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "6px 2px", fontWeight: "700" }}>{site.siteName}</td>
                  <td style={{ padding: "6px 2px" }}>{site.status || "Planning"}</td>
                  <td style={{ padding: "6px 2px" }}>{site.startDate}</td>
                  <td style={{ padding: "6px 2px" }}>{site.expectedEndDate}</td>
                  <td style={{ padding: "6px 2px", textAlign: "right", fontWeight: "700" }}>{financials.progressPercent}%</td>
                  <td style={{ padding: "6px 2px", textAlign: "right" }}>{plannedProgress}%</td>
                  <td style={{ padding: "6px 2px", textAlign: "right", fontWeight: "700", color: gap >= 0 ? "var(--success-700)" : "var(--danger-700)" }}>
                    {gap >= 0 ? `+${gap}%` : `${gap}%`}
                  </td>
                  <td style={{ padding: "6px 2px" }}>
                    {delay ? "Delayed Schedule" : "On Schedule"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Signature lines */}
        <div style={{ borderTop: "1.5px solid #cbd5e1", marginTop: "40px", paddingTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
          <p>Document Verification Code: APEX-BI-{new Date().getFullYear()}-{Math.floor(Math.random() * 90000) + 10000}</p>
          <div style={{ textAlign: "right" }}>
            <p style={{ borderTop: "1.5px solid #1e293b", width: "160px", display: "inline-block", marginTop: "24px" }}></p>
            <p style={{ margin: "2px 0 0 0" }}>Authorized Officer Signature</p>
          </div>
        </div>

      </div>

    </Layout>
  );
}

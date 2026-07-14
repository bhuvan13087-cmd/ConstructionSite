import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { 
  resolveApprovalRequest,
  syncApprovalsFromLegacy
} from "../services/firebaseService";
import { 
  onSnapshot,
  collection,
  query,
  where
} from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { 
  Check, 
  X, 
  Filter, 
  Calendar, 
  User, 
  Package, 
  MapPin, 
  Layers, 
  AlertCircle, 
  ExternalLink,
  CreditCard,
  Users
} from "lucide-react";

export default function ApprovalsDashboard() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Data States
  const [engineers, setEngineers] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  
  // Filter States
  const [filterType, setFilterType] = useState("all"); // "all", "Leave", "Location", "Material", "Payment", "Labour"
  const [filterStatus, setFilterStatus] = useState("pending"); // "all", "pending", "approved", "rejected"
  const [filterDate, setFilterDate] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const db = getFirebaseDb();
    setLoading(true);

    const runLegacySync = async () => {
      try {
        await syncApprovalsFromLegacy();
      } catch (e) {
        console.warn("Legacy sync warning:", e);
      }
    };
    runLegacySync();

    let engineersLoaded = false;
    let approvalsLoaded = false;

    const checkLoadingComplete = () => {
      if (engineersLoaded && approvalsLoaded) {
        setLoading(false);
      }
    };

    let unsubLegacyEngineers = null;
    const unsubEngineers = onSnapshot(collection(db, "siteEngineers"), (snapshot) => {
      if (snapshot.empty) {
        if (unsubLegacyEngineers) unsubLegacyEngineers();
        const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
        unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
          const list = [];
          legacySnap.forEach(docSnap => {
            const data = docSnap.data();
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

    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setAllRequests(list);
      approvalsLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Approvals listener error:", err);
      approvalsLoaded = true;
      checkLoadingComplete();
    });

    return () => {
      unsubEngineers();
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      unsubApprovals();
    };
  }, [userProfile]);

  // Calculate Metrics
  const pendingCount = allRequests.filter(r => r.status === "pending" || r.status === "Pending").length;
  const approvedCount = allRequests.filter(r => r.status === "approved" || r.status === "Approved").length;
  const rejectedCount = allRequests.filter(r => r.status === "rejected" || r.status === "Rejected").length;
  const totalCount = allRequests.length;

  // Apply filters
  const filteredRequests = allRequests.filter(r => {
    const rStatus = (r.status || "").toLowerCase();
    const fStatus = filterStatus.toLowerCase();
    
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterStatus !== "all" && rStatus !== fStatus) return false;
    if (filterDate && r.requestDate !== filterDate) return false;
    if (filterEngineer && r.engineerId !== filterEngineer) return false;
    return true;
  });

  // Approval Handlers
  const handleApprove = async (req) => {
    if (!window.confirm(`Approve this ${req.type} request?`)) return;
    setLoading(true);
    try {
      await resolveApprovalRequest(req.id, "Approved", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
      showToast(`${req.type} request approved successfully.`, "success");
    } catch (err) {
      console.error("Approve failed:", err);
      showToast(`Approval failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (req) => {
    if (!window.confirm(`Reject this ${req.type} request?`)) return;
    setLoading(true);
    try {
      await resolveApprovalRequest(req.id, "Rejected", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
      showToast(`${req.type} request rejected.`, "info");
    } catch (err) {
      console.error("Reject failed:", err);
      showToast(`Rejection failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="dashboard-content" style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* Toast Alert */}
        {toast.show && (
          <div className={`toast toast-${toast.type}`} style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            backgroundColor: toast.type === "success" ? "var(--success-500)" : toast.type === "error" ? "var(--danger-500)" : "var(--primary-600)",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <AlertCircle size={18} />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-family-title)", fontSize: "28px", fontWeight: 800, color: "var(--primary-950)", letterSpacing: "-0.02em" }}>
              Approval Management Console
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
              Centralized interface to review and resolve all site requisitions, general expense payments, leaves, and configurations.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="erp-kpi-grid" style={{ marginBottom: "24px" }}>
          <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--warning-500)" }}>
            <div className="erp-kpi-content">
              <span className="erp-kpi-label">Pending Action</span>
              <span className="erp-kpi-num">{pendingCount}</span>
              <span className="erp-kpi-footer" style={{ color: "var(--warning-600)" }}>Awaiting verification review</span>
            </div>
          </div>

          <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--success-500)" }}>
            <div className="erp-kpi-content">
              <span className="erp-kpi-label">Total Approved</span>
              <span className="erp-kpi-num">{approvedCount}</span>
              <span className="erp-kpi-footer" style={{ color: "var(--success-600)" }}>Audits verified resolved</span>
            </div>
          </div>

          <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--danger-500)" }}>
            <div className="erp-kpi-content">
              <span className="erp-kpi-label">Total Rejected</span>
              <span className="erp-kpi-num">{rejectedCount}</span>
              <span className="erp-kpi-footer" style={{ color: "var(--danger-600)" }}>Denied audits logged</span>
            </div>
          </div>

          <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--accent-500)" }}>
            <div className="erp-kpi-content">
              <span className="erp-kpi-label">Total Submissions</span>
              <span className="erp-kpi-num">{totalCount}</span>
              <span className="erp-kpi-footer">Overall console submissions</span>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <Card style={{ padding: "16px", marginBottom: "20px", backgroundColor: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
            <Filter size={14} style={{ color: "var(--accent-600)" }} />
            <strong style={{ fontSize: "13px", color: "var(--primary-900)" }}>Filter Requisitions Queue</strong>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "750", color: "var(--primary-700)", textTransform: "uppercase" }}>Approval Type</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px", height: "36px" }}
              >
                <option value="all">All Request Types</option>
                <option value="Leave">Leaves</option>
                <option value="Location">Locations</option>
                <option value="Material">Materials</option>
                <option value="Payment">Payments & Expenses</option>
                <option value="Labour">Labour Requests</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "750", color: "var(--primary-700)", textTransform: "uppercase" }}>Status</label>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px", height: "36px" }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "750", color: "var(--primary-700)", textTransform: "uppercase" }}>Submission Date</label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px", height: "36px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: "750", color: "var(--primary-700)", textTransform: "uppercase" }}>Site Engineer</label>
              <select 
                value={filterEngineer} 
                onChange={(e) => setFilterEngineer(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px", height: "36px" }}
              >
                <option value="">All Engineers</option>
                {engineers.map(e => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Requests List */}
        <Card variant="table" style={{ padding: "0", overflow: "hidden", backgroundColor: "#fff" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: "700", color: "var(--primary-900)", fontSize: "14px" }}>
              All Requests Queue ({filteredRequests.length} listed)
            </span>
            <Badge status={filterStatus === "pending" ? "pending" : "success"}>
              Status Filter: {filterStatus.toUpperCase()}
            </Badge>
          </div>

          {filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
              <AlertCircle size={32} style={{ color: "var(--primary-300)", marginBottom: "12px" }} />
              <p style={{ fontWeight: "600", fontSize: "14px", margin: "0" }}>No matching approval requests found.</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Modify type or status filter selectors.</p>
            </div>
          ) : (
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Employee</th>
                    <th>Details / Specification</th>
                    <th>Site / Project</th>
                    <th>Requested Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => {
                    const isPending = (req.status || "").toLowerCase() === "pending";
                    return (
                      <tr key={`${req.type}-${req.id}-${index}`}>
                        
                        {/* Type Badge */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {req.type === "Leave" && <Layers size={14} style={{ color: "var(--warning-500)" }} />}
                            {req.type === "Location" && <MapPin size={14} style={{ color: "var(--accent-600)" }} />}
                            {req.type === "Material" && <Package size={14} style={{ color: "var(--primary-600)" }} />}
                            {req.type === "Payment" && <CreditCard size={14} style={{ color: "var(--success-500)" }} />}
                            {req.type === "Labour" && <Users size={14} style={{ color: "var(--danger-500)" }} />}
                            <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--primary-800)" }}>{req.type}</span>
                          </div>
                        </td>

                        {/* Employee Name */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div className="avatar-initials info">
                              {(req.requestedBy || "SE").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--primary-900)", fontWeight: "600" }}>{req.requestedBy}</span>
                          </div>
                        </td>

                        {/* Details */}
                        <td style={{ maxWidth: "350px" }}>
                          <div style={{ fontSize: "12.5px", color: "var(--primary-950)", fontWeight: "600", lineHeight: "1.4" }}>
                            {req.details}
                          </div>
                        </td>

                        {/* Site */}
                        <td>
                          <strong style={{ fontSize: "13px", color: req.siteName === "N/A" ? "var(--text-muted)" : "var(--primary-900)" }}>
                            {req.siteName}
                          </strong>
                        </td>

                        {/* Date */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Calendar size={13} style={{ color: "var(--text-muted)" }} />
                            <span>{req.requestDate}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>
                          <Badge status={req.status}>
                            {req.status === "pending" || req.status === "Pending" ? "Pending Approval" : req.status.toUpperCase()}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td>
                          {isPending ? (
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleApprove(req)}
                                style={{ 
                                  borderColor: "var(--success-600)", 
                                  color: "var(--success-600)", 
                                  backgroundColor: "var(--success-50)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  height: "30px !important",
                                  padding: "4px 10px !important"
                                }}
                              >
                                <Check size={12} /> Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleReject(req)}
                                style={{ 
                                  borderColor: "var(--danger-500)", 
                                  color: "var(--danger-600)", 
                                  backgroundColor: "var(--danger-50)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  height: "30px !important",
                                  padding: "4px 10px !important"
                                }}
                              >
                                <X size={12} /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", display: "block", textAlign: "right" }}>
                              Audited
                            </span>
                          )}
                        </td>
                        
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
      <Loading show={loading} text="Updating approval state..." />
    </Layout>
  );
}

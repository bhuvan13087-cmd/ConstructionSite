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
        <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "30px" }}>
          <Card style={{ borderLeft: "4px solid var(--warning-500)", padding: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Pending Action</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{pendingCount}</span>
              <span style={{ fontSize: "12px", color: "var(--warning-600)", fontWeight: "600" }}>Waiting review</span>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--success-500)", padding: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Approved</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{approvedCount}</span>
              <span style={{ fontSize: "12px", color: "var(--success-600)", fontWeight: "600" }}>Resolved verified</span>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--danger-500)", padding: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Rejected</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{rejectedCount}</span>
              <span style={{ fontSize: "12px", color: "var(--danger-600)", fontWeight: "600" }}>Denied audits</span>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--accent-500)", padding: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Submissions</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{totalCount}</span>
              <span style={{ fontSize: "12px", color: "var(--accent-600)", fontWeight: "600" }}>Overall timeline</span>
            </div>
          </Card>
        </div>

        {/* Filters Panel */}
        <Card style={{ padding: "20px", marginBottom: "24px", backgroundColor: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            <Filter size={16} style={{ color: "var(--accent-600)" }} />
            <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>Filter Requests Queue</strong>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Approval Type</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Request Types</option>
                <option value="Leave">Leaves</option>
                <option value="Location">Locations</option>
                <option value="Material">Materials</option>
                <option value="Payment">Payments & Expenses</option>
                <option value="Labour">Labour Requests</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Status</label>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc", outline: "none", fontSize: "13px" }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Submission Date</label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc", outline: "none", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Site Engineer</label>
              <select 
                value={filterEngineer} 
                onChange={(e) => setFilterEngineer(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc", outline: "none", fontSize: "13px" }}
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
        <Card style={{ padding: "0", overflow: "hidden", backgroundColor: "#fff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: "700", color: "var(--primary-900)" }}>
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Type</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Employee</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Details / Specification</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Site / Project</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Requested Date</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => {
                    const isPending = (req.status || "").toLowerCase() === "pending";
                    return (
                      <tr key={`${req.type}-${req.id}-${index}`} style={{ borderBottom: "1px solid var(--border-color)", transition: "background var(--transition-fast)" }} className="table-row-hover">
                        
                        {/* Type Badge */}
                        <td style={{ padding: "16px 20px" }}>
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
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--primary-100)", color: "var(--primary-800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>
                              {(req.requestedBy || "SE").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--primary-900)", fontWeight: "600" }}>{req.requestedBy}</span>
                          </div>
                        </td>

                        {/* Details */}
                        <td style={{ padding: "16px 20px", maxWidth: "450px" }}>
                          <div style={{ fontSize: "13px", color: "var(--primary-950)", fontWeight: "600" }}>
                            {req.details}
                          </div>
                        </td>

                        {/* Site */}
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--primary-800)" }}>
                          <strong style={{ color: req.siteName === "N/A" ? "var(--text-muted)" : "var(--primary-900)" }}>
                            {req.siteName}
                          </strong>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--primary-800)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                            <span>{req.requestDate}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: "16px 20px" }}>
                          <Badge status={req.status}>
                            {req.status === "pending" || req.status === "Pending" ? "Pending Approval" : req.status.toUpperCase()}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          {isPending ? (
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                onClick={() => handleApprove(req)}
                                style={{ 
                                  borderColor: "var(--success-500)", 
                                  color: "var(--success-600)", 
                                  backgroundColor: "var(--success-50)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <Check size={12} /> Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                onClick={() => handleReject(req)}
                                style={{ 
                                  borderColor: "var(--danger-500)", 
                                  color: "var(--danger-600)", 
                                  backgroundColor: "var(--danger-50)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <X size={12} /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
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

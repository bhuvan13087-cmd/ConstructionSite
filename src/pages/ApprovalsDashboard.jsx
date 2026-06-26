import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSites, 
  getSiteEngineers, 
  approveSiteLocation, 
  rejectSiteLocation, 
  getAllLeaves, 
  approveLeave, 
  rejectLeave, 
  getMaterialsDetailed, 
  approveMaterialLog, 
  rejectMaterialLog 
} from "../services/firebaseService";
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
  ClipboardCheck, 
  MapPin, 
  Layers, 
  Search, 
  AlertCircle, 
  ExternalLink 
} from "lucide-react";

export default function ApprovalsDashboard() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Data States
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  // Filter States
  const [filterType, setFilterType] = useState("all"); // "all", "Leave", "Location", "Material"
  const [filterStatus, setFilterStatus] = useState("pending"); // "all", "pending", "approved", "rejected"
  const [filterDate, setFilterDate] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedSites, fetchedEngineers, fetchedLeaves, fetchedMaterials] = await Promise.all([
        getSites(),
        getSiteEngineers(),
        getAllLeaves(),
        getMaterialsDetailed()
      ]);
      setSites(fetchedSites);
      setEngineers(fetchedEngineers);
      setLeaves(fetchedLeaves);
      setMaterials(fetchedMaterials);
    } catch (err) {
      console.error("Failed to load approvals data:", err);
      showToast("Failed to fetch database logs.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Unify and map data
  const leaveRequests = leaves.map(l => ({
    id: l.id,
    type: "Leave",
    employeeId: l.engineerId,
    employeeName: l.engineerName,
    requestDate: l.date,
    details: l.reason,
    leaveType: l.leaveType || "Casual",
    days: l.days || 1,
    status: l.status || "approved",
    raw: l
  }));

  const locationRequests = sites.filter(s => s.locationStatus).map(s => {
    const engineer = engineers.find(e => e.id === (s.proposedLocationCapturedBy || s.locationCapturedBy));
    const isPending = s.locationStatus === "Pending Approval";
    return {
      id: s.id,
      type: "Location",
      employeeId: s.proposedLocationCapturedBy || s.locationCapturedBy || "",
      employeeName: engineer ? engineer.fullName : "Unknown Engineer",
      requestDate: (s.proposedLocationCreatedDate || s.locationCreatedDate || "").split("T")[0] || "",
      details: s.siteName,
      address: isPending ? s.proposedLocation : s.location,
      latitude: isPending ? s.proposedLatitude : s.latitude,
      longitude: isPending ? s.proposedLongitude : s.longitude,
      accuracy: isPending ? s.proposedLocationAccuracy : s.locationAccuracy,
      status: s.locationStatus === "Verified" ? "approved" : s.locationStatus === "Pending Approval" ? "pending" : "rejected",
      raw: s
    };
  });

  const materialRequests = materials.map(m => ({
    id: m.id,
    type: "Material",
    employeeId: m.engineerId,
    employeeName: m.engineerName,
    requestDate: m.purchaseDate,
    details: `${m.materialName} (${m.category})`,
    quantity: `${m.quantity} ${m.unit || "Unit"}${Number(m.quantity) !== 1 ? "s" : ""}`,
    supplier: m.supplierName,
    invoiceUrl: m.invoiceUrl || "",
    status: m.status === undefined ? "approved" : m.status,
    raw: m
  }));

  // Combine and sort
  const allRequests = [...leaveRequests, ...locationRequests, ...materialRequests].sort((a, b) => {
    return b.requestDate.localeCompare(a.requestDate);
  });

  // Calculate Metrics
  const pendingCount = allRequests.filter(r => r.status === "pending").length;
  const approvedCount = allRequests.filter(r => r.status === "approved").length;
  const rejectedCount = allRequests.filter(r => r.status === "rejected").length;
  const totalCount = allRequests.length;

  // Apply filters
  const filteredRequests = allRequests.filter(r => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterDate && r.requestDate !== filterDate) return false;
    if (filterEngineer && r.employeeId !== filterEngineer) return false;
    return true;
  });

  // Approval Handlers
  const handleApprove = async (req) => {
    if (!window.confirm(`Approve this ${req.type} request?`)) return;
    setLoading(true);
    try {
      if (req.type === "Leave") {
        await approveLeave(req.id);
      } else if (req.type === "Location") {
        await approveSiteLocation(req.id, {
          proposedLatitude: req.latitude,
          proposedLongitude: req.longitude,
          proposedLocation: req.address,
          proposedLocationAccuracy: req.accuracy,
          proposedLocationCapturedBy: req.employeeId,
          proposedLocationCreatedDate: req.raw.proposedLocationCreatedDate || new Date().toISOString()
        });
      } else if (req.type === "Material") {
        await approveMaterialLog(req.id);
      }
      showToast(`${req.type} request approved successfully.`, "success");
      await loadData();
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
      if (req.type === "Leave") {
        await rejectLeave(req.id);
      } else if (req.type === "Location") {
        await rejectSiteLocation(req.id);
      } else if (req.type === "Material") {
        await rejectMaterialLog(req.id);
      }
      showToast(`${req.type} request rejected.`, "info");
      await loadData();
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
              Unified dashboard to review, approve, or reject field logs and leave submissions.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>Reload Data</Button>
        </div>

        {/* Metrics Grid */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "30px" }}>
          <Card style={{ borderLeft: "4px solid var(--warning-500)", padding: "20px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Pending Action</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{pendingCount}</span>
              <span style={{ fontSize: "12px", color: "var(--warning-600)", fontWeight: "600" }}>Requests waiting</span>
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
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Scope Logs</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: "800", color: "var(--primary-900)" }}>{totalCount}</span>
              <span style={{ fontSize: "12px", color: "var(--accent-600)", fontWeight: "600" }}>Total parsed</span>
            </div>
          </Card>
        </div>

        {/* Filters Panel */}
        <Card style={{ padding: "20px", marginBottom: "24px", backgroundColor: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            <Filter size={16} style={{ color: "var(--accent-600)" }} />
            <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>Filter Request Logs</strong>
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
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Request Date</label>
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
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Change the status or type filter dropdown values.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textCombineUpright: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Type</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Employee</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Details / Specification</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Requested Date</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "16px 20px", fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => {
                    const isPending = req.status === "pending";
                    return (
                      <tr key={`${req.type}-${req.id}-${index}`} style={{ borderBottom: "1px solid var(--border-color)", transition: "background var(--transition-fast)" }} className="table-row-hover">
                        
                        {/* Type Badge */}
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {req.type === "Leave" && <Layers size={14} style={{ color: "var(--warning-500)" }} />}
                            {req.type === "Location" && <MapPin size={14} style={{ color: "var(--accent-600)" }} />}
                            {req.type === "Material" && <Package size={14} style={{ color: "var(--primary-600)" }} />}
                            <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--primary-800)" }}>{req.type}</span>
                          </div>
                        </td>

                        {/* Employee Name */}
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--primary-100)", color: "var(--primary-800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>
                              {req.employeeName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", color: "var(--primary-900)", fontWeight: "600" }}>{req.employeeName}</span>
                          </div>
                        </td>

                        {/* Details */}
                        <td style={{ padding: "16px 20px", maxWidth: "450px" }}>
                          {req.type === "Leave" && (
                            <div style={{ fontSize: "13px" }}>
                              <span style={{ fontWeight: "700", display: "block" }}>{req.leaveType} Leave ({req.days} Day{req.days > 1 ? "s" : ""})</span>
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Reason: "{req.details}"</span>
                            </div>
                          )}
                          
                          {req.type === "Location" && (
                            <div style={{ fontSize: "13px" }}>
                              <span style={{ fontWeight: "700", display: "block" }}>{req.details} Setup Request</span>
                              <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "block", wordBreak: "break-all" }}>Address: {req.address}</span>
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--accent-600)" }}>
                                Coords: {req.latitude?.toFixed(6)}, {req.longitude?.toFixed(6)} (Acc: {Math.round(req.accuracy)}m)
                              </span>
                            </div>
                          )}

                          {req.type === "Material" && (
                            <div style={{ fontSize: "13px" }}>
                              <span style={{ fontWeight: "700", display: "block" }}>{req.details}</span>
                              <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                                <span>Qty: <strong>{req.quantity}</strong></span>
                                <span>Supplier: <strong>{req.supplier}</strong></span>
                              </div>
                              {req.invoiceUrl && (
                                <a 
                                  href={req.invoiceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent-600)", fontWeight: "700", marginTop: "4px" }}
                                >
                                  View Challan Invoice <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          )}
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
                            {req.status === "pending" ? "Pending Approval" : req.status.toUpperCase()}
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
      <Loading show={loading} text="Updating state database..." />
    </Layout>
  );
}

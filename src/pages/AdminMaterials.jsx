import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import {
  getSites,
  getMaterialsDetailed,
  updateMaterial,
  getMaterialMaster,
  saveMaterialMaster,
  logMaterialUsage,
  logMaterialPayment
} from "../services/firebaseService";
import {
  processMaterialPaymentAndDelivery
} from "../services/businessLogic";
import {
  Package,
  Check,
  X,
  Plus,
  Edit2,
  DollarSign,
  FileText,
  TrendingUp,
  AlertCircle,
  Truck,
  Database,
  History,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Printer
} from "lucide-react";

export default function AdminMaterials() {
  const [activeTab, setActiveTab] = useState("master"); // master, requests, inventory, payments
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("all");
  const [allMaterials, setAllMaterials] = useState([]);
  const [materialMaster, setMaterialMaster] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Modals state
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const [newMasterItem, setNewMasterItem] = useState({ name: "", category: "Cement", unit: "Bag" });
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalQty, setApprovalQty] = useState("");
  const [approvalCost, setApprovalCost] = useState("");
  
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [usageQty, setUsageQty] = useState("");
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split("T")[0]);
  const [usageNotes, setUsageNotes] = useState("");
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedSites, fetchedMaster, fetchedMaterials] = await Promise.all([
        getSites(),
        getMaterialMaster(),
        getMaterialsDetailed(null) // Fetch all materials across all sites
      ]);
      setSites(fetchedSites);
      setMaterialMaster(fetchedMaster);
      setAllMaterials(fetchedMaterials);
    } catch (err) {
      console.error("Failed to load materials data:", err);
      showToast(`Error syncing logs: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMaster = async (e) => {
    e.preventDefault();
    if (!newMasterItem.name.trim()) return;
    try {
      const updatedList = [
        ...materialMaster,
        {
          name: newMasterItem.name.trim(),
          category: newMasterItem.category,
          unit: newMasterItem.unit,
          status: "Active"
        }
      ];
      await saveMaterialMaster(updatedList);
      setMaterialMaster(updatedList);
      setNewMasterItem({ name: "", category: "Cement", unit: "Bag" });
      setShowAddMasterModal(false);
      showToast("Lookup material added successfully!", "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleToggleMasterStatus = async (index) => {
    try {
      const updatedList = [...materialMaster];
      updatedList[index].status = updatedList[index].status === "Active" ? "Inactive" : "Active";
      await saveMaterialMaster(updatedList);
      setMaterialMaster(updatedList);
      showToast("Lookup status modified!", "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleOpenApproval = (req) => {
    setSelectedRequest(req);
    setApprovalQty(req.requiredQuantity || req.quantity || "0");
    
    // Calc fallback total cost
    let unitCost = 500;
    if (req.category === "Steel") unitCost = 5000;
    else if (req.category === "Sand") unitCost = 2500;
    else if (req.category === "Bricks") unitCost = 10;
    else if (req.category === "Cement") unitCost = 400;
    else if (req.category === "Other") unitCost = 1500;
    
    setApprovalCost((Number(req.requiredQuantity || req.quantity) * unitCost).toString());
    setShowApprovalModal(true);
  };

  const submitApproval = async (status) => {
    if (!selectedRequest) return;
    try {
      const updates = {
        status: status,
        approvedAt: new Date().toISOString(),
        approvedBy: "Admin"
      };
      
      if (status === "Approved") {
        updates.quantity = Number(approvalQty) || 0; // approved quantity mapped to field 'quantity'
        updates.totalAmount = Number(approvalCost) || 0;
      }
      
      await updateMaterial(selectedRequest.id, updates);
      showToast(`Material request ${status.toLowerCase()} successfully!`, "success");
      setShowApprovalModal(false);
      await loadData();
    } catch (err) {
      showToast(`Approval failed: ${err.message}`, "error");
    }
  };

  const handleOpenUsage = (item) => {
    setSelectedInventoryItem(item);
    setUsageQty("");
    setUsageNotes("");
    setShowUsageModal(true);
  };

  const submitUsage = async (e) => {
    e.preventDefault();
    if (!selectedInventoryItem || !usageQty) return;
    const qty = Number(usageQty);
    if (qty <= 0) return;
    if (qty > selectedInventoryItem.remainingStock) {
      showToast("Cannot consume more than available stock!", "error");
      return;
    }

    try {
      await logMaterialUsage(selectedInventoryItem.id, {
        quantity: qty,
        date: usageDate,
        notes: usageNotes
      });
      showToast("Material consumption logged successfully!", "success");
      setShowUsageModal(false);
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleOpenPayment = (item) => {
    setSelectedPaymentItem(item);
    setPayAmount(item.pendingPayment.toString());
    setPayRef("");
    setPayNotes("");
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentItem || !payAmount) return;
    const amt = Number(payAmount);
    if (amt <= 0) return;

    try {
      await logMaterialPayment(selectedPaymentItem.id, {
        amount: amt,
        date: payDate,
        reference: payRef,
        notes: payNotes
      });
      showToast("Supplier payment reference recorded!", "success");
      setShowPaymentModal(false);
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  if (loading) {
    return (
      <Layout title="Materials ledger" description="Synchronizing master inventory records...">
        <Loading show={true} text="Initializing material ledger console..." />
      </Layout>
    );
  }

  // Process and filter material records
  const processedMaterials = allMaterials.map(processMaterialPaymentAndDelivery);
  
  const siteFiltered = processedMaterials.filter(m => {
    if (selectedSiteId === "all") return true;
    return m.siteId === selectedSiteId;
  });

  const pendingRequests = processedMaterials.filter(m => m.status === "pending" || m.status === "Pending" || !m.status);
  const inventoryList = siteFiltered.filter(m => m.status === "approved" || m.status === "Approved");
  const paymentsList = siteFiltered.filter(m => m.status === "approved" || m.status === "Approved");

  // Sum calculations
  const totalStockVal = inventoryList.reduce((acc, m) => acc + m.totalAmount, 0);
  const totalPaidVal = paymentsList.reduce((acc, m) => acc + m.paidAmount, 0);
  const totalPendingVal = paymentsList.reduce((acc, m) => acc + m.pendingPayment, 0);

  const formatINR = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <Layout 
      title="Material Tracking & Corporate stock" 
      description="Monitor lookup registries, approve field requisitions, and audit supplier payments ledger."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "2px", marginBottom: "20px" }}>
        {[
          { id: "master", label: "Material Master lookup", icon: Database },
          { id: "requests", label: `Approval Queue (${pendingRequests.length})`, icon: Clock },
          { id: "inventory", label: "Inventory & Consumption", icon: Package },
          { id: "payments", label: "Supplier Payments ledger", icon: DollarSign }
        ].map(t => {
          const ActiveIcon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                border: "none",
                backgroundColor: "transparent",
                borderBottom: isActive ? "3px solid var(--primary-600)" : "3px solid transparent",
                color: isActive ? "var(--primary-750)" : "var(--text-muted)",
                fontWeight: isActive ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <ActiveIcon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Global Filter Bar */}
        {activeTab !== "master" && activeTab !== "requests" && (
          <Card title="Site Filter" className="no-print">
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0, minWidth: "250px" }}>
                <label htmlFor="site-select">Select Construction Site</label>
                <div className="input-wrapper" style={{ marginTop: "4px" }}>
                  <MapPin className="input-icon" size={16} />
                  <select
                    id="site-select"
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 40px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "#ffffff",
                      fontWeight: 600,
                      outline: "none"
                    }}
                  >
                    <option value="all">All Corporate Sites</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>{site.siteName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={() => window.print()} variant="secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Printer size={16} />
                <span>Print Ledger</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Tab content 1: Material Master */}
        {activeTab === "master" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Card 
              title="Material Types Master configuration" 
              subtitle="Lookup database types for site engineers."
              headerActions={
                <Button onClick={() => setShowAddMasterModal(true)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={16} />
                  <span>Add Material</span>
                </Button>
              }
            >
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th>Unit of Measure</th>
                      <th>Lookup Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialMaster.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "700" }}>{item.name}</td>
                        <td>
                          <Badge status="pending">{item.category}</Badge>
                        </td>
                        <td className="font-mono">{item.unit}</td>
                        <td>
                          <Badge status={item.status === "Active" ? "success" : "danger"}>{item.status}</Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => handleToggleMasterStatus(idx)}
                          >
                            Toggle Status
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab content 2: Approvals Queue */}
        {activeTab === "requests" && (
          <Card title="Pending Field Requests approval queue" subtitle="Review, adjust and authorize site supply orders.">
            {pendingRequests.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                No pending requests in the approval queue.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Site Name</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: "right" }}>Required Quantity</th>
                      <th>Date Required</th>
                      <th>Engineer Note</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(req => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: "700" }}>{req.siteName || "Unknown Site"}</td>
                        <td style={{ fontWeight: "700" }}>{req.materialName}</td>
                        <td><Badge status="pending">{req.category}</Badge></td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>{req.requiredQuantity} {req.unit}</td>
                        <td className="font-mono">{req.purchaseDate || "--"}</td>
                        <td>{req.notes || "--"}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleOpenApproval(req)}
                              style={{ display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <Check size={14} />
                              <span>Process</span>
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => { setSelectedRequest(req); submitApproval("Rejected"); }}
                              style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--danger-600)" }}
                            >
                              <X size={14} />
                              <span>Reject</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Tab content 3: Inventory & Stock */}
        {activeTab === "inventory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Stats dials */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Inventory Investment</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>{formatINR(totalStockVal)}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>value of approved deliveries</span>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Stock Consumption Ratio</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>
                  {inventoryList.reduce((acc, m) => acc + m.consumedQuantity, 0)} Units
                </strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>consumed out of {inventoryList.reduce((acc, m) => acc + m.receivedQuantity, 0)} received</span>
              </Card>
            </div>

            {/* Inventory table */}
            <Card title="Site Stocks & Usage Ledger" subtitle="Lists approved shipments and remaining stocks.">
              {inventoryList.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                  No stocks registered for the selected filter.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Material Batch</th>
                        <th>Category</th>
                        <th style={{ textAlign: "right" }}>Approved</th>
                        <th style={{ textAlign: "right" }}>Received</th>
                        <th style={{ textAlign: "right" }}>Consumed</th>
                        <th style={{ textAlign: "right" }}>Remaining Stock</th>
                        <th>Standing</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryList.map(item => (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={{ fontWeight: "700" }}>
                              <div>
                                <span>{item.materialName}</span>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                                  Site: <u>{item.siteName}</u> • Date: {item.purchaseDate || "--"}
                                </div>
                              </div>
                            </td>
                            <td><Badge status="pending">{item.category}</Badge></td>
                            <td style={{ textAlign: "right" }}>{item.requiredQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", fontWeight: "600" }}>{item.receivedQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", color: "var(--danger-700)" }}>{item.consumedQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", fontWeight: "700", color: "var(--success-700)" }}>{item.remainingStock} {item.unit}</td>
                            <td>
                              <Badge status={item.remainingStock > 0 ? "success" : "danger"}>
                                {item.remainingStock > 0 ? "In Stock" : "Stock Empty"}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleOpenUsage(item)}
                              >
                                Log Usage
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Render Consumption/Usage History details if available */}
                          {item.usageHistory && item.usageHistory.length > 0 && (
                            <tr>
                              <td colSpan={8} style={{ padding: "8px 24px", backgroundColor: "#f8fafc" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)" }}>Usage Logs:</span>
                                  {item.usageHistory.map((u, ui) => (
                                    <div key={ui} style={{ fontSize: "11.5px", color: "#475569", display: "flex", gap: "10px" }}>
                                      <span className="font-mono">{u.date}</span>
                                      <strong>-{u.quantity} {item.unit}</strong>
                                      <span>({u.notes || "No notes"})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab content 4: Payments Ledger */}
        {activeTab === "payments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Stats dials */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Material Cost</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>{formatINR(totalStockVal)}</strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Amount Paid</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--success-700)", marginTop: "6px" }}>{formatINR(totalPaidVal)}</strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Outstanding Balance</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--danger-700)", marginTop: "6px" }}>{formatINR(totalPendingVal)}</strong>
              </Card>
            </div>

            {/* Payments table */}
            <Card title="Supplier Materials Payment ledger" subtitle="Monitor batch amounts, paid logs and remaining dues.">
              {paymentsList.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                  No materials invoices registered for the selected filter.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Material Item</th>
                        <th>Supplier</th>
                        <th style={{ textAlign: "right" }}>Total Cost</th>
                        <th style={{ textAlign: "right" }}>Amount Paid</th>
                        <th style={{ textAlign: "right" }}>Remaining Balance</th>
                        <th>Payment Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsList.map(item => (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={{ fontWeight: "700" }}>
                              <div>
                                <span>{item.materialName}</span>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                                  Received: {item.receivedQuantity} {item.unit} • Site: <u>{item.siteName}</u>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontWeight: "600" }}>{item.supplierName || "--"}</td>
                            <td style={{ textAlign: "right", fontWeight: "700" }}>{formatINR(item.totalAmount)}</td>
                            <td style={{ textAlign: "right", color: "var(--success-700)", fontWeight: "600" }}>{formatINR(item.paidAmount)}</td>
                            <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "700" }}>{formatINR(item.pendingPayment)}</td>
                            <td>
                              <Badge status={item.paymentStatus === "Paid" ? "success" : item.paymentStatus === "Partial Payment" ? "pending" : "danger"}>
                                {item.paymentStatus}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleOpenPayment(item)}
                                disabled={item.pendingPayment === 0}
                              >
                                Log Payout
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Payment history list if logged */}
                          {item.paymentHistory && item.paymentHistory.length > 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: "8px 24px", backgroundColor: "#f8fafc" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--success-700)" }}>Payout History Logs:</span>
                                  {item.paymentHistory.map((p, pi) => (
                                    <div key={pi} style={{ fontSize: "11.5px", color: "#475569", display: "flex", gap: "10px" }}>
                                      <span className="font-mono">{p.date}</span>
                                      <strong style={{ color: "var(--success-700)" }}>{formatINR(p.amount)}</strong>
                                      <span>(Ref: <u>{p.reference || "--"}</u> • {p.notes || "No notes"})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>

      {/* Modal: Add master Lookup item */}
      {showAddMasterModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Create Master Material Type</h3>
              <button className="modal-close" onClick={() => setShowAddMasterModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddMaster}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label htmlFor="master-name">Material Name</label>
                  <input
                    id="master-name"
                    type="text"
                    placeholder="e.g. 53 Grade Cement, 10mm TMT Steel"
                    value={newMasterItem.name}
                    onChange={(e) => setNewMasterItem(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="master-cat">Category Type</label>
                  <select
                    id="master-cat"
                    value={newMasterItem.category}
                    onChange={(e) => setNewMasterItem(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                  >
                    <option value="Cement">Cement</option>
                    <option value="Steel">Steel</option>
                    <option value="Sand">Sand</option>
                    <option value="Bricks">Bricks</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="master-unit">Unit Type</label>
                  <select
                    id="master-unit"
                    value={newMasterItem.unit}
                    onChange={(e) => setNewMasterItem(prev => ({ ...prev, unit: e.target.value }))}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                  >
                    <option value="Bag">Bag</option>
                    <option value="Ton">Ton</option>
                    <option value="Load">Load</option>
                    <option value="Piece">Piece</option>
                    <option value="Meter">Meter</option>
                    <option value="Unit">Unit</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowAddMasterModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create Type</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Requisition */}
      {showApprovalModal && selectedRequest && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Process Requisition Approval</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Project: <strong>{selectedRequest.siteName}</strong><br />
                Material: <strong>{selectedRequest.materialName} ({selectedRequest.category})</strong><br />
                Requested: <strong>{selectedRequest.requiredQuantity} {selectedRequest.unit}</strong> on {selectedRequest.purchaseDate || "--"}
              </p>
              
              <div className="form-group">
                <label htmlFor="approve-qty">Approved Quantity ({selectedRequest.unit})</label>
                <input
                  id="approve-qty"
                  type="number"
                  value={approvalQty}
                  onChange={(e) => setApprovalQty(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="approve-cost">Approved Budget / Total Cost (₹)</label>
                <input
                  id="approve-cost"
                  type="number"
                  value={approvalCost}
                  onChange={(e) => setApprovalCost(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
              <Button type="button" variant="primary" onClick={() => submitApproval("Approved")}>Approve Request</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log stock Consumption */}
      {showUsageModal && selectedInventoryItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log Material Consumption</h3>
              <button className="modal-close" onClick={() => setShowUsageModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitUsage}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  Site: <strong>{selectedInventoryItem.siteName}</strong><br />
                  Material: <strong>{selectedInventoryItem.materialName}</strong><br />
                  In Stock: <strong>{selectedInventoryItem.remainingStock} {selectedInventoryItem.unit}</strong>
                </p>

                <div className="form-group">
                  <label htmlFor="usage-qty">Quantity Consumed ({selectedInventoryItem.unit})</label>
                  <input
                    id="usage-qty"
                    type="number"
                    min="0.1"
                    step="any"
                    max={selectedInventoryItem.remainingStock}
                    value={usageQty}
                    onChange={(e) => setUsageQty(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="usage-date">Date of Consumption</label>
                  <input
                    id="usage-date"
                    type="date"
                    value={usageDate}
                    onChange={(e) => setUsageDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="usage-notes">Usage Notes / Details</label>
                  <input
                    id="usage-notes"
                    type="text"
                    placeholder="e.g. Wing A column casting, blockwork curing"
                    value={usageNotes}
                    onChange={(e) => setUsageNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowUsageModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Log Consumed</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log supplier payout */}
      {showPaymentModal && selectedPaymentItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log Supplier Payout</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitPayment}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  Supplier: <strong>{selectedPaymentItem.supplierName}</strong><br />
                  Material: <strong>{selectedPaymentItem.materialName}</strong><br />
                  Pending Amount: <strong>{formatINR(selectedPaymentItem.pendingPayment)}</strong>
                </p>

                <div className="form-group">
                  <label htmlFor="pay-amt">Amount Paid (₹)</label>
                  <input
                    id="pay-amt"
                    type="number"
                    min="1"
                    max={selectedPaymentItem.pendingPayment}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-date">Payment Date</label>
                  <input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-ref">Transaction reference # (UPI / Check / Cash)</label>
                  <input
                    id="pay-ref"
                    type="text"
                    placeholder="e.g. TXN-9492193, Cash"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-notes">Additional Notes</label>
                  <input
                    id="pay-notes"
                    type="text"
                    placeholder="e.g. Part payment for structural steel batch"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Log Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}

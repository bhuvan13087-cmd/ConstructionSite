import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import {
  getSites,
  getWorkers,
  addWorker,
  updateWorkerStatus,
  getLabourDailyCountsSummary,
  getLabourMaster,
  saveLabourMaster,
  getLabourPayments,
  saveLabourPayment
} from "../services/firebaseService";
import {
  getLabourDisplayName,
  calculateLabourFinancials
} from "../services/businessLogic";
import {
  Users,
  MapPin,
  Plus,
  Edit2,
  ListFilter,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  History,
  FileText,
  UserPlus
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import { useAuth } from "../context/AuthContext";

export default function AdminLabour() {
  const { userProfile } = useAuth();
  
  // App states
  const [activeTab, setActiveTab] = useState("master"); // master, assignments, salary
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Datasets
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [labourMaster, setLabourMaster] = useState({ categories: {}, history: [] });
  const [payments, setPayments] = useState([]);
  const [allLabourHistory, setAllLabourHistory] = useState({}); // siteId -> history
  
  // Tab 1: Master Form states
  const [newCatName, setNewCatName] = useState("");
  const [newCatWage, setNewCatWage] = useState("");
  const [newCatType, setNewCatType] = useState("Daily");
  const [editingCatKey, setEditingCatKey] = useState(null);
  const [editingWage, setEditingWage] = useState("");

  // Tab 2: Assignment Form states
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [newWorkerCategory, setNewWorkerCategory] = useState("");
  const [newWorkerSiteId, setNewWorkerSiteId] = useState("");
  const [newWorkerJoinDate, setNewWorkerJoinDate] = useState(new Date().toISOString().split("T")[0]);

  // Tab 3: Salary Form states
  const [paymentSiteId, setPaymentSiteId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const adminId = userProfile?.uid || userProfile?.id || null;
      const [fetchedSites, fetchedWorkers, fetchedMaster, fetchedPayments] = await Promise.all([
        getSites(adminId),
        getWorkers(null, adminId),
        getLabourMaster(adminId),
        getLabourPayments(adminId)
      ]);

      setSites(fetchedSites);
      setWorkers(fetchedWorkers);
      setLabourMaster(fetchedMaster);
      setPayments(fetchedPayments);

      if (fetchedSites.length > 0) {
        setPaymentSiteId(fetchedSites[0].id);
        setNewWorkerSiteId(fetchedSites[0].id);
      }
      
      const activeCats = Object.keys(fetchedMaster.categories).filter(c => fetchedMaster.categories[c].status === "Active");
      if (activeCats.length > 0) {
        setNewWorkerCategory(activeCats[0]);
      }

      // Fetch labor daily histories for all sites to do financial calculations
      const historyPromises = fetchedSites.map(s => getLabourDailyCountsSummary(s.id));
      const histories = await Promise.all(historyPromises);
      
      const histMap = {};
      histories.forEach((hist, index) => {
        const siteId = fetchedSites[index].id;
        histMap[siteId] = hist;
      });
      setAllLabourHistory(histMap);

    } catch (err) {
      console.error("Failed to load records:", err);
      showToast(`Failed to load data: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // TAB 1: LABOUR MASTER HANDLERS
  // -------------------------------------------------------------
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const nameClean = newCatName.trim();
    const wageNum = Number(newCatWage);
    
    if (!nameClean) {
      showToast("Category label cannot be empty.", "error");
      return;
    }
    if (isNaN(wageNum) || wageNum <= 0) {
      showToast("Please enter a valid wage amount.", "error");
      return;
    }
    
    // Check duplication
    if (labourMaster.categories[nameClean]) {
      showToast("Category name already registered.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const updatedCats = {
        ...labourMaster.categories,
        [nameClean]: {
          wage: wageNum,
          type: newCatType,
          status: "Active"
        }
      };

      const newHistoryLog = {
        categoryName: nameClean,
        oldSalary: 0,
        newSalary: wageNum,
        changedDate: new Date().toISOString().split("T")[0],
        changedBy: userProfile?.fullName || "Admin"
      };

      const updatedHistory = [newHistoryLog, ...labourMaster.history];
      
      await saveLabourMaster(updatedCats, updatedHistory, userProfile?.uid || userProfile?.id || null);
      showToast(`Labour category ${nameClean} created!`, "success");
      setNewCatName("");
      setNewCatWage("");
      
      await loadData();
    } catch (err) {
      showToast(`Failed to create category: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateWage = async (catKey) => {
    const newWageNum = Number(editingWage);
    if (isNaN(newWageNum) || newWageNum <= 0) {
      showToast("Specify a valid wage rate.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const oldWage = labourMaster.categories[catKey].wage;
      const updatedCats = {
        ...labourMaster.categories,
        [catKey]: {
          ...labourMaster.categories[catKey],
          wage: newWageNum
        }
      };

      const newHistoryLog = {
        categoryName: catKey,
        oldSalary: oldWage,
        newSalary: newWageNum,
        changedDate: new Date().toISOString().split("T")[0],
        changedBy: userProfile?.fullName || "Admin"
      };

      const updatedHistory = [newHistoryLog, ...labourMaster.history];
      
      await saveLabourMaster(updatedCats, updatedHistory, userProfile?.uid || userProfile?.id || null);
      showToast(`Wage rate updated for ${catKey}.`, "success");
      setEditingCatKey(null);
      setEditingWage("");
      
      await loadData();
    } catch (err) {
      showToast(`Failed to update wage: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCategoryStatus = async (catKey) => {
    const current = labourMaster.categories[catKey];
    const newStatus = current.status === "Active" ? "Inactive" : "Active";
    
    if (["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(catKey) && newStatus === "Inactive") {
      if (!confirm(`Are you sure you want to disable core category "${catKey}"?`)) return;
    }

    setSubmitting(true);
    try {
      const updatedCats = {
        ...labourMaster.categories,
        [catKey]: {
          ...current,
          status: newStatus
        }
      };
      
      await saveLabourMaster(updatedCats, labourMaster.history, userProfile?.uid || userProfile?.id || null);
      showToast(`Category "${catKey}" set to ${newStatus}.`, "info");
      await loadData();
    } catch (err) {
      showToast(`Status update failed: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: LABOUR ASSIGNMENTS HANDLERS
  // -------------------------------------------------------------
  const handleAssignWorker = async (e) => {
    e.preventDefault();
    const name = newWorkerName.trim();
    const phone = newWorkerPhone.trim();
    
    if (!name || !phone) {
      showToast("Please fill in worker name and phone number.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await addWorker({
        siteId: newWorkerSiteId,
        engineerId: userProfile?.uid || userProfile?.id || "admin",
        adminId: userProfile?.uid || userProfile?.id || null,
        workerName: name,
        category: newWorkerCategory,
        phoneNumber: phone,
        joiningDate: newWorkerJoinDate,
        status: "active"
      });

      showToast(`Assigned worker ${name} successfully!`, "success");
      setNewWorkerName("");
      setNewWorkerPhone("");
      await loadData();
    } catch (err) {
      showToast(`Worker assignment failed: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleWorkerStatus = async (w) => {
    const nextStatus = w.status === "active" ? "inactive" : "active";
    if (!confirm(`Toggle status of ${w.workerName} to ${nextStatus}?`)) return;
    
    setSubmitting(true);
    try {
      await updateWorkerStatus(w.id, nextStatus);
      showToast(`${w.workerName} status updated.`, "success");
      await loadData();
    } catch (err) {
      showToast(`Deactivation failed: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: SALARY PAYMENTS HANDLERS
  // -------------------------------------------------------------
  const handleLogPayment = async (e) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast("Please specify a valid payment amount.", "error");
      return;
    }

    const site = sites.find(s => s.id === paymentSiteId);
    if (!site) return;

    setSubmitting(true);
    try {
      await saveLabourPayment({
        siteId: paymentSiteId,
        amount: amountNum,
        date: paymentDate,
        reference: paymentReference.trim(),
        notes: paymentNotes.trim(),
        loggedBy: userProfile?.fullName || "Admin"
      }, userProfile?.uid || userProfile?.id || null);

      showToast(`Salary payment of ${amountNum} logged for ${site.siteName}!`, "success");
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      await loadData();
    } catch (err) {
      showToast(`Payment logging failed: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDERS
  // -------------------------------------------------------------
  const renderMasterTab = () => {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>
        
        {/* Category Add Form */}
        <Card title="Register New Labour Category" subtitle="Define standard wages and categories.">
          <form onSubmit={handleCreateCategory} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="cat-name" style={{ fontSize: "12.5px", fontWeight: "700" }}>Category Label (English)</label>
              <input
                id="cat-name"
                type="text"
                placeholder="e.g. Carpenter"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="cat-wage" style={{ fontSize: "12.5px", fontWeight: "700" }}>Default Daily Wage (₹)</label>
              <input
                id="cat-wage"
                type="number"
                placeholder="e.g. 700"
                value={newCatWage}
                onChange={(e) => setNewCatWage(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="cat-type" style={{ fontSize: "12.5px", fontWeight: "700" }}>Salary Cycle Type</label>
              <select
                id="cat-type"
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="Daily">Daily Wages</option>
                <option value="Weekly">Weekly Cycle</option>
                <option value="Monthly">Monthly Fixed</option>
              </select>
            </div>

            <Button type="submit" style={{ marginTop: "10px", backgroundColor: "var(--primary-800)" }}>
              Create Category
            </Button>
          </form>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Categories list */}
          <Card title="Active & Configured Labour Master Categories" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Labour Category</th>
                    <th style={{ textAlign: "right" }}>Wage rate</th>
                    <th>Billing Cycle</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Operations</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(labourMaster.categories).map(key => {
                    const catObj = labourMaster.categories[key];
                    const isEditing = editingCatKey === key;
                    
                    return (
                      <tr key={key}>
                        <td style={{ fontWeight: "700" }}>{getLabourDisplayName(key)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editingWage}
                              onChange={(e) => setEditingWage(e.target.value)}
                              style={{ width: "80px", padding: "4px 8px", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                            />
                          ) : (
                            `₹${catObj.wage}`
                          )}
                        </td>
                        <td>{catObj.type}</td>
                        <td>
                          <Badge status={catObj.status === "Active" ? "success" : "pending"}>
                            {catObj.status}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            {isEditing ? (
                              <>
                                <Button size="sm" onClick={() => handleUpdateWage(key)} style={{ backgroundColor: "var(--success-600)", color: "#ffffff", padding: "2px 8px" }}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingCatKey(null)} style={{ padding: "2px 8px" }}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingCatKey(key);
                                    setEditingWage(catObj.wage);
                                  }}
                                  className="btn-icon btn-edit-action"
                                  title="Edit wage"
                                  style={{ padding: "4px" }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleCategoryStatus(key)}
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderColor: catObj.status === "Active" ? "var(--danger-200)" : "var(--success-200)",
                                    color: catObj.status === "Active" ? "var(--danger-600)" : "var(--success-600)"
                                  }}
                                >
                                  {catObj.status === "Active" ? "Deactivate" : "Activate"}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Salary changes history logs */}
          <Card title="Wage Rate Adjustments & Updates History">
            {labourMaster.history.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>No salary adjustments on record.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
                {labourMaster.history.map((log, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", fontSize: "12.5px" }}>
                    <div>
                      <strong>{getLabourDisplayName(log.categoryName)}</strong>: Wage rate adjusted from <s>₹{log.oldSalary}</s> to <strong>₹{log.newSalary}</strong>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "end", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>Changed by: {log.changedBy}</span>
                      <span className="font-mono">{log.changedDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

      </div>
    );
  };

  const renderAssignmentsTab = () => {
    // Group active workers by site
    const workersBySite = {};
    sites.forEach(s => {
      workersBySite[s.id] = { siteName: s.siteName, list: [] };
    });
    
    workers.forEach(w => {
      if (workersBySite[w.siteId]) {
        workersBySite[w.siteId].list.push(w);
      }
    });

    const activeCategories = Object.keys(labourMaster.categories).filter(c => labourMaster.categories[c].status === "Active");

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>
        
        {/* Assign worker form */}
        <Card title="Assign Trade Workers to Site">
          <form onSubmit={handleAssignWorker} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="worker-name" style={{ fontSize: "12.5px", fontWeight: "700" }}>Worker Full Name</label>
              <input
                id="worker-name"
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="worker-phone" style={{ fontSize: "12.5px", fontWeight: "700" }}>Mobile Number</label>
              <input
                id="worker-phone"
                type="text"
                placeholder="e.g. +91 9876543210"
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="worker-cat" style={{ fontSize: "12.5px", fontWeight: "700" }}>Labour Category</label>
                <select
                  id="worker-cat"
                  value={newWorkerCategory}
                  onChange={(e) => setNewWorkerCategory(e.target.value)}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
                >
                  {activeCategories.map(cat => (
                    <option key={cat} value={cat}>{getLabourDisplayName(cat)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="worker-date" style={{ fontSize: "12.5px", fontWeight: "700" }}>Assignment Date</label>
                <input
                  id="worker-date"
                  type="date"
                  value={newWorkerJoinDate}
                  onChange={(e) => setNewWorkerJoinDate(e.target.value)}
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="worker-site" style={{ fontSize: "12.5px", fontWeight: "700" }}>Assign Construction Site</label>
              <select
                id="worker-site"
                value={newWorkerSiteId}
                onChange={(e) => setNewWorkerSiteId(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            <Button type="submit" icon={UserPlus} style={{ marginTop: "10px", backgroundColor: "var(--primary-800)" }}>
              Assign Worker
            </Button>
          </form>
        </Card>

        {/* Site Groupings list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {sites.map(site => {
            const siteData = workersBySite[site.id];
            if (!siteData) return null;
            
            return (
              <Card key={site.id} title={`Active Labor Assignments: ${site.siteName}`} subtitle={`Headcounts and wage details`}>
                {siteData.list.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic", margin: "10px 0" }}>No workers currently assigned to this site.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Worker Name</th>
                          <th>Category</th>
                          <th>Assigned Date</th>
                          <th style={{ textAlign: "right" }}>Wage Rate</th>
                          <th>Status</th>
                          <th style={{ textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteData.list.map(w => {
                          const rateObj = labourMaster.categories[w.category] || { wage: 500 };
                          return (
                            <tr key={w.id}>
                              <td style={{ fontWeight: "700" }}>{w.workerName}</td>
                              <td>{getLabourDisplayName(w.category)}</td>
                              <td className="font-mono">{w.joiningDate}</td>
                              <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{rateObj.wage}</td>
                              <td>
                                <Badge status={w.status === "active" ? "success" : "pending"}>
                                  {w.status || "active"}
                                </Badge>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleWorkerStatus(w)}
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderColor: w.status === "active" ? "var(--danger-200)" : "var(--success-200)",
                                    color: w.status === "active" ? "var(--danger-600)" : "var(--success-600)"
                                  }}
                                >
                                  {w.status === "active" ? "Deactivate" : "Activate"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

      </div>
    );
  };

  const renderSalaryTab = () => {
    // Generate site-wise financials
    const siteLabourFinancials = sites.map(site => {
      const hist = allLabourHistory[site.id] || [];
      const stats = calculateLabourFinancials(site.id, hist, labourMaster.categories, payments);
      return {
        site,
        stats
      };
    });

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>
        
        {/* Log Payment Form */}
        <Card title="Log Labour Salary Payment">
          <form onSubmit={handleLogPayment} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-site" style={{ fontSize: "12.5px", fontWeight: "700" }}>Construction Site</label>
              <select
                id="pay-site"
                value={paymentSiteId}
                onChange={(e) => setPaymentSiteId(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="pay-amount" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Amount (₹)</label>
                <input
                  id="pay-amount"
                  type="number"
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="pay-date" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Date</label>
                <input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-ref" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Reference / Receipt ID</label>
              <input
                id="pay-ref"
                type="text"
                placeholder="e.g. TXN-1928374 or Cash"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-notes" style={{ fontSize: "12.5px", fontWeight: "700" }}>Additional Notes</label>
              <textarea
                id="pay-notes"
                placeholder="Details of payout..."
                rows={3}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <Button type="submit" icon={DollarSign} style={{ marginTop: "10px", backgroundColor: "var(--primary-800)" }}>
              Log Payment
            </Button>
          </form>
        </Card>

        {/* Ledger overview & payment history logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Ledger Table */}
          <Card title="Corporate Site-wise Labor Salary Audit Ledger" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Site Name</th>
                    <th style={{ textAlign: "right" }}>Total Wages Owed</th>
                    <th style={{ textAlign: "right" }}>Total Paid Out</th>
                    <th style={{ textAlign: "right" }}>Pending Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {siteLabourFinancials.map(({ site, stats }) => (
                    <tr key={site.id}>
                      <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{stats.totalCost}</td>
                      <td style={{ textAlign: "right", color: "var(--success-700)", fontFamily: "monospace" }}>₹{stats.paidAmount}</td>
                      <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "700", fontFamily: "monospace" }}>₹{stats.pendingAmount}</td>
                    </tr>
                  ))}
                  
                  {/* Totals */}
                  <tr style={{ backgroundColor: "var(--primary-50)", fontWeight: "800" }}>
                    <td>Aggregate Summary</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.totalCost, 0)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.paidAmount, 0)}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--danger-800)", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.pendingAmount, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Payment history list */}
          <Card title="Corporate Labor Payout Transaction History">
            {payments.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>No payout transactions recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                {payments.map((p, idx) => {
                  const site = sites.find(s => s.id === p.siteId) || { siteName: "Unknown Site" };
                  return (
                    <div key={p.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", fontSize: "12.5px" }}>
                      <div>
                        Paid <strong style={{ color: "var(--success-700)" }}>₹{p.amount}</strong> to workers at <strong>{site.siteName}</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>Ref: {p.reference || "none"} | Notes: {p.notes || "none"}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "end", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>By: {p.loggedBy}</span>
                        <span className="font-mono">{p.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>

      </div>
    );
  };

  return (
    <Layout
      title="Labour & Wage Administration console"
      description="Define corporate trade wage rates, assign workers to site checklists, and track pending salary balances."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Tabs Menu navigation */}
      <div className="tab-menu" style={{ display: "flex", gap: "14px", borderBottom: "2px solid var(--border-color)", paddingBottom: "2px", marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("master")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "master" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "master" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Labour Master
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "assignments" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "assignments" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Labour Assignments
        </button>
        <button
          onClick={() => setActiveTab("salary")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "salary" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "salary" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Salary Management
        </button>
      </div>

      {activeTab === "master" && renderMasterTab()}
      {activeTab === "assignments" && renderAssignmentsTab()}
      {activeTab === "salary" && renderSalaryTab()}

      <Loading show={loading || submitting} text="Processing labour operations..." />
    </Layout>
  );
}

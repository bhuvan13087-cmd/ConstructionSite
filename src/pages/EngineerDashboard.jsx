import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getAssignedSitesForEngineer, 
  getTodayAttendance,
  markAttendance,
  saveSitePhoto,
  getSitePhotos,
  saveDailyProgressReport,
  getDailyUpdatesForEngineer,
  calculateDistanceMeters,
  addMaterial,
  getMaterialsDetailed,
  saveLabourDailyCounts,
  getLabourDailyCounts,
  getLabourDailyCountsHistory
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  Shield, 
  Camera, 
  Upload, 
  Save, 
  X,
  ClipboardCheck,
  Percent,
  Calendar,
  AlertTriangle,
  Package,
  Users,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  Briefcase,
  Sliders,
  TrendingUp,
  Activity,
  ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EngineerDashboard({ tab = "dashboard" }) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  // Loader & Toast states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Database datasets
  const [assignedSites, setAssignedSites] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [sitePhotos, setSitePhotos] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [activeSiteId, setActiveSiteId] = useState("");
  
  // Geolocation mock control (highly useful for remote developer testing)
  const [mockLocation, setMockLocation] = useState(true);

  // Dynamic Labour Categories
  const [categories, setCategories] = useState(["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Form inputs states
  // 1. Today's Attendance Check-in
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendancePhotoFile, setAttendancePhotoFile] = useState(null);
  const [attendancePhotoPreview, setAttendancePhotoPreview] = useState(null);
  const [attendancePhotoUploaded, setAttendancePhotoUploaded] = useState(false);
  const [attendancePhotoUploading, setAttendancePhotoUploading] = useState(false);
  const [uploadedAttendancePhotoUrl, setUploadedAttendancePhotoUrl] = useState("");
  const [attendancePhotoLat, setAttendancePhotoLat] = useState(null);
  const [attendancePhotoLng, setAttendancePhotoLng] = useState(null);

  // 2. Daily Labour Counts
  const [labourDate, setLabourDate] = useState(new Date().toISOString().split("T")[0]);
  const [countsMap, setCountsMap] = useState({
    Mason: 0,
    Helper: 0,
    Electrician: 0,
    Plumber: 0,
    Painter: 0,
    Other: 0
  });
  const [labourHistory, setLabourHistory] = useState([]);
  const [labourHistoryLoading, setLabourHistoryLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);

  // 3. Material Received fields
  const [materialName, setMaterialName] = useState("");
  const [materialCategory, setMaterialCategory] = useState("Cement");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialUnit, setMaterialUnit] = useState("Bag");
  const [materialSupplier, setMaterialSupplier] = useState("");
  const [materialPurchaseDate, setMaterialPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [materialNotes, setMaterialNotes] = useState("");
  const [materialInvoiceFile, setMaterialInvoiceFile] = useState(null);
  const [materialInvoicePreview, setMaterialInvoicePreview] = useState(null);
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  
  // Material search & filter state
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialDateFilter, setMaterialDateFilter] = useState("");

  // 4. Site Progress Photo fields
  const [sitePhotoFile, setSitePhotoFile] = useState(null);
  const [sitePhotoPreview, setSitePhotoPreview] = useState(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);

  // 5. Daily Progress Log fields
  const [workDescription, setWorkDescription] = useState("");
  const [progressPercent, setProgressPercent] = useState(50);
  const [progressPhotoFile, setProgressPhotoFile] = useState(null);
  const [progressPhotoPreview, setProgressPhotoPreview] = useState(null);
  const [issuesText, setIssuesText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [progressSubmitting, setProgressSubmitting] = useState(false);

  // Helper to trigger toast messages
  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  // Main loader for data sync
  const loadDashboardData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const engineerId = userProfile.uid || userProfile.id || "";
      
      // Load assigned construction sites
      const filteredSites = await getAssignedSitesForEngineer(engineerId);
      setAssignedSites(filteredSites);

      if (filteredSites.length > 0) {
        // Fallback or default active site
        const defaultSiteId = activeSiteId || filteredSites[0].id;
        setActiveSiteId(defaultSiteId);
        
        // Fetch today's check-in attendance
        const attendance = await getTodayAttendance(engineerId, todayStr);
        setTodayAttendance(attendance);
        
        // Fetch site photos
        const photos = await getSitePhotos(engineerId);
        setSitePhotos(photos);
        
        // Fetch daily updates
        const updates = await getDailyUpdatesForEngineer(engineerId);
        setDailyUpdates(updates);

        // Fetch material receipts
        const fetchedMaterials = [];
        for (const site of filteredSites) {
          const siteMats = await getMaterialsDetailed(site.id);
          fetchedMaterials.push(...siteMats);
        }
        setMaterials(fetchedMaterials);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      showToast(`Database synchronization failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Sync data on component mount and profile changes
  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

  // Sync labour counts & historical summary whenever active site or select date changes
  useEffect(() => {
    const fetchLabourCountsAndHistory = async () => {
      if (!activeSiteId || !labourDate) return;
      setLabourHistoryLoading(true);
      try {
        const counts = await getLabourDailyCounts(activeSiteId, labourDate);
        const hist = await getLabourDailyCountsHistory(activeSiteId);
        setLabourHistory(hist);

        // Incorporate custom categories present in fetched data
        setCategories(prev => {
          const newCats = [...prev];
          Object.keys(counts).forEach(cat => {
            if (!newCats.includes(cat)) {
              newCats.push(cat);
            }
          });

          // Build updated counts map with fallback to zero
          setCountsMap(current => {
            const updated = {};
            newCats.forEach(cat => {
              updated[cat] = counts[cat] || 0;
            });
            return updated;
          });

          return newCats;
        });
      } catch (err) {
        console.error("Labour statistics load error:", err);
      } finally {
        setLabourHistoryLoading(false);
      }
    };

    fetchLabourCountsAndHistory();
  }, [activeSiteId, labourDate]);

  // Handle local photo files base64 parsing
  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 1. Staff check-in verification photo
  const handleUploadAttendancePhoto = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please select your active site first.", "error");
      return;
    }
    if (!attendancePhotoPreview) {
      showToast("Please capture or choose verification photo.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Target site check failed.", "error");
      return;
    }

    const siteLat = Number(site.latitude || 28.5355);
    const siteLng = Number(site.longitude || 77.3910);
    const siteRadius = Number(site.radius || 500);

    setAttendancePhotoUploading(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      let userLat = siteLat;
      let userLng = siteLng;

      if (!mockLocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      }

      // Geofence checking
      const distance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      if (distance > siteRadius) {
        throw new Error(
          `Geofence Error: You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m. Enable 'Mock Location' to bypass.`
        );
      }

      // Upload verification image
      await saveSitePhoto(engineerId, activeSiteId, attendancePhotoPreview, userLat, userLng);

      setUploadedAttendancePhotoUrl(attendancePhotoPreview);
      setAttendancePhotoLat(userLat);
      setAttendancePhotoLng(userLng);
      setAttendancePhotoUploaded(true);
      showToast("Check-in photo uploaded successfully!", "success");
    } catch (err) {
      console.error("Verification upload error:", err);
      showToast(err.message || "Failed to upload verification photo.", "error");
    } finally {
      setAttendancePhotoUploading(false);
    }
  };

  // 2. Execute Staff Check-In Attendance
  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please select your active site.", "error");
      return;
    }
    if (!attendancePhotoUploaded || !uploadedAttendancePhotoUrl) {
      showToast("Please upload and verify check-in photo first.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Active site check failed.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    setAttendanceSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const lat = attendancePhotoLat !== null ? attendancePhotoLat : Number(site.latitude || 28.5355);
      const lng = attendancePhotoLng !== null ? attendancePhotoLng : Number(site.longitude || 77.3910);

      await markAttendance(engineerId, activeSiteId, todayStr, lat, lng, uploadedAttendancePhotoUrl);

      showToast(`Checked in present at ${site.siteName}!`, "success");
      setAttendancePhotoFile(null);
      setAttendancePhotoPreview(null);
      setAttendancePhotoUploaded(false);
      setUploadedAttendancePhotoUrl("");
      setAttendancePhotoLat(null);
      setAttendancePhotoLng(null);

      await loadDashboardData();
    } catch (err) {
      console.error("Mark attendance error:", err);
      showToast(err.message || "Failed to complete check-in.", "error");
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  // 3. Save Labour Counts Attendance
  const handleSaveLabourCounts = async (e) => {
    if (e) e.preventDefault();
    if (!activeSiteId) {
      showToast("Please select active construction site.", "error");
      return;
    }
    if (!labourDate) {
      showToast("Please choose daily record date.", "error");
      return;
    }

    setLabourSaving(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      
      // Filter out any undefined categories and map countsMap cleanly
      const submitMap = {};
      categories.forEach(cat => {
        submitMap[cat] = Number(countsMap[cat]) || 0;
      });

      await saveLabourDailyCounts(activeSiteId, engineerId, labourDate, submitMap);
      showToast(`Labour counts updated successfully for ${labourDate}!`, "success");
      
      // Refresh historical logs
      const hist = await getLabourDailyCountsHistory(activeSiteId);
      setLabourHistory(hist);
    } catch (err) {
      console.error("Labour sync failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setLabourSaving(false);
    }
  };

  // Add custom category type
  const handleAddLabourCategory = (e) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      showToast("Please specify a category label.", "error");
      return;
    }
    
    // Capitalize category name nicely
    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    if (categories.includes(formattedName)) {
      showToast("Category type already exists.", "error");
      return;
    }

    const updated = [...categories, formattedName];
    setCategories(updated);
    setCountsMap(prev => ({
      ...prev,
      [formattedName]: 0
    }));
    
    // Save to LocalStorage for user persistence
    localStorage.setItem("labour_categories", JSON.stringify(updated));
    setNewCategoryName("");
    showToast(`Added category: ${formattedName}. You can now input attendance count.`, "success");
  };

  // Delete/hide custom category
  const handleDeleteLabourCategory = (categoryName) => {
    if (["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(categoryName)) {
      showToast("Cannot remove core labour categories.", "error");
      return;
    }
    if (confirm(`Remove custom category "${categoryName}"? This hides it from inputs (saved counts remain in database).`)) {
      const updated = categories.filter(c => c !== categoryName);
      setCategories(updated);
      setCountsMap(prev => {
        const copy = { ...prev };
        delete copy[categoryName];
        return copy;
      });
      localStorage.setItem("labour_categories", JSON.stringify(updated));
      showToast(`Removed category "${categoryName}" from active tracker list.`, "success");
    }
  };

  // 4. Save Material Receipt
  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please choose active project.", "error");
      return;
    }
    if (!materialName.trim()) {
      showToast("Material Name is required.", "error");
      return;
    }
    if (!materialQuantity || isNaN(Number(materialQuantity)) || Number(materialQuantity) <= 0) {
      showToast("Quantity must be greater than 0.", "error");
      return;
    }
    if (!materialSupplier.trim()) {
      showToast("Supplier Company details required.", "error");
      return;
    }
    
    setMaterialSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      await addMaterial({
        siteId: activeSiteId,
        engineerId,
        materialName: materialName.trim(),
        category: materialCategory,
        quantity: Number(materialQuantity),
        unit: materialUnit,
        supplierName: materialSupplier.trim(),
        purchaseDate: materialPurchaseDate,
        notes: materialNotes.trim(),
        invoiceUrl: materialInvoicePreview || ""
      });

      showToast("Material receipt logged successfully!", "success");
      
      // Reset forms
      setMaterialName("");
      setMaterialCategory("Cement");
      setMaterialQuantity("");
      setMaterialUnit("Bag");
      setMaterialSupplier("");
      setMaterialPurchaseDate(new Date().toISOString().split("T")[0]);
      setMaterialNotes("");
      setMaterialInvoiceFile(null);
      setMaterialInvoicePreview(null);

      await loadDashboardData();
    } catch (err) {
      console.error("Material submit error:", err);
      showToast(`Material submit failed: ${err.message}`, "error");
    } finally {
      setMaterialSubmitting(false);
    }
  };

  // 5. Upload Geotagged Progress Photo
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please select construction site.", "error");
      return;
    }
    if (!sitePhotoPreview) {
      showToast("Please select or capture photo file.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Selected site check failed.", "error");
      return;
    }

    const siteLat = Number(site.latitude || 28.5355);
    const siteLng = Number(site.longitude || 77.3910);
    const siteRadius = Number(site.radius || 500);

    setPhotoSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      let userLat = siteLat;
      let userLng = siteLng;

      if (!mockLocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      }

      // Check distance
      const distance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      if (distance > siteRadius) {
        throw new Error(
          `Location Verification Error: You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m. Enable 'Mock Location' to bypass.`
        );
      }

      await saveSitePhoto(engineerId, activeSiteId, sitePhotoPreview, userLat, userLng);
      showToast("Geotagged site photo uploaded to feed!", "success");

      setSitePhotoFile(null);
      setSitePhotoPreview(null);
      await loadDashboardData();
    } catch (err) {
      console.error("Progress photo upload error:", err);
      showToast(err.message || "Failed to save photo.", "error");
    } finally {
      setPhotoSubmitting(false);
    }
  };

  // 6. Submit Daily Progress updates
  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please choose target project.", "error");
      return;
    }
    if (!workDescription.trim()) {
      showToast("Work description details required.", "error");
      return;
    }

    setProgressSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const photoIds = [];

      // Save progressive log photo if attached
      if (progressPhotoPreview) {
        const site = assignedSites.find(s => s.id === activeSiteId);
        const lat = site ? Number(site.latitude) : 28.5355;
        const lng = site ? Number(site.longitude) : 77.3910;
        await saveSitePhoto(engineerId, activeSiteId, progressPhotoPreview, lat, lng);
        photoIds.push("progress_log_attached_photo");
      }

      // Format description to store work completed, issues, notes in same string
      const compiledDescription = 
        `Work Completed: ${workDescription.trim()}` +
        `\n\nIssues/Blockers: ${issuesText.trim() ? issuesText.trim() : "None"}` +
        `\n\nNotes/Remarks: ${notesText.trim() ? notesText.trim() : "None"}`;

      await saveDailyProgressReport(
        engineerId,
        activeSiteId,
        compiledDescription,
        `${progressPercent}%`,
        photoIds
      );

      showToast("Daily progress updates logged successfully!", "success");
      setWorkDescription("");
      setProgressPercent(50);
      setIssuesText("");
      setNotesText("");
      setProgressPhotoFile(null);
      setProgressPhotoPreview(null);

      await loadDashboardData();
    } catch (err) {
      console.error("Progress report log failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setProgressSubmitting(false);
    }
  };

  // Full Screen Alert if no sites assigned
  if (assignedSites.length === 0 && !loading) {
    return (
      <Layout title="Site Engineer Dashboard" description="Construction Field representative portal.">
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
          <Card title="Engineer Profile" style={{ borderLeft: "5px solid var(--accent-500)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
              <div className="user-avatar" style={{ width: "50px", height: "50px", fontSize: "18px", borderRadius: "12px" }}>
                {userProfile?.fullName ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "SE"}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{userProfile?.fullName || "Site Engineer"}</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>{userProfile?.email}</p>
              </div>
            </div>
          </Card>
          <Card style={{ padding: "40px 20px", textAlign: "center", borderTop: "4px solid var(--danger-500)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <AlertTriangle size={36} style={{ color: "var(--danger-500)" }} />
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary-900)", margin: 0 }}>No Worksite Assigned</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                You do not currently have any active construction sites allocated. Please contact the project administrator to assign a site to your user profile.
              </p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  // Active site variables
  const currentSite = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];

  // Helper title mapping
  const pageTitles = {
    dashboard: "Dashboard Overview",
    attendance: "Labour Attendance Tracker",
    labour: "Labour & Team Management",
    material: "Material Receipts Inventory",
    photos: "Site Inspection Photos",
    progress: "Daily Progress Log Feed"
  };

  return (
    <Layout title={pageTitles[tab] || "Site Engineer Dashboard"} description="Record construction field operations, labour stats, and delivery records.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP SELECTOR & DEV OPTIONS PANEL */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        padding: "16px",
        backgroundColor: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 auto", minWidth: "250px" }}>
          <div style={{
            backgroundColor: "var(--accent-50)",
            padding: "8px",
            borderRadius: "var(--radius-sm)",
            color: "var(--accent-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <MapPin size={20} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
              Active Project Worksite
            </span>
            {assignedSites.length === 1 ? (
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--primary-900)" }}>
                {assignedSites[0].siteName}
              </h4>
            ) : (
              <select
                value={activeSiteId}
                onChange={(e) => setActiveSiteId(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--primary-900)",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {assignedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
            <Calendar size={14} style={{ color: "var(--accent-500)" }} />
            <span>Today: {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <label style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: "700",
            color: "var(--accent-600)",
            cursor: "pointer",
            userSelect: "none",
            backgroundColor: "var(--accent-50)",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent-200)"
          }}>
            <input 
              type="checkbox" 
              checked={mockLocation} 
              onChange={(e) => setMockLocation(e.target.checked)} 
              style={{ cursor: "pointer" }}
            />
            <span>Bypass GPS Geofence (Mocking)</span>
          </label>
        </div>
      </div>

      {/* RENDER DYNAMIC MODULE TABS */}

      {/* A) OVERVIEW DASHBOARD TAB */}
      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Welcome Banner */}
          <div style={{
            background: "linear-gradient(135deg, var(--primary-900) 0%, var(--primary-950) 100%)",
            color: "#ffffff",
            padding: "24px",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "var(--accent-500)",
                color: "var(--primary-950)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "18px"
              }}>
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>Welcome Back, {userProfile?.fullName || "Site Engineer"}</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>Civil Representative • Active duty</p>
              </div>
            </div>
            {currentSite && (
              <div style={{ backgroundColor: "rgba(255,255,255,0.08)", padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)" }}>
                <span style={{ display: "block", fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Selected Site</span>
                <strong style={{ fontSize: "14px", color: "var(--accent-400)" }}>{currentSite.siteName}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Project Details Card */}
            {currentSite && (
              <Card title="Assigned Site Information" icon={MapPin} style={{ borderLeft: "5px solid var(--accent-500)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)" }}>{currentSite.siteName}</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>{currentSite.location}</p>
                    </div>
                    <Badge status={currentSite.status || "Planning"} />
                  </div>
                  <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Client Name:</span>
                      <span style={{ fontWeight: "600", color: "var(--primary-800)" }}>{currentSite.clientName || "--"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Start Date:</span>
                      <span style={{ fontWeight: "600" }} className="font-mono">{currentSite.startDate || "--"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Expected Completion:</span>
                      <span style={{ fontWeight: "600" }} className="font-mono">{currentSite.expectedEndDate || "--"}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Today's Attendance Summary (Staff check-in) */}
            <Card title="Today's Attendance Status" icon={ClipboardCheck} style={{ borderLeft: "5px solid var(--primary-500)" }}>
              {todayAttendance ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center", padding: "10px 0" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--success-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={24} style={{ color: "var(--success-500)" }} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: "700", color: "var(--primary-950)", margin: 0, fontSize: "14px" }}>Attendance Verified & Present</h4>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Checked in: <strong>{todayAttendance.checkInTime?.seconds 
                        ? new Date(todayAttendance.checkInTime.seconds * 1000).toLocaleTimeString()
                        : new Date(todayAttendance.checkInTime).toLocaleTimeString()}</strong>
                    </p>
                    {todayAttendance.photoUrl && (
                      <div style={{ marginTop: "10px", width: "120px", height: "90px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)", margin: "10px auto 0 auto" }}>
                        <img src={todayAttendance.photoUrl} alt="Check-in Selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "var(--danger-50)", padding: "10px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--danger-500)" }}>
                    <AlertCircle size={16} style={{ color: "var(--danger-500)", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "var(--danger-700)", fontWeight: "600" }}>
                      Staff check-in is pending for today.
                    </span>
                  </div>

                  <div style={{ border: "1px dashed var(--border-color)", padding: "12px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)" }}>
                    {/* Selfie check-in form in place */}
                    {!attendancePhotoUploaded ? (
                      <form onSubmit={handleUploadAttendancePhoto} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          alignItems: "center", 
                          gap: "4px", 
                          padding: "12px", 
                          border: "1px dashed var(--border-color)", 
                          borderRadius: "var(--radius-sm)", 
                          cursor: "pointer", 
                          backgroundColor: "#ffffff",
                          fontSize: "11px"
                        }}>
                          <Camera size={20} style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontWeight: "700", color: "var(--primary-800)" }}>Selfie at Site Location</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            style={{ display: "none" }} 
                            onChange={(e) => handleFileChange(e, setAttendancePhotoFile, setAttendancePhotoPreview)} 
                          />
                        </label>
                        {attendancePhotoPreview && (
                          <div style={{ position: "relative", width: "100%", height: "90px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                            <img src={attendancePhotoPreview} alt="Selfie preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button type="button" onClick={() => { setAttendancePhotoFile(null); setAttendancePhotoPreview(null); }} style={{ position: "absolute", top: "4px", right: "4px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                          </div>
                        )}
                        <Button type="submit" isLoading={attendancePhotoUploading} icon={Upload} disabled={!attendancePhotoPreview} style={{ padding: "6px 12px", fontSize: "12px" }}>
                          Upload Verification Photo
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleMarkAttendance} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success-700)", fontSize: "12px", fontWeight: "700" }}>
                          <CheckCircle2 size={14} /> Photo Verified
                        </div>
                        <Button type="submit" isLoading={attendanceSubmitting} icon={ClipboardCheck} style={{ padding: "6px 12px", fontSize: "12px" }}>
                          Mark Present Check-In
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </Card>

          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            
            {/* Labour Summary Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--primary-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Labour Present Today</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {Object.values(countsMap).reduce((sum, val) => sum + (val || 0), 0)} Workers
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--primary-50)", padding: "8px", borderRadius: "50%", color: "var(--primary-600)" }}>
                <Users size={20} />
              </div>
            </div>

            {/* Material Summary Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--accent-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Material Logged</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {materials.filter(m => m.siteId === activeSiteId).length} Deliveries
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--accent-50)", padding: "8px", borderRadius: "50%", color: "var(--accent-600)" }}>
                <Package size={20} />
              </div>
            </div>

            {/* Photo Logs Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--info-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Site Photos Captured</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {sitePhotos.filter(p => p.siteId === activeSiteId).length} Images
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--info-50)", padding: "8px", borderRadius: "50%", color: "var(--info-600)" }}>
                <Camera size={20} />
              </div>
            </div>

          </div>

          {/* Recent site activities & timelines */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Recent Progress Logs */}
            <Card title="Recent Work Updates" icon={FileText} headerActions={<Button onClick={() => navigate("/engineer/progress")} variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Manage</Button>}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
                {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: "16px 0" }}>No updates recorded yet.</p>
                ) : (
                  dailyUpdates.filter(u => u.siteId === activeSiteId).slice(0, 3).map(update => {
                    // Extract title description (handles formatted description)
                    const lines = update.description.split("\n\n");
                    const workCompleted = lines[0]?.replace("Work Completed: ", "") || update.description;
                    
                    return (
                      <div key={update.id} style={{ padding: "10px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>
                          <span className="font-mono text-muted">
                            {update.createdAt?.seconds 
                              ? new Date(update.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(update.createdAt).toLocaleDateString()}
                          </span>
                          <span style={{ color: "var(--success-600)" }}>{update.progress} Done</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--primary-950)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {workCompleted}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Recent Photos */}
            <Card title="Recent Photo Gallery" icon={Camera} headerActions={<Button onClick={() => navigate("/engineer/photos")} variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Upload</Button>}>
              {sitePhotos.filter(p => p.siteId === activeSiteId).length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: "16px 0" }}>No photos uploaded yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {sitePhotos.filter(p => p.siteId === activeSiteId).slice(0, 2).map(photo => (
                    <div key={photo.id} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", overflow: "hidden", backgroundColor: "#fff" }}>
                      <div style={{ height: "100px" }}>
                        <img src={photo.imageUrl} alt="Inspection" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ padding: "6px", fontSize: "10px" }}>
                        <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                          {photo.capturedAt?.seconds 
                            ? new Date(photo.capturedAt.seconds * 1000).toLocaleDateString()
                            : new Date(photo.capturedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>

        </div>
      )}

      {/* B) ATTENDANCE MODULE TAB (Daily Labour Attendance Tracking) */}
      {tab === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          
          {/* Main Attendance Input */}
          <Card title="Labour Attendance Check-In" icon={ClipboardCheck} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handleSaveLabourCounts} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label htmlFor="labour-date">Supervisor Check-In Date</label>
                <input 
                  type="date" 
                  id="labour-date" 
                  value={labourDate} 
                  onChange={(e) => setLabourDate(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Categories Present</span>
                {categories.map(cat => {
                  const currentVal = countsMap[cat] || 0;
                  return (
                    <div key={cat} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      backgroundColor: "var(--primary-50)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px"
                    }}>
                      <span style={{ fontWeight: "700", color: "var(--primary-900)", fontSize: "13px" }}>{cat}</span>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setCountsMap(prev => ({ ...prev, [cat]: Math.max(0, currentVal - 1) }))}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            border: "1px solid var(--border-color)",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontWeight: "800",
                            color: "var(--danger-600)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                          }}
                        >
                          <Minus size={16} />
                        </button>
                        
                        <input
                          type="number"
                          value={currentVal}
                          min="0"
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setCountsMap(prev => ({ ...prev, [cat]: val }));
                          }}
                          style={{
                            width: "60px",
                            height: "36px",
                            textAlign: "center",
                            fontWeight: "700",
                            fontSize: "14px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-color)",
                            margin: 0
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => setCountsMap(prev => ({ ...prev, [cat]: currentVal + 1 }))}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            border: "1px solid var(--border-color)",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontWeight: "800",
                            color: "var(--success-600)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Autocalculate Summary Box */}
              <div style={{
                padding: "12px",
                backgroundColor: "var(--primary-100)",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--primary-200)",
                marginTop: "4px"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>Total Labour Present:</span>
                <strong style={{ fontSize: "16px", color: "var(--primary-950)" }}>
                  {Object.values(countsMap).reduce((sum, val) => sum + (val || 0), 0)} Workers
                </strong>
              </div>

              <Button type="submit" isLoading={labourSaving} icon={Save} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>
                Save Daily Attendance Counts
              </Button>
            </form>
          </Card>

          {/* Historical Logs List */}
          <Card title="Attendance Counts History" icon={Clock}>
            {labourHistoryLoading ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px" }}>Syncing database logs...</p>
            ) : labourHistory.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px" }}>No historical daily counts registered yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
                {labourHistory.map(row => (
                  <div key={row.date} style={{
                    padding: "12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span className="font-mono" style={{ fontWeight: "700", color: "var(--primary-950)" }}>{row.date}</span>
                      <Badge status="success">{row.total} Workers</Badge>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px" }}>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Masons: {row.Masons}</span>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Helpers: {row.Helpers}</span>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Others: {row.Others}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* C) LABOUR MANAGEMENT MODULE TAB */}
      {tab === "labour" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Add Labour Category Card */}
            <Card title="Add Labour Category" icon={Plus} style={{ borderLeft: "5px solid var(--accent-500)" }}>
              <form onSubmit={handleAddLabourCategory} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label htmlFor="new-category-input">New Category Name</label>
                  <input 
                    type="text" 
                    id="new-category-input"
                    placeholder="E.g., Welder, Carpenter, Supervisor"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required 
                  />
                </div>
                <Button type="submit" icon={Plus} style={{ width: "100%" }}>
                  Add Category Type
                </Button>
              </form>
            </Card>

            {/* Manage Labour Types */}
            <Card title="Manage Labour Types" icon={Sliders}>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Core system categories are locked. Custom added types can be removed below.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {categories.map(cat => {
                  const isCore = ["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(cat);
                  return (
                    <div key={cat} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: isCore ? "var(--primary-50)" : "#ffffff"
                    }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary-900)" }}>
                        {cat} {isCore && <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" }}>(Core)</span>}
                      </span>
                      {!isCore && (
                        <button 
                          type="button" 
                          onClick={() => handleDeleteLabourCategory(cat)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--danger-500)",
                            cursor: "pointer",
                            padding: "4px"
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

          </div>

          {/* Today's Labour Summary Cards */}
          <Card title="Today's Labour Summary" icon={Users} variant="accent">
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Detailed counts breakdown logged for <strong>{new Date().toISOString().split("T")[0]}</strong>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {categories.map(cat => {
                const count = countsMap[cat] || 0;
                return (
                  <div key={cat} style={{
                    padding: "16px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    borderTop: "3px solid var(--primary-500)"
                  }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
                      {cat}
                    </span>
                    <strong style={{ fontSize: "22px", color: "var(--primary-950)" }}>
                      {count} <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-muted)" }}>Workers</span>
                    </strong>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      )}

      {/* D) MATERIAL MANAGEMENT MODULE TAB */}
      {tab === "material" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          
          {/* Add Material Log */}
          <Card title="Log Material Received" icon={Plus} style={{ borderLeft: "5px solid var(--accent-500)" }}>
            <form onSubmit={handleMaterialSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              <div className="form-group">
                <label htmlFor="material-name">Material Name</label>
                <input 
                  type="text" 
                  id="material-name"
                  placeholder="E.g., OPC Cement 53 Grade"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  required 
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="material-category">Category</label>
                  <select
                    id="material-category"
                    value={materialCategory}
                    onChange={(e) => setMaterialCategory(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontWeight: 600 }}
                  >
                    <option value="Cement">Cement</option>
                    <option value="Steel">Steel</option>
                    <option value="Sand">Sand</option>
                    <option value="Bricks">Bricks</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="material-unit">Unit</label>
                  <select
                    id="material-unit"
                    value={materialUnit}
                    onChange={(e) => setMaterialUnit(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontWeight: 600 }}
                  >
                    <option value="Bag">Bag</option>
                    <option value="Kg">Kg</option>
                    <option value="Ton">Ton</option>
                    <option value="Load">Load</option>
                    <option value="Pieces">Pieces</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="material-quantity">Quantity</label>
                  <input 
                    type="number" 
                    id="material-quantity"
                    placeholder="Quantity"
                    min="0.01"
                    step="any"
                    value={materialQuantity}
                    onChange={(e) => setMaterialQuantity(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="material-date">Receipt Date</label>
                  <input 
                    type="date" 
                    id="material-date"
                    value={materialPurchaseDate}
                    onChange={(e) => setMaterialPurchaseDate(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="material-supplier">Supplier Name</label>
                <input 
                  type="text" 
                  id="material-supplier"
                  placeholder="Supplier Company Details"
                  value={materialSupplier}
                  onChange={(e) => setMaterialSupplier(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="material-notes">Notes (Optional)</label>
                <textarea 
                  id="material-notes"
                  placeholder="Inspection notes, challan number, etc..."
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                  style={{ minHeight: "60px" }}
                />
              </div>

              <div className="form-group">
                <label>Invoice/Bill Photo (Optional)</label>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <label style={{ cursor: "pointer", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-50)", fontSize: "11px", fontWeight: 700 }}>
                    <Camera size={14} />
                    <span>Choose Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setMaterialInvoiceFile, setMaterialInvoicePreview)} />
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                    {materialInvoiceFile ? materialInvoiceFile.name : "No file chosen"}
                  </span>
                </div>
                {materialInvoicePreview && (
                  <div style={{ marginTop: "8px", position: "relative", width: "100px", height: "70px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={materialInvoicePreview} alt="Invoice preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setMaterialInvoiceFile(null); setMaterialInvoicePreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={materialSubmitting} icon={Save} style={{ width: "100%", marginTop: "4px" }}>
                Save Material Log
              </Button>
            </form>
          </Card>

          {/* Search & Filter Material History */}
          <Card title="Material Inventory History" icon={Package}>
            
            {/* Searching Filters */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "var(--radius-sm)", backgroundColor: "#ffffff" }}>
                <Search size={16} style={{ color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search item name, supplier, category..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", padding: "6px 0", margin: 0 }}
                />
              </div>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Filter by Date</label>
                <input 
                  type="date" 
                  value={materialDateFilter} 
                  onChange={(e) => setMaterialDateFilter(e.target.value)} 
                />
                {materialDateFilter && (
                  <button 
                    type="button" 
                    onClick={() => setMaterialDateFilter("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger-600)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: "4px 0",
                      alignSelf: "flex-start"
                    }}
                  >
                    Clear Date Filter
                  </button>
                )}
              </div>
            </div>

            {/* List of Deliveries */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
              {materials
                .filter(m => m.siteId === activeSiteId)
                .filter(m => {
                  const query = materialSearch.toLowerCase().trim();
                  if (!query) return true;
                  return (
                    m.materialName.toLowerCase().includes(query) ||
                    m.category.toLowerCase().includes(query) ||
                    m.supplierName.toLowerCase().includes(query)
                  );
                })
                .filter(m => {
                  if (!materialDateFilter) return true;
                  return m.purchaseDate === materialDateFilter;
                })
                .length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                    No material delivery logs match current filters.
                  </p>
                ) : (
                  materials
                    .filter(m => m.siteId === activeSiteId)
                    .filter(m => {
                      const query = materialSearch.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        m.materialName.toLowerCase().includes(query) ||
                        m.category.toLowerCase().includes(query) ||
                        m.supplierName.toLowerCase().includes(query)
                      );
                    })
                    .filter(m => {
                      if (!materialDateFilter) return true;
                      return m.purchaseDate === materialDateFilter;
                    })
                    .map(m => (
                      <div key={m.id} style={{
                        padding: "12px",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div>
                            <strong style={{ display: "block", fontSize: "13px", color: "var(--primary-950)" }}>{m.materialName}</strong>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Category: {m.category}</span>
                          </div>
                          <Badge status="success">{m.quantity} {m.unit}</Badge>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "11px", color: "var(--text-dark)", marginTop: "4px" }}>
                          <span>Supplier: <strong>{m.supplierName}</strong></span>
                          <span>Challan Date: <strong className="font-mono">{m.purchaseDate}</strong></span>
                        </div>
                        {m.notes && (
                          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Remarks: {m.notes}
                          </p>
                        )}
                        {m.invoiceUrl && (
                          <div style={{ marginTop: "8px" }}>
                            <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--accent-600)", fontWeight: "700", textDecoration: "underline" }}>
                              Open Bill Image
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                )}
            </div>
          </Card>
        </div>
      )}

      {/* E) SITE PHOTO MODULE TAB */}
      {tab === "photos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          
          {/* Capture Site Photo */}
          <Card title="Capture Progress Photo" icon={Camera} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handlePhotoUpload} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Geotag and timestamp are recorded automatically.
              </p>
              
              <div className="form-group">
                <label>Site Picture Source</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <label style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px", 
                    padding: "24px 16px", 
                    border: "2px dashed var(--border-color)", 
                    borderRadius: "8px", 
                    cursor: "pointer", 
                    backgroundColor: "var(--primary-50)" 
                  }}>
                    <Camera size={32} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      style={{ display: "none" }} 
                      onChange={(e) => handleFileChange(e, setSitePhotoFile, setSitePhotoPreview)} 
                    />
                  </label>
                  {sitePhotoFile && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--success-600)", textAlign: "center" }}>
                      Selected: {sitePhotoFile.name}
                    </span>
                  )}
                </div>

                {sitePhotoPreview && (
                  <div style={{ marginTop: "12px", position: "relative", width: "100%", height: "180px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={sitePhotoPreview} alt="Site preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setSitePhotoFile(null); setSitePhotoPreview(null); }} style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={photoSubmitting} icon={Upload} disabled={!sitePhotoPreview} style={{ width: "100%" }}>
                Upload Geotagged Photo
              </Button>
            </form>
          </Card>

          {/* Photo Gallery Grid */}
          <Card title="Site Photos Gallery" icon={Camera}>
            {sitePhotos.filter(p => p.siteId === activeSiteId).length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>
                No site photos logged for this project yet.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
                {sitePhotos.filter(p => p.siteId === activeSiteId).map(photo => (
                  <div key={photo.id} style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}>
                    <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", height: "110px" }}>
                      <img src={photo.imageUrl} alt="Progress inspection" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </a>
                    <div style={{ padding: "8px", fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                        {photo.capturedAt?.seconds 
                          ? new Date(photo.capturedAt.seconds * 1000).toLocaleString()
                          : new Date(photo.capturedAt).toLocaleString()}
                      </span>
                      <span style={{ fontWeight: "700", color: "var(--accent-600)" }}>
                        GPS: {Number(photo.latitude).toFixed(5)}, {Number(photo.longitude).toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* F) DAILY PROGRESS MODULE TAB */}
      {tab === "progress" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          
          {/* Submit progress updates */}
          <Card title="Log Daily Progress Updates" icon={Plus} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              <div className="form-group">
                <label>Estimated Progress Completed</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    style={{ flexGrow: 1, accentColor: "var(--accent-500)", cursor: "pointer", height: "6px" }}
                  />
                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: "12px", minWidth: "46px", textAlign: "center" }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="work-completed">Work Completed Today</label>
                <textarea 
                  id="work-completed" 
                  placeholder="Describe pours completed, walls built, etc..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  required 
                  style={{ minHeight: "80px" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="issues-obstacles">Issues / Delay Obstacles</label>
                <input 
                  type="text" 
                  id="issues-obstacles"
                  placeholder="E.g. Material shortage, heavy rain delays..."
                  value={issuesText}
                  onChange={(e) => setIssuesText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="progress-notes">Notes / Special Instructions</label>
                <input 
                  type="text" 
                  id="progress-notes"
                  placeholder="E.g. Structural engineer inspected the footings..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Attach Work Photo (Optional)</label>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <label style={{ cursor: "pointer", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-50)", fontSize: "11px", fontWeight: 700 }}>
                    <Camera size={14} />
                    <span>Choose Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setProgressPhotoFile, setProgressPhotoPreview)} />
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                    {progressPhotoFile ? progressPhotoFile.name : "No file attached"}
                  </span>
                </div>
                {progressPhotoPreview && (
                  <div style={{ marginTop: "8px", position: "relative", width: "100px", height: "70px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={progressPhotoPreview} alt="Work preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={progressSubmitting} icon={Save} style={{ width: "100%" }}>
                Submit Daily Progress Report
              </Button>
            </form>
          </Card>

          {/* Progress logs timeline */}
          <Card title="Progress Reports History" icon={FileText}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "450px", overflowY: "auto", paddingLeft: "10px" }}>
              {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                  No reports logged for this project yet.
                </p>
              ) : (
                dailyUpdates.filter(u => u.siteId === activeSiteId).map((row) => {
                  // Parse description strings
                  const lines = row.description.split("\n\n");
                  const workLine = lines[0]?.replace("Work Completed: ", "") || row.description;
                  const issuesLine = lines[1]?.replace("Issues/Blockers: ", "");
                  const notesLine = lines[2]?.replace("Notes/Remarks: ", "");

                  return (
                    <div key={row.id} style={{
                      position: "relative",
                      paddingLeft: "20px",
                      borderLeft: "2px solid var(--primary-200)",
                      paddingBottom: "8px"
                    }}>
                      {/* Timeline dot */}
                      <div style={{
                        position: "absolute",
                        left: "-6px",
                        top: "4px",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: "var(--primary-600)",
                        border: "2px solid #fff"
                      }} />
                      
                      <div style={{
                        padding: "12px",
                        backgroundColor: "var(--primary-50)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span className="font-mono" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-900)" }}>
                            {row.createdAt?.seconds 
                              ? new Date(row.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(row.createdAt).toLocaleDateString()}
                          </span>
                          <Badge status="success">{row.progress}</Badge>
                        </div>
                        
                        <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--primary-950)" }}>
                          <strong>Work Completed:</strong> {workLine}
                        </p>
                        
                        {issuesLine && issuesLine !== "None" && (
                          <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--danger-700)" }}>
                            <strong>Issues:</strong> {issuesLine}
                          </p>
                        )}

                        {notesLine && notesLine !== "None" && (
                          <p style={{ margin: "4px 0", fontSize: "11px", color: "var(--text-muted)" }}>
                            <strong>Notes:</strong> {notesLine}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      <Loading show={loading} text="Synchronizing Worksite Database..." />
    </Layout>
  );
}

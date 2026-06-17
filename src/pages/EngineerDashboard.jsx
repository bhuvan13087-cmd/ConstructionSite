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
  Users
} from "lucide-react";

export default function EngineerDashboard() {
  const { userProfile } = useAuth();
  
  // Loader & Toast states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Database datasets
  const [assignedSites, setAssignedSites] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [sitePhotos, setSitePhotos] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  // Geolocation mock control (highly useful for remote developer testing)
  const [mockLocation, setMockLocation] = useState(true);

  // Selected site IDs for forms (defaults to first assigned site)
  const [selectedAttendanceSiteId, setSelectedAttendanceSiteId] = useState("");
  const [selectedPhotoSiteId, setSelectedPhotoSiteId] = useState("");
  const [selectedMaterialSiteId, setSelectedMaterialSiteId] = useState("");
  const [selectedLabourSiteId, setSelectedLabourSiteId] = useState("");
  const [selectedLogSiteId, setSelectedLogSiteId] = useState("");
  
  // 1. Today's Attendance State
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendancePhotoFile, setAttendancePhotoFile] = useState(null);
  const [attendancePhotoPreview, setAttendancePhotoPreview] = useState(null);
  const [attendancePhotoUploaded, setAttendancePhotoUploaded] = useState(false);
  const [attendancePhotoUploading, setAttendancePhotoUploading] = useState(false);
  const [uploadedAttendancePhotoUrl, setUploadedAttendancePhotoUrl] = useState("");
  const [attendancePhotoLat, setAttendancePhotoLat] = useState(null);
  const [attendancePhotoLng, setAttendancePhotoLng] = useState(null);

  // 2. Material Form fields
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

  // 3. Site Photo Form fields
  const [sitePhotoFile, setSitePhotoFile] = useState(null);
  const [sitePhotoPreview, setSitePhotoPreview] = useState(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);

  // 4. Labour Daily Counts State
  const [labourDate, setLabourDate] = useState(new Date().toISOString().split("T")[0]);
  const [masonCount, setMasonCount] = useState(0);
  const [helperCount, setHelperCount] = useState(0);
  const [painterCount, setPainterCount] = useState(0);
  const [plumberCount, setPlumberCount] = useState(0);
  const [electricianCount, setElectricianCount] = useState(0);
  const [otherCount, setOtherCount] = useState(0);
  const [labourHistory, setLabourHistory] = useState([]);
  const [labourHistoryLoading, setLabourHistoryLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);

  // 5. Daily Progress Log Form fields
  const [workDescription, setWorkDescription] = useState("");
  const [progressPercent, setProgressPercent] = useState(50);
  const [progressPhotoFile, setProgressPhotoFile] = useState(null);
  const [progressPhotoPreview, setProgressPhotoPreview] = useState(null);
  const [progressSubmitting, setProgressSubmitting] = useState(false);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  const loadDashboardData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const engineerId = userProfile.uid || userProfile.id || "";
      
      // 1. Get and filter sites assigned to this engineer
      const filteredSites = await getAssignedSitesForEngineer(engineerId);
      setAssignedSites(filteredSites);

      if (filteredSites.length > 0) {
        // Find default selected sites
        setSelectedAttendanceSiteId(prev => prev || filteredSites[0].id);
        setSelectedPhotoSiteId(prev => prev || filteredSites[0].id);
        setSelectedMaterialSiteId(prev => prev || filteredSites[0].id);
        setSelectedLabourSiteId(prev => prev || filteredSites[0].id);
        setSelectedLogSiteId(prev => prev || filteredSites[0].id);
        
        // 2. Fetch today's check-in attendance
        const attendance = await getTodayAttendance(engineerId, todayStr);
        setTodayAttendance(attendance);
        
        // 3. Fetch geo-tagged photos gallery
        const photos = await getSitePhotos(engineerId);
        setSitePhotos(photos);
        
        // 4. Fetch daily progress updates
        const updates = await getDailyUpdatesForEngineer(engineerId);
        setDailyUpdates(updates);

        // 5. Fetch materials logged
        const fetchedMaterials = [];
        for (const site of filteredSites) {
          const siteMats = await getMaterialsDetailed(site.id);
          fetchedMaterials.push(...siteMats);
        }
        setMaterials(fetchedMaterials);
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);
      showToast(`Failed to fetch database records: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch daily labour counts when active site or date selection changes
  useEffect(() => {
    const fetchLabourCounts = async () => {
      if (!selectedLabourSiteId || !labourDate) return;
      try {
        const counts = await getLabourDailyCounts(selectedLabourSiteId, labourDate);
        setMasonCount(counts.Mason || 0);
        setHelperCount(counts.Helper || 0);
        setPainterCount(counts.Painter || 0);
        setPlumberCount(counts.Plumber || 0);
        setElectricianCount(counts.Electrician || 0);
        setOtherCount(counts.Other || 0);
      } catch (err) {
        console.error("Error loading labour counts for date:", err);
      }
    };

    fetchLabourCounts();
  }, [selectedLabourSiteId, labourDate]);

  // Fetch historical labour counts list
  useEffect(() => {
    const fetchLabourHistory = async () => {
      if (!selectedLabourSiteId) return;
      setLabourHistoryLoading(true);
      try {
        const hist = await getLabourDailyCountsHistory(selectedLabourSiteId);
        setLabourHistory(hist);
      } catch (err) {
        console.error("Error loading labour history:", err);
      } finally {
        setLabourHistoryLoading(false);
      }
    };

    fetchLabourHistory();
  }, [selectedLabourSiteId]);

  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

  // Handle Attendance site selection change
  const handleAttendanceSiteChange = (siteId) => {
    setSelectedAttendanceSiteId(siteId);
    setAttendancePhotoFile(null);
    setAttendancePhotoPreview(null);
    setAttendancePhotoUploaded(false);
    setUploadedAttendancePhotoUrl("");
    setAttendancePhotoLat(null);
    setAttendancePhotoLng(null);
  };

  // Step 1: Upload verification photo at site with geofence check
  const handleUploadAttendancePhoto = async (e) => {
    e.preventDefault();
    if (!selectedAttendanceSiteId) {
      showToast("Please select a site to mark attendance.", "error");
      return;
    }
    if (!attendancePhotoPreview) {
      showToast("Please capture or choose a selfie/photo in front of the site.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === selectedAttendanceSiteId);
    if (!site) {
      showToast("Selected site is invalid.", "error");
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

      // Geofence check
      const distance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      if (distance > siteRadius) {
        throw new Error(
          `Location check failed. You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m. Enable 'Mock Location' to bypass.`
        );
      }

      // Save photo to sitePhotos collection
      await saveSitePhoto(engineerId, selectedAttendanceSiteId, attendancePhotoPreview, userLat, userLng);

      setUploadedAttendancePhotoUrl(attendancePhotoPreview);
      setAttendancePhotoLat(userLat);
      setAttendancePhotoLng(userLng);
      setAttendancePhotoUploaded(true);
      showToast("Verification photo uploaded successfully!", "success");
    } catch (err) {
      console.error("Verification photo upload error:", err);
      showToast(err.message || "Failed to upload verification photo.", "error");
    } finally {
      setAttendancePhotoUploading(false);
    }
  };

  // Step 2: Mark attendance after photo is uploaded
  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    if (!selectedAttendanceSiteId) {
      showToast("Please select a site to mark attendance.", "error");
      return;
    }
    if (!attendancePhotoUploaded || !uploadedAttendancePhotoUrl) {
      showToast("Please upload the verification photo first.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === selectedAttendanceSiteId);
    if (!site) {
      showToast("Selected site is invalid.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];

    setAttendanceSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const lat = attendancePhotoLat !== null ? attendancePhotoLat : Number(site.latitude || 28.5355);
      const lng = attendancePhotoLng !== null ? attendancePhotoLng : Number(site.longitude || 77.3910);

      // Mark the attendance record with the uploaded photo URL and coords
      await markAttendance(engineerId, selectedAttendanceSiteId, todayStr, lat, lng, uploadedAttendancePhotoUrl);

      showToast(`Checked in present at ${site.siteName}!`, "success");

      // Reset today's attendance inputs
      setAttendancePhotoFile(null);
      setAttendancePhotoPreview(null);
      setAttendancePhotoUploaded(false);
      setUploadedAttendancePhotoUrl("");
      setAttendancePhotoLat(null);
      setAttendancePhotoLng(null);

      await loadDashboardData();
    } catch (err) {
      console.error("Attendance marking error:", err);
      showToast(err.message || "Failed to mark attendance.", "error");
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  // Handle Geo-tagged Photo upload
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (!selectedPhotoSiteId) {
      showToast("Please select a site for photo upload.", "error");
      return;
    }
    if (!sitePhotoPreview) {
      showToast("Please select or capture an image file first.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === selectedPhotoSiteId);
    if (!site) {
      showToast("Selected site is invalid.", "error");
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
          `Photo geotag verification failed. You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m. Enable 'Mock Location' to bypass.`
        );
      }

      await saveSitePhoto(engineerId, selectedPhotoSiteId, sitePhotoPreview, userLat, userLng);
      showToast("Geo-tagged progress photo uploaded successfully!", "success");
      
      // Reset forms
      setSitePhotoFile(null);
      setSitePhotoPreview(null);
      await loadDashboardData();
    } catch (err) {
      console.error("Photo upload error:", err);
      showToast(err.message || "Failed to save geo-tagged photo.", "error");
    } finally {
      setPhotoSubmitting(false);
    }
  };

  // Handle Material Form Submission
  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaterialSiteId) {
      showToast("Please select a construction site.", "error");
      return;
    }
    if (!materialName.trim()) {
      showToast("Material Name is required.", "error");
      return;
    }
    if (!materialQuantity || isNaN(Number(materialQuantity)) || Number(materialQuantity) <= 0) {
      showToast("Please enter a valid quantity greater than 0.", "error");
      return;
    }
    if (!materialSupplier.trim()) {
      showToast("Supplier Name is required.", "error");
      return;
    }
    if (!materialPurchaseDate) {
      showToast("Purchase Date is required.", "error");
      return;
    }
    
    setMaterialSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      
      await addMaterial({
        siteId: selectedMaterialSiteId,
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
      
      showToast("Material logged successfully!", "success");
      
      // Reset form fields
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
      console.error("Material submission error:", err);
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      setMaterialSubmitting(false);
    }
  };

  // Handle Labour Daily Count Save
  const handleSaveLabourCounts = async (e) => {
    e.preventDefault();
    if (!selectedLabourSiteId) {
      showToast("Please select a site to mark labour counts.", "error");
      return;
    }
    if (!labourDate) {
      showToast("Please select a date.", "error");
      return;
    }

    setLabourSaving(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const countsMap = {
        Mason: Number(masonCount) || 0,
        Helper: Number(helperCount) || 0,
        Painter: Number(painterCount) || 0,
        Plumber: Number(plumberCount) || 0,
        Electrician: Number(electricianCount) || 0,
        Other: Number(otherCount) || 0
      };

      await saveLabourDailyCounts(selectedLabourSiteId, engineerId, labourDate, countsMap);
      showToast(`Labour counts saved successfully for ${labourDate}!`, "success");
      
      // Reload history logs
      const hist = await getLabourDailyCountsHistory(selectedLabourSiteId);
      setLabourHistory(hist);
    } catch (err) {
      console.error("Labour counts save failed:", err);
      showToast(`Failed to save counts: ${err.message}`, "error");
    } finally {
      setLabourSaving(false);
    }
  };

  // Handle Daily Progress Report submit
  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLogSiteId) {
      showToast("Please select a site.", "error");
      return;
    }
    if (!workDescription.trim()) {
      showToast("Progress description is required.", "error");
      return;
    }

    setProgressSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const photoIds = [];

      // Save progressive log photo if attached
      if (progressPhotoPreview) {
        const site = assignedSites.find(s => s.id === selectedLogSiteId);
        const lat = site ? Number(site.latitude) : 28.5355;
        const lng = site ? Number(site.longitude) : 77.3910;
        await saveSitePhoto(engineerId, selectedLogSiteId, progressPhotoPreview, lat, lng);
        photoIds.push("progress_log_attached_photo");
      }

      await saveDailyProgressReport(
        engineerId,
        selectedLogSiteId,
        workDescription.trim(),
        `${progressPercent}%`,
        photoIds
      );

      showToast("Daily progress log submitted successfully!", "success");
      
      // Reset progress form fields
      setWorkDescription("");
      setProgressPercent(50);
      setProgressPhotoFile(null);
      setProgressPhotoPreview(null);
      
      await loadDashboardData();
    } catch (err) {
      console.error("Progress log error:", err);
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      setProgressSubmitting(false);
    }
  };

  // Helper to convert images to Base64 preview
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

  // Reusable helper to render site selection as a read-only badge (if 1 site) or dropdown (if >1)
  const renderSiteSelector = (selectedVal, onChangeHandler) => {
    if (assignedSites.length === 0) return null;
    if (assignedSites.length === 1) {
      return (
        <div style={{ 
          padding: "8px 12px", 
          backgroundColor: "var(--primary-50)", 
          border: "1px solid var(--border-color)", 
          borderRadius: "var(--radius-sm)", 
          fontWeight: 700, 
          color: "var(--primary-800)", 
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "4px"
        }}>
          <MapPin size={14} style={{ color: "var(--accent-500)" }} />
          <span>{assignedSites[0].siteName} ({assignedSites[0].location})</span>
        </div>
      );
    }
    return (
      <select
        value={selectedVal}
        onChange={(e) => onChangeHandler(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-color)",
          backgroundColor: "#ffffff",
          outline: "none",
          fontWeight: 600,
          cursor: "pointer",
          marginTop: "4px"
        }}
      >
        {assignedSites.map(site => (
          <option key={site.id} value={site.id}>{site.siteName}</option>
        ))}
      </select>
    );
  };

  // Render Full Screen Alert if no sites assigned
  if (assignedSites.length === 0) {
    return (
      <Layout title="Site Engineer Dashboard" description="System control desk.">
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Engineer Profile Card */}
          <Card className="w-full" style={{ borderLeft: "5px solid var(--accent-500)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div className="user-avatar" style={{ width: "56px", height: "56px", fontSize: "20px", borderRadius: "14px" }}>
                  {userProfile?.fullName
                    ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                    : "SE"}
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-900)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    {userProfile?.fullName || "Site Engineer"}
                    <Badge status="inactive" />
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", margin: "4px 0 0 0" }}>
                    <Shield size={14} /> Registered Field Representative
                  </p>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <Mail size={16} style={{ color: "var(--text-muted)" }} />
                  <span>{userProfile?.email}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* No site assigned Card */}
          <Card style={{ padding: "48px 24px", textAlign: "center", borderTop: "4px solid var(--danger-500)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "var(--danger-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={32} style={{ color: "var(--danger-500)" }} />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>No Site Assigned Yet</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "450px", margin: "0 auto", lineHeight: "1.6" }}>
                You do not currently have any active construction sites allocated. Please contact the project administrator to assign a site to your user profile.
              </p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Site Engineer Dashboard" description="Log daily progress updates, material deliveries, and labour statistics.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP SECTION: PROFILE & ASSIGNED SITES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        
        {/* Engineer Profile Card */}
        <Card title="Engineer Profile" style={{ borderLeft: "5px solid var(--primary-500)", height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="user-avatar" style={{ width: "64px", height: "64px", fontSize: "22px", borderRadius: "16px" }}>
                {userProfile?.fullName
                  ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                  : "SE"}
              </div>
              <div>
                <h4 style={{ fontWeight: 800, color: "var(--primary-900)", margin: 0, fontSize: "16px" }}>
                  {userProfile?.fullName || "Site Engineer"}
                </h4>
                <div style={{ marginTop: "4px" }}>
                  <Badge status="active" />
                </div>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Mail size={15} style={{ color: "var(--text-muted)" }} />
                <span className="font-mono">{userProfile?.email}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Phone size={15} style={{ color: "var(--text-muted)" }} />
                <span>{userProfile?.phoneNumber || "--"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={15} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontWeight: 600, color: "var(--primary-800)" }}>Field Site Engineer</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Assigned Site Card */}
        <Card title="Assigned Projects" style={{ borderLeft: "5px solid var(--accent-500)", height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", maxHeight: "190px" }}>
            {assignedSites.map((site) => (
              <div 
                key={site.id} 
                style={{ 
                  padding: "12px 14px", 
                  backgroundColor: "var(--primary-50)", 
                  borderRadius: "var(--radius-sm)", 
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "var(--primary-950)", fontSize: "14px" }}>{site.siteName}</span>
                  <Badge status={site.status || "Planning"} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                  <MapPin size={13} style={{ color: "var(--accent-500)" }} />
                  <span>{site.location}</span>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-dark)", marginTop: "2px" }}>
                  <span>Start: {site.startDate || "--"}</span>
                  <span>End: {site.expectedEndDate || "--"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* MAIN LAYOUT: 5 MAIN CARDS RESPONSIVE GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px", alignItems: "start" }}>
        
        {/* CARD 1: TODAY'S ATTENDANCE */}
        <Card title="1. Today's Attendance Check-in" icon={ClipboardCheck} variant="accent">
          {todayAttendance ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "var(--success-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={28} style={{ color: "var(--success-500)" }} />
              </div>
              <div>
                <h4 style={{ fontWeight: 800, color: "var(--primary-950)", margin: 0 }}>Attendance Marked Present</h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                  Check-in Time: <strong>{todayAttendance.checkInTime?.seconds 
                    ? new Date(todayAttendance.checkInTime.seconds * 1000).toLocaleTimeString()
                    : new Date(todayAttendance.checkInTime).toLocaleTimeString()}</strong>
                </p>
                <p style={{ fontSize: "11px", color: "var(--accent-600)", marginTop: "4px", fontFamily: "monospace" }}>
                  Coordinates: {Number(todayAttendance.latitude).toFixed(5)}, {Number(todayAttendance.longitude).toFixed(5)}
                </p>
                {todayAttendance.photoUrl && (
                  <div style={{ marginTop: "12px", width: "100%", height: "130px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={todayAttendance.photoUrl} alt="Check-in verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "var(--danger-50)", padding: "12px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--danger-500)" }}>
                <AlertCircle size={18} style={{ color: "var(--danger-500)", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "var(--danger-700)", fontWeight: 600 }}>
                  Individual check-in is pending for today.
                </span>
              </div>

              <div className="form-group">
                <label>Select Worksite Location</label>
                {renderSiteSelector(selectedAttendanceSiteId, handleAttendanceSiteChange)}
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", color: "var(--accent-600)", cursor: "pointer", userSelect: "none" }}>
                <input 
                  type="checkbox" 
                  checked={mockLocation} 
                  onChange={(e) => setMockLocation(e.target.checked)} 
                />
                <span>Developer Mock GPS Location (Success Check)</span>
              </label>

              <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />

              {/* Step 1: Upload Verification Photo */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary-900)" }}>
                    Step 1: Upload Verification Photo
                  </span>
                  {attendancePhotoUploaded ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--success-600)", display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: "10px", fontWeight: 700 }}>Required</span>
                  )}
                </div>

                {!attendancePhotoUploaded ? (
                  <form onSubmit={handleUploadAttendancePhoto} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "center", 
                        gap: "6px", 
                        padding: "16px", 
                        border: "2px dashed var(--border-color)", 
                        borderRadius: "var(--radius-sm)", 
                        cursor: "pointer", 
                        backgroundColor: "var(--primary-50)" 
                      }}>
                        <Camera size={24} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-800)" }}>Take Selfie / Photo at Site</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          style={{ display: "none" }} 
                          onChange={(e) => handleFileChange(e, setAttendancePhotoFile, setAttendancePhotoPreview)} 
                        />
                      </label>
                      {attendancePhotoFile && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--success-600)", textAlign: "center" }}>
                          Photo Selected: {attendancePhotoFile.name}
                        </span>
                      )}
                    </div>

                    {attendancePhotoPreview && (
                      <div style={{ position: "relative", width: "100%", height: "130px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                        <img src={attendancePhotoPreview} alt="Attendance preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" onClick={() => { setAttendancePhotoFile(null); setAttendancePhotoPreview(null); }} style={{ position: "absolute", top: "6px", right: "6px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={12} /></button>
                      </div>
                    )}

                    <Button 
                      type="submit"
                      isLoading={attendancePhotoUploading}
                      icon={Upload}
                      disabled={!attendancePhotoPreview}
                      style={{ width: "100%" }}
                    >
                      Upload Photo to Verify Location
                    </Button>
                  </form>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", backgroundColor: "var(--success-50)", border: "1px solid var(--success-200)", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle2 size={16} style={{ color: "var(--success-600)" }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-800)" }}>Photo Uploaded & Verified</span>
                    </div>
                    {uploadedAttendancePhotoUrl && (
                      <div style={{ width: "100%", height: "100px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--success-200)" }}>
                        <img src={uploadedAttendancePhotoUrl} alt="Uploaded check-in verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => {
                        setAttendancePhotoUploaded(false);
                        setUploadedAttendancePhotoUrl("");
                        setAttendancePhotoLat(null);
                        setAttendancePhotoLng(null);
                      }} 
                      style={{ 
                        alignSelf: "flex-end",
                        background: "none",
                        border: "none",
                        color: "var(--danger-600)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>

              <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />

              {/* Step 2: Mark Attendance */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary-900)" }}>
                  Step 2: Mark Attendance
                </span>
                
                <form onSubmit={handleMarkAttendance}>
                  <Button 
                    type="submit"
                    isLoading={attendanceSubmitting}
                    disabled={!attendancePhotoUploaded}
                    icon={ClipboardCheck}
                    style={{ width: "100%" }}
                  >
                    Mark Attendance & Check-In
                  </Button>
                </form>
              </div>
            </div>
          )}
        </Card>

        {/* CARD 2: ADD MATERIAL */}
        <Card title="2. Add Material Received" icon={Package} variant="accent">
          <form onSubmit={handleMaterialSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-group">
              <label>Logging Site</label>
              {renderSiteSelector(selectedMaterialSiteId, setSelectedMaterialSiteId)}
            </div>

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
                placeholder="Supplier Company"
                value={materialSupplier}
                onChange={(e) => setMaterialSupplier(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <label htmlFor="material-notes">Notes (Optional)</label>
              <textarea 
                id="material-notes"
                placeholder="Inspection notes, etc..."
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
                  <img src={materialInvoicePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => { setMaterialInvoiceFile(null); setMaterialInvoicePreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                </div>
              )}
            </div>

            <Button type="submit" isLoading={materialSubmitting} icon={Save} style={{ width: "100%", marginTop: "4px" }}>
              Save Material Log
            </Button>
          </form>

          {/* Compact Recent Material Logs */}
          <div style={{ marginTop: "20px" }}>
            <h5 style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-900)", marginBottom: "8px" }}>Recent Materials Logged</h5>
            <div style={{ overflowX: "auto" }}>
              <table className="status-table" style={{ margin: 0, fontSize: "11px" }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Date</th>
                    <th>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.filter(m => m.siteId === selectedMaterialSiteId).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px" }}>No logs recorded.</td>
                    </tr>
                  ) : (
                    materials.filter(m => m.siteId === selectedMaterialSiteId).slice(0, 4).map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700 }}>{m.materialName}</td>
                        <td>{m.quantity} {m.unit}</td>
                        <td className="font-mono">{m.purchaseDate}</td>
                        <td>{m.invoiceUrl ? <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-600)", fontWeight: "bold" }}>View</a> : "--"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* CARD 3: CAPTURE SITE PHOTO */}
        <Card title="3. Capture Site Photo" icon={Camera} variant="accent">
          <form onSubmit={handlePhotoUpload} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-group">
              <label>Select Target Site</label>
              {renderSiteSelector(selectedPhotoSiteId, setSelectedPhotoSiteId)}
            </div>

            <div className="form-group">
              <label>Site Picture Source</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                <label style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  gap: "8px", 
                  padding: "20px", 
                  border: "2px dashed var(--border-color)", 
                  borderRadius: "var(--radius-sm)", 
                  cursor: "pointer", 
                  backgroundColor: "var(--primary-50)" 
                }}>
                  <Camera size={28} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    style={{ display: "none" }} 
                    onChange={(e) => handleFileChange(e, setSitePhotoFile, setSitePhotoPreview)} 
                  />
                </label>
                {sitePhotoFile && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--success-600)" }}>
                    Selected: {sitePhotoFile.name}
                  </span>
                )}
              </div>

              {sitePhotoPreview && (
                <div style={{ marginTop: "12px", position: "relative", width: "100%", height: "150px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <img src={sitePhotoPreview} alt="Capture preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => { setSitePhotoFile(null); setSitePhotoPreview(null); }} style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                </div>
              )}
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "700", color: "var(--accent-600)", cursor: "pointer", userSelect: "none" }}>
              <input 
                type="checkbox" 
                checked={mockLocation} 
                onChange={(e) => setMockLocation(e.target.checked)} 
              />
              <span>Developer Mock GPS Location (Success Check)</span>
            </label>

            <Button type="submit" isLoading={photoSubmitting} icon={Upload} style={{ width: "100%" }}>
              Upload Tagged Photo
            </Button>
          </form>

          {/* Photo Gallery Grid */}
          <div style={{ marginTop: "20px" }}>
            <h5 style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-900)", marginBottom: "8px" }}>Latest Photo Submissions</h5>
            {sitePhotos.filter(p => p.siteId === selectedPhotoSiteId).length === 0 ? (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", margin: "12px 0" }}>No photos logged yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {sitePhotos.filter(p => p.siteId === selectedPhotoSiteId).slice(0, 4).map(photo => (
                  <div key={photo.id} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", overflow: "hidden", backgroundColor: "#fff" }}>
                    <div style={{ height: "70px", position: "relative" }}>
                      <img src={photo.imageUrl} alt="Progress site" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: "6px", fontSize: "9px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                        {photo.capturedAt?.seconds 
                          ? new Date(photo.capturedAt.seconds * 1000).toLocaleDateString()
                          : new Date(photo.capturedAt).toLocaleDateString()}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--accent-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        GPS: {Number(photo.latitude).toFixed(3)}, {Number(photo.longitude).toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* CARD 4: LABOUR DAILY COUNT ENTRY */}
        <Card title="4. Labour Daily Counts" icon={Users} variant="accent">
          <form onSubmit={handleSaveLabourCounts} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-group">
              <label>Target Site</label>
              {renderSiteSelector(selectedLabourSiteId, setSelectedLabourSiteId)}
            </div>

            <div className="form-group">
              <label htmlFor="labour-date">Labour Entry Date</label>
              <input 
                type="date" 
                id="labour-date" 
                value={labourDate} 
                onChange={(e) => setLabourDate(e.target.value)} 
                required 
              />
            </div>

            {/* Counts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "8px 0" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="mason-count" style={{ fontSize: "11px", fontWeight: "700" }}>Masons count</label>
                <input 
                  type="number" 
                  id="mason-count" 
                  min="0" 
                  value={masonCount} 
                  onChange={(e) => setMasonCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="helper-count" style={{ fontSize: "11px", fontWeight: "700" }}>Helpers count</label>
                <input 
                  type="number" 
                  id="helper-count" 
                  min="0" 
                  value={helperCount} 
                  onChange={(e) => setHelperCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="painter-count" style={{ fontSize: "11px", fontWeight: "700" }}>Painters count</label>
                <input 
                  type="number" 
                  id="painter-count" 
                  min="0" 
                  value={painterCount} 
                  onChange={(e) => setPainterCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="plumber-count" style={{ fontSize: "11px", fontWeight: "700" }}>Plumbers count</label>
                <input 
                  type="number" 
                  id="plumber-count" 
                  min="0" 
                  value={plumberCount} 
                  onChange={(e) => setPlumberCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="electrician-count" style={{ fontSize: "11px", fontWeight: "700" }}>Electricians count</label>
                <input 
                  type="number" 
                  id="electrician-count" 
                  min="0" 
                  value={electricianCount} 
                  onChange={(e) => setElectricianCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="other-count" style={{ fontSize: "11px", fontWeight: "700" }}>Others count</label>
                <input 
                  type="number" 
                  id="other-count" 
                  min="0" 
                  value={otherCount} 
                  onChange={(e) => setOtherCount(Math.max(0, parseInt(e.target.value) || 0))} 
                  required 
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "var(--primary-50)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-900)" }}>Total Labor Count:</span>
              <strong style={{ fontSize: "14px", color: "var(--accent-600)" }}>
                {masonCount + helperCount + painterCount + plumberCount + electricianCount + otherCount} workers
              </strong>
            </div>

            <Button type="submit" isLoading={labourSaving} icon={Save} style={{ width: "100%" }}>
              Save Labour Counts
            </Button>
          </form>

          {/* Historical Logs List */}
          <div style={{ marginTop: "20px" }}>
            <h5 style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-900)", marginBottom: "8px" }}>Counts History Log</h5>
            {labourHistoryLoading ? (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", margin: "12px 0" }}>Syncing counts...</p>
            ) : labourHistory.length === 0 ? (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", margin: "12px 0" }}>No daily counts registered yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="status-table" style={{ margin: 0, fontSize: "11px" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Masons</th>
                      <th>Helpers</th>
                      <th>Plumbers</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourHistory.slice(0, 4).map(h => (
                      <tr key={h.date}>
                        <td style={{ fontWeight: 700 }} className="font-mono">{h.date}</td>
                        <td>{h.Masons}</td>
                        <td>{h.Helpers}</td>
                        <td>{h.Plumbers}</td>
                        <td style={{ fontWeight: 700, color: "var(--primary-800)" }}>{h.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* CARD 5: DAILY PROGRESS UPDATE */}
        <Card title="5. Daily Progress Update" icon={FileText} variant="accent">
          <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-group">
              <label>Select Target Project</label>
              {renderSiteSelector(selectedLogSiteId, setSelectedLogSiteId)}
            </div>

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
              <label htmlFor="work-description">Description of Daily Work Completed</label>
              <textarea 
                id="work-description" 
                placeholder="Describe pours completed, blocks completed, deliveries, delayed sections, etc..."
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                required 
                style={{ minHeight: "80px" }}
              />
            </div>

            <div className="form-group">
              <label>Attach Progress Image (Optional)</label>
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
                  <img src={progressPhotoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                </div>
              )}
            </div>

            <Button type="submit" isLoading={progressSubmitting} icon={Save} style={{ width: "100%", marginTop: "4px" }}>
              Submit Progress Report
            </Button>
          </form>

          {/* History of daily progress updates */}
          <div style={{ marginTop: "20px" }}>
            <h5 style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary-900)", marginBottom: "8px" }}>Reports Submission History</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
              {dailyUpdates.filter(u => u.siteId === selectedLogSiteId).length === 0 ? (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", margin: "12px 0" }}>No reports logged yet.</p>
              ) : (
                dailyUpdates.filter(u => u.siteId === selectedLogSiteId).map(update => (
                  <div key={update.id} style={{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span className="font-mono" style={{ fontWeight: 700 }}>
                        {update.createdAt?.seconds 
                          ? new Date(update.createdAt.seconds * 1000).toLocaleDateString()
                          : new Date(update.createdAt).toLocaleDateString()}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--success-600)" }}>Progress: {update.progress}</span>
                    </div>
                    <p style={{ margin: 0, color: "var(--primary-800)" }}>{update.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <Loading show={loading} text="Loading Dashboard..." />
    </Layout>
  );
}

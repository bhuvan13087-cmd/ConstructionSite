import React, { useState, useEffect, useRef, useMemo } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSites, 
  createSite, 
  updateSite, 
  deleteSite,
  getSiteEngineers,
  approveSiteLocation,
  rejectSiteLocation,
  calculateDistanceMeters
} from "../services/firebaseService";
import { formatINR, calculateTotalSitesBudget, getSiteBudget, formatDateDMY } from "../services/businessLogic";
import Loading from "../components/common/Loading";
import SiteDetails from "./SiteDetails";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import SiteFilterBar from "../components/common/SiteFilterBar";
import ViewToggle from "../components/common/ViewToggle";
import { useAuth } from "../context/AuthContext";
import { firebaseConfig } from "../firebase/config";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  MapPin, 
  Building2,
  Calendar,
  Check,
  X,
  AlertCircle,
  Shield
} from "lucide-react";
import AdminAssistedEntryModal from "../components/common/AdminAssistedEntryModal";

const addressGeocodeCache = new Map();

const PendingApprovalItem = ({ site, engineers, onApprove, onReject }) => {
  const [distance, setDistance] = useState(null);
  const [loadingDistance, setLoadingDistance] = useState(false);
  const [errorDistance, setErrorDistance] = useState(null);
  const [mapType, setMapType] = useState("h"); // "m" for roadmap, "k" for satellite, "h" for hybrid
  const [zoomLevel, setZoomLevel] = useState(19); // default 19 for street-level detail

  useEffect(() => {
    let isMounted = true;
    const fetchDistance = async () => {
      const targetAddress = site.assignedAddress || site.location;
      if (!targetAddress || !site.proposedLatitude || !site.proposedLongitude) return;

      const cacheKey = targetAddress.trim().toLowerCase();
      if (addressGeocodeCache.has(cacheKey)) {
        const cached = addressGeocodeCache.get(cacheKey);
        if (cached && isMounted) {
          const dist = calculateDistanceMeters(cached.lat, cached.lon, site.proposedLatitude, site.proposedLongitude);
          setDistance(dist);
          return;
        }
      }

      setLoadingDistance(true);
      setErrorDistance(null);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetAddress)}&limit=1`);
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = Number(data[0].lat);
            const lon = Number(data[0].lon);
            addressGeocodeCache.set(cacheKey, { lat, lon });
            const dist = calculateDistanceMeters(lat, lon, site.proposedLatitude, site.proposedLongitude);
            if (isMounted) setDistance(dist);
          } else {
            if (isMounted) setErrorDistance("Could not geocode assigned address");
          }
        } else {
          if (isMounted) setErrorDistance("API lookup failed");
        }
      } catch (err) {
        console.warn("Error geocoding target address:", err);
        if (isMounted) setErrorDistance("Lookup exception");
      } finally {
        if (isMounted) setLoadingDistance(false);
      }
    };
    fetchDistance();
    return () => {
      isMounted = false;
    };
  }, [site]);

  const engineer = engineers.find(e => e.id === site.proposedLocationCapturedBy) || { fullName: "Unknown Engineer" };
  const distKm = distance !== null ? (distance / 1000).toFixed(2) : null;
  const isFar = distance !== null && distance > 500; // red warning if > 500m

  return (
    <div className="pending-location-item" style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "24px",
      padding: "20px",
      backgroundColor: "#ffffff",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border-color)",
      boxShadow: "var(--shadow-sm)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      position: "relative"
    }}>
      {/* Left Column: Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
        <div>
          <span className="badge badge-warning" style={{ display: "inline-block", marginBottom: "6px" }}>Pending Approval</span>
          <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>{site.siteName}</h4>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>Client: {site.clientName || "--"}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-500)", display: "block" }}>Assigned Address (Admin)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              <MapPin size={13} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary-800)" }}>{site.assignedAddress || site.location}</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-500)", display: "block" }}>Captured GPS Location (Engineer)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              <MapPin size={13} style={{ color: "var(--accent-500)" }} />
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent-800)" }}>
                {site.proposedLatitude.toFixed(6)}, {site.proposedLongitude.toFixed(6)}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>
                (Accuracy: {Math.round(site.proposedLocationAccuracy)}m)
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
            <div style={{ backgroundColor: "var(--primary-50)", padding: "8px 10px", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-600)", display: "block" }}>Captured Street</span>
              <strong style={{ fontSize: "12px", color: "var(--primary-900)", wordBreak: "break-word" }}>{site.proposedStreet || "Unknown Street"}</strong>
            </div>
            <div style={{ backgroundColor: "var(--primary-50)", padding: "8px 10px", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-600)", display: "block" }}>Captured Area</span>
              <strong style={{ fontSize: "12px", color: "var(--primary-900)", wordBreak: "break-word" }}>{site.proposedArea || "Unknown Area"}</strong>
            </div>
          </div>

          <div style={{ marginTop: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-500)", display: "block" }}>Full Reverse-Geocoded Address</span>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
              {site.proposedLocation}
            </p>
          </div>
        </div>

        {/* Distance Comparison */}
        <div style={{
          marginTop: "6px",
          padding: "10px 12px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: loadingDistance ? "var(--primary-50)" : (isFar ? "var(--danger-50)" : "var(--success-50)"),
          border: `1px solid ${loadingDistance ? "var(--primary-200)" : (isFar ? "var(--danger-200)" : "var(--success-200)")}`
        }}>
          {loadingDistance ? (
            <span style={{ fontSize: "12px", color: "var(--primary-700)", fontWeight: "600" }}>Calculating distance to assigned address...</span>
          ) : errorDistance ? (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Distance check: {errorDistance}</span>
          ) : (
            <>
              {isFar ? (
                <AlertCircle size={15} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
              ) : (
                <Check size={15} style={{ color: "var(--success-600)", flexShrink: 0 }} />
              )}
              <span style={{ fontSize: "12px", fontWeight: "700", color: isFar ? "var(--danger-700)" : "var(--success-700)" }}>
                {isFar 
                  ? `Warning: Location is ${distKm} km away from assigned address!`
                  : `Verified: Location is ${distance !== null ? Math.round(distance) : 0} meters from assigned address.`}
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Captured by <strong>{engineer.fullName}</strong> on {site.proposedLocationCreatedDate ? new Date(site.proposedLocationCreatedDate).toLocaleString() : "--"}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <Button 
            onClick={() => onApprove(site.id, site)} 
            icon={Check} 
            size="sm"
            style={{ backgroundColor: "var(--success-600)", color: "#ffffff", borderColor: "var(--success-700)" }}
          >
            Approve Location
          </Button>
          <Button 
            onClick={() => onReject(site.id)} 
            icon={X} 
            variant="outline"
            size="sm"
            style={{ color: "var(--danger-600)", borderColor: "var(--danger-300)" }}
          >
            Reject Setup
          </Button>
        </div>
      </div>

      {/* Right Column: Map Embed */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-500)", textAlign: "left" }}>Live Map Verification View</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              style={{
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 4px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="15">Zoom 15</option>
              <option value="17">Zoom 17</option>
              <option value="18">Zoom 18</option>
              <option value="19">Zoom 19</option>
              <option value="20">Zoom 20</option>
              <option value="21">Zoom 21</option>
            </select>
            <button
              type="button"
              onClick={() => setMapType("m")}
              style={{
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: mapType === "m" ? "var(--primary-600)" : "#ffffff",
                color: mapType === "m" ? "#ffffff" : "var(--text-muted)",
                cursor: "pointer"
              }}
            >
              Road
            </button>
            <button
              type="button"
              onClick={() => setMapType("k")}
              style={{
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: mapType === "k" ? "var(--primary-600)" : "#ffffff",
                color: mapType === "k" ? "#ffffff" : "var(--text-muted)",
                cursor: "pointer"
              }}
            >
              Sat
            </button>
            <button
              type="button"
              onClick={() => setMapType("h")}
              style={{
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: mapType === "h" ? "var(--primary-600)" : "#ffffff",
                color: mapType === "h" ? "#ffffff" : "var(--text-muted)",
                cursor: "pointer"
              }}
            >
              Hybrid
            </button>
          </div>
        </div>
        <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden", minHeight: "260px", height: "100%" }}>
          <iframe 
            width="100%" 
            height="100%" 
            style={{ border: "0", minHeight: "260px" }} 
            src={`https://maps.google.com/maps?q=${site.proposedLatitude},${site.proposedLongitude}&z=${zoomLevel}&t=${mapType}&output=embed`}
            title={`Proposed Map for ${site.siteName}`}
          />
        </div>
      </div>
    </div>
  );
};

export default function Sites() {
  const { userProfile } = useAuth();
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [engineerFilter, setEngineerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [progressFilter, setProgressFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [showAdminEntryModal, setShowAdminEntryModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: "Confirm Action",
    message: "Are you sure you want to perform this action?",
    confirmText: "Confirm",
    variant: "primary",
    onConfirm: null
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, show: false, onConfirm: null }));
  };

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  
  // Form Fields State
  const [formMode, setFormMode] = useState("add"); // "add" or "edit"
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formLocationName, setFormLocationName] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formPlaceId, setFormPlaceId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formExpectedEndDate, setFormExpectedEndDate] = useState("");
  const [formStatus, setFormStatus] = useState("Planning");
  const [formBudget, setFormBudget] = useState("");
  const [viewMode, setViewMode] = useState("normal");

  // Google Maps States & Refs
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);



  // Load Google Maps API script dynamically
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsMapsLoaded(true);
      return;
    }
    const apiKey = firebaseConfig.googleMapsApiKey || firebaseConfig.apiKey;
    if (!apiKey) {
      console.error("Google Maps API Key is not set in firebaseConfig.");
      setMapsLoadError(true);
      return;
    }

    // Capture Google Maps API authentication errors
    window.gm_authFailure = () => {
      console.error("Google Maps API authentication failed: billing is not configured, or Maps JS APIs are disabled on your Google Cloud Console.");
      setMapsLoadError(true);
      setIsMapsLoaded(false);
    };

    const scriptId = "google-maps-api-script";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => setIsMapsLoaded(true);
    const handleError = () => setMapsLoadError(true);

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      if (script) {
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
      }
    };
  }, []);

  // Initialize Map inside Modal (Google Maps version)
  useEffect(() => {
    if (!showFormModal || !isMapsLoaded || !mapDivRef.current || !window.google || !window.google.maps) return;

    // Clear any previous elements in map div to prevent duplicate or conflicting maps
    mapDivRef.current.innerHTML = "";

    // Centered at Chennai, Tamil Nadu for optimal local centering
    const initialLat = Number(formLatitude) || 13.0827; 
    const initialLng = Number(formLongitude) || 80.2707;
    const hasCoords = !!formLatitude && !!formLongitude;

    const mapOptions = {
      center: { lat: initialLat, lng: initialLng },
      zoom: hasCoords ? 19 : 8,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_RIGHT
      },
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true
    };

    const map = new window.google.maps.Map(mapDivRef.current, mapOptions);
    mapInstanceRef.current = map;

    const marker = new window.google.maps.Marker({
      position: { lat: initialLat, lng: initialLng },
      map: map,
      draggable: true,
      title: "Construction Site Location",
      animation: window.google.maps.Animation.DROP
    });
    markerInstanceRef.current = marker;

    // Real-time dragging updates
    window.google.maps.event.addListener(marker, "drag", () => {
      const pos = marker.getPosition();
      const latVal = pos.lat();
      const lngVal = pos.lng();
      setFormLatitude(latVal.toFixed(6));
      setFormLongitude(lngVal.toFixed(6));
    });

    window.google.maps.event.addListener(marker, "dragend", () => {
      const pos = marker.getPosition();
      const latVal = pos.lat();
      const lngVal = pos.lng();
      setFormLatitude(latVal.toFixed(6));
      setFormLongitude(lngVal.toFixed(6));
    });

    // Map click fine alignment click event
    map.addListener("click", (e) => {
      const latLng = e.latLng;
      marker.setPosition(latLng);
      setFormLatitude(latLng.lat().toFixed(6));
      setFormLongitude(latLng.lng().toFixed(6));
    });

    return () => {
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setMap(null);
        markerInstanceRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [showFormModal, isMapsLoaded]);




  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedSites, fetchedEngineers] = await Promise.all([
        getSites(),
        getSiteEngineers()
      ]);
      setSites(fetchedSites);
      setEngineers(fetchedEngineers);
    } catch (err) {
      console.error("Error loading sites page data:", err);
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to view sites.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
        showToast("Database Offline: Please check your network connection.", "error");
      } else {
        showToast(`Failed to load sites: ${err.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (site.siteName || "").toLowerCase().includes(q);
        const matchClient = (site.clientName || "").toLowerCase().includes(q);
        const matchLoc = (site.location || "").toLowerCase().includes(q);
        if (!matchName && !matchClient && !matchLoc) return false;
      }

      // Status Filter
      if (statusFilter !== "all" && site.status !== statusFilter) return false;

      // Engineer Filter
      if (engineerFilter) {
        const matchEng = site.proposedLocationCapturedBy === engineerFilter || (site.assignedEngineers && site.assignedEngineers.includes(engineerFilter));
        if (!matchEng) return false;
      }

      // Date Range Filter
      if (fromDate && site.startDate && site.startDate < fromDate) return false;
      if (toDate && site.expectedEndDate && site.expectedEndDate > toDate) return false;

      // Progress Filter
      if (progressFilter !== "all") {
        const p = Number(site.progress || 0);
        if (progressFilter === "0-25" && (p < 0 || p > 25)) return false;
        if (progressFilter === "25-50" && (p <= 25 || p > 50)) return false;
        if (progressFilter === "50-75" && (p <= 50 || p > 75)) return false;
        if (progressFilter === "75-100" && (p <= 75 || p > 100)) return false;
      }

      return true;
    });
  }, [sites, searchQuery, statusFilter, engineerFilter, fromDate, toDate, progressFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setEngineerFilter("");
    setFromDate("");
    setToDate("");
    setProgressFilter("all");
  };

  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormId("");
    setFormName("");
    setFormClientName("");
    setFormLocation("");
    setFormLocationName("");
    setFormLatitude("");
    setFormLongitude("");
    setFormPlaceId("");
    setFormStartDate("");
    setFormExpectedEndDate("");
    setFormStatus("Planning");
    setFormBudget("");
    setShowFormModal(true);
  };

  const handleOpenEditModal = (site) => {
    setFormMode("edit");
    setFormId(site.id);
    setFormName(site.siteName || "");
    setFormClientName(site.clientName || "");
    setFormLocation(site.location || "");
    setFormLocationName(site.siteLocationName || "");
    setFormLatitude(site.latitude || "");
    setFormLongitude(site.longitude || "");
    setFormPlaceId(site.googlePlaceId || "");
    setFormStartDate(site.startDate || "");
    setFormExpectedEndDate(site.expectedEndDate || "");
    setFormStatus(site.status || "Planning");
    setFormBudget(site.budget !== undefined && site.budget !== null ? site.budget.toString() : "");
    setShowFormModal(true);
  };

  const executeSaveSite = async (budgetNum, rad) => {
    setLoading(true);
    try {
      if (formMode === "add") {
        const adminId = userProfile?.uid || userProfile?.id || null;
        await createSite(
          formName.trim(), 
          formClientName.trim(), 
          formLocation.trim(), 
          formStartDate, 
          formExpectedEndDate, 
          formStatus,
          formLatitude,
          formLongitude,
          50,
          adminId,
          formPlaceId,
          formLocationName.trim(),
          budgetNum
        );
        showToast("Construction Site added successfully.", "success");
        setShowFormModal(false);
        await loadData();
      } else {
        await updateSite(
          formId,
          formName.trim(),
          formClientName.trim(),
          formLocation.trim(),
          formStartDate,
          formExpectedEndDate,
          formStatus,
          rad,
          formLatitude,
          formLongitude,
          formPlaceId,
          formLocationName.trim(),
          budgetNum
        );
        showToast("Construction Site updated successfully.", "success");
        setShowFormModal(false);
        await loadData();
      }
    } catch (err) {
      console.error("Form action failed:", err);
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to modify sites.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
        showToast("Database Offline: Please check your network connection.", "error");
      } else {
        showToast(err.message || "Failed to save site.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Validation checks
    if (!formName.trim()) {
      showToast("Site Name is required.", "error");
      return;
    }
    if (!formClientName.trim()) {
      showToast("Client Name is required.", "error");
      return;
    }
    if (!formStartDate) {
      showToast("Start Date is required.", "error");
      return;
    }
    if (!formExpectedEndDate) {
      showToast("Expected End Date is required.", "error");
      return;
    }
    if (new Date(formExpectedEndDate) < new Date(formStartDate)) {
      showToast("Expected End Date cannot be before Start Date.", "error");
      return;
    }

    const budgetNum = Number(formBudget);
    if (!formBudget.toString().trim()) {
      showToast("Site Budget is required.", "error");
      return;
    }
    if (isNaN(budgetNum) || budgetNum <= 0) {
      showToast("Site Budget must be a positive numeric value.", "error");
      return;
    }

    if (!formLatitude || !formLongitude) {
      showToast("Please search for or click to pin the exact site location on Google Maps.", "error");
      return;
    }

    let rad = 50;
    if (formMode === "edit") {
      const existingSite = sites.find(s => s.id === formId);
      rad = existingSite ? Number(existingSite.radius || 50) : 50;

      // Popup confirmation before updating site
      setConfirmModal({
        show: true,
        title: "Save Site Modifications",
        message: `Are you sure you want to update and save modifications to construction site "${formName.trim()}"?`,
        confirmText: "Save Changes",
        variant: "primary",
        onConfirm: () => {
          closeConfirmModal();
          executeSaveSite(budgetNum, rad);
        }
      });
      return;
    }

    await executeSaveSite(budgetNum, rad);
  };

  const handleApproveLocation = (siteId, siteData) => {
    setConfirmModal({
      show: true,
      title: "Approve Site Location",
      message: `Are you sure you want to approve boundary location setup for "${siteData.siteName}"?`,
      confirmText: "Approve Location",
      variant: "primary",
      onConfirm: async () => {
        closeConfirmModal();
        setLoading(true);
        try {
          await approveSiteLocation(siteId, siteData);
          showToast("Site Location Approved successfully", "success");
          await loadData();
        } catch (err) {
          console.error("Error approving site location:", err);
          showToast(`Failed to approve location: ${err.message}`, "error");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleRejectLocation = (siteId) => {
    setConfirmModal({
      show: true,
      title: "Reject Site Location",
      message: "Are you sure you want to reject this site location setup? The site engineer will need to capture it again.",
      confirmText: "Reject Location",
      variant: "danger",
      onConfirm: async () => {
        closeConfirmModal();
        setLoading(true);
        try {
          await rejectSiteLocation(siteId);
          showToast("Site Location Rejected", "info");
          await loadData();
        } catch (err) {
          console.error("Error rejecting site location:", err);
          showToast(`Failed to reject location: ${err.message}`, "error");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteSite = (site) => {
    setConfirmModal({
      show: true,
      title: "Delete Construction Site",
      message: `Are you sure you want to permanently delete site "${site.siteName}"? All associated logs and site records will be removed.`,
      confirmText: "Delete Site",
      variant: "danger",
      onConfirm: async () => {
        closeConfirmModal();
        setLoading(true);
        try {
          await deleteSite(site.id);
          showToast("Site deleted successfully.", "success");
          await loadData();
        } catch (err) {
          console.error("Deletion failed:", err);
          if (err.code === "permission-denied") {
            showToast("Access Denied: You do not have permission to delete sites.", "error");
          } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
            showToast("Database Offline: Please check your network connection.", "error");
          } else {
            showToast(`Failed to delete site: ${err.message}`, "error");
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (selectedSiteId) {
    return (
      <SiteDetails 
        siteId={selectedSiteId} 
        onBack={() => setSelectedSiteId(null)} 
      />
    );
  }

  return (
    <Layout title="Construction Sites" description="Manage active civil construction projects and track details.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Pending Location Approvals Section */}
      {sites.some(s => s.locationStatus === "Pending Approval") && (
        <Card 
          title="Pending Location Approvals" 
          style={{ 
            marginBottom: "24px", 
            border: "1.5px solid var(--warning-300)", 
            backgroundColor: "rgba(245, 158, 11, 0.03)" 
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sites.filter(s => s.locationStatus === "Pending Approval").map(site => (
              <PendingApprovalItem 
                key={site.id} 
                site={site} 
                engineers={engineers} 
                onApprove={handleApproveLocation} 
                onReject={handleRejectLocation} 
              />
            ))}
          </div>
        </Card>
      )}

      {/* Toolbar header */}
      <div className="subview-actions-header">
        <div className="search-filter-bar">
          <div className="input-wrapper search-wrapper">
            <Search className="input-icon" size={16} />
            <input 
              type="text" 
              placeholder="Search sites by name, client, or location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdminEntryModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8", fontWeight: "750" }}
          >
            <Shield size={16} />
            <span>Add Entry for Engineer</span>
          </Button>
          <Button onClick={handleOpenAddModal} icon={Plus} className="btn-add">
            Add Site
          </Button>
        </div>
      </div>

      {/* KPI Summary Bar */}
      {sites.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "24px"
        }}>
          {[
            { label: "Total Sites", value: sites.length, sub: "Registered projects", icon: "🏗️", bg: "#fff7ed", border: "#ffedd5", color: "#c2410c" },
            { label: "Active Sites", value: sites.filter(s => s.status === "Active").length, sub: "Currently ongoing", icon: "✅", bg: "var(--success-50)", border: "var(--success-100)", color: "var(--success-600)" },
            { label: "Planning", value: sites.filter(s => s.status === "Planning").length, sub: "Not yet started", icon: "📋", bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-700)" },
            { label: "Completed", value: sites.filter(s => s.status === "Completed").length, sub: "Finished projects", icon: "🏆", bg: "#f0fdf4", border: "#dcfce7", color: "var(--success-600)" },
            { label: "Total Budget", value: formatINR(calculateTotalSitesBudget(sites)), sub: "Across all sites", icon: "💰", bg: "#fff7ed", border: "#ffedd5", color: "#c2410c" }
          ].map((kpi, i) => (
            <div key={i} style={{
              background: kpi.bg,
              border: `1px solid ${kpi.border}`,
              borderRadius: "14px",
              padding: "16px 18px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{kpi.label}</span>
                <span style={{ fontSize: "18px" }}>{kpi.icon}</span>
              </div>
              <div style={{ fontSize: kpi.label === "Total Budget" ? "20px" : "24px", fontWeight: "900", color: kpi.color, lineHeight: "1.2", wordBreak: "break-word" }}>{kpi.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── All Sites Table (Full-Width Compact List) ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)"
      }}>
        {filteredSites.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "56px 24px",
            color: "var(--text-muted)"
          }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🏗️</div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--primary-800)", marginBottom: "4px" }}>
              {searchQuery ? "No construction sites match your search" : "No construction sites found"}
            </div>
            <div style={{ fontSize: "12px" }}>
              {searchQuery ? "Try searching with a different name, client, or location." : `Click "Add Site" to register your first project.`}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", padding: "16px" }}>
            {filteredSites.map((site) => {
              const statusColors = {
                Active: { bg: "var(--success-50)", border: "var(--success-100)", color: "var(--success-600)", dot: "var(--success-500)" },
                Planning: { bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-700)", dot: "var(--primary-500)" },
                Completed: { bg: "#f0fdf4", border: "#dcfce7", color: "var(--success-700)", dot: "var(--success-600)" }
              };
              const sc = statusColors[site.status] || statusColors["Planning"];
              const initials = site.siteName ? site.siteName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "CS";
              const budgetVal = getSiteBudget(site);
              const budgetFormatted = budgetVal > 0 ? formatINR(budgetVal) : "—";

              return (
                <div
                  key={site.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div>
                    {/* Card Header: Initials, Name & Status */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          onClick={() => setSelectedSiteId(site.id)}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            backgroundColor: "#fff7ed",
                            border: "1.5px solid #ffedd5",
                            color: "#c2410c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "800",
                            fontSize: "12px",
                            flexShrink: 0,
                            cursor: "pointer"
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <h4 
                            onClick={() => setSelectedSiteId(site.id)}
                            style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0f172a", cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ea580c"}
                            onMouseLeave={e => e.currentTarget.style.color = "#0f172a"}
                          >
                            {site.siteName}
                          </h4>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>{site.clientName || "No Client"}</span>
                        </div>
                      </div>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "700",
                        backgroundColor: sc.bg,
                        color: sc.color,
                        border: `1px solid ${sc.border}`
                      }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: sc.dot }} />
                        {site.status || "Planning"}
                      </span>
                    </div>

                    {/* Details: Location, Budget, Timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={13} style={{ color: "#ea580c", flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{site.location || "—"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "4px" }}>
                        <span style={{ color: "#64748b" }}>Budget:</span>
                        <strong style={{ fontFamily: "monospace", color: "#0f172a" }}>{budgetFormatted}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>Dates:</span>
                        <span>{formatDateDMY(site.startDate)} to {formatDateDMY(site.expectedEndDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                    <Button 
                      onClick={() => setSelectedSiteId(site.id)} 
                      variant="outline" 
                      style={{ height: "30px", padding: "0 10px", fontSize: "11.5px" }}
                    >
                      View Details
                    </Button>
                    <button
                      className="btn-icon btn-view-action"
                      onClick={() => setSelectedSiteId(site.id)}
                      title="View Site Dashboard"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#2563eb",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        transition: "transform 0.15s ease, color 0.15s ease",
                        outline: "none"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#1d4ed8"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#2563eb"; }}
                    >
                      <Building2 size={16} />
                    </button>
                    <button
                      className="btn-icon btn-edit-action"
                      onClick={() => handleOpenEditModal(site)}
                      title="Edit Site"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ea580c",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        transition: "transform 0.15s ease, color 0.15s ease",
                        outline: "none"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#c2410c"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#ea580c"; }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="btn-icon btn-delete-action"
                      onClick={() => handleDeleteSite(site)}
                      title="Delete Site"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        transition: "transform 0.15s ease, color 0.15s ease",
                        outline: "none"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#b91c1c"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#dc2626"; }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead>
                <tr style={{ background: "var(--primary-50)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ width: "22%", paddingLeft: "20px" }}>Site Name</th>
                  <th style={{ width: "15%" }}>Client</th>
                  <th style={{ width: "18%" }}>Location</th>
                  <th style={{ width: "11%" }}>Start Date</th>
                  <th style={{ width: "11%" }}>End Date</th>
                  <th style={{ width: "11%" }}>Budget</th>
                  <th style={{ width: "10%", textAlign: "center" }}>Status</th>
                  <th style={{ width: "12%", textAlign: "right", paddingRight: "20px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((site) => {
                  const statusColors = {
                    Active: { bg: "var(--success-50)", border: "var(--success-100)", color: "var(--success-600)", dot: "var(--success-500)" },
                    Planning: { bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-700)", dot: "var(--primary-500)" },
                    Completed: { bg: "#f0fdf4", border: "#dcfce7", color: "var(--success-700)", dot: "var(--success-600)" }
                  };
                  const sc = statusColors[site.status] || statusColors["Planning"];
                  const initials = site.siteName ? site.siteName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "CS";
                  const budgetVal = getSiteBudget(site);
                  const budgetFormatted = budgetVal > 0 ? formatINR(budgetVal) : "—";

                  return (
                    <tr
                      key={site.id}
                      style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.12s ease" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {/* Site Name column */}
                      <td style={{ paddingLeft: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            onClick={() => setSelectedSiteId(site.id)}
                            title="View Site Dashboard"
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "9px",
                              backgroundColor: "#fff7ed",
                              border: "1.5px solid #ffedd5",
                              color: "#c2410c",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "800",
                              fontSize: "11px",
                              flexShrink: 0,
                              cursor: "pointer",
                              transition: "transform 0.15s ease",
                              userSelect: "none"
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                          >
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              onClick={() => setSelectedSiteId(site.id)}
                              title="View Site Dashboard"
                              style={{
                                fontWeight: "700",
                                fontSize: "13px",
                                color: "var(--primary-950)",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "200px",
                                transition: "color 0.12s ease"
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = "#ea580c"}
                              onMouseLeave={e => e.currentTarget.style.color = "var(--primary-950)"}
                            >
                              {site.siteName}
                            </div>
                            {site.siteLocationName && (
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
                                {site.siteLocationName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client column */}
                      <td>
                        <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--primary-800)", whiteSpace: "nowrap" }}>
                          {site.clientName || "—"}
                        </span>
                      </td>

                      {/* Location column */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--primary-700)", fontWeight: 500, maxWidth: "220px" }}>
                          <MapPin size={12} style={{ color: "#ea580c", flexShrink: 0 }} />
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={site.location || ""}>
                            {site.location || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Start Date column */}
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--primary-700)", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {formatDateDMY(site.startDate)}
                        </span>
                      </td>

                      {/* End Date column */}
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--primary-700)", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {formatDateDMY(site.expectedEndDate)}
                        </span>
                      </td>

                      {/* Budget column */}
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {budgetFormatted}
                        </span>
                      </td>

                      {/* Status column */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 9px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor: sc.bg,
                          color: sc.color,
                          border: `1px solid ${sc.border}`,
                          whiteSpace: "nowrap"
                        }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: sc.dot, flexShrink: 0 }} />
                          {site.status || "Planning"}
                        </span>
                      </td>

                      {/* Actions column */}
                      <td style={{ paddingRight: "20px" }}>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                          {/* View */}
                          <button
                            className="btn-icon btn-view-action"
                            onClick={() => setSelectedSiteId(site.id)}
                            title="View Site Dashboard"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#2563eb",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#1d4ed8"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#2563eb"; }}
                          >
                            <Building2 size={15} />
                          </button>

                          {/* Edit */}
                          <button
                            className="btn-icon btn-edit-action"
                            onClick={() => handleOpenEditModal(site)}
                            title="Edit Site"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ea580c",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#c2410c"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#ea580c"; }}
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Delete */}
                          <button
                            className="btn-icon btn-delete-action"
                            onClick={() => handleDeleteSite(site)}
                            title="Delete Site"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#b91c1c"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#dc2626"; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {filteredSites.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--border-color)",
            padding: "10px 20px",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredSites.length} of {sites.length} site{sites.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* MODAL: ADD/EDIT SITE */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => setShowFormModal(false)} 
        title={formMode === "add" ? "Add Construction Site" : "Edit Construction Site"}
      >
        <form onSubmit={handleFormSubmit} style={{ margin: 0, padding: 0 }}>
          <div className="form-group">
            <label htmlFor="site-name">Site Name</label>
            <div className="input-wrapper">
              <Building2 className="input-icon" size={16} />
              <input 
                type="text" 
                id="site-name" 
                placeholder="E.g., Greenwood Apartments" 
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="client-name">Client Name</label>
            <div className="input-wrapper">
              <Building2 className="input-icon" size={16} style={{ opacity: 0.6 }} />
              <input 
                type="text" 
                id="client-name" 
                placeholder="E.g., Greenwood Developers" 
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="site-location">Location / Address</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input 
                type="text" 
                id="site-location" 
                placeholder="E.g., 123 Greenwood St, Chennai" 
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Google Maps Location Picker</label>

            {mapsLoadError && (
              <div style={{ backgroundColor: "var(--danger-50)", border: "1.5px dashed var(--danger-300)", borderRadius: "8px", padding: "12px", color: "var(--danger-700)", fontSize: "12px", marginBottom: "12px", textAlign: "left" }}>
                ⚠️ <strong>Google Maps Load Error</strong>: The Google Maps JavaScript API failed to load. Please verify that:
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  <li>Billing is enabled on your Google Cloud Platform project.</li>
                  <li>The <strong>Maps JavaScript API</strong> is enabled.</li>
                  <li>Your API Key is valid and unrestricted.</li>
                </ul>
                <button type="button" onClick={() => window.location.reload()} style={{ marginTop: "8px", padding: "5px 10px", fontSize: "11px", backgroundColor: "var(--danger-600)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "700" }}>Retry Loading</button>
              </div>
            )}

            <div style={{ position: "relative", width: "100%", height: "300px", marginBottom: "12px" }}>
              <div 
                ref={mapDivRef} 
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  borderRadius: "8px", 
                  border: "1px solid var(--border-color)", 
                  backgroundColor: "#f1f5f9"
                }} 
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "11px", fontWeight: "700", display: "block", marginBottom: "4px" }}>Selected Latitude</label>
                <input 
                  type="text" 
                  readOnly 
                  value={formLatitude || "Not Pinpointed"} 
                  style={{ 
                    backgroundColor: "var(--primary-50)", 
                    color: "var(--primary-900)", 
                    fontWeight: "600",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    width: "100%",
                    outline: "none"
                  }} 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "11px", fontWeight: "700", display: "block", marginBottom: "4px" }}>Selected Longitude</label>
                <input 
                  type="text" 
                  readOnly 
                  value={formLongitude || "Not Pinpointed"} 
                  style={{ 
                    backgroundColor: "var(--primary-50)", 
                    color: "var(--primary-900)", 
                    fontWeight: "600",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    width: "100%",
                    outline: "none"
                  }} 
                />
              </div>
            </div>

            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "4px", marginBottom: "12px" }}>
              💡 <em>Tip: You can use the top-right Map/Satellite toggler. Drag the pin or click on the map to fine-tune the exact location.</em>
            </span>
          </div>



          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label htmlFor="start-date">Start Date</label>
              <div className="input-wrapper">
                <Calendar className="input-icon" size={16} />
                <input 
                  type="date" 
                  id="start-date" 
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expected-end-date">Expected End Date</label>
              <div className="input-wrapper">
                <Calendar className="input-icon" size={16} />
                <input 
                  type="date" 
                  id="expected-end-date" 
                  value={formExpectedEndDate}
                  onChange={(e) => setFormExpectedEndDate(e.target.value)}
                  required 
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="site-budget">Site Budget (₹)</label>
            <div className="input-wrapper">
              <span className="input-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", opacity: 0.6, fontSize: "14px" }}>₹</span>
              <input 
                type="number" 
                id="site-budget" 
                placeholder="E.g., 2500000" 
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="site-status">Status</label>
            <div className="input-wrapper">
              <select 
                id="site-status" 
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  outline: "none",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ margin: "24px -24px -24px -24px" }}>
            <Button variant="outline" onClick={() => setShowFormModal(false)}>Cancel</Button>
            <Button type="submit" icon={Save}>
              Save Site
            </Button>
          </div>
        </form>
      </Modal>

      {/* ACTION CONFIRMATION POPUP MODAL */}
      <ConfirmationModal
        isOpen={confirmModal.show}
        onClose={closeConfirmModal}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || "Confirm"}
        variant={confirmModal.variant || "danger"}
        onConfirm={confirmModal.onConfirm}
      />

      {/* ADMIN ASSISTED ENTRY MODAL */}
      {showAdminEntryModal && (
        <AdminAssistedEntryModal
          isOpen={showAdminEntryModal}
          onClose={() => setShowAdminEntryModal(false)}
          onSuccess={() => {
            loadData();
            showToast("Admin entry saved and synced.", "success");
          }}
        />
      )}

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

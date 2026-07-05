import React, { useState, useEffect, useRef } from "react";
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
import Loading from "../components/common/Loading";
import SiteDetails from "./SiteDetails";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
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
  AlertCircle
} from "lucide-react";

const PendingApprovalItem = ({ site, engineers, onApprove, onReject }) => {
  const [distance, setDistance] = useState(null);
  const [loadingDistance, setLoadingDistance] = useState(false);
  const [errorDistance, setErrorDistance] = useState(null);
  const [mapType, setMapType] = useState("h"); // "m" for roadmap, "k" for satellite, "h" for hybrid
  const [zoomLevel, setZoomLevel] = useState(19); // default 19 for street-level detail

  useEffect(() => {
    const fetchDistance = async () => {
      const targetAddress = site.assignedAddress || site.location;
      if (!targetAddress || !site.proposedLatitude || !site.proposedLongitude) return;
      setLoadingDistance(true);
      setErrorDistance(null);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(targetAddress)}&limit=1&cb=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = Number(data[0].lat);
            const lon = Number(data[0].lon);
            const dist = calculateDistanceMeters(lat, lon, site.proposedLatitude, site.proposedLongitude);
            setDistance(dist);
          } else {
            setErrorDistance("Could not geocode assigned address");
          }
        } else {
          setErrorDistance("API lookup failed");
        }
      } catch (err) {
        console.warn("Error geocoding target address:", err);
        setErrorDistance("Lookup exception");
      } finally {
        setLoadingDistance(false);
      }
    };
    fetchDistance();
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
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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

  // Google Maps States & Refs
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  // Address Search State
  const [searchingAddress, setSearchingAddress] = useState(false);

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

  // Geocode input address and pin/center map
  const handleSearchAddress = async () => {
    if (!formLocation.trim()) return;
    setSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formLocation)}&limit=1&cb=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          const displayName = data[0].display_name;
          
          setFormLatitude(lat.toFixed(6));
          setFormLongitude(lon.toFixed(6));
          setFormLocationName(displayName);

          // Update Google Map coordinates and zoom
          if (isMapsLoaded && mapInstanceRef.current && markerInstanceRef.current && window.google) {
            const newPos = new window.google.maps.LatLng(lat, lon);
            mapInstanceRef.current.setCenter(newPos);
            mapInstanceRef.current.setZoom(17);
            markerInstanceRef.current.setPosition(newPos);
          }
          showToast("Location found and pinned on map!", "success");
        } else {
          showToast("Could not find this address. Please enter a more specific location.", "error");
        }
      } else {
        showToast("Address lookup failed. Please pin manually.", "error");
      }
    } catch (err) {
      console.warn("Geocoding failed:", err);
      showToast("Error searching address. Please try again or pin manually.", "error");
    } finally {
      setSearchingAddress(false);
    }
  };


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
      const fetchedSites = await getSites(adminId);
      setSites(fetchedSites);
      const fetchedEngineers = await getSiteEngineers(adminId);
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

  const filteredSites = sites.filter(site => 
    site.siteName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    site.clientName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    site.location?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

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
    setShowFormModal(true);
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

    if (!formLatitude || !formLongitude) {
      showToast("Please search for or click to pin the exact site location on Google Maps.", "error");
      return;
    }

    let rad = 50;
    if (formMode === "edit") {
      const existingSite = sites.find(s => s.id === formId);
      rad = existingSite ? Number(existingSite.radius || 50) : 50;
    }

    setLoading(true);
    try {
      if (formMode === "add") {
        const adminId = userProfile?.uid || userProfile?.id || null;
        const newSiteId = await createSite(
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
          formLocationName.trim()
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
          formLocationName.trim()
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

  const handleApproveLocation = async (siteId, siteData) => {
    if (confirm(`Approve location setup for "${siteData.siteName}"?`)) {
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
  };

  const handleRejectLocation = async (siteId) => {
    if (confirm("Reject this site location setup? Site engineer will need to capture it again.")) {
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
  };

  const handleDeleteSite = async (site) => {
    if (confirm(`Are you sure you want to delete the site "${site.siteName}"?`)) {
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
        <Button onClick={handleOpenAddModal} icon={Plus} className="btn-add">
          Add Site
        </Button>
      </div>

      {/* Main Table */}
      <Card variant="table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Client Name</th>
              <th>Location</th>
              <th>Start Date</th>
              <th>Expected End Date</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No construction sites found. Click "Add Site" to register one.
                </td>
              </tr>
            ) : (
              filteredSites.map((site) => {
                return (
                  <tr key={site.id}>
                    <td 
                      style={{ fontWeight: 700, color: "var(--primary-600)", cursor: "pointer" }} 
                      onClick={() => setSelectedSiteId(site.id)}
                      title="Click to view site dashboard"
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                    >
                      {site.siteName}
                    </td>
                    <td>{site.clientName || "--"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={14} style={{ color: "var(--text-muted)" }} />
                        <span>{site.location}</span>
                      </div>
                    </td>
                    <td className="font-mono">{site.startDate || "--"}</td>
                    <td className="font-mono">{site.expectedEndDate || "--"}</td>
                    <td>
                      <Badge status={site.status || "Planning"} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button 
                          onClick={() => setSelectedSiteId(site.id)} 
                          className="btn-icon" 
                          title="View Site Dashboard" 
                          style={{ color: "var(--primary-600)" }}
                        >
                          <Building2 size={16} />
                        </button>
                        <button onClick={() => handleOpenEditModal(site)} className="btn-icon btn-edit-action" title="Edit Site">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDeleteSite(site)} className="btn-icon" title="Delete Site" style={{ color: "var(--danger-500)" }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

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
            <div style={{ display: "flex", gap: "8px" }}>
              <div className="input-wrapper" style={{ flex: 1 }}>
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
              <button
                type="button"
                onClick={handleSearchAddress}
                disabled={searchingAddress || !formLocation.trim()}
                style={{
                  padding: "0 16px",
                  backgroundColor: "var(--primary-600)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: searchingAddress || !formLocation.trim() ? "not-allowed" : "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "110px",
                  opacity: searchingAddress || !formLocation.trim() ? 0.6 : 1,
                  transition: "background-color 0.2s"
                }}
              >
                {searchingAddress ? "Searching..." : "Find on Map"}
              </button>
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

      {/* MODAL: VIEW SITE LOCATION MAP */}


      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

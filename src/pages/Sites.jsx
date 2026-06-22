import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSites, 
  createSite, 
  updateSite, 
  deleteSite,
  getSiteEngineers
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  MapPin, 
  Building2,
  Calendar
} from "lucide-react";

const loadLeaflet = () => {
  return new Promise((resolve) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      resolve(window.L);
    };
    document.head.appendChild(script);
  });
};

const fetchReverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {
    console.warn("Reverse geocode failed:", e);
  }
  return `Lat: ${Number(lat).toFixed(6)}, Lng: ${Number(lng).toFixed(6)}`;
};

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
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
  const [formStartDate, setFormStartDate] = useState("");
  const [formExpectedEndDate, setFormExpectedEndDate] = useState("");
  const [formStatus, setFormStatus] = useState("Planning");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formRadius, setFormRadius] = useState("100");

  // Location Setup Modal states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSite, setLocationSite] = useState(null);
  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedAccuracy, setSelectedAccuracy] = useState(null);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCapturingGps, setIsCapturingGps] = useState(false);

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const fetchedSites = await getSites();
      setSites(fetchedSites);
      const fetchedEngineers = await getSiteEngineers();
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
    setFormStartDate("");
    setFormExpectedEndDate("");
    setFormStatus("Planning");
    setFormLatitude("");
    setFormLongitude("");
    setFormRadius("100");
    setShowFormModal(true);
  };

  const handleOpenEditModal = (site) => {
    setFormMode("edit");
    setFormId(site.id);
    setFormName(site.siteName || "");
    setFormClientName(site.clientName || "");
    setFormLocation(site.location || "");
    setFormStartDate(site.startDate || "");
    setFormExpectedEndDate(site.expectedEndDate || "");
    setFormStatus(site.status || "Planning");
    setFormLatitude(site.latitude !== undefined ? String(site.latitude) : "");
    setFormLongitude(site.longitude !== undefined ? String(site.longitude) : "");
    setFormRadius(site.radius !== undefined ? String(site.radius) : "100");
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
    if (!formLocation.trim()) {
      showToast("Site Address is required.", "error");
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

    let rad = 100;

    if (formMode === "edit") {
      if (formRadius.trim()) {
        rad = Number(formRadius);
        if (isNaN(rad) || rad <= 0) {
          showToast("Allowed Radius must be a positive number.", "error");
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (formMode === "add") {
        const newSiteId = await createSite(
          formName.trim(), 
          formClientName.trim(), 
          formLocation.trim(), 
          formStartDate, 
          formExpectedEndDate, 
          formStatus,
          null,
          null,
          100
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
          rad
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

  // Map effects and triggers (read-only for Admin to view captured location)
  useEffect(() => {
    if (!showLocationModal || !locationSite) return;

    let map = null;
    let marker = null;

    loadLeaflet().then((L) => {
      const mapContainer = document.getElementById("leaflet-location-map");
      if (!mapContainer) return;

      const hasCoords = locationSite.latitude !== undefined && locationSite.latitude !== null &&
                        locationSite.longitude !== undefined && locationSite.longitude !== null;

      const initLat = hasCoords ? Number(locationSite.latitude) : 11.1271; // Default to Tamil Nadu coordinates
      const initLng = hasCoords ? Number(locationSite.longitude) : 78.6569;
      
      map = L.map("leaflet-location-map").setView([initLat, initLng], 15);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      if (hasCoords) {
        marker = L.marker([initLat, initLng], { icon: customIcon, draggable: false }).addTo(map);
        markerRef.current = marker;
        setSelectedLat(initLat);
        setSelectedLng(initLng);
        setSelectedAddress(locationSite.location || "");
        setSelectedAccuracy(locationSite.locationAccuracy || 5);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [showLocationModal, locationSite]);

  const handleMapSearch = async (e) => {
    if (e) e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery.trim())}&limit=5`, {
        headers: {
          'Accept-Language': 'en'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
      showToast("Location search failed.", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSelectedAddress(result.display_name);
    setSelectedAccuracy(5);
    setSearchResults([]);
    setMapSearchQuery("");

    const map = mapRef.current;
    let marker = markerRef.current;

    if (map) {
      map.setView([lat, lng], 15);
      const L = window.L;
      const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
        markerRef.current = marker;

        marker.on("dragend", async () => {
          const pos = marker.getLatLng();
          setSelectedLat(pos.lat);
          setSelectedLng(pos.lng);
          const addr = await fetchReverseGeocode(pos.lat, pos.lng);
          setSelectedAddress(addr);
          setSelectedAccuracy(5);
        });
      }
    }
  };

  const handleCaptureCurrentGps = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", "error");
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 10;
        
        setSelectedLat(lat);
        setSelectedLng(lng);
        setSelectedAccuracy(accuracy);
        
        const addr = await fetchReverseGeocode(lat, lng);
        setSelectedAddress(addr);
        
        const map = mapRef.current;
        let marker = markerRef.current;
        
        if (map) {
          map.setView([lat, lng], 16);
          const L = window.L;
          const customIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          if (marker) {
            marker.setLatLng([lat, lng]);
          } else {
            marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);
            markerRef.current = marker;

            marker.on("dragend", async () => {
              const pos = marker.getLatLng();
              setSelectedLat(pos.lat);
              setSelectedLng(pos.lng);
              const addr = await fetchReverseGeocode(pos.lat, pos.lng);
              setSelectedAddress(addr);
              setSelectedAccuracy(5);
            });
          }
        }
        setIsCapturingGps(false);
        showToast("Current location captured successfully.", "success");
      },
      (error) => {
        console.error(error);
        setIsCapturingGps(false);
        showToast("Failed to capture location: " + error.message, "error");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveLocation = async () => {
    if (selectedLat === null || selectedLng === null) {
      showToast("Please pick a location first.", "error");
      return;
    }
    setLoading(true);
    try {
      const createdDate = new Date().toISOString();
      await updateSiteLocation(
        locationSite.id,
        selectedLat,
        selectedLng,
        selectedAddress || locationSite.location || "Verified Location",
        selectedAccuracy || 5,
        createdDate
      );
      showToast("Site location configured successfully.", "success");
      setShowLocationModal(false);
      await loadData();
    } catch (err) {
      console.error("Save site location error:", err);
      showToast(err.message || "Failed to save location.", "error");
    } finally {
      setLoading(false);
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

  return (
    <Layout title="Construction Sites" description="Manage active civil construction projects and track details.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
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
                    <td style={{ fontWeight: 700 }}>{site.siteName}</td>
                    <td>{site.clientName || "--"}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={14} className="text-muted" style={{ color: "var(--text-muted)" }} />
                          <span>{site.location}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "20px" }}>
                          {site.latitude !== undefined && site.latitude !== null && site.longitude !== undefined && site.longitude !== null ? (
                            `GPS: ${Number(site.latitude).toFixed(4)}, ${Number(site.longitude).toFixed(4)} (Radius: ${site.radius || 100}m)`
                          ) : (
                            "GPS coordinates: Not Set"
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginLeft: "20px", marginTop: "4px" }}>
                          <Badge status={site.locationStatus === "Verified" ? "verified" : "not set"}>
                            Location: {site.locationStatus === "Verified" ? "Verified" : "Not Set"}
                          </Badge>
                          <Badge status={site.locationStatus === "Verified" ? "enabled" : "disabled"}>
                            Attendance: {site.locationStatus === "Verified" ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div style={{ marginLeft: "20px", marginTop: "6px" }}>
                          {site.locationStatus === "Verified" ? (
                            <button
                              type="button"
                              className="btn-location-setup"
                              onClick={() => {
                                setLocationSite(site);
                                setSelectedLat(site.latitude !== undefined ? site.latitude : null);
                                setSelectedLng(site.longitude !== undefined ? site.longitude : null);
                                setSelectedAddress(site.location || "");
                                setSelectedAccuracy(site.locationAccuracy || null);
                                setShowLocationModal(true);
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: "700",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color)",
                                backgroundColor: "var(--primary-100)",
                                color: "var(--primary-800)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <MapPin size={12} />
                              <span>View Site Location</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#f97316", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              ⚠ Setup Required by Site Engineer
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono">{site.startDate || "--"}</td>
                    <td className="font-mono">{site.expectedEndDate || "--"}</td>
                    <td>
                      <Badge status={site.status || "Planning"} />
                    </td>
                    <td>
                      <div className="table-actions">
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
            <label htmlFor="site-location">Site Address</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input 
                type="text" 
                id="site-location" 
                placeholder="E.g., Sector 45" 
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                required 
              />
            </div>
          </div>

          {formMode === "edit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
              <div className="form-group">
                <label htmlFor="site-radius">Allowed Radius (m)</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    id="site-radius" 
                    placeholder="E.g., 100" 
                    value={formRadius}
                    onChange={(e) => setFormRadius(e.target.value)}
                    required 
                  />
                </div>
              </div>
              
              {formLatitude && formLongitude ? (
                <div style={{
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--primary-50)",
                  fontSize: "12px",
                  lineHeight: "1.5"
                }}>
                  <div style={{ fontWeight: "700", color: "var(--primary-900)", marginBottom: "4px" }}>Engineer Captured GPS Coordinates</div>
                  <div>Latitude: {formLatitude}</div>
                  <div>Longitude: {formLongitude}</div>
                </div>
              ) : (
                <div style={{
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px dashed #f97316",
                  backgroundColor: "rgba(249, 115, 22, 0.05)",
                  fontSize: "12px",
                  color: "#ea580c",
                  fontWeight: "600"
                }}>
                  ⚠ Site location coordinates are not set yet. Will be established on site engineer's first visit.
                </div>
              )}
            </div>
          )}

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
      <Modal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title={`View Site Location: ${locationSite?.siteName || ""}`}
        maxWidth="680px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Status and Hint */}
          <div style={{
            padding: "12px 14px",
            backgroundColor: "var(--success-50)",
            borderLeft: "4px solid var(--success-500)",
            borderRadius: "4px",
            fontSize: "13px",
            lineHeight: "1.5"
          }}>
            <strong>Site Location Details:</strong> Below is the verified physical check-in center established by the assigned site engineer on-site.
          </div>

          {/* Map Area */}
          <div style={{ position: "relative", width: "100%" }}>
            <div
              id="leaflet-location-map"
              style={{
                height: "320px",
                width: "100%",
                borderRadius: "var(--radius-md)",
                border: "1.5px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
                backgroundColor: "#f5f5f5",
                zIndex: 1
              }}
            ></div>
          </div>

          {/* Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", alignItems: "start" }}>
            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "var(--primary-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <div><strong>Latitude:</strong> {selectedLat !== null ? selectedLat.toFixed(6) : "--"}</div>
              <div><strong>Longitude:</strong> {selectedLng !== null ? selectedLng.toFixed(6) : "--"}</div>
              <div><strong>GPS Accuracy:</strong> {selectedAccuracy !== null ? `${Math.round(selectedAccuracy)} meters` : "--"}</div>
              <div style={{ wordBreak: "break-word" }}><strong>Resolved Address:</strong> {selectedAddress || "--"}</div>
            </div>

            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "var(--primary-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <div><strong>Captured On:</strong> {locationSite?.locationCreatedDate ? new Date(locationSite.locationCreatedDate).toLocaleString() : "--"}</div>
              <div>
                <strong>Captured By:</strong> {
                  locationSite?.locationCapturedBy 
                    ? (engineers.find(e => e.id === locationSite.locationCapturedBy)?.fullName || `Engineer (ID: ${locationSite.locationCapturedBy.substring(0, 6)}...)`) 
                    : "--"
                }
              </div>
              <div style={{ wordBreak: "break-word" }}><strong>Device Details:</strong> {locationSite?.locationDeviceDetails || "--"}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <Button
              type="button"
              onClick={() => setShowLocationModal(false)}
              style={{ padding: "8px 24px" }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

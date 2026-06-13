import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { HardHat, LayoutDashboard, Users, MapPin, LogOut, X } from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const { userProfile, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      try {
        await logout();
      } catch (err) {
        console.error("Sign out error:", err);
      }
    }
  };

  const initials = userProfile?.fullName
    ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : (userProfile?.role === "admin" ? "AD" : "SE");

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <HardHat className="brand-icon" size={24} />
          <span className="brand-text">Construction Site</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {userProfile?.role === "admin" ? (
          <>
            <NavLink 
              to="/admin" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Overview Dashboard</span>
            </NavLink>
            
            <NavLink 
              to="/admin/engineers" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Site Engineers</span>
            </NavLink>

            <NavLink 
              to="/admin/sites" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <MapPin size={18} />
              <span>Construction Sites</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink 
              to="/engineer" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Engineer Dashboard</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-details">
            <p className="user-name" id="display-admin-name">{userProfile?.fullName || (userProfile?.role === "admin" ? "Admin" : "Engineer")}</p>
            <p className="user-email" id="display-admin-email">{userProfile?.email || ""}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-outline btn-logout" style={{ width: "100%", justifyContent: "center" }}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../services/businessLogic";
import { LayoutDashboard, Users, MapPin, ClipboardCheck, LogOut, X, Package, Camera, FileText, CheckSquare, DollarSign, TrendingUp, FolderOpen } from "lucide-react";
import Button from "../common/Button";
import CivilEngineerLogo from "../common/CivilEngineerLogo";


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
    : (userProfile?.role === "super_admin" || userProfile?.role === "superadmin" ? "SA" : (userProfile?.role === "admin" ? "AD" : "SE"));

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <CivilEngineerLogo className="brand-icon" size={24} />
          <span className="brand-text">Construction Site</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {userProfile?.role === "super_admin" || userProfile?.role === "superadmin" ? (
          <>
            <NavLink 
              to="/superadmin" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Executive Overview</span>
            </NavLink>
            
            <NavLink 
              to="/superadmin/sites" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <MapPin size={18} />
              <span>Site Monitoring</span>
            </NavLink>

            <NavLink 
              to="/superadmin/finance" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <DollarSign size={18} />
              <span>Financial Monitoring</span>
            </NavLink>

            <NavLink 
              to="/superadmin/progress" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <TrendingUp size={18} />
              <span>Progress Tracking</span>
            </NavLink>

            <NavLink 
              to="/superadmin/approvals" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <CheckSquare size={18} />
              <span>Approval Center</span>
            </NavLink>

            <NavLink 
              to="/superadmin/reports" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Management Reports</span>
            </NavLink>

            <NavLink 
              to="/superadmin/documents" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FolderOpen size={18} />
              <span>Project Documents</span>
            </NavLink>
          </>
        ) : hasPermission(userProfile?.role, "view", "approvals") ? (
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
              to="/admin/approvals" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <CheckSquare size={18} />
              <span>Approval Dashboard</span>
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

            <NavLink 
              to="/admin/assignments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Site Assignments</span>
            </NavLink>

            <NavLink 
              to="/admin/materials" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Package size={18} />
              <span>Materials Management</span>
            </NavLink>

            <NavLink 
              to="/admin/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Labour Master</span>
            </NavLink>

            <NavLink 
              to="/admin/payments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <DollarSign size={18} />
              <span>Payments & Expenses</span>
            </NavLink>

            <NavLink 
              to="/admin/documents" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FolderOpen size={18} />
              <span>Project Documents</span>
            </NavLink>

            <NavLink 
              to="/admin/reports" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Management Reports</span>
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
              <span>Dashboard Overview</span>
            </NavLink>

            <NavLink 
              to="/engineer/attendance" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Labour Attendance</span>
            </NavLink>

            <NavLink 
              to="/engineer/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Labour Management</span>
            </NavLink>

            <NavLink 
              to="/engineer/material" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Package size={18} />
              <span>Material Inventory</span>
            </NavLink>

            <NavLink 
              to="/engineer/photos" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Camera size={18} />
              <span>Site Photos</span>
            </NavLink>

            <NavLink 
              to="/engineer/progress" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Daily Progress</span>
            </NavLink>

            <NavLink 
              to="/engineer/documents" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FolderOpen size={18} />
              <span>Project Documents</span>
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
        <Button onClick={handleLogout} variant="outline" icon={LogOut} className="btn-logout" style={{ width: "100%" }}>
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

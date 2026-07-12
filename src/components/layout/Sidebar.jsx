import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../services/businessLogic";
import { LayoutDashboard, Users, MapPin, ClipboardCheck, LogOut, X, Package, Camera, FileText, CheckSquare, DollarSign, TrendingUp, FolderOpen, History } from "lucide-react";
import Button from "../common/Button";
import CivilEngineerLogo from "../common/CivilEngineerLogo";

const NavGroupTitle = ({ children }) => (
  <div style={{
    fontSize: "9px",
    fontWeight: "850",
    color: "rgba(148, 163, 184, 0.45)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "16px 0 6px 12px",
    fontFamily: "var(--font-family-title, sans-serif)"
  }}>
    {children}
  </div>
);

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
      {/* Self-contained CSS scopes for modern Enterprise branding */}
      <style>{`
        .sidebar {
          background-color: var(--primary-900, #0f172a);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sidebar-brand {
          font-family: var(--font-family-title, sans-serif);
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.5px;
        }

        .sidebar-nav {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          color: rgba(255,255,255,0.65);
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .nav-item:hover {
          background-color: rgba(255,255,255,0.04);
          color: #ffffff;
        }

        .nav-item.active {
          background-color: var(--accent-600, #e65100) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(230, 81, 0, 0.2);
        }

        .nav-item svg {
          opacity: 0.8;
          transition: transform 0.2s ease;
        }

        .nav-item:hover svg {
          opacity: 1;
          transform: translateX(2px);
        }

        .sidebar-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 16px;
          background-color: var(--primary-950, #080c14);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, var(--accent-500), var(--accent-700));
          color: #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 12px;
          border: 1px solid rgba(255,255,255,0.15);
        }

        .user-name {
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          margin: 0;
        }

        .user-email {
          color: rgba(255,255,255,0.45);
          font-size: 11px;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .btn-logout {
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.7) !important;
          background: transparent !important;
          transition: all 0.2s ease;
        }

        .btn-logout:hover {
          background-color: var(--danger-600, #b3261e) !important;
          border-color: var(--danger-600, #b3261e) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 10px rgba(179, 38, 30, 0.2);
        }
      `}</style>

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
            <NavGroupTitle>Executive Console</NavGroupTitle>
            <NavLink 
              to="/superadmin" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Executive Overview</span>
            </NavLink>
            
            <NavGroupTitle>Operations &amp; Finance</NavGroupTitle>
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
              to="/superadmin/payroll" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Payroll Summary</span>
            </NavLink>

            <NavGroupTitle>Approvals &amp; Progress</NavGroupTitle>
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

            <NavGroupTitle>Information Ledger</NavGroupTitle>
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
            <NavGroupTitle>Core Console</NavGroupTitle>
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

            <NavGroupTitle>Operations</NavGroupTitle>
            <NavLink 
              to="/admin/sites" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <MapPin size={18} />
              <span>Construction Sites</span>
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
              to="/admin/assignments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Site Assignments</span>
            </NavLink>

            <NavGroupTitle>Logistics &amp; Workforce</NavGroupTitle>
            <NavLink 
              to="/admin/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Labour Master</span>
            </NavLink>

            <NavLink 
              to="/admin/materials" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Package size={18} />
              <span>Materials Management</span>
            </NavLink>

            <NavGroupTitle>Finance &amp; Audit</NavGroupTitle>
            <NavLink 
              to="/admin/payments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <DollarSign size={18} />
              <span>Payments &amp; Expenses</span>
            </NavLink>

            <NavLink 
              to="/admin/payroll" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Payroll Summary</span>
            </NavLink>

            <NavGroupTitle>Analytics &amp; Records</NavGroupTitle>
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
            <NavGroupTitle>Field Console</NavGroupTitle>
            <NavLink 
              to="/engineer" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard Overview</span>
            </NavLink>

            <NavGroupTitle>Workforce &amp; Logs</NavGroupTitle>
            <NavLink 
              to="/engineer/attendance" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Labour Attendance</span>
            </NavLink>

            <NavLink 
              to="/engineer/attendance-history" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <History size={18} />
              <span>Attendance History</span>
            </NavLink>

            <NavLink 
              to="/engineer/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Labour Management</span>
            </NavLink>

            <NavGroupTitle>Site Resources</NavGroupTitle>
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

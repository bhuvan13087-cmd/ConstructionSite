import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../services/businessLogic";
import { LayoutDashboard, Users, MapPin, ClipboardCheck, LogOut, X, Package, Camera, FileText, CheckSquare, DollarSign, TrendingUp, FolderOpen, History, ChevronLeft, ChevronRight, Menu, Archive } from "lucide-react";
import Button from "../common/Button";
import CivilEngineerLogo from "../common/CivilEngineerLogo";
import ConfirmationModal from "../common/ConfirmationModal";

const NavGroupTitle = ({ children }) => (
  <div className="sidebar-nav-group-title">
    {children}
  </div>
);

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const { userProfile, logout } = useAuth();
  
  // Custom Confirmation Modal state
  const [confirmModalState, setConfirmModalState] = React.useState({
    isOpen: false,
    title: "",
    message: "",
    details: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "warning",
    onConfirm: null,
    isLoading: false
  });

  const showConfirmModal = (config) => {
    setConfirmModalState({
      isOpen: true,
      title: config.title || "Confirm Action",
      message: config.message || "Are you sure you want to proceed?",
      details: config.details || null,
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Cancel",
      variant: config.variant || "warning",
      onConfirm: config.onConfirm || null,
      isLoading: false
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  const handleLogout = async () => {
    showConfirmModal({
      title: "Sign Out of Workspace?",
      message: "Are you sure you want to sign out of your account?",
      confirmText: "Sign Out",
      cancelText: "Stay Signed In",
      variant: "warning",
      icon: LogOut,
      onConfirm: async () => {
        try {
          await logout();
        } catch (err) {
          console.error("Sign out error:", err);
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const initials = userProfile?.fullName
    ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : (userProfile?.role === "super_admin" || userProfile?.role === "superadmin" ? "SA" : (userProfile?.role === "admin" ? "AD" : "SE"));

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Self-contained CSS scopes for modern Enterprise branding */}
      <style>{`
        .sidebar {
          background-color: #0f172a;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sidebar-brand {
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidebar-nav {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          flex: 1;
        }

        /* Nav Group Title override */
        .sidebar-nav-group-title {
          font-size: 10px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 16px 0 6px 12px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          color: #94a3b8;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }

        .nav-item:hover {
          background-color: rgba(255, 255, 255, 0.04);
          color: #ffffff;
        }

        .nav-item.active {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important;
          border-color: transparent !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px 0 rgba(249, 115, 22, 0.35) !important;
          font-weight: 700 !important;
        }

        .nav-item svg {
          opacity: 0.85;
          transition: transform 0.2s ease;
          color: currentColor;
        }

        .nav-item:hover svg {
          opacity: 1;
          transform: translateX(2px);
        }

        .sidebar-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px;
          background-color: #090d16;
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
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
          border: 1px solid rgba(255,255,255,0.2);
        }

        .user-name {
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          margin: 0;
        }

        .user-email {
          color: #64748b;
          font-size: 11px;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        .btn-logout {
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #94a3b8 !important;
          background: transparent !important;
          transition: all 0.2s ease;
          height: 32px !important;
          font-size: 12px !important;
          padding: 4px 12px !important;
        }

        .btn-logout:hover {
          background-color: #ef4444 !important;
          border-color: #ef4444 !important;
          color: #ffffff !important;
        }
      `}</style>

      <div className="sidebar-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 16px 16px" }}>
        <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
          <CivilEngineerLogo className="brand-icon" size={24} style={{ flexShrink: 0 }} />
          <span className="brand-text" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "14px", fontWeight: "800", letterSpacing: "0.5px" }}>
            {userProfile?.organizationName || userProfile?.orgName || "VISVAS BUILDERS"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {/* Sidebar Collapse Toggle Button */}
          <button 
            className="sidebar-collapse-btn" 
            onClick={onToggleCollapse} 
            type="button" 
            title="Collapse Sidebar" 
            aria-label="Collapse Sidebar"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "6px",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }}
          >
            <ChevronLeft size={16} />
          </button>
          
          {/* Mobile Drawer Close Button */}
          <button className="sidebar-close-btn" onClick={onClose} type="button" aria-label="Close Sidebar">
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {userProfile?.role === "super_admin" || userProfile?.role === "superadmin" ? (
          <>
            <NavGroupTitle>Main</NavGroupTitle>
            <NavLink 
              to="/superadmin" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
            
            <NavGroupTitle>Sites &amp; Projects</NavGroupTitle>
            <NavLink 
              to="/superadmin/sites" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <MapPin size={18} />
              <span>All Sites</span>
            </NavLink>

            <NavLink 
              to="/admin/assignments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Assign Engineers</span>
            </NavLink>

            <NavGroupTitle>Team &amp; Materials</NavGroupTitle>
            <NavLink 
              to="/admin/engineers" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Site Engineers</span>
            </NavLink>

            <NavLink 
              to="/admin/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Daily Workers</span>
            </NavLink>

            <NavLink 
              to="/superadmin/finance" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Package size={18} />
              <span>Material Stock</span>
            </NavLink>

            <NavGroupTitle>Money &amp; Accounts</NavGroupTitle>
            <NavLink 
              to="/superadmin/finance" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <DollarSign size={18} />
              <span>Site Expenses</span>
            </NavLink>

            <NavLink 
              to="/superadmin/payroll" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Worker Payouts</span>
            </NavLink>

            <NavGroupTitle>Approvals &amp; Reports</NavGroupTitle>
            <NavLink 
              to="/superadmin/reports" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <TrendingUp size={18} />
              <span>Site Reports</span>
            </NavLink>

            <NavLink 
              to="/superadmin/approvals" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <CheckSquare size={18} />
              <span>Pending Approvals</span>
            </NavLink>

            <NavLink 
              to="/superadmin/documents" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FolderOpen size={18} />
              <span>Settings</span>
            </NavLink>
          </>
        ) : hasPermission(userProfile?.role, "view", "approvals") ? (
          <>
            <NavGroupTitle>Main</NavGroupTitle>
            <NavLink 
              to="/admin" 
              end 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            <NavGroupTitle>Sites &amp; Projects</NavGroupTitle>
            <NavLink 
              to="/admin/sites" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <MapPin size={18} />
              <span>All Sites</span>
            </NavLink>

            <NavLink 
              to="/admin/assignments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <ClipboardCheck size={18} />
              <span>Assigned Engineers</span>
            </NavLink>

            <NavLink 
              to="/admin/site-completion" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Archive size={18} />
              <span>Completed Sites</span>
            </NavLink>

            <NavGroupTitle>Team &amp; Materials</NavGroupTitle>
            <NavLink 
              to="/admin/engineers" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Site Engineers</span>
            </NavLink>

            <NavLink 
              to="/admin/labour" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Users size={18} />
              <span>Daily Workers</span>
            </NavLink>

            <NavLink 
              to="/admin/materials" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <Package size={18} />
              <span>Material Stock</span>
            </NavLink>

            <NavGroupTitle>Money &amp; Accounts</NavGroupTitle>
            <NavLink 
              to="/admin/payments" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <DollarSign size={18} />
              <span>Site Expenses</span>
            </NavLink>

            <NavLink 
              to="/admin/payroll" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FileText size={18} />
              <span>Worker Payouts</span>
            </NavLink>

            <NavGroupTitle>Approvals &amp; Reports</NavGroupTitle>
            <NavLink 
              to="/admin/approvals" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <CheckSquare size={18} />
              <span>Pending Approvals</span>
            </NavLink>

            <NavLink 
              to="/admin/reports" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <TrendingUp size={18} />
              <span>Site Reports</span>
            </NavLink>

            <NavLink 
              to="/admin/documents" 
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              onClick={onClose}
            >
              <FolderOpen size={18} />
              <span>Settings</span>
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

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />
    </aside>
  );
}

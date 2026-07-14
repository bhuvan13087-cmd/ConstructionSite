import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import AdminDashboard from "../pages/AdminDashboard";
import SiteEngineers from "../pages/SiteEngineers";
import Sites from "../pages/Sites";
import SiteAssignments from "../pages/SiteAssignments";
import AdminMaterials from "../pages/AdminMaterials";
import AdminLabour from "../pages/AdminLabour";
import AdminPayments from "../pages/AdminPayments";
import EngineerDashboard from "../pages/EngineerDashboard";
import ApprovalsDashboard from "../pages/ApprovalsDashboard";
import SuperAdminDashboard from "../pages/SuperAdminDashboard";
import DocumentsDashboard from "../pages/DocumentsDashboard";
import ReportsDashboard from "../pages/ReportsDashboard";
import PayrollSummary from "../pages/PayrollSummary";
import ProtectedRoute from "../components/common/ProtectedRoute";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { useAuth } from "../context/AuthContext";

export default function AppRoutes() {
  const { user, userProfile } = useAuth();

  return (
    <Routes>
      {/* Landing / Login routes */}
      <Route path="/" element={<ErrorBoundary><Login /></ErrorBoundary>} />
      <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />

      {/* Protected Admin Dashboard Area */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
        <Route path="/admin/approvals" element={<ErrorBoundary><ApprovalsDashboard /></ErrorBoundary>} />
        <Route path="/admin/engineers" element={<ErrorBoundary><SiteEngineers /></ErrorBoundary>} />
        <Route path="/admin/sites" element={<ErrorBoundary><Sites /></ErrorBoundary>} />
        <Route path="/admin/assignments" element={<ErrorBoundary><SiteAssignments /></ErrorBoundary>} />
        <Route path="/admin/materials" element={<ErrorBoundary><AdminMaterials /></ErrorBoundary>} />
        <Route path="/admin/labour" element={<ErrorBoundary><AdminLabour /></ErrorBoundary>} />
        <Route path="/admin/payments" element={<ErrorBoundary><AdminPayments /></ErrorBoundary>} />
        <Route path="/admin/payroll" element={<ErrorBoundary><PayrollSummary /></ErrorBoundary>} />
        <Route path="/admin/documents" element={<ErrorBoundary><DocumentsDashboard /></ErrorBoundary>} />
        <Route path="/admin/reports" element={<ErrorBoundary><ReportsDashboard /></ErrorBoundary>} />
      </Route>

      {/* Protected Site Engineer Area */}
      <Route element={<ProtectedRoute allowedRoles={["site_engineer", "engineer"]} />}>
        <Route path="/engineer" element={<ErrorBoundary><EngineerDashboard tab="dashboard" /></ErrorBoundary>} />
        <Route path="/engineer/attendance" element={<ErrorBoundary><EngineerDashboard tab="attendance" /></ErrorBoundary>} />
        <Route path="/engineer/attendance-history" element={<ErrorBoundary><EngineerDashboard tab="attendance-history" /></ErrorBoundary>} />
        <Route path="/engineer/labour" element={<ErrorBoundary><EngineerDashboard tab="labour" /></ErrorBoundary>} />
        <Route path="/engineer/material" element={<ErrorBoundary><EngineerDashboard tab="material" /></ErrorBoundary>} />
        <Route path="/engineer/photos" element={<ErrorBoundary><EngineerDashboard tab="photos" /></ErrorBoundary>} />
        <Route path="/engineer/progress" element={<ErrorBoundary><EngineerDashboard tab="progress" /></ErrorBoundary>} />
        <Route path="/engineer/expenses" element={<ErrorBoundary><EngineerDashboard tab="expenses" /></ErrorBoundary>} />
        <Route path="/engineer/more" element={<ErrorBoundary><EngineerDashboard tab="more" /></ErrorBoundary>} />
        <Route path="/engineer/profile" element={<ErrorBoundary><EngineerDashboard tab="profile" /></ErrorBoundary>} />
        <Route path="/engineer/documents" element={<ErrorBoundary><DocumentsDashboard /></ErrorBoundary>} />
      </Route>

      {/* Protected Super Admin Area */}
      <Route element={<ProtectedRoute allowedRoles={["super_admin", "superadmin"]} />}>
        <Route path="/superadmin" element={<ErrorBoundary><SuperAdminDashboard tab="dashboard" /></ErrorBoundary>} />
        <Route path="/superadmin/sites" element={<ErrorBoundary><SuperAdminDashboard tab="sites" /></ErrorBoundary>} />
        <Route path="/superadmin/finance" element={<ErrorBoundary><SuperAdminDashboard tab="finance" /></ErrorBoundary>} />
        <Route path="/superadmin/progress" element={<ErrorBoundary><SuperAdminDashboard tab="progress" /></ErrorBoundary>} />
        <Route path="/superadmin/approvals" element={<ErrorBoundary><SuperAdminDashboard tab="approvals" /></ErrorBoundary>} />
        <Route path="/superadmin/reports" element={<ErrorBoundary><ReportsDashboard /></ErrorBoundary>} />
        <Route path="/superadmin/payroll" element={<ErrorBoundary><PayrollSummary /></ErrorBoundary>} />
        <Route path="/superadmin/documents" element={<ErrorBoundary><DocumentsDashboard /></ErrorBoundary>} />
      </Route>

      {/* Fallback route redirection */}
      <Route 
        path="*" 
        element={
          user && userProfile
            ? (userProfile.role === "super_admin" || userProfile.role === "superadmin"
                ? <Navigate to="/superadmin" replace />
                : (userProfile.role === "admin" 
                    ? <Navigate to="/admin" replace /> 
                    : <Navigate to="/engineer" replace />))
            : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
}

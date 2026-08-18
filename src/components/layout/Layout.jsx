import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout({ children, title, description, hideNavbar = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 992) {
      setSidebarOpen(prev => !prev);
    } else {
      handleToggleCollapse();
    }
  };

  return (
    <div className={`dashboard-layout ${sidebarOpen ? "sidebar-open" : ""} ${isCollapsed ? "sidebar-collapsed" : ""}`} style={{ minHeight: "100vh" }}>
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <main className="main-content">
        {!hideNavbar && (
          <Navbar 
            title={title} 
            description={description} 
            onToggleSidebar={handleToggleSidebar} 
          />
        )}
        <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

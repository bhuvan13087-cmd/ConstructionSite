import React, { useState, useEffect } from "react";
import { Clock, Menu, Bell, BellOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../../services/firebaseService";

export default function Navbar({ title = "Dashboard", description = "Control Panel", onToggleSidebar }) {
  const [time, setTime] = useState("");
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.uid) return;
    try {
      const data = await getNotifications(user.uid);
      setNotifications(data);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 8000); // Poll notifications every 8s
    return () => clearInterval(timer);
  }, [user]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid) return;
    try {
      await markAllNotificationsAsRead(user.uid);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="top-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar} type="button">
          <Menu size={20} />
        </button>
        <div className="page-title-area">
          <h2 className="page-title" id="page-title">{title}</h2>
          <p className="page-description" id="page-description">{description}</p>
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Bell Icon & Dropdown container */}
        <div style={{ position: "relative" }}>
          <button 
            type="button" 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ 
              background: "none", 
              border: "none", 
              cursor: "pointer", 
              position: "relative",
              padding: "6px",
              borderRadius: "50%",
              backgroundColor: showDropdown ? "var(--primary-100)" : "transparent",
              color: showDropdown ? "var(--primary-800)" : "var(--primary-900)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            id="notification-bell"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                backgroundColor: "var(--danger-500)",
                color: "#ffffff",
                fontSize: "10px",
                fontWeight: "800",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 2px #ffffff"
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Card */}
          {showDropdown && (
            <div style={{
              position: "absolute",
              top: "38px",
              right: "0",
              width: "320px",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              border: "1px solid var(--border-color)",
              zIndex: 1000,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "400px"
            }} id="notification-dropdown">
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc"
              }}>
                <span style={{ fontWeight: "800", fontSize: "13px", color: "var(--primary-950)" }}>Notifications</span>
                {unreadCount > 0 && (
                  <button 
                    type="button" 
                    onClick={handleMarkAllRead}
                    style={{ background: "none", border: "none", color: "var(--accent-700)", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
                    <BellOff size={24} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
                    <p>No notifications yet.</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const timeStr = n.createdAt?.seconds 
                      ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    const dateStr = n.createdAt?.seconds
                      ? new Date(n.createdAt.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

                    const isHigh = n.priority === "high";

                    return (
                      <div 
                        key={n.id} 
                        onClick={() => !n.read && handleMarkAsRead(n.id)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border-color)",
                          backgroundColor: n.read ? "transparent" : (isHigh ? "rgba(239, 68, 68, 0.03)" : "rgba(30, 41, 59, 0.02)"),
                          cursor: n.read ? "default" : "pointer",
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                          transition: "background 0.2s"
                        }}
                        className="notification-item"
                      >
                        <div style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: n.read ? "transparent" : (isHigh ? "var(--danger-500)" : "var(--primary-600)"),
                          marginTop: "6px",
                          flexShrink: 0
                        }} />
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "2px" }}>
                          <span style={{
                            fontWeight: "800",
                            fontSize: "12px",
                            color: isHigh ? "var(--danger-700)" : "var(--primary-900)"
                          }}>{n.title}</span>
                          <p style={{ margin: 0, fontSize: "11.5px", color: "#334155", lineHeight: "1.4" }}>{n.description}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                            <span style={{ fontWeight: "700", textTransform: "uppercase" }}>{n.moduleType}</span>
                            <span>{dateStr} {timeStr}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="system-time" id="system-time">
          <Clock size={16} />
          <span id="time-display">{time || "--:--:--"}</span>
        </div>
      </div>
    </header>
  );
}

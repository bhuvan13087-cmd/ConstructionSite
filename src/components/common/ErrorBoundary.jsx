import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f9fa",
          padding: "24px",
          fontFamily: "Inter, system-ui, sans-serif"
        }}>
          <div style={{
            maxWidth: "600px",
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            padding: "40px",
            border: "1px solid #e9ecef",
            textAlign: "center"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px auto",
              fontSize: "32px",
              fontWeight: "bold"
            }}>
              ⚠
            </div>
            
            <h1 style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "#1e293b",
              margin: "0 0 12px 0"
            }}>
              Something went wrong
            </h1>
            
            <p style={{
              fontSize: "14px",
              color: "#64748b",
              lineHeight: "1.6",
              margin: "0 0 32px 0"
            }}>
              An unexpected error occurred in this section of the Construction ERP system. 
              The application remains active, and you can reload or navigate back to the home page.
            </p>

            <div style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              marginBottom: "32px"
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  backgroundColor: "#6750a4",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 6px -1px rgba(103, 80, 164, 0.2)"
                }}
              >
                Reload Page
              </button>
              
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Go to Home
              </button>
            </div>

            {this.state.error && (
              <details style={{
                textAlign: "left",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                fontSize: "12px"
              }}>
                <summary style={{
                  cursor: "pointer",
                  color: "#475569",
                  fontWeight: "600",
                  outline: "none"
                }}>
                  Technical Error Details
                </summary>
                <div style={{
                  marginTop: "12px",
                  overflowX: "auto",
                  color: "#ef4444",
                  fontFamily: "monospace",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap"
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

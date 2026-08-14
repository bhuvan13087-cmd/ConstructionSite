import React from "react";

export default function Loading({ show = false, text = "Loading..." }) {
  if (!show) return null;

  return (
    <div id="global-loader" className="global-loader">
      <div className="loader-spinner"></div>
      <p id="loader-text">{text}</p>
    </div>
  );
}

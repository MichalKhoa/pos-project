import React from 'react';

export default function CashDrawerIcon({ size = 20, color = "currentColor", style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {/* Main Drawer Frame */}
      <rect x="2" y="4" width="20" height="15" rx="2.5" />
      {/* Drawer Lock Keyhole */}
      <circle cx="12" cy="11.5" r="1.5" fill={color} />
      <line x1="12" y1="7" x2="12" y2="8.5" />
      {/* Bill & Coin Compartment Tray */}
      <line x1="2" y1="14.5" x2="22" y2="14.5" />
      <line x1="7" y1="14.5" x2="7" y2="19" />
      <line x1="12" y1="14.5" x2="12" y2="19" />
      <line x1="17" y1="14.5" x2="17" y2="19" />
      {/* Drawer Base Rail */}
      <line x1="5" y1="21" x2="19" y2="21" />
    </svg>
  );
}

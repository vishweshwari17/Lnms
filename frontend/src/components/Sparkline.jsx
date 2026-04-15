import React from "react";

const Sparkline = ({ data = [], color = "#3b82f6", height = 30, width = 120 }) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible opacity-50 group-hover:opacity-100 transition-opacity">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Glow effect */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        className="blur-sm opacity-20"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default Sparkline;

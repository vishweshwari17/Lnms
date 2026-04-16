import React from 'react';

export default function NetworkHealth({ healthScore }) {
  const segments = 20;
  const activeSegments = Math.round((healthScore / 100) * segments);
  const color = healthScore > 90 ? '#10b981' : healthScore > 70 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* SVG Gauge Background */}
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {[...Array(segments)].map((_, i) => {
            const angle = (i / segments) * 360;
            const isActive = i < activeSegments;
            return (
              <rect
                key={i}
                x="48"
                y="5"
                width="4"
                height="12"
                rx="2"
                transform={`rotate(${angle} 50 50)`}
                fill={isActive ? color : '#e2e8f0'}
                className="transition-all duration-500"
                style={{ 
                  opacity: isActive ? 1 : 0.3,
                  filter: isActive ? `drop-shadow(0 0 5px ${color}80)` : 'none'
                }}
              />
            );
          })}
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black tracking-tighter text-slate-900">{healthScore}%</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Efficiency</span>
        </div>

        {/* Pulsing Core */}
        <div 
          className="absolute w-24 h-24 rounded-full blur-2xl opacity-20 animate-pulse-soft"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="mt-6 flex gap-8">
        <div className="text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Status</p>
          <p className="body-text font-black text-emerald-600">OPTIMAL</p>
        </div>
        <div className="w-px h-8 bg-slate-100" />
        <div className="text-center">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Latency</p>
          <p className="body-text font-black text-slate-700">12ms</p>
        </div>
      </div>
    </div>
  );
}
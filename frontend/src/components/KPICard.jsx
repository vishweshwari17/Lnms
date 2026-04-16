import React from 'react';
import Sparkline from './Sparkline';

const KPICard = ({ label, value, icon, color = 'blue', trend, loading }) => {
  const gradientMap = {
    blue: "var(--grad-blue)",
    rose: "var(--grad-red)",
    amber: "var(--grad-orange)",
    green: "var(--grad-green)",
    red: "var(--grad-red)",
    emerald: "var(--grad-green)"
  };

  return (
    <div 
      className="p-6 rounded-[20px] shadow-lg flex flex-col gap-4 group transition-all text-white creative-hover" 
      style={{ background: gradientMap[color] || gradientMap.blue }}
    >
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md transition-all group-hover:scale-110 group-hover:rotate-6">
          {React.cloneElement(icon, { size: 24, className: "text-white" })}
        </div>
        {trend && <Sparkline data={trend} color="rgba(255,255,255,0.6)" />}
      </div>
      
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <div className="h-9 w-16 bg-white/20 animate-pulse rounded-lg" />
          ) : (
            <p className="text-3xl font-black tracking-tighter tabular-nums">{value}</p>
          )}
          {!loading && trend && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full border border-white/10">
              <span className="opacity-70">TREND</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPICard;

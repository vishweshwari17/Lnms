import { useEffect, useState } from "react";
import { Search, Bell, User, Clock, ChevronRight } from "lucide-react";

function formatNow(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function PremiumHeader() {
  const [now, setNow] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatNow(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="app-header justify-between border-b border-white/10 shadow-lg" style={{ background: 'var(--blue-grad-header)', color: 'white' }}>
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 text-white/40">
           <span className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-blue-400 cursor-pointer transition-colors">Infra Matrix</span>
           <ChevronRight size={12} className="opacity-40" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Core Ops</span>
        </div>

        <div className="relative group lg:w-[450px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search Global Infrastructure..."
            className="w-full bg-white/5 border border-white/10 focus:border-blue-500/30 focus:bg-white/10 rounded-2xl pl-12 pr-4 py-2 text-xs font-semibold text-white placeholder:text-white/20 outline-none transition-all duration-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-8">
        {/* Real-time Status */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Network Secure</span>
        </div>

        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 glass-card">
           <Clock size={16} className="text-blue-400" />
           <span className="text-sm font-black tabular-nums tracking-tighter">{now}</span>
        </div>

        <div className="flex items-center gap-6 border-l border-white/10 pl-8">
           <button className="relative p-2.5 text-white/30 hover:text-blue-400 hover:bg-white/5 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#1e3a8a]" />
           </button>
           
           <div className="flex items-center gap-4 group cursor-pointer">
              <div className="flex flex-col items-end">
                 <span className="text-xs font-black text-white leading-none">Senior Architect</span>
                 <span className="text-[9px] text-blue-400/60 font-black uppercase tracking-widest mt-1.5">NOC Level 3</span>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white ring-2 ring-white/10 shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-105 active:scale-95">
                 <User size={20} />
              </div>
           </div>
        </div>
      </div>
    </header>
  );
}

export default PremiumHeader;

import { useEffect, useState, useRef } from "react";
import { Search, Bell, User, Clock, ChevronRight, X, Info, AlertTriangle, Menu } from "lucide-react";

function formatNow(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function PremiumHeader({ onMenuClick }) {
  const [now, setNow] = useState(() => formatNow(new Date()));
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'critical', msg: 'Core Switch Router A1 - Connection timeout', time: '2m ago' },
    { id: 2, type: 'major', msg: 'Disk usage exceeding 85% on Server B2', time: '15m ago' },
    { id: 3, type: 'minor', msg: 'New device discovered on Network Segment C', time: '1h ago' }
  ]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatNow(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.length;

  return (
    <header className="app-header justify-between shadow-lg">
      <div className="flex items-center gap-4 lg:gap-8">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-3 text-white/40">
           <span className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-blue-400 cursor-pointer transition-colors">Infra Matrix</span>
           <ChevronRight size={12} className="opacity-40" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Core Ops</span>
        </div>

        <div className="relative group lg:w-[450px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search Global Infrastructure..."
            className="w-full bg-white/10 border border-white/20 focus:border-white/40 focus:bg-white/20 rounded-2xl pl-12 pr-4 py-2 text-xs font-semibold text-white placeholder:text-white/40 outline-none transition-all duration-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Real-time Status */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Network Secure</span>
        </div>

        <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
           <Clock size={16} className="text-white" />
           <span className="text-sm font-black tabular-nums tracking-tighter text-white">{now}</span>
        </div>

        <div className="flex items-center gap-6 border-l border-white/10 pl-6">
           <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 rounded-xl transition-all ${showNotifications ? 'bg-white/10 text-blue-400' : 'text-white/40 hover:text-blue-400 hover:bg-white/5'}`}
              >
                 <Bell size={20} />
                 {unreadCount > 0 && (
                   <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-[#2563EB]">
                      {unreadCount}
                   </span>
                 )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-slate-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                   <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Real-time alerts</h4>
                      <button onClick={() => setNotifications([])} className="text-[9px] font-bold text-white/60 hover:text-white">Clear all</button>
                   </div>
                   <div className="max-h-[350px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-white/20 font-bold text-xs">No new alerts</div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                             <div className="flex gap-3">
                                <div className={`mt-1 p-1.5 rounded-lg ${
                                  notif.type === 'critical' ? 'bg-rose-500/10 text-rose-400' : 
                                  notif.type === 'major' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                   <AlertTriangle size={14} />
                                </div>
                                <div className="flex-1">
                                   <p className="text-xs font-bold text-white leading-snug group-hover:text-blue-400 transition-colors">{notif.msg}</p>
                                   <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-tighter">{notif.time}</p>
                                </div>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                   <div className="p-3 bg-white/5 text-center">
                      <button className="text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-blue-400 transition-colors">View performance logs</button>
                   </div>
                </div>
              )}
           </div>
           
           <div className="flex items-center gap-4 group cursor-pointer">
              <div className="flex flex-col items-end">
                 <span className="text-xs font-black text-white leading-none">Senior Architect</span>
                 <span className="text-[9px] text-white/50 font-black uppercase tracking-widest mt-1.5">NOC Level 3</span>
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


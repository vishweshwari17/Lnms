import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  ChevronDown, ChevronRight, Menu, Radio, Terminal,
  ShieldAlert, Layers, BarChart3, Clock, LayoutDashboard,
  Activity, Ticket, Server, Settings, ClipboardList, AlertCircle, Zap
} from "lucide-react";

const CollapsibleSection = ({ label, Icon, children, collapsed, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 border-b border-blue-800/20 gap-4">
         {children}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 label-badge text-blue-400 uppercase tracking-widest hover:text-white transition-colors border-none bg-transparent"
      >
        <div className="flex items-center gap-3">
          <Icon size={13} />
          <span className="text-[10px] font-black">{label}</span>
        </div>
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {isOpen && (
        <div className="mt-2 ml-2 space-y-1 transition-all">
          {children}
        </div>
      )}
    </div>
  );
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, label, Icon, badge }) => (
    <Link to={to} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl body-text transition-all duration-300 sidebar-item group
      ${isActive(to) 
        ? "active-item shadow-lg" 
        : "text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"}`}>
      <Icon size={18} className={`shrink-0 ${isActive(to) ? "text-white" : "text-blue-400 group-hover:text-white"}`} />
      {!collapsed && <span className="flex-1 truncate font-black tracking-tight">{label}</span>}
      {badge && (
        <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-lg min-w-5 text-center shadow-inner ${
            isActive(to) ? "bg-white/20 text-white" : "bg-red-500 text-white"
        }`}>
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <div className={`text-white h-full shrink-0 flex flex-col transition-all duration-500 ${collapsed ? "w-20" : "w-72"} border-r border-white/10 shadow-2xl overflow-hidden z-[60] app-sidebar`} style={{ background: "var(--blue-grad-sidebar)" }}>

      {/* Header */}
      <div className={`flex items-center border-b border-white/10 px-6 py-6 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <h1 className="text-section-title flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500 shadow-lg shadow-blue-500/30">
                    <Radio size={18} className="text-white" />
                </div>
                <span className="font-black tracking-tighter">LNMS <span className="text-blue-400">PRO</span></span>
            </h1>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mt-1 text-blue-400/80">Premium Enterprise</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white transition-all p-2 rounded-xl bg-slate-800/40 border border-white/10 hover:border-blue-500 shadow-sm">
          <Menu size={18} />
        </button>
      </div>

      <nav className="px-3 py-8 space-y-1 flex-1 overflow-y-auto custom-scrollbar-sidebar">
        
        <CollapsibleSection label="Command" Icon={LayoutDashboard} collapsed={collapsed} defaultOpen={true}>
          <NavLink to="/"            label="Operational Dashboard"  Icon={LayoutDashboard} />
          <NavLink to="/live-stream" label="Live Stream"   Icon={Radio} />
        </CollapsibleSection>

        <CollapsibleSection label="Monitoring" Icon={Activity} collapsed={collapsed} defaultOpen={true}>
          <NavLink to="/alarms" label="Alarm Stream" Icon={Activity} badge="LIVE" />
          <NavLink to="/correlated-alarms" label="Correlated Root" Icon={Zap} />
          <NavLink to="/tickets" label="Service Tickets" Icon={Ticket} />
        </CollapsibleSection>

        <CollapsibleSection label="Inventory" Icon={Server} collapsed={collapsed} defaultOpen={true}>
          <NavLink to="/devices" label="Device Matrix" Icon={Layers} />
          <NavLink to="/incidents" label="Incident Tracking" Icon={AlertCircle} />
        </CollapsibleSection>

        <CollapsibleSection label="System" Icon={Settings} collapsed={collapsed} defaultOpen={true}>
          <NavLink to="/admin" label="Administration" Icon={Settings} />
          <NavLink to="/audit" label="Audit Logs" Icon={ClipboardList} />
        </CollapsibleSection>

      </nav>

      <div className="p-6 border-t border-white/10">
          {!collapsed && (
              <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 glass-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/20 text-white bg-blue-600">AD</div>
                  <div className="flex-1 min-w-0">
                      <div className="text-xs font-black truncate text-white">Administrator</div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-blue-400">Operative L3</div>
                  </div>
              </div>
          )}
      </div>

      <style>{`
        .custom-scrollbar-sidebar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-sidebar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
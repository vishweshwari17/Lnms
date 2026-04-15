import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  getDevice, 
  getAlarms,
  getDiagnosticsPing,
  getDiagnosticsTrace,
  getNeighbors,
  getPerformanceMetrics
} from "../api/api";
import { 
  FaArrowLeft, 
  FaServer, 
  FaChartLine, 
  FaExclamationTriangle, 
  FaExternalLinkAlt,
  FaInfoCircle,
  FaMicrochip,
  FaMemory,
  FaClock,
  FaTerminal,
  FaNetworkWired,
  FaShieldAlt,
  FaBolt
} from "react-icons/fa";
import toast from "react-hot-toast";

// Simple Sparkline Component
function Sparkline({ data, color }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8 opacity-50 mt-4 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="animate-draw"
      />
    </svg>
  );
}

export default function DeviceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [diagConsole, setDiagConsole] = useState([]);
  const [isDiagRunning, setIsDiagRunning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [deviceRes, alarmsRes, neighborsRes, metricsRes] = await Promise.all([
        getDevice(id),
        getAlarms({ device_id: id, limit: 10 }),
        getNeighbors(id),
        getPerformanceMetrics(id)
      ]);
      setDevice(deviceRes.data);
      setAlarms(alarmsRes.data.alarms || []);
      setNeighbors(neighborsRes.data || []);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error("Failed to fetch device details", err);
      toast.error("Failed to load live roadmap data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runDiagnostic = async (tool) => {
    setIsDiagRunning(true);
    setDiagConsole([`[SYSTEM] Connecting to LNMS Tactical Plane for ${tool}...`]);
    
    try {
       const res = tool === "QUICK PING" ? await getDiagnosticsPing(id) : await getDiagnosticsTrace(id);
       const output = res.data.output || [];
       
       output.forEach((line, i) => {
          setTimeout(() => {
             setDiagConsole(prev => [...prev, line]);
             if (i === output.length - 1) {
                setDiagConsole(prev => [...prev, `[DONE] ${tool} operation finalized.`]);
                setIsDiagRunning(false);
             }
          }, (i + 1) * 300);
       });
    } catch (err) {
       setDiagConsole(prev => [...prev, `[CRITICAL] Connection to device timed out.`]);
       setIsDiagRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4 shadow-xl shadow-indigo-100"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Syncing Command Satellite...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <FaExclamationTriangle className="text-rose-500 mb-6 animate-pulse" size={48} />
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4 text-center">Identity Not Found</h2>
        <button 
          onClick={() => navigate("/inventory")}
          className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans page-transition">
      <div className="max-w-6xl mx-auto">
        
        <button 
          onClick={() => navigate("/devices")}
          className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-all font-black text-[10px] uppercase tracking-widest mb-10 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm creative-hover"
        >
          <FaArrowLeft /> Command Control
        </button>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 p-8 mb-8 border border-slate-100 relative overflow-hidden flex flex-col lg:flex-row justify-between items-center gap-8 creative-hover">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 opacity-10 rounded-full translate-x-32 -translate-y-32 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-8 relative z-10 w-full lg:w-auto">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-xl ${device.status === 'ACTIVE' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-rose-500 shadow-rose-500/20'} group`}>
              <FaServer size={32} className="group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{device.hostname}</h1>
                <div className="flex gap-2">
                   <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${device.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                     {device.status}
                   </span>
                   <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100">
                     {device.vendor || "Nivetti"}
                   </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] items-center">
                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-slate-500"><FaBolt className="text-amber-400" /> {device.ip_address}</span>
                <span className="flex items-center gap-2"><FaNetworkWired className="text-indigo-400" /> {device.device_type}</span>
                <span className="flex items-center gap-2">&bull; {device.location || "Global Region"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10 w-full lg:w-auto">
            <QuickActionButton icon={<FaTerminal />} label="Ping Test" onClick={() => { setActiveTab("diagnostics"); runDiagnostic("QUICK PING"); }} />
            <QuickActionButton icon={<FaChartLine />} label="Telemetry" onClick={() => setActiveTab("metrics")} />
            <QuickActionButton icon={<FaExclamationTriangle />} label="Incidents" onClick={() => setActiveTab("alarms")} />
            <QuickActionButton icon={<FaExternalLinkAlt />} label="SSH Link" onClick={() => window.open(`http://${device.ip_address}`, '_blank')} color="indigo" />
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex gap-3 p-2 bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 mb-10 w-fit mx-auto border border-slate-50">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="System" icon={<FaInfoCircle />} />
          <TabButton active={activeTab === "alarms"} onClick={() => setActiveTab("alarms")} label="Events" icon={<FaExclamationTriangle />} />
          <TabButton active={activeTab === "diagnostics"} onClick={() => setActiveTab("diagnostics")} label="Tactical tools" icon={<FaTerminal />} />
          <TabButton active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} label="Performance" icon={<FaChartLine />} />
        </div>

        {/* TAB CONTENT */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <ContentCard title="Operational Metadata" icon={<FaInfoCircle />} className="lg:col-span-1">
                <div className="space-y-2">
                  <DataRow label="System Host" value={device.hostname} />
                  <DataRow label="Network IP" value={device.ip_address} />
                  <DataRow label="Hardware ID" value={`TRX-${device.id.toString().padStart(4, '0')}`} />
                  <DataRow label="Discovery Date" value={new Date(device.created_at).toLocaleDateString()} />
                  <DataRow label="Node Logic" value="Tactical" />
                  <DataRow label="Cloud Link" value="SYNCED" />
                </div>
              </ContentCard>

              <div className="lg:col-span-2 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <MetricCard 
                      icon={<FaMicrochip />} 
                      label="Processing Load" 
                      value={`${metrics?.cpu?.slice(-1)[0]?.value || 0}%`} 
                      color="indigo" 
                      sparkline={<Sparkline data={metrics?.cpu} color="#6366f1" />}
                    />
                    <MetricCard 
                      icon={<FaMemory />} 
                      label="Buffer Context" 
                      value={`${metrics?.memory?.slice(-1)[0]?.value || 0}%`} 
                      color="emerald" 
                      sparkline={<Sparkline data={metrics?.memory} color="#10b981" />}
                    />
                 </div>
                 
                 <ContentCard title="Adjacency Hub (LLDP)" icon={<FaNetworkWired />}>
                    <div className="space-y-3">
                       {neighbors.length === 0 ? (
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-6">No active neighbors discovered</p>
                       ) : neighbors.map((nbr, idx) => (
                          <NeighborRow key={idx} name={nbr.neighbor_name} interface={nbr.local_interface} status={nbr.status} />
                       ))}
                    </div>
                 </ContentCard>
              </div>
            </div>
          )}

          {activeTab === "alarms" && (
            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 p-12 border border-slate-50">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Signal History</h3>
                  <span className="bg-rose-50 text-rose-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm shadow-rose-100">{alarms.length} Anomalies</span>
               </div>
               
               <div className="space-y-5">
                 {alarms.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                       <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center"><FaExclamationTriangle size={32}/></div>
                       <p className="font-black text-slate-300 uppercase tracking-widest text-xs">Clear Sector Grid</p>
                    </div>
                 ) : alarms.map((alarm, idx) => (
                    <div key={idx} className="flex items-center justify-between p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group cursor-pointer shadow-sm hover:shadow-xl hover:shadow-indigo-50/30">
                       <div className="flex items-center gap-8">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${alarm.severity === 'Critical' ? 'bg-rose-500 shadow-rose-100' : alarm.severity === 'Major' ? 'bg-amber-500 shadow-amber-100' : 'bg-indigo-500 shadow-indigo-100'} shadow-lg group-hover:scale-110 transition-transform`}>
                             <FaExclamationTriangle size={24} />
                          </div>
                          <div>
                             <div className="text-lg font-black text-slate-800 uppercase group-hover:text-indigo-600 transition-colors tracking-tighter">{alarm.alarm_name}</div>
                             <div className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest flex items-center gap-3">
                                <span>{new Date(alarm.created_at).toLocaleString()}</span>
                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span>Source: LNMS-TACTOR</span>
                             </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${alarm.status === 'OPEN' ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>{alarm.status}</span>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === "diagnostics" && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
                <ContentCard title="Tactical Console" icon={<FaTerminal />} className="lg:col-span-2">
                   <div className="bg-slate-900 rounded-[2rem] p-8 min-h-[400px] font-mono text-emerald-400 text-sm shadow-2xl relative overflow-hidden">
                      <div className="absolute top-4 right-4 flex gap-2">
                         <div className="w-3 h-3 rounded-full bg-rose-500" />
                         <div className="w-3 h-3 rounded-full bg-amber-500" />
                         <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      </div>
                      <div className="space-y-2 overflow-y-auto max-h-[350px] custom-scrollbar">
                         {diagConsole.map((line, i) => (
                            <div key={i} className="animate-in fade-in slide-in-from-left-4 duration-300">
                               <span className="text-slate-600 mr-3">[{new Date().toLocaleTimeString()}]</span>
                               <span className={line.includes('[DONE]') || line.includes('64 bytes') ? 'text-indigo-400 font-bold' : line.includes('[SYSTEM]') || line.includes('[CRITICAL]') ? 'text-amber-400' : ''}>
                                  {line}
                               </span>
                            </div>
                         ))}
                         {isDiagRunning && <div className="animate-pulse">_</div>}
                         {!isDiagRunning && diagConsole.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-700">
                               <FaTerminal size={48} className="mb-4 opacity-50" />
                               <p className="font-black uppercase tracking-widest text-[10px]">Awaiting tactical command...</p>
                            </div>
                         )}
                      </div>
                   </div>
                </ContentCard>
                <div className="space-y-8">
                   <ContentCard title="Tactical Tools" icon={<FaBolt />}>
                      <div className="space-y-4">
                         <DiagButton label="ICMP PING" desc="Verify IP Reachability" onClick={() => runDiagnostic("QUICK PING")} active={isDiagRunning} />
                         <DiagButton label="UDP TRACEROUTE" desc="Identify Path Anomalies" onClick={() => runDiagnostic("TRACEROUTE")} active={isDiagRunning} />
                         <DiagButton label="MIB SCAN" desc="Fetch SNMP Logic" onClick={() => toast.error("SNMP Auth Required")} active={isDiagRunning} />
                      </div>
                   </ContentCard>
                </div>
             </div>
          )}

          {activeTab === "metrics" && (
            <div className="grid grid-cols-1 gap-8 mb-20">
               <ContentCard title="CPU Utilization (24h Trend)" icon={<FaChartLine />}>
                  <div className="h-64 flex items-end gap-1 px-4">
                     {metrics?.cpu?.map((d, i) => (
                        <div key={i} className="flex-1 bg-indigo-500/20 hover:bg-indigo-500 transition-all group relative rounded-t-lg" style={{ height: `${d.value}%` }}>
                           <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                              {d.value}% @ {new Date(d.timestamp).getHours()}:00
                           </div>
                        </div>
                     ))}
                  </div>
                  <div className="flex justify-between mt-6 text-[8px] font-black text-slate-300 uppercase tracking-widest px-4">
                     <span>24h Ago</span>
                     <span>Current</span>
                  </div>
               </ContentCard>
               
               <ContentCard title="Memory Context (24h Trend)" icon={<FaTerminal />}>
                  <div className="h-64 flex items-end gap-1 px-4">
                     {metrics?.memory?.map((d, i) => (
                        <div key={i} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 transition-all group relative rounded-t-lg" style={{ height: `${d.value}%` }}>
                           <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                              {d.value}% @ {new Date(d.timestamp).getHours()}:00
                           </div>
                        </div>
                     ))}
                  </div>
                  <div className="flex justify-between mt-6 text-[8px] font-black text-slate-300 uppercase tracking-widest px-4">
                     <span>24h Ago</span>
                     <span>Current</span>
                  </div>
               </ContentCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick, color="slate" }) {
  const colors = {
     slate: "text-slate-400 hover:text-indigo-600 hover:border-indigo-600",
     indigo: "text-indigo-600 border-indigo-100 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
  };
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-6 bg-white rounded-3xl border border-slate-100 group transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95 ${colors[color]}`}
    >
      <div className="group-hover:scale-110 transition-transform">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-[0.3em]">{label}</span>
    </button>
  );
}

function TabButton({ active, label, icon, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] transition-all duration-300 font-black text-[10px] uppercase tracking-widest border border-transparent ${active ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-100 scale-105' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ContentCard({ title, icon, children, className="" }) {
  return (
    <div className={`bg-white rounded-[2rem] shadow-lg shadow-blue-900/5 p-8 border border-slate-50 creative-hover ${className}`}>
      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
        <span className="text-indigo-400">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all rounded-2xl px-4 group">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      <span className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{value}</span>
    </div>
  );
}

function MetricCard({ icon, label, value, color, sparkline }) {
   const colors = {
      indigo: "text-indigo-600 bg-indigo-50 shadow-indigo-100 border-indigo-100",
      emerald: "text-emerald-600 bg-emerald-50 shadow-emerald-100 border-emerald-100"
   };
   return (
      <div className={`p-8 rounded-[3rem] border transition-all hover:scale-[1.02] relative overflow-hidden group ${colors[color]}`}>
         <div className="absolute top-0 right-0 p-5 opacity-20 group-hover:scale-125 transition-transform duration-500">{icon && <div className="text-4xl">{icon}</div>}</div>
         <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-70">{label}</p>
         <p className="text-4xl font-black tracking-tighter">{value}</p>
         {sparkline}
      </div>
   );
}

function NeighborRow({ name, interface: iface, status }) {
   return (
      <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"><FaServer size={20}/></div>
            <div>
               <div className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{name}</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{iface}</div>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{status}</span>
         </div>
      </div>
   );
}

function DiagButton({ label, desc, onClick, active }) {
   return (
      <button 
         disabled={active}
         onClick={onClick}
         className={`w-full text-left p-6 rounded-3xl border transition-all group flex flex-col gap-1 ${active ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-100 hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-50 font-black'}`}
      >
         <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-widest text-slate-800 group-hover:text-indigo-600 transition-colors">{label}</span>
            <FaBolt className={active ? 'animate-spin' : 'text-slate-200 group-hover:text-indigo-400 transition-colors'} />
         </div>
         <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{desc}</span>
      </button>
   );
}

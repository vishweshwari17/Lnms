import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import { 
  FaArrowLeft, 
  FaServer, 
  FaExclamationCircle, 
  FaCheckCircle, 
  FaHistory, 
  FaNetworkWired,
  FaShieldAlt,
  FaInfoCircle,
  FaSyncAlt,
  FaExternalLinkAlt,
  FaClock
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function IncidentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIncident = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      // Fixed: Ensure leading slash if needed, but api.get usually handles prefix
      const res = await api.get(`incidents/${id}`);
      setIncident(res.data);
    } catch (err) {
      console.error(err);
      setError("Incident data could not be retrieved from the command grid.");
      toast.error("Access Denied or Link Broken");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleAction = async (endpoint, message) => {
    try {
      // Fixed: Better endpoint handling
      await api.put(`incidents/${id}/${endpoint}`);
      toast.success(message);
      fetchIncident(true);
    } catch (err) {
      toast.error("Action failed");
    }
  };

  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorFallback error={error} retry={() => fetchIncident()} />;
  if (!incident) return <div className="p-20 text-center font-black text-rose-500 tracking-widest uppercase">No Incident Data Found</div>;

  // Severity color mapping
  const severityStyles = {
    Critical: "bg-rose-50 text-rose-600 border-rose-100",
    Major: "bg-amber-50 text-amber-600 border-amber-100",
    Minor: "bg-indigo-50 text-indigo-600 border-indigo-100",
    Warning: "bg-slate-50 text-slate-600 border-slate-100"
  };

  // Fixed: SLA Progress Calculation
  const slaDeadline = incident.sla_deadline ? new Date(incident.sla_deadline) : null;
  const createdTime = incident.created_time ? new Date(incident.created_time) : null;
  const now = new Date();
  
  let slaProgress = 0;
  let slaColor = "bg-emerald-500";
  
  if (slaDeadline && createdTime) {
     const totalDuration = slaDeadline - createdTime;
     const elapsed = now - createdTime;
     slaProgress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
     
     if (slaProgress > 90) slaColor = "bg-rose-500";
     else if (slaProgress > 70) slaColor = "bg-amber-500";
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* TOP NAV BAR */}
        <div className="flex justify-between items-center mb-8">
           <button 
             onClick={() => navigate(-1)}
             className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest border border-slate-200 px-5 py-2.5 rounded-xl bg-white shadow-sm active:scale-95"
           >
             <FaArrowLeft /> Back to Command center
           </button>
           
           <div className="flex gap-3">
              <button 
                onClick={() => fetchIncident(true)}
                className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center hover:text-indigo-600 hover:shadow-md transition-all active:scale-95"
              >
                <FaSyncAlt />
              </button>
              <button 
                onClick={() => navigate(`/war-room?incident=${incident.id}`)}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95"
              >
                <FaExternalLinkAlt size={10} /> Open in War Room
              </button>
           </div>
        </div>

        {/* HEADER CARD */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 p-10 mb-10 border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full translate-x-32 -translate-y-32 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-5">
                <span className="px-5 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100">
                  {incident?.ticket_id || `#${incident?.id}`}
                </span>
                <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border ${severityStyles[incident?.severity] || severityStyles.Warning}`}>
                  {incident?.severity}
                </span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3 uppercase leading-tight">{incident?.title}</h1>
              <div 
                onClick={() => navigate(`/devices/${incident?.device_id}`)}
                className="text-slate-400 font-bold flex items-center gap-2 hover:text-indigo-600 transition-colors cursor-pointer group w-fit"
              >
                <FaServer className="group-hover:scale-110 transition-transform" /> 
                <span className="border-b border-transparent group-hover:border-indigo-200">{incident?.device} &bull; {incident?.ip_address}</span>
              </div>
            </div>
            
            <div className="flex gap-4">
               {!incident?.acknowledged && (
                 <button 
                    onClick={() => handleAction('acknowledge?user=Admin', 'Incident Acknowledged')}
                    className="px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-1"
                 >
                   Acknowledge
                 </button>
               )}
               {incident?.status !== 'RESOLVED' && (
                 <button 
                    onClick={() => handleAction('status?status=RESOLVED', 'Incident Resolved')}
                    className="px-10 py-5 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-100 hover:bg-emerald-600 transition-all hover:-translate-y-1"
                 >
                   Resolve
                 </button>
               )}
            </div>
          </div>

          {/* SLA PROGRESS BAR */}
          {slaDeadline && incident?.status !== 'RESOLVED' && (
             <div className="mt-12 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <FaClock /> SLA Integrity Tracker
                   </div>
                   <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">
                      {slaProgress >= 100 ? "BREACHED" : `${Math.floor(100 - slaProgress)}% REMAINING`}
                   </div>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                   <div 
                     className={`h-full transition-all duration-1000 ease-out ${slaColor}`} 
                     style={{ width: `${slaProgress}%` }} 
                   />
                </div>
                <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                   <span>Started: {createdTime?.toLocaleString()}</span>
                   <span>Deadline: {slaDeadline?.toLocaleString()}</span>
                </div>
             </div>
          )}
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          <div className="lg:col-span-2 space-y-10">
            {/* SUMMARY */}
            <section className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/20 border border-slate-50">
               <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                 <FaInfoCircle size={14} className="text-indigo-400" /> Synthetic summary
               </h3>
               <p className="text-slate-600 font-medium leading-relaxed text-lg">{incident?.description || "No analytical breakdown provided for this trigger."}</p>
            </section>

            {/* CORRELATED EVENTS */}
            <section className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/20 border border-slate-50">
               <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                 <FaNetworkWired size={14} className="text-indigo-400" /> Correlated telemetry chain (+{incident?.occurrence_count} events)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(incident?.related_alarm_ids || []).map((aid, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                             <FaExclamationCircle />
                          </div>
                          <div>
                             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alarm Event</div>
                             <div className="text-xs font-black text-slate-700 uppercase">ALM-{aid}</div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-10">
             {/* COMMAND TELEMETRY */}
             <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-10">Command Telemetry</h3>
                
                <div className="space-y-8">
                   <MetricRow label="Sovereign Status" value={incident?.status} color="text-emerald-400" />
                   <MetricRow label="Logical Node" value={incident?.location || "REG-A1-NODE-X"} color="text-indigo-400" />
                   <MetricRow label="Time Trigger" value={new Date(incident?.created_time).toLocaleTimeString()} color="text-slate-300" />
                   <MetricRow label="Risk Score" value={`${incident?.risk_score || 0}%`} color="text-rose-400" />
                </div>
             </div>

             {/* REAL TIMELINE */}
             <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/20 border border-slate-50">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                  <FaShieldAlt size={14} className="text-indigo-400" /> Command logs
                </h3>
                <div className="relative pl-6 space-y-10 before:absolute before:left-[1px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                   <TimelineItem 
                      time={incident?.created_time ? new Date(incident.created_time).toLocaleTimeString() : "Pending"} 
                      label="Detection Triggered" 
                      active 
                      icon={<div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                   />
                   <TimelineItem 
                      time={incident?.ack_time ? new Date(incident.ack_time).toLocaleTimeString() : "Awaiting response"} 
                      label="NOC Acknowledged" 
                      active={!!incident?.acknowledged} 
                      icon={<div className={`w-2.5 h-2.5 rounded-full ${incident?.acknowledged ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
                   />
                   <TimelineItem 
                      time={incident?.resolved_at ? new Date(incident.resolved_at).toLocaleTimeString() : "In progress"} 
                      label="Resource Restored" 
                      active={incident?.status === 'RESOLVED'} 
                      icon={<div className={`w-2.5 h-2.5 rounded-full ${incident?.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                   />
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center group">
       <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{label}</span>
       <span className={`text-sm font-black uppercase tracking-tight ${color} group-hover:scale-105 transition-transform duration-300`}>{value}</span>
    </div>
  );
}

function TimelineItem({ time, label, active, icon }) {
  return (
    <div className="relative">
       <div className={`absolute -left-[30px] top-1.5 w-[14px] h-[14px] rounded-full border-2 bg-white flex items-center justify-center ${active ? 'border-indigo-600' : 'border-slate-100'}`}>
          {icon}
       </div>
       <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{time}</div>
       <div className={`text-[11px] font-black uppercase tracking-tight ${active ? 'text-slate-800' : 'text-slate-300'}`}>{label}</div>
    </div>
  );
}

function SkeletonLoader() {
   return (
      <div className="p-8 bg-slate-50 min-h-screen animate-pulse">
         <div className="max-w-6xl mx-auto">
            <div className="w-48 h-10 bg-white rounded-xl mb-8"></div>
            <div className="bg-white h-64 rounded-[3rem] mb-10"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="lg:col-span-2 space-y-10">
                  <div className="bg-white h-48 rounded-[2.5rem]"></div>
                  <div className="bg-white h-64 rounded-[2.5rem]"></div>
               </div>
               <div className="space-y-10">
                  <div className="bg-slate-900 h-64 rounded-[2.5rem]"></div>
                  <div className="bg-white h-64 rounded-[2.5rem]"></div>
               </div>
            </div>
         </div>
      </div>
   );
}

function ErrorFallback({ error, retry }) {
   return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
         <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-rose-100">
            <FaExclamationCircle size={48} />
         </div>
         <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-4">Command Grid Failure</h2>
         <p className="text-slate-500 font-bold text-sm uppercase mb-8 max-w-md">{error}</p>
         <button 
           onClick={retry}
           className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
         >
           Attempt Re-Link
         </button>
      </div>
   );
}

import { useEffect, useState, useCallback, useRef } from "react";
import { getAlarms, updateAlarmStatus } from "../api/api";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter, 
  Search, 
  RefreshCcw, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  Bell,
  ExternalLink,
  Bot
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import toast from "react-hot-toast";

dayjs.extend(relativeTime);

export default function IncomingAlarms() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [stats, setStats] = useState({ total: 0, critical: 0, major: 0, minor: 0 });

  const navigate = useNavigate();
  
  const prevAlarmIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const fetchAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      
      const res = await getAlarms(params);
      const data = res.data;
      
      setAlarms(data.alarms);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      
      // Check for new alarms
      if (!isFirstLoad.current) {
        const currentIds = data.alarms.map(a => a.alarm_id);
        const newAlarms = data.alarms.filter(a => !prevAlarmIds.current.has(a.alarm_id));
        
        if (newAlarms.length > 0) {
          newAlarms.forEach(a => {
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-[1.5rem] pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-8 border-rose-500`}>
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5 text-rose-500">
                      <Bell size={24} />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">New Alarm Received</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{a.alarm_name}</p>
                      <p className="mt-1 text-xs text-slate-500 font-medium">{a.device_name} — {a.severity}</p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-gray-200">
                  <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-black text-rose-600 hover:text-rose-500 focus:outline-none">Close</button>
                </div>
              </div>
            ), { duration: 6000 });
          });
        }
      }
      
      // Update refs
      prevAlarmIds.current = new Set(data.alarms.map(a => a.alarm_id));
      isFirstLoad.current = false;
    } catch (err) {
      console.error("Failed to fetch alarms:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate]);

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 30000);
    return () => clearInterval(interval);
  }, [fetchAlarms]);

  // Derived filtering for search/severity/status (since these are not yet server-side in my backend update, 
  // I should add them to backend or do them here. User asked for date/pagination server-side specifically, 
  // but usually search should be too. I'll keep them client-side for now to avoid over-complicating backend 
  // unless requested, but I'll make sure they work with the current paginated set or suggest server-side search.)
  
  const filteredAlarms = alarms.filter(a => {
    const matchesSearch = !search || 
      a.device_name?.toLowerCase().includes(search.toLowerCase()) || 
      a.alarm_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.alarm_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesSeverity = severityFilter === "All" || a.severity === severityFilter;
    const matchesStatus = statusFilter === "All" || a.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleAction = async (e, id, status) => {
    e.stopPropagation();
    try {
      await updateAlarmStatus(id, status);
      fetchAlarms();
    } catch (err) {
      console.error(err);
    }
  };

  const navigateToDetail = (alarm) => {
    if (alarm.ticket_id) {
      navigate(`/tickets/${alarm.ticket_id}`);
    } else {
      navigate(`/alarms/${alarm.alarm_id}`);
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev) {
      case "Critical": return "bg-red-500 text-white shadow-red-200";
      case "Major": return "bg-orange-500 text-white shadow-orange-200";
      case "Minor": return "bg-yellow-500 text-white shadow-yellow-200";
      default: return "bg-blue-500 text-white shadow-blue-200";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold"><CheckCircle size={12}/> Resolved</span>;
      case "ACK":
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold"><Clock size={12}/> Acknowledged</span>;
      default:
        return <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold animate-pulse"><Zap size={12}/> Active</span>;
    }
  };

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans text-slate-800">
      
      {/* Header section with Glassmorphism feel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
              <AlertTriangle size={28} />
            </div>
            Alarm Dashboard
          </h1>
          <p className="text-slate-500 mt-1 font-medium flex items-center gap-2 text-sm uppercase tracking-widest">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Real-time Monitoring System
          </p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 items-center gap-2">
           <button 
             onClick={() => fetchAlarms()}
             className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-500"
             title="Refresh"
           >
             <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
           </button>
           <div className="w-px h-6 bg-slate-100 mx-1"></div>
           <span className="px-3 text-xs font-bold text-slate-400">Showing {filteredAlarms.length} of {total}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPI title="Total Alarms" value={total} icon={<AlertTriangle />} color="indigo" />
        <KPI title="Critical" value={loading ? "..." : alarms.filter(a => a.severity === "Critical").length} icon={<Zap />} color="rose" />
        <KPI title="Major" value={loading ? "..." : alarms.filter(a => a.severity === "Major").length} icon={<Clock />} color="orange" />
        <KPI title="Resolved" value={loading ? "..." : alarms.filter(a => a.status === "RESOLVED").length} icon={<CheckCircle />} color="emerald" />
      </div>

      {/* Filters Area */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-6 border border-white mb-8">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          
          <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[300px]">
             {/* Search */}
             <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
               <input 
                 type="text"
                 placeholder="Search alarm or device..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl w-full sm:w-64 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all outline-none font-medium placeholder-slate-300 shadow-inner"
               />
             </div>

             {/* Severity Filter */}
             <div className="relative">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <select 
                 className="pl-11 pr-8 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all outline-none font-bold text-[11px] uppercase tracking-wider text-slate-500 appearance-none shadow-inner cursor-pointer"
                 value={severityFilter}
                 onChange={(e) => setSeverityFilter(e.target.value)}
               >
                 <option value="All">All Severities</option>
                 <option>Critical</option>
                 <option>Major</option>
                 <option>Minor</option>
               </select>
             </div>

             {/* Status Filter */}
             <div className="relative">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <select 
                 className="pl-11 pr-8 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all outline-none font-bold text-[11px] uppercase tracking-wider text-slate-500 appearance-none shadow-inner cursor-pointer"
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
               >
                 <option value="All">All Statuses</option>
                 <option value="OPEN">ACTIVE</option>
                 <option value="ACK">ACK</option>
                 <option value="RESOLVED">RESOLVED</option>
               </select>
             </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl shadow-inner border border-slate-100">
               <div className="relative flex items-center">
                 <Calendar className="absolute left-3 text-slate-400" size={14} />
                 <input 
                   type="date"
                   value={startDate}
                   onChange={(e) => setStartDate(e.target.value)}
                   className="pl-9 pr-3 py-2 bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 outline-none cursor-pointer"
                 />
               </div>
               <span className="text-slate-300 font-bold">to</span>
               <div className="relative flex items-center">
                 <Calendar className="absolute left-3 text-slate-400" size={14} />
                 <input 
                   type="date"
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="pl-9 pr-3 py-2 bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 outline-none cursor-pointer"
                 />
               </div>
            </div>

            <button 
              onClick={() => {
                setSearch("");
                setSeverityFilter("All");
                setStatusFilter("All");
                setStartDate("");
                setEndDate("");
              }}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-100"
            >
              Reset
            </button>
          </div>

        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] first:rounded-tl-[2.5rem]">ID</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Source</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Device Information</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Alarm Type</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Severity</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em]">Created</th>
                <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] last:rounded-tr-[2.5rem]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCcw className="animate-spin text-indigo-600" size={40} />
                      <p className="font-bold text-slate-400">Loading alarms...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-32 text-center">
                    <div className="text-6xl mb-6 opacity-20 grayscale">🔕</div>
                    <p className="text-xl font-black text-slate-800">No alarms found</p>
                    <p className="text-slate-400 mt-2 font-medium">Try adjusting your filters or date range</p>
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((a) => (
                  <tr 
                    key={a.alarm_id} 
                    className="hover:bg-slate-50/50 cursor-pointer group transition-all"
                    onClick={() => navigateToDetail(a)}
                  >
                    <td className="px-6 py-6 font-mono text-[10px] font-black text-indigo-600">
                      {a.alarm_id}
                    </td>
                    <td className="px-6 py-6">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${a.source === 'LNMS' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {a.source || "LNMS"}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{a.device_name}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{a.ip_address}</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="font-bold text-slate-600">{a.alarm_name}</div>
                    </td>
                    <td className="px-6 py-6">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg ${getSeverityColor(a.severity)} transition-all group-hover:scale-105`}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="px-6 py-6 font-medium">
                      {getStatusBadge(a.status)}
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-slate-700 font-bold text-xs">{dayjs(a.created_at).format("DD MMM, HH:mm")}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{dayjs(a.created_at).fromNow()}</div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex justify-center items-center gap-3">
                        {a.status !== "RESOLVED" && (
                          <>
                            <button 
                              onClick={(e) => handleAction(e, a.alarm_id, "Ack")} 
                              className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors group/btn shadow-sm"
                              title="Acknowledge"
                            >
                              <Clock size={16} />
                            </button>
                            <button 
                              onClick={(e) => handleAction(e, a.alarm_id, "Resolved")} 
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors group/btn shadow-sm"
                              title="Resolve"
                            >
                              <CheckCircle size={16} />
                            </button>
                          </>
                        )}
                        {a.ticket_id ? (
                           <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl" title="Linked Ticket">
                             <ExternalLink size={16} />
                           </div>
                        ) : (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               window.dispatchEvent(new CustomEvent("ask-ai", { 
                                 detail: { question: `${a.device_name} is having a ${a.alarm_name} issue. What should I do?` } 
                               }));
                             }}
                             className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors" 
                             title="Ask AI Assistant"
                           >
                             <Bot size={16} />
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-8 py-8 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per page</span>
             <select 
               value={limit} 
               onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
               className="bg-transparent border-none outline-none font-black text-xs text-indigo-600 cursor-pointer"
             >
               {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
             </select>
             <div className="w-px h-4 bg-slate-100 mx-2"></div>
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
               Showing {(page-1)*limit + 1} - {Math.min(page*limit, total)} of {total}
             </span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-slate-100 disabled:hover:text-slate-600 transition-all font-bold"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-2">
               {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                 let pageNum;
                 if (totalPages <= 5) pageNum = i + 1;
                 else if (page <= 3) pageNum = i + 1;
                 else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                 else pageNum = page - 2 + i;
                 
                 return (
                   <button 
                     key={pageNum}
                     onClick={() => setPage(pageNum)}
                     className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                       page === pageNum 
                         ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110" 
                         : "bg-white text-slate-400 hover:text-slate-600 border border-slate-100"
                     }`}
                   >
                     {pageNum}
                   </button>
                 );
               })}
            </div>

            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:border-slate-100 disabled:hover:text-slate-600 transition-all font-bold"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, icon, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  
  return (
    <div className={`p-6 rounded-[2rem] border-2 shadow-sm flex items-center gap-5 transition-all hover:translate-y-[-4px] cursor-default group relative overflow-hidden ${colors[color]}`}>
      <div className="p-4 bg-white/50 rounded-2xl group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{title}</p>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
      <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
    </div>
  );
}
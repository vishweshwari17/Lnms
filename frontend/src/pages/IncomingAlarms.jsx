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
  };  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center premium-card p-5 mb-6">
        <div>
          <h1 className="page-title mb-0">Incoming Alarms</h1>
          <p className="small-meta uppercase tracking-wider">
            Real-time infrastructure fault monitoring
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fetchAlarms()}
            className="w-10 h-10 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-primary transition-colors shadow-sm"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="label-badge text-emerald-600">Active Monitoring</span>
          </div>
        </div>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Alarms" value={total} color="blue" icon={<AlertTriangle size={16} />} />
        <KPICard title="Critical" value={loading ? "..." : alarms.filter(a => a.severity === "Critical").length} color="red" icon={<Zap size={16} />} />
        <KPICard title="Major" value={loading ? "..." : alarms.filter(a => a.severity === "Major").length} color="amber" icon={<Clock size={16} />} />
        <KPICard title="Resolved" value={loading ? "..." : alarms.filter(a => a.status === "RESOLVED").length} color="emerald" icon={<CheckCircle size={16} />} />
      </div>

      {/* FILTERS & SEARCH */}
      <div className="premium-card p-6 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex flex-wrap gap-3 items-center flex-1">
             <div className="relative min-w-[240px]">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
               <input 
                 type="text"
                 placeholder="Search alarm or device..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-100 rounded-lg pl-9 pr-4 py-2 body-text outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
               />
             </div>

             <div className="flex gap-2">
               <FilterSelect 
                 value={severityFilter}
                 onChange={setSeverityFilter}
                 options={["All", "Critical", "Major", "Minor"]}
                 label="Severity"
               />
               <FilterSelect 
                 value={statusFilter}
                 onChange={setStatusFilter}
                 options={["All", "OPEN", "ACK", "RESOLVED"]}
                 label="Status"
               />
             </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg">
               <Calendar size={14} className="text-gray-400" />
               <input 
                 type="date"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="bg-transparent body-text font-bold outline-none text-xs"
               />
               <span className="small-meta font-bold">to</span>
               <input 
                 type="date"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="bg-transparent body-text font-bold outline-none text-xs"
               />
            </div>

            <button 
              onClick={() => {
                setSearch("");
                setSeverityFilter("All");
                setStatusFilter("All");
                setStartDate("");
                setEndDate("");
              }}
              className="px-4 py-2 text-blue-primary body-text font-bold hover:underline"
            >
              Reset
            </button>
          </div>
        </div>

        {/* TABLE Area */}
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header table-cell">ID</th>
                <th className="table-header table-cell">Source</th>
                <th className="table-header table-cell">Device Info</th>
                <th className="table-header table-cell">Alarm Type</th>
                <th className="table-header table-cell">Severity</th>
                <th className="table-header table-cell">Status</th>
                <th className="table-header table-cell">Created</th>
                <th className="table-header table-cell text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-20 animate-pulse body-text font-bold text-gray-400">
                    Syncing alarms...
                  </td>
                </tr>
              ) : filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-20">
                    <div className="text-gray-200 mb-2 font-black text-4xl">🔕</div>
                    <p className="body-text font-bold text-gray-500">No alarms found</p>
                    <p className="small-meta">Try adjusting your filters or date range</p>
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((a) => (
                  <tr 
                    key={a.alarm_id} 
                    className="hover:bg-gray-50/50 cursor-pointer group transition-colors body-text"
                    onClick={() => navigateToDetail(a)}
                  >
                    <td className="table-cell font-bold text-blue-primary">
                      {a.alarm_id.slice(0, 8)}
                    </td>
                    <td className="table-cell">
                      <span className="label-badge text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {a.source || "LNMS"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="font-bold text-gray-900">{a.device_name}</div>
                      <div className="small-meta">{a.ip_address}</div>
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-gray-700">{a.alarm_name}</div>
                    </td>
                    <td className="table-cell">
                      <SeverityBadge sev={a.severity} />
                    </td>
                    <td className="table-cell">
                      {getStatusBadgeRefactored(a.status)}
                    </td>
                    <td className="table-cell">
                      <div className="font-bold text-gray-700">{dayjs(a.created_at).format("DD MMM, HH:mm")}</div>
                      <div className="small-meta mt-0.5">{dayjs(a.created_at).fromNow()}</div>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-center items-center gap-2">
                        {a.status !== "RESOLVED" && (
                          <>
                            <button 
                              onClick={(e) => handleAction(e, a.alarm_id, "Ack")} 
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Acknowledge"
                            >
                              <Clock size={14} />
                            </button>
                            <button 
                              onClick={(e) => handleAction(e, a.alarm_id, "Resolved")} 
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Resolve"
                            >
                              <CheckCircle size={14} />
                            </button>
                          </>
                        )}
                        {a.ticket_id ? (
                           <div className="p-1.5 text-blue-primary bg-blue-50 rounded-md" title="Linked Ticket">
                             <ExternalLink size={14} />
                           </div>
                        ) : (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               window.dispatchEvent(new CustomEvent("ask-ai", { 
                                 detail: { question: `${a.device_name} is having a ${a.alarm_name} issue. What should I do?` } 
                               }));
                             }}
                             className="p-1.5 text-blue-primary hover:bg-blue-50 rounded-md transition-colors" 
                             title="Ask AI Assistant"
                           >
                             <Bot size={14} />
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
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="small-meta uppercase font-bold text-xs">Rows</span>
               <select 
                 value={limit} 
                 onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                 className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 body-text font-bold outline-none text-xs cursor-pointer"
               >
                 {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
               </select>
             </div>
             <div className="w-px h-4 bg-gray-200 mx-1"></div>
             <span className="small-meta">
               Showing {(page-1)*limit + 1} - {Math.min(page*limit, total)} of {total}
             </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex items-center gap-1">
               {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
                .map((p, i, arr) => (
                  <div key={p} className="flex items-center gap-1">
                    {i > 0 && p - arr[i-1] > 1 && <span className="small-meta px-1">...</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                        page === p 
                          ? "bg-blue-primary text-white shadow-sm" 
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                ))
               }
            </div>

            <button 
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, icon, color }) {
  const colorMap = {
     blue: "text-blue-600 border-blue-100/50 bg-blue-50/20",
     red: "text-red-600 border-red-100/50 bg-red-50/20",
     amber: "text-amber-600 border-amber-100/50 bg-amber-50/20",
     emerald: "text-emerald-600 border-emerald-100/50 bg-emerald-50/20"
  };
  
  return (
    <div className={`premium-card p-5 group hover:shadow-lg transition-all ${colorMap[color] || colorMap.blue}`}>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] uppercase font-black tracking-widest opacity-60">{title}</p>
        <div className="p-1.5 opacity-40 group-hover:opacity-100 group-hover:text-blue-500 transition-all">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black tracking-tighter tabular-nums">{value}</p>
    </div>
  );
}

function KPICard({ title, value, icon, color }) {
  return <KPI title={title} value={value} icon={icon} color={color} />;
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg">
      <span className="small-meta uppercase font-bold opacity-60 text-[10px]">{label}</span>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent body-text font-bold outline-none cursor-pointer p-1 text-xs"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt === 'OPEN' ? 'ACTIVE' : opt}</option>)}
      </select>
    </div>
  );
}

function SeverityBadge({ sev }) {
  const styles = {
    Critical: "bg-red-50 text-red-600 border-red-100",
    Major: "bg-amber-50 text-amber-600 border-amber-100",
    Minor: "bg-blue-50 text-blue-primary border-blue-100",
  };
  return (
    <span className={`label-badge px-2 py-0.5 rounded border ${styles[sev] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
      {sev || "\u2014"}
    </span>
  );
}

function getStatusBadgeRefactored(status) {
  switch (status) {
    case "RESOLVED":
    case "CLOSED":
      return <span className="flex items-center gap-1.5 text-emerald-600 label-badge"><CheckCircle size={12}/> {status}</span>;
    case "ACK":
      return <span className="flex items-center gap-1.5 text-amber-600 label-badge"><Clock size={12}/> {status}</span>;
    default:
      return <span className="flex items-center gap-1.5 text-red-600 label-badge animate-pulse"><Zap size={12}/> ACTIVE</span>;
  }
}

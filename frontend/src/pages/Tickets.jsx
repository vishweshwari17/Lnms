// src/pages/Tickets.jsx  (LNMS)
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api, { getTickets, acknowledgeTicket, resolveTicket } from "../api/api";
import StatusBadge from "../components/StatusBadge";
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight, 
  Ticket as TicketIcon, 
  Bell, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Zap,
  Calendar
} from "lucide-react";
import Sparkline from "../components/Sparkline";
import toast from "react-hot-toast";

const SEVERITY_ORDER = { Critical: 3, Major: 2, Minor: 1, Warning: 0 };
const VALID_FILTER_STATUSES = ["All", "OPEN", "ACK", "RESOLVED", "CLOSED"];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [filter, setFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortSeverity, setSortSeverity] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const prevTicketIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const formatTime = (time) => {
    if (!time) return "\u2014";
    return new Date(time).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      const res = await getTickets(params);
      if (res?.data) {
        const data = res.data;
        setTickets(data.tickets);
        setTotal(data.total);
        setTotalPages(data.total_pages);

        // Check for new tickets
        if (!isFirstLoad.current) {
          const newTickets = data.tickets.filter(t => !prevTicketIds.current.has(t.ticket_id));
          if (newTickets.length > 0) {
            newTickets.forEach(t => {
              toast.custom((toastObj) => (
                <div className={`${toastObj.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-[1.5rem] pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-8 border-indigo-500`}>
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5 text-indigo-500">
                        <Bell size={24} />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">New Ticket Generated</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{t.title}</p>
                        <p className="mt-1 text-xs text-slate-500 font-medium">{t.device_name} — {t.severity_calculated}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-200">
                    <button onClick={() => toast.dismiss(toastObj.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-black text-indigo-600 hover:text-indigo-500 focus:outline-none">Close</button>
                  </div>
                </div>
              ), { duration: 6000 });
            });
          }
        }
        
        // Update refs
        prevTicketIds.current = new Set(data.tickets.map(t => t.ticket_id));
        isFirstLoad.current = false;
      }
    } catch (err) {
      console.error("Ticket fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, startDate, endDate]);

  useEffect(() => {
    fetchTickets();
    const id = setInterval(fetchTickets, 30000);
    return () => clearInterval(id);
  }, [fetchTickets]);

  const handleAck = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await acknowledgeTicket(id);
      toast.success("Ticket Acknowledged");
      fetchTickets();
    } catch (err) {
      toast.error("Failed to acknowledge");
    }
  };

  const handleResolve = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const notes = window.prompt("Resolution notes:");
    if (notes === null) return;
    try {
      await resolveTicket(id, { resolution_notes: notes });
      toast.success("Ticket Resolved");
      fetchTickets();
    } catch (err) {
      toast.error("Failed to resolve");
    }
  };

  const openCount = Array.isArray(tickets) ? tickets.filter(t => t.status === "OPEN").length : 0;
  const ackCount = Array.isArray(tickets) ? tickets.filter(t => t.status === "ACK").length : 0;
  const resolvedCount = Array.isArray(tickets) ? tickets.filter(t => t.status === "RESOLVED").length : 0;
  const closedCount = Array.isArray(tickets) ? tickets.filter(t => t.status === "CLOSED").length : 0;
  const syncedCount = tickets.filter(t => t.sync_status === "synced").length;
  const pendingCount = tickets.filter(t => t.sync_status === "pending").length;

  const filteredTickets = useMemo(() => {
    let data = [...tickets];
    if (filter !== "All") {
      data = data.filter(t => t.status === filter);
    }
    if (severityFilter !== "All") {
      data = data.filter(t => t.severity_calculated === severityFilter);
    }
    if (search) {
      const term = search.toLowerCase();
      data = data.filter(t =>
        t.global_ticket_id?.toLowerCase().includes(term) ||
        t.ticket_id?.toLowerCase().includes(term) ||
        t.device_name?.toLowerCase().includes(term) ||
        t.title?.toLowerCase().includes(term)
      );
    }
    return data;
  }, [tickets, filter, severityFilter, search]);

  const sortedTickets = useMemo(() => {
    if (!sortSeverity) return filteredTickets;
    return [...filteredTickets].sort(
      (a, b) =>
        (SEVERITY_ORDER[b.severity_calculated] || 0) -
        (SEVERITY_ORDER[a.severity_calculated] || 0)
    );
  }, [filteredTickets, sortSeverity]);  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center premium-card p-6 border-b border-white/5 bg-white/5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter">TICKET OPERATIONS</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mt-1">
             Status: <span className="text-emerald-400">Tactical Secure</span> &bull; LNMS_PRO_MODE
          </p>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 group-hover:border-blue-500/30 transition-all">
              <Zap size={14} className="text-blue-400 animate-pulse" />
              <span className="text-[10px] font-black text-white tracking-widest uppercase">Live Auto-Sync</span>
           </div>
           <button 
             onClick={() => fetchTickets()}
             className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 group"
           >
             <RefreshCcw size={16} className={`${loading ? "animate-spin" : ""} group-hover:scale-110`} />
           </button>
        </div>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <PremiumKPICard title="Total" value={total} color="blue" trend={[20, 22, 18, 25, 23, 27]} />
        <PremiumKPICard title="Open" value={openCount} color="rose" trend={[5, 8, 4, 9, 6, 10]} />
        <PremiumKPICard title="Acknowledged" value={ackCount} color="amber" trend={[10, 12, 11, 14, 13, 15]} />
        <PremiumKPICard title="Resolved" value={resolvedCount} color="emerald" trend={[100, 105, 102, 108, 110, 115]} />
        <PremiumKPICard title="Synced" value={syncedCount} color="blue" trend={[50, 55, 52, 58, 60, 65]} />
        <PremiumKPICard title="Pending" value={pendingCount} color="amber" trend={[2, 1, 3, 0, 2, 1]} />
      </div>

      {/* FILTERS & TABLE */}
      <div className="card space-y-6">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100 w-fit">
            {VALID_FILTER_STATUSES.map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === tab
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg">
               <Calendar size={14} className="text-gray-400" />
               <input 
                 type="date"
                 value={startDate}
                 onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                 className="bg-transparent body-text font-bold outline-none text-xs"
               />
               <span className="small-meta font-bold">to</span>
               <input 
                 type="date"
                 value={endDate}
                 onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                 className="bg-transparent body-text font-bold outline-none text-xs"
               />
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs font-black text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-white outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#020617]">All Severity</option>
              <option className="bg-[#020617]">Critical</option>
              <option className="bg-[#020617]">Major</option>
              <option className="bg-[#020617]">Minor</option>
            </select>
          </div>
        </div>

        <div className="card space-y-6 !p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header table-cell text-slate-400">ID</th>
                <th className="table-header table-cell text-slate-700">Ticket Details</th>
                <th className="table-header table-cell text-slate-700">Asset</th>
                <th
                  className="table-header table-cell cursor-pointer hover:text-blue-600 text-slate-700"
                  onClick={() => setSortSeverity(s => !s)}
                >
                  Severity {sortSeverity ? "↓" : "↕"}
                </th>
                <th className="table-header table-cell text-slate-700">Status</th>
                <th className="table-header table-cell text-slate-700">Sync</th>
                <th className="table-header table-cell text-center text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <RefreshCcw className="animate-spin text-blue-primary mx-auto mb-2" size={24} />
                    <p className="body-text text-gray-400">Syncing tickets...</p>
                  </td>
                </tr>
              ) : sortedTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <div className="text-gray-200 mb-2"><TicketIcon size={48} className="mx-auto" /></div>
                    <p className="body-text font-bold text-gray-500">No tickets found</p>
                    <p className="small-meta">Adjust your filters to see more results</p>
                  </td>
                </tr>
              ) : sortedTickets.map(ticket => {
                const ticketIdentifier = ticket.ticket_id || ticket.global_ticket_id;
                return (
                  <tr key={ticketIdentifier} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="table-cell font-bold text-blue-primary">
                      {ticketIdentifier.slice(0, 10)}
                    </td>
                    <td className="table-cell">
                      <div className="body-text font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ticket.title}</div>
                      <div className="small-meta mt-0.5">{formatTime(ticket.created_at)}</div>
                    </td>
                    <td className="table-cell">
                      <div className="body-text text-slate-700">{ticket.device_name}</div>
                      <div className="small-meta">{ticket.ip_address || "N/A"}</div>
                    </td>
                    <td className="table-cell">
                      <SeverityBadge sev={ticket.severity_calculated} />
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="table-cell">
                      <SyncBadge status={ticket.sync_status || "pending"} pushPending={!ticket.sent_to_cnms_at} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center gap-2">
                        {ticket.status === "OPEN" && (
                          <button 
                            onClick={(e) => handleAck(e, ticketIdentifier)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                            title="Acknowledge"
                          >
                            <Clock size={14} />
                          </button>
                        )}
                        {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                          <button 
                            onClick={(e) => handleResolve(e, ticketIdentifier)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Resolve"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <Link
                          to={"/tickets/" + ticketIdentifier}
                          className="p-1.5 text-blue-primary hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="small-meta uppercase font-bold">Rows</span>
               <select
                 value={rowsPerPage}
                 onChange={e => {
                   setRowsPerPage(Number(e.target.value));
                   setCurrentPage(1);
                 }}
                 className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 body-text font-bold outline-none text-xs"
               >
                 {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
               </select>
             </div>
             <div className="w-px h-4 bg-gray-200" />
             <p className="small-meta">
               Showing <span className="font-bold text-gray-900">{(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, total)}</span> of {total}
             </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
               {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || (p >= currentPage -1 && p <= currentPage + 1))
                .map((p, i, arr) => (
                  <div key={p} className="flex items-center gap-1">
                    {i > 0 && p - arr[i-1] > 1 && <span className="small-meta px-1">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                        currentPage === p 
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
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
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

function PremiumKPICard({ title, value, color, trend }) {
  const colorMap = {
     blue: "text-blue-400 border-blue-500/10 bg-blue-500/5",
     rose: "text-rose-400 border-rose-500/10 bg-rose-500/5",
     amber: "text-amber-400 border-amber-500/10 bg-amber-500/5",
     emerald: "text-emerald-400 border-emerald-500/10 bg-emerald-500/5"
  };

  const sparkColorMap = {
     blue: "#3b82f6",
     rose: "#f43f5e",
     amber: "#fbbf24",
     emerald: "#10b981"
  };

  return (
    <div className={`premium-card p-5 flex flex-col gap-3 group hover:bg-white/[0.05] transition-all ${colorMap[color] || colorMap.blue}`}>
      <div className="flex justify-between items-start">
        <p className="text-[9px] uppercase font-black tracking-widest opacity-40">{title}</p>
        <Sparkline data={trend} color={sparkColorMap[color] || "#3b82f6"} height={20} width={80} />
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-black tracking-tighter tabular-nums text-white">{value.toLocaleString()}</p>
        <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-400/5 px-1 rounded transition-all group-hover:bg-emerald-400/10">
           <TrendingUp size={8} /> +
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, color }) {
  return <PremiumKPICard title={title} value={value} color={color} trend={[10, 15, 8, 12, 14, 18]} />;
}

function SeverityBadge({ sev }) {
  const styles = {
    Critical: "bg-red-50 text-red-600 border-red-100",
    Major: "bg-amber-50 text-amber-600 border-amber-100",
    Minor: "bg-blue-50 text-blue-primary border-blue-100",
    Warning: "bg-gray-50 text-gray-600 border-gray-100",
  };
  return (
    <span className={`label-badge px-2 py-0.5 rounded border ${styles[sev] || styles.Warning}`}>
      {sev || "\u2014"}
    </span>
  );
}

function SyncBadge({ status, pushPending }) {
  const styles = {
    synced: "bg-emerald-500",
    pending: "bg-amber-500",
    out_of_sync: "bg-red-500",
    conflict: "bg-purple-600",
  };
  const key = status?.toLowerCase() in styles ? status.toLowerCase() : "pending";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${styles[key]} ${key === 'pending' ? 'animate-pulse' : ''}`} />
        <span className="small-meta font-bold uppercase tracking-tighter opacity-70">{status || "Waiting"}</span>
      </div>
      {pushPending && (
        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter bg-amber-50 px-1 rounded w-fit">Push Pending</span>
      )}
    </div>
  );
}

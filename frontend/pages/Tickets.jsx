// src/pages/Tickets.jsx  (LNMS)
import { useEffect, useState, useMemo } from "react";
import { getTickets } from "../api/api";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";

const SEVERITY_ORDER = { Critical: 3, Major: 2, Minor: 1 };
const VALID_FILTER_STATUSES = ["All", "OPEN", "ACK", "RESOLVED", "CLOSED"];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortSeverity, setSortSeverity] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ticketsPerPage = 10;

  const formatTime = (time) => {
    if (!time) return "\u2014";
    return new Date(time).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const fetchTickets = async () => {
    try {
      const res = await getTickets();
      if (res?.data?.tickets) setTickets([...res.data.tickets]);
    } catch (err) {
      console.error("Ticket fetch error:", err);
    }
  };

  useEffect(() => {
    fetchTickets();
    const id = setInterval(fetchTickets, 10000);
    return () => clearInterval(id);
  }, []);

  const openCount     = tickets.filter(t => t.status === "OPEN").length;
  const ackCount      = tickets.filter(t => t.status === "ACK").length;
  const resolvedCount = tickets.filter(t => t.status === "RESOLVED").length;
  const closedCount   = tickets.filter(t => t.status === "CLOSED").length;
  const syncedCount   = tickets.filter(t => t.sync_status === "synced").length;
  const pendingCount  = tickets.filter(t => t.sync_status === "pending").length;

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
  }, [filteredTickets, sortSeverity]);

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / ticketsPerPage));
  const currentTickets = sortedTickets.slice(
    (currentPage - 1) * ticketsPerPage,
    currentPage * ticketsPerPage
  );

  useEffect(() => setCurrentPage(1), [filter, search, sortSeverity, severityFilter]);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">

      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">LNMS Tickets</h1>
        <div className="flex items-center text-green-600 text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
          Live &bull; Auto refresh
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
        <KPI title="Total"        value={tickets.length} />
        <KPI title="Open"         value={openCount}      color="text-red-600" />
        <KPI title="ACK"          value={ackCount}        color="text-yellow-600" />
        <KPI title="Resolved"     value={resolvedCount}   color="text-green-600" />
        <KPI title="Synced"       value={syncedCount}     color="text-emerald-600" />
        <KPI title="Pending sync" value={pendingCount}    color="text-orange-600" />
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {VALID_FILTER_STATUSES.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={
              "px-4 py-2 rounded-xl text-sm " +
              (filter === tab ? "bg-blue-600 text-white" : "bg-white shadow")
            }
          >
            {tab === "All" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search ticket / device / title"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-xl w-64"
        />
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="px-4 py-2 border rounded-xl"
        >
          <option value="All">All Severity</option>
          <option>Critical</option>
          <option>Major</option>
          <option>Minor</option>
        </select>
      </div>

      <div className="bg-white shadow rounded-2xl p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 border-b">
            <tr>
              <th className="text-left py-2">ID</th>
              <th className="text-left py-2">Title</th>
              <th className="text-left py-2">Device</th>
              <th
                className="text-left py-2 cursor-pointer"
                onClick={() => setSortSeverity(s => !s)}
              >
                Severity {sortSeverity ? "\u25b2" : "\u2195"}
              </th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Sync</th>
              <th className="text-left py-2">Sent to CNMS</th>
              <th className="text-left py-2">Resolved time</th>
              <th className="text-left py-2">Resolution note</th>
              <th className="text-left py-2">Created</th>
              <th className="text-left py-2">View</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.map(ticket => {
              const ticketIdentifier = ticket.ticket_id || ticket.global_ticket_id;

              return (
                <tr key={ticketIdentifier} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-mono text-xs">
                    {ticketIdentifier}
                  </td>
                  <td className="py-3">{ticket.title}</td>
                  <td className="py-3">{ticket.device_name}</td>
                  <td className="py-3">{ticket.severity_calculated}</td>
                  <td className="py-3">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="py-3">
                    <SyncBadge status={ticket.sync_status || "pending"} />
                  </td>
                  <td className="py-3">
                    {ticket.sent_to_cnms_at ? (
                      <span className="text-green-600">{formatTime(ticket.sent_to_cnms_at)}</span>
                    ) : (
                      <span className="text-yellow-600">Pending</span>
                    )}
                  </td>
                  <td className="py-3">{formatTime(ticket.resolved_at)}</td>
                  <td className="py-3 max-w-xs truncate text-gray-500 text-xs">
                    {ticket.resolution_note || "\u2014"}
                  </td>
                  <td className="py-3 text-xs text-gray-400">{formatTime(ticket.created_at)}</td>
                  <td className="py-3">
                    <Link
                      to={"/tickets/" + ticketIdentifier}
                      className="px-3 py-1 bg-gray-800 text-white rounded text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {currentTickets.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-gray-400">
                  No tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={
                "px-3 py-1 rounded " +
                (currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200")
              }
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value, color }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <p className="text-xs text-gray-400">{title}</p>
      <p className={"text-xl font-bold " + (color || "")}>{value}</p>
    </div>
  );
}

function SyncBadge({ status }) {
  const styles = {
    synced:      "bg-emerald-100 text-emerald-700",
    pending:     "bg-amber-100 text-amber-700",
    out_of_sync: "bg-orange-100 text-orange-700",
    conflict:    "bg-red-100 text-red-700",
  };
  const labels = {
    synced: "Synced", pending: "Pending", out_of_sync: "Out of sync", conflict: "Conflict",
  };
  const key = status in styles ? status : "pending";
  return (
    <span className={"px-3 py-1 rounded-full text-xs font-semibold " + styles[key]}>
      {labels[key]}
    </span>
  );
}

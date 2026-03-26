import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import StatusBadge from "../components/StatusBadge";

function Incidents() {

  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents");
      setTickets(res.data);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  /* ---------- SEARCH FILTER ---------- */

  const filteredTickets = Array.isArray(tickets)
    ? tickets.filter((ticket) => {
        const term = search.toLowerCase();

        return (
          ticket.device?.toLowerCase().includes(term) ||
          ticket.host?.toLowerCase().includes(term) ||
          ticket.global_ticket_id?.toLowerCase().includes(term) ||
          ticket.ticket_id?.toLowerCase().includes(term)
        );
      })
    : [];

  /* ---------- PAGINATION ---------- */

  const totalPages = Math.ceil(filteredTickets.length / pageSize);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const goNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goPrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  /* ---------- SEVERITY COLORS ---------- */

  const severityColor = {
    Critical: "text-red-600 font-semibold",
    Major: "text-orange-500 font-semibold",
    Minor: "text-yellow-500 font-semibold",
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">

      {/* PAGE TITLE */}

      <h2 className="text-2xl font-bold text-blue-700 mb-6">
        Incident List
      </h2>

      {/* SEARCH + PAGE SIZE */}

      <div className="flex justify-between mb-4">
        <input
          placeholder="Search host or device..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded-lg w-80"
        />

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="border p-2 rounded-lg"
        >
          <option value={5}>5 rows</option>
          <option value={8}>8 rows</option>
          <option value={15}>15 rows</option>
          <option value={25}>25 rows</option>
        </select>
      </div>

      {/* TABLE */}

      <div className="bg-white shadow rounded-xl overflow-hidden">
        <table className="w-full">

          <thead className="bg-gray-50 text-gray-600 text-sm">
            <tr>
              <th className="p-3 text-left">Ticket</th>
              <th className="text-left">Host</th>
              <th className="text-left">Device</th>
              <th className="text-left">Severity</th>
              <th className="text-left">Status</th>
              <th className="text-left">Created</th>
              <th className="text-left">SLA</th>
            </tr>
          </thead>

          <tbody>
            {paginatedTickets.map((ticket) => (
              <tr
                key={ticket.ticket_id || ticket.global_ticket_id}
                className="border-t hover:bg-gray-50"
              >

                {/* Ticket ID */}

                <td className="p-3 text-blue-600 font-medium">
                  <Link
                    to={`/tickets/${ticket.ticket_id || ticket.global_ticket_id}`}
                    className="hover:underline"
                  >
                    {ticket.ticket_id || ticket.global_ticket_id}
                  </Link>
                </td>

                {/* Host */}

                <td>{ticket.host || "-"}</td>

                {/* Device */}

                <td>{ticket.device || "-"}</td>

                {/* Severity */}

                <td className={severityColor[ticket.severity] || "text-gray-600"}>
                  {ticket.severity}
                </td>

                {/* Status */}

                <td>
                  <StatusBadge status={ticket.status} />
                </td>

                {/* Created Time */}

                <td>
                  {ticket.created_time
                    ? new Date(ticket.created_time).toLocaleString()
                    : "-"}
                </td>

                {/* SLA */}

                <td>
                  {ticket.sla_deadline
                    ? new Date(ticket.sla_deadline).toLocaleString()
                    : "-"}
                </td>

              </tr>
            ))}
          </tbody>

        </table>

        {/* EMPTY STATE */}

        {paginatedTickets.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No incidents found
          </p>
        )}
      </div>

      {/* PAGINATION CONTROLS */}

      <div className="flex justify-between items-center mt-6">

        <button
          onClick={goPrev}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50"
        >
          Previous
        </button>

        <span className="text-gray-600">
          Page {currentPage} of {totalPages || 1}
        </span>

        <button
          onClick={goNext}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-white border rounded-lg disabled:opacity-50"
        >
          Next
        </button>

      </div>

    </div>
  );
}

export default Incidents;

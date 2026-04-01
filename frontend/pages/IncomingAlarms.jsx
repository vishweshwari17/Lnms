import { useEffect, useState } from "react";
import { getAlarms, updateAlarmStatus } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);
  const [filteredAlarms, setFilteredAlarms] = useState([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());

  const navigate = useNavigate();

  useEffect(() => {
    fetchAlarms();

    const interval = setInterval(fetchAlarms, 30000);
    const timeInterval = setInterval(() => setNow(Date.now()), 60000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    filterData();
  }, [alarms, search, severityFilter, statusFilter]);

  const fetchAlarms = async () => {
    try {
      const res = await getAlarms();
      setAlarms(res.data);
    } catch (err) {
      console.error("Error fetching alarms", err);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await updateAlarmStatus(id, status);
      fetchAlarms();
    } catch (err) {
      console.error("Failed to update alarm status", err);
    }
  };

  const displayStatus = {
    Open: "ACTIVE",
    OPEN: "ACTIVE",
    Ack: "ACKNOWLEDGED",
    ACK: "ACKNOWLEDGED",
    Resolved: "RESOLVED",
    RESOLVED: "RESOLVED",
    Closed: "RESOLVED",
    CLOSED: "RESOLVED",
  };

  const filterData = () => {
    let data = [...alarms];

    if (severityFilter !== "All") {
      data = data.filter((a) => a.severity === severityFilter);
    }

    if (statusFilter !== "All") {
      data = data.filter(
        (a) =>
          displayStatus[a.status]?.toLowerCase() ===
          statusFilter.toLowerCase()
      );
    }

    if (search) {
      data = data.filter(
        (a) =>
          a.device_name?.toLowerCase().includes(search.toLowerCase()) ||
          a.alarm_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort latest first
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFilteredAlarms(data);
    setPage(1);
  };

  const severityColors = {
    Critical: "bg-red-500",
    Major: "bg-orange-500",
    Minor: "bg-yellow-400",
  };

  const statusColors = {
    Open: "bg-red-500",
    OPEN: "bg-red-500",
    Ack: "bg-yellow-500 text-yellow-900",
    ACK: "bg-yellow-500 text-yellow-900",
    Resolved: "bg-green-500",
    RESOLVED: "bg-green-500",
    Closed: "bg-gray-500",
    CLOSED: "bg-gray-500",
  };

  const getDuration = (timeStr) => {
    if (!timeStr) return "-";
    const diffMs = now - new Date(timeStr).getTime();
    if (diffMs < 0) return "0s";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ${diffMins % 60}m`;
    return `${Math.floor(diffHrs / 24)}d ${diffHrs % 24}h`;
  };

  const indexOfLast = page * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentRows = filteredAlarms.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredAlarms.length / rowsPerPage);

  const criticalCount = alarms.filter((a) => a.severity === "Critical").length;
  const majorCount = alarms.filter((a) => a.severity === "Major").length;
  const minorCount = alarms.filter((a) => a.severity === "Minor").length;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">🚨 Network Alarms Dashboard</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="Total" value={alarms.length} />
        <Card title="Critical" value={criticalCount} color="red" />
        <Card title="Major" value={majorCount} color="orange" />
        <Card title="Minor" value={minorCount} color="yellow" />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-wrap gap-4 justify-between">
        <input
          type="text"
          placeholder="Search..."
          className="border p-2 rounded w-1/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-3">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="border p-2 rounded">
            <option>All</option>
            <option>Critical</option>
            <option>Major</option>
            <option>Minor</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border p-2 rounded">
            <option>All</option>
            <option>ACTIVE</option>
            <option>ACKNOWLEDGED</option>
            <option>RESOLVED</option>
          </select>

          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="border p-2 rounded">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={75}>75</option>
            <option value={100}>100</option>
          </select>

          <button onClick={() => { setSearch(""); setSeverityFilter("All"); setStatusFilter("All"); }} className="bg-gray-200 px-3 rounded">
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-6 rounded-xl shadow">
        <table className="w-full">
          <thead>
            <tr className="text-gray-600">
              <th>ID</th><th>Device</th><th>Severity</th><th>Status</th><th>Duration</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((a) => {
              const isResolved = ["Resolved", "Closed", "RESOLVED"].includes(a.status);
              const dur = getDuration(a.problem_time || a.created_at);
              const stat = displayStatus[a.status];

              return (
                <tr key={a.alarm_id} onClick={() => navigate(`/alarms/${a.alarm_id}`)} className="cursor-pointer hover:bg-gray-50">
                  <td>{a.alarm_id}</td>
                  <td>{a.device_name}</td>
                  <td><span className={`${severityColors[a.severity]} text-white px-2 rounded`}>{a.severity}</span></td>
                  <td><span className={`${statusColors[a.status]} px-2 rounded text-white`}>{stat}</span></td>
                  <td>{dur}</td>
                  <td>
                    <button onClick={(e) => { e.stopPropagation(); handleAction(a.alarm_id, 'Ack') }} disabled={isResolved}>Ack</button>
                    <button onClick={(e) => { e.stopPropagation(); handleAction(a.alarm_id, 'Resolved') }} disabled={isResolved}>Resolve</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between mt-4">
        <p>Showing {indexOfFirst + 1} - {Math.min(indexOfLast, filteredAlarms.length)} of {filteredAlarms.length}</p>

        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(p - 1, 1))}>Prev</button>
          <span>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Next</button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <div className={`p-4 rounded shadow bg-${color ? color + "-100" : "white"}`}>
      <p>{title}</p>
      <h2 className="text-xl font-bold">{value}</h2>
    </div>
  );
}
import { useEffect, useState } from "react";
import { getAlarms } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);
  const [filteredAlarms, setFilteredAlarms] = useState([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [page, setPage] = useState(1);

  const navigate = useNavigate();

  const rowsPerPage = 10;

  useEffect(() => {
    fetchAlarms();

    const interval = setInterval(() => {
      fetchAlarms();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterData();
  }, [alarms, search, severityFilter]);

  const fetchAlarms = async () => {
    try {
      const res = await getAlarms();
      setAlarms(res.data);
    } catch (err) {
      console.error("Error fetching alarms", err);
    }
  };

  const filterData = () => {
    let data = [...alarms];

    if (severityFilter !== "All") {
      data = data.filter((a) => a.severity === severityFilter);
    }

    if (search) {
      data = data.filter(
        (a) =>
          a.device_name?.toLowerCase().includes(search.toLowerCase()) ||
          a.alarm_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredAlarms(data);
    setPage(1);
  };

  const severityColors = {
    Critical: "bg-red-500",
    Major: "bg-orange-500",
    Minor: "bg-yellow-400",
  };

  const statusColors = {
    OPEN: "bg-red-500",
    ACK: "bg-purple-500",
    RESOLVED: "bg-green-500",
    CLOSED: "bg-gray-500",
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

      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        🚨 Network Alarms Dashboard
      </h1>

      {/* Summary Cards */}

      <div className="grid grid-cols-4 gap-4 mb-6">

        <div className="bg-white p-4 rounded-xl shadow">
          <p className="text-gray-500 text-sm">Total Alarms</p>
          <h2 className="text-2xl font-bold">{alarms.length}</h2>
        </div>

        <div className="bg-red-100 p-4 rounded-xl shadow">
          <p className="text-red-600 text-sm">Critical</p>
          <h2 className="text-2xl font-bold">{criticalCount}</h2>
        </div>

        <div className="bg-orange-100 p-4 rounded-xl shadow">
          <p className="text-orange-600 text-sm">Major</p>
          <h2 className="text-2xl font-bold">{majorCount}</h2>
        </div>

        <div className="bg-yellow-100 p-4 rounded-xl shadow">
          <p className="text-yellow-700 text-sm">Minor</p>
          <h2 className="text-2xl font-bold">{minorCount}</h2>
        </div>

      </div>

      {/* Filters */}

      <div className="bg-white p-4 rounded-xl shadow mb-6 flex justify-between">

        <input
          type="text"
          placeholder="Search device or alarm..."
          className="border p-2 rounded w-1/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border p-2 rounded"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option>All</option>
          <option>Critical</option>
          <option>Major</option>
          <option>Minor</option>
        </select>

      </div>

      {/* Table */}

      <div className="bg-white shadow rounded-xl p-6">

        <table className="w-full text-left border-separate border-spacing-y-2">

          <thead>
            <tr className="text-gray-600 text-sm">
              <th>Alarm ID</th>
              <th>Device</th>
              <th>Severity</th>
              <th>Alarm</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>

            {currentRows.map((alarm) => (
              <tr
                key={alarm.alarm_id}
                onClick={() => navigate(`/alarms/${alarm.alarm_id}`)}
                className="bg-gray-50 hover:bg-gray-100 cursor-pointer rounded-lg"
              >
                <td className="p-3">{alarm.alarm_id}</td>

                <td>{alarm.device_name}</td>

                <td>
                  <span
                    className={`px-2 py-1 text-xs text-white rounded ${
                      severityColors[alarm.severity] || "bg-gray-400"
                    }`}
                  >
                    {alarm.severity}
                  </span>
                </td>

                <td>{alarm.alarm_name}</td>

                <td>
                  <span
                    className={`px-2 py-1 text-xs text-white rounded ${
                      statusColors[alarm.status] || "bg-gray-400"
                    }`}
                  >
                    {alarm.status}
                  </span>
                </td>

                <td>{alarm.created_at}</td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

      {/* Pagination */}

      <div className="flex justify-center mt-6 gap-2">

        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            className={`px-4 py-2 rounded ${
              page === i + 1
                ? "bg-blue-500 text-white"
                : "bg-white border"
            }`}
          >
            {i + 1}
          </button>
        ))}

      </div>

    </div>
  );
}


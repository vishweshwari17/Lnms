import { useEffect, useState, useMemo ,Fragment } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const CorrelatedAlarms = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [expandedRow, setExpandedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();
  const rowsPerPage = 10;

  useEffect(() => {
    fetchCorrelatedAlarms();
  }, []);

  const fetchCorrelatedAlarms = async () => {
    try {
      const response = await axios.get(
        "http://127.0.0.1:8000/correlated-alarms/"
      );
      setData(response.data || []);
    } catch (error) {
      console.error("Error fetching correlated alarms:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-600";
      case "major":
        return "bg-orange-100 text-orange-600";
      case "minor":
        return "bg-yellow-100 text-yellow-700";
      case "warning":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  /* ---------------- FILTER + SEARCH ---------------- */

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSeverity =
        severityFilter === "All" || item.severity === severityFilter;

      const matchesSearch =
        item.device_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.root_alarm_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.correlation_id?.toString().includes(search);

      return matchesSeverity && matchesSearch;
    });
  }, [data, search, severityFilter]);

  /* ---------------- PAGINATION ---------------- */

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  /* ---------------- SUMMARY ---------------- */

  const totalRelated = filteredData.reduce(
    (acc, item) => acc + (item.total_alarms || 0),
    0
  );

  const criticalCount = filteredData.filter(
    (item) => item.severity === "Critical"
  ).length;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            Correlated Alarms
          </h2>
          <p className="text-sm text-gray-500">
            Monitor grouped alarms and root cause analysis
          </p>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-6 rounded-xl shadow mb-6 flex flex-wrap gap-4 items-center">

          <input
            type="text"
            placeholder="Search by Device / Root Alarm / ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="border rounded-lg px-4 py-2 w-72 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
            <option value="Warning">Warning</option>
          </select>

        </div>

        {/* SUMMARY CARDS */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Total Correlations</p>
              <p className="text-3xl font-bold text-indigo-600 mt-2">
                {filteredData.length}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Critical Correlations</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {criticalCount}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Total Related Alarms</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {totalRelated}
              </p>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 text-left">ID</th>
                <th className="px-6 py-4 text-left">Root Alarm</th>
                <th className="px-6 py-4 text-left">Device</th>
                <th className="px-6 py-4 text-left">Severity</th>
                <th className="px-6 py-4 text-left">Total Related</th>
              </tr>
            </thead>

            <tbody>
  {paginatedData.map((item) => (
    <Fragment key={item.correlation_id}>
      <tr
        className="border-t hover:bg-gray-50 cursor-pointer"
        onClick={() => navigate(`/correlations/${item.correlation_id}`)}
      >
        <td className="px-6 py-4 font-semibold text-indigo-600">
          #{item.correlation_id}
        </td>

        <td className="px-6 py-4">
          {item.root_alarm_name || "-"}
        </td>

        <td className="px-6 py-4">
          {item.device_name || "-"}
        </td>

        <td className="px-6 py-4">
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full ${getSeverityStyle(
              item.severity
            )}`}
          >
            {item.severity}
          </span>
        </td>

        <td
          className="px-6 py-4 font-bold text-purple-600"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedRow(
              expandedRow === item.correlation_id
                ? null
                : item.correlation_id
            );
          }}
        >
          {item.total_alarms}
        </td>
      </tr>

      {expandedRow === item.correlation_id && (
        <tr className="bg-gray-50">
          <td colSpan="5" className="px-6 py-4">
            <p className="font-semibold mb-2">Related Alarms:</p>

            {item.related_alarms?.length > 0 ? (
              <ul className="list-disc ml-6 text-gray-600">
                {item.related_alarms.map((alarm) => (
                  <li key={alarm.alarm_id}>
                    {alarm.device_name} - {alarm.alarm_name} ({alarm.severity})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No related alarms found.</p>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  ))}
</tbody>
          </table>

          {/* PAGINATION */}
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="px-4 py-2 bg-indigo-500 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="px-4 py-2 bg-indigo-500 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorrelatedAlarms;


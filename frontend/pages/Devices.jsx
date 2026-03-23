import { useEffect, useState } from "react";
import { getDevices } from "../api/api";
import { RefreshCw } from "lucide-react";

export default function Devices() {

  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const perPage = 10;

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await getDevices();
      setDevices(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const filtered = devices.filter(d =>
    (d.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address?.includes(search)) &&
    (typeF ? d.device_type === typeF : true) &&
    (statusF ? d.status === statusF : true)
  );

  const pages = Math.ceil(filtered.length / perPage);
  const visible = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 bg-gray-50 min-h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">

        <div>
          <h1 className="text-2xl font-bold text-blue-900">LNMS Devices</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} devices discovered
          </p>
        </div>

        <button
          onClick={loadDevices}
          className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:text-blue-600"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>

      </div>

      {/* Filters */}

      <div className="flex flex-wrap gap-2 mb-4">

        <input
          placeholder="Search hostname or IP"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm w-56 outline-none focus:border-blue-400"
        />

        <select
          value={typeF}
          onChange={(e) => {
            setTypeF(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Types</option>
          <option>Router</option>
          <option>Switch</option>
          <option>Firewall</option>
          <option>Server</option>
          <option>AP</option>
          <option>Other</option>
        </select>

        <select
          value={statusF}
          onChange={(e) => {
            setStatusF(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Status</option>
          <option>ACTIVE</option>
          <option>INACTIVE</option>
        </select>

      </div>

      {/* Table */}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-50">

            <tr>
              {[
                "ID",
                "Hostname",
                "IP Address",
                "Type",
                "Location",
                "Status"
              ].map(h => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wide text-left"
                >
                  {h}
                </th>
              ))}
            </tr>

          </thead>

          <tbody className="divide-y divide-gray-100">

            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading devices...
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No devices found
                </td>
              </tr>
            )}

            {visible.map((d) => (

              <tr key={d.id} className="hover:bg-blue-50">

                <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                  {d.id}
                </td>

                <td className="px-4 py-3 text-sm font-medium text-gray-800">
                  {d.hostname}
                </td>

                <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                  {d.ip_address}
                </td>

                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border">
                    {d.device_type}
                  </span>
                </td>

                <td className="px-4 py-3 text-sm text-gray-500">
                  {d.location}
                </td>

                <td className="px-4 py-3">

                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-semibold border ${
                      d.status === "ACTIVE"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {d.status}
                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* Pagination */}

      {pages > 1 && (
        <div className="flex gap-2 mt-4">

          {[...Array(pages)].map((_, i) => (

            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                page === i + 1
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {i + 1}
            </button>

          ))}

        </div>
      )}

    </div>
  );
}
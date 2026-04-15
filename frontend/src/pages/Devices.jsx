import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { 
  FaServer, 
  FaSearch, 
  FaSyncAlt, 
  FaDesktop, 
  FaNetworkWired,
  FaArrowRight
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function DevicesDashboard() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchDevices = async () => {
    try {
      const res = await api.get("devices", {
        params: {
          search: search || undefined,
          type: typeFilter === "All" ? undefined : typeFilter,
          status: statusFilter === "All" ? undefined : statusFilter
        }
      });
      setDevices(res.data.devices || []);
    } catch (err) {
      console.error("Failed to fetch devices", err);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("devices/sync");
      toast.success("Devices synchronized successfully");
      fetchDevices();
    } catch (err) {
      console.error("Sync failed", err);
      toast.error("Synchronization failed");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [search, typeFilter, statusFilter]);

  const counts = {
    total: devices.length,
    routers: devices.filter(d => d.type?.toLowerCase().includes("router")).length,
    servers: devices.filter(d => d.type?.toLowerCase().includes("server") || d.type?.toLowerCase().includes("host")).length,
    active: devices.filter(d => d.status === "ACTIVE").length,
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="page-title mb-0">Core Inventory</h1>
          <p className="small-meta uppercase tracking-wider">
            {counts.total} Infrastructure Assets Managed
          </p>
        </div>
        
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-blue-primary text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-blue-header transition-colors disabled:opacity-50"
        >
          <FaSyncAlt className={syncing ? "animate-spin" : ""} />
          {syncing ? "Scanning..." : "Sync Assets"}
        </button>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Assets" value={counts.total} color="blue" icon={<FaNetworkWired />} />
        <KPICard label="Active Nodes" value={counts.active} color="emerald" icon={<FaDesktop />} />
        <KPICard label="Routers" value={counts.routers} color="amber" icon={<FaNetworkWired />} />
        <KPICard label="Servers" value={counts.servers} color="blue" icon={<FaServer />} />
      </div>

      {/* FILTERS */}
      <div className="card flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
          <input
            type="text"
            placeholder="Search hostname or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-lg pl-9 pr-4 py-2 body-text focus:ring-2 focus:ring-blue-100 transition-all outline-none"
          />
        </div>
        <div className="flex gap-3">
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={["All", "SNMP", "Router", "Switch", "Server"]} label="Type" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "ACTIVE", "INACTIVE"]} label="Status" />
        </div>
      </div>

      {/* TABLE */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="table-header table-cell">ID</th>
                <th className="table-header table-cell">Hostname & IP</th>
                <th className="table-header table-cell">Type</th>
                <th className="table-header table-cell">Location</th>
                <th className="table-header table-cell text-center">Status</th>
                <th className="table-header table-cell text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="6" className="table-cell text-center body-text py-10 animate-pulse">Scanning perimeter...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan="6" className="table-cell text-center body-text py-10 text-gray-400">No assets discovered.</td></tr>
              ) : devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <td className="table-cell font-bold text-blue-primary">
                    DEV-{device.id.toString().padStart(4, '0')}
                  </td>
                  <td className="table-cell">
                    <div className="body-text font-bold text-gray-900">{device.hostname}</div>
                    <div className="small-meta">{device.ip_address}</div>
                  </td>
                  <td className="table-cell">
                    <span className="label-badge text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{device.type || "IP Node"}</span>
                  </td>
                  <td className="table-cell small-meta">{device.location || "N/A"}</td>
                  <td className="table-cell">
                    <div className="flex items-center justify-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${device.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                       <span className={`label-badge ${device.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
                         {device.status}
                       </span>
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <button 
                      onClick={() => navigate(`/devices/${device.id}`)}
                      className="p-2 text-gray-400 hover:text-blue-primary transition-colors"
                    >
                      <FaArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, color, icon }) {
  const colors = {
    blue: "text-blue-600 border-blue-100/50 bg-blue-50/20",
    emerald: "text-emerald-600 border-emerald-100/50 bg-emerald-50/20",
    amber: "text-amber-600 border-amber-100/50 bg-amber-50/20"
  };

  return (
    <div className={`premium-card p-5 group hover:shadow-lg transition-all ${colors[color] || colors.blue}`}>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] uppercase font-black tracking-widest opacity-60">{label}</p>
        <div className="p-1.5 opacity-40 group-hover:opacity-100 transition-all text-current">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black tracking-tighter tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg">
      <span className="small-meta uppercase font-bold opacity-60">{label}</span>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent body-text font-bold outline-none cursor-pointer p-1"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

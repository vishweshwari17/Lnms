import api from "../api/api";

function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get("audit/");
      setLogs(res.data);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    }
  };

  return (
    <div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-blue-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">Track all system activity and user actions</p>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Activity History
          </h2>
          <span className="text-xs text-gray-400">{logs.length} records</span>
        </div>

        <table className="w-full text-left">

          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wider">ID</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.log_id} className="hover:bg-blue-50 transition-colors duration-100">

                <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>

                <td className="px-6 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {log.user_name}
                  </span>
                </td>

                <td className="px-6 py-3 text-sm text-gray-800 font-medium">
                  {log.action}
                </td>

                <td className="px-6 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {log.entity_type}
                  </span>
                </td>

                <td className="px-6 py-3 text-sm text-gray-500 font-mono">
                  #{log.entity_id}
                </td>

              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>

        </table>

      </div>

    </div>
  );
}

export default AuditLogs;
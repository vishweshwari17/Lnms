function StatusBadge({ status }) {
  const normalized = String(status || "").trim().toUpperCase();
  const colors = {
    OPEN: "bg-red-500/20 text-red-400",
    ACK: "bg-yellow-500/20 text-yellow-500",
    RESOLVED: "bg-green-500/20 text-green-400",
    CLOSED: "bg-gray-400/20 text-gray-500",
    ESCALATED: "bg-yellow-500/20 text-yellow-400",
    RISK: "bg-orange-500/20 text-orange-400",
  };
  const labels = {
    OPEN: "Open",
    ACK: "Ack",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    ESCALATED: "Escalated",
    RISK: "Risk",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs ${colors[normalized] || "bg-gray-200 text-gray-600"}`}>
      {labels[normalized] || status || "Unknown"}
    </span>
  );
}

export default StatusBadge;

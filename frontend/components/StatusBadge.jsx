function StatusBadge({ status }) {
  const colors = {
    Open: "bg-red-500/20 text-red-400",
    Resolved: "bg-green-500/20 text-green-400",
    Escalated: "bg-yellow-500/20 text-yellow-400",
    Risk: "bg-orange-500/20 text-orange-400",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs ${colors[status]}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
import { useEffect, useState, useRef } from "react";

function LiveAlarmStream() {
  const [alarms, setAlarms] = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket("ws://localhost:8000/ws/alarms");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to alarm stream");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAlarms((prev) => [data, ...prev].slice(0, 20));
        } catch (e) {
          console.error("Failed to parse alarm message:", e);
        }
      };

      ws.onerror = (err) => console.error("WebSocket error:", err);

      ws.onclose = () => {
        setConnected(false);
        console.log("WebSocket closed — reconnecting in 3s...");
        setTimeout(connect, 3000); // auto-reconnect
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [alarms]);

  const severityStyle = {
    Critical: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", pulse: true },
    Major:    { color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", pulse: false },
    Minor:    { color: "#ca8a04", bg: "#fefce8", border: "#fef08a", pulse: false },
    Warning:  { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", pulse: false },
  };

  const formatTime = (alarm) => {
    const raw = alarm.problem_time || alarm.created_at || alarm.time;
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleTimeString();
    } catch {
      return "—";
    }
  };

  return (
    <div className="bg-white shadow rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Live Alarm Stream</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          <span className={connected ? "text-green-600" : "text-red-400"}>
            {connected ? "Connected" : "Reconnecting..."}
          </span>
          {alarms.length > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {alarms.length} events
            </span>
          )}
        </div>
      </div>

      <div className="h-64 overflow-y-auto space-y-2 pr-1">
        {alarms.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <p className="text-sm">Waiting for alarms...</p>
          </div>
        )}

        {alarms.map((alarm, index) => {
          // Support both field naming conventions from backend
          const deviceName = alarm.device_name || alarm.device || "Unknown Device";
          const alarmName = alarm.alarm_name || alarm.alarm || "Unknown Alarm";
          const severity = alarm.severity || "Unknown";
          const style = severityStyle[severity] || { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };

          return (
            <div
              key={index}
              className="border rounded-lg p-3 flex justify-between items-center hover:shadow-sm transition-all"
              style={{ background: style.bg, borderColor: style.border }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: style.color,
                    animation: style.pulse ? "pulse 1.5s infinite" : "none"
                  }}
                />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{deviceName}</p>
                  <p className="text-xs text-gray-500">{alarmName}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xs font-bold" style={{ color: style.color }}>
                  {severity}
                </p>
                <p className="text-xs text-gray-400">{formatTime(alarm)}</p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default LiveAlarmStream;
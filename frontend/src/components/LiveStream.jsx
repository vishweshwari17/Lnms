import { useEffect, useState } from "react";

export default function LiveAlarmStream() {
  const [alarms, setAlarms] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const socket = new WebSocket(`ws://${hostname}:8000/ws/alarms`);

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "ALARM_UPDATE" || msg.type === "ALARM_LIST") {
        setAlarms(msg.alarms || msg.data || []);
      } else if (msg.alarms) {
        setAlarms(msg.alarms);
      } else if (msg.type === "NEW_ALARM") {
        setAlarms(prev => [msg.data, ...prev].slice(0, 10));
      }
    };

    return () => socket.close();
  }, []);

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {alarms.length === 0 && (
        <p className="small-meta text-center py-4">
          Waiting for alarms...
        </p>
      )}

      {alarms.map((alarm, i) => (
        <div
          key={i}
          className="flex justify-between items-start border-b border-gray-50 pb-2 mb-2 last:border-0"
        >
          <div className="flex-1 min-w-0">
            <p className="body-text font-bold text-gray-800 truncate">
              {alarm.device_name}
            </p>
            <p className="small-meta truncate opacity-70">
              {alarm.alarm_name || alarm.description}
            </p>
          </div>
          <span className={`label-badge ml-2 ${
            alarm.severity === 'Critical' ? 'text-red-600' : 
            alarm.severity === 'Major' ? 'text-amber-600' : 
            'text-blue-primary'
          }`}>
            {alarm.severity}
          </span>
        </div>
      ))}
    </div>
  );
}
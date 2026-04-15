import { useEffect, useState, useRef } from "react";
import dayjs from "dayjs";

function LiveStreamPage() {
  const [alarms, setAlarms] = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const hostname = window.location.hostname;
      const ws = new WebSocket(`ws://${hostname}:8000/ws/alarms`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to alarm stream");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ALARM_UPDATE") {
            setAlarms(msg.alarms || []);
          } else if (msg.alarms) {
             setAlarms(msg.alarms); 
          }
        } catch (e) {
          console.error("Failed to parse alarm message:", e);
        }
      };

      ws.onerror = (err) => console.error("WebSocket error:", err);

      ws.onclose = () => {
        setConnected(false);
        console.log("WebSocket closed — reconnecting in 3s...");
        setTimeout(connect, 3000); 
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [alarms]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center premium-card p-6">
        <div>
          <h1 className="page-title mb-0">War Room: Live Signal Intel</h1>
          <p className="small-meta uppercase tracking-wider">
            Monitor real-time infrastructure alerts
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
            <span className={`label-badge ${connected ? "text-emerald-400" : "text-rose-400"}`}>
              {connected ? "Live Stream Active" : "Stream Offline"}
            </span>
          </div>
          {alarms.length > 0 && (
            <span className="label-badge bg-blue-50 text-blue-primary px-3 py-1.5 rounded-lg border border-blue-100">
              {alarms.length} Cumulative Events
            </span>
          )}
        </div>
      </div>

      <div className="card min-h-[500px] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {alarms.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 py-20">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <p className="body-text">Waiting for tactical signal data...</p>
            </div>
          )}

          {alarms.map((alarm, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-4 rounded-xl border border-slate-100 hover:bg-blue-50/30 transition-all bg-white shadow-sm creative-hover"
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    alarm.severity === 'Critical' ? 'bg-red-600 animate-pulse' : 
                    alarm.severity === 'Major' ? 'bg-amber-500' : 
                    'bg-blue-primary'
                  }`}
                />
                <div>
                  <p className="body-text font-bold text-slate-900">{alarm.device_name || alarm.device || "Unknown"}</p>
                  <p className="small-meta text-blue-600 font-black uppercase tracking-widest">{alarm.alarm_name || alarm.alarm || "Unknown Event"}</p>
                </div>
              </div>

              <div className="text-right flex items-center gap-6">
                <div>
                    <span className={`label-badge px-2 py-1 rounded border border-current ${
                        alarm.severity === 'Critical' ? 'text-red-600 bg-red-50' : 
                        alarm.severity === 'Major' ? 'text-amber-600 bg-amber-50' : 
                        'text-blue-primary bg-blue-50'
                    }`}>
                      {alarm.severity}
                    </span>
                    <p className="small-meta mt-1 text-slate-400 font-bold uppercase tracking-tighter">
                        {alarm.created_at ? dayjs(isNaN(Number(alarm.created_at)) ? alarm.created_at : Number(alarm.created_at) * (String(alarm.created_at).length === 10 ? 1000 : 1)).format("HH:mm:ss") : "Syncing..."}
                    </p>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

export default LiveStreamPage;
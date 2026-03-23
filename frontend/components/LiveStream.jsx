import { useEffect, useState } from "react";

export default function LiveAlarmStream() {

  const [alarms,setAlarms] = useState([]);

  useEffect(()=>{

    const socket = new WebSocket("ws://localhost:8000/ws/alarms");

    socket.onmessage = (event)=>{

      const msg = JSON.parse(event.data);

      if(msg.type === "NEW_ALARM"){

        setAlarms(prev => [
          msg.data,
          ...prev
        ].slice(0,10));

      }

    };

    return ()=>socket.close();

  },[]);


  return (

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="font-semibold mb-4">
Live Alarm Stream
</h2>

<div className="space-y-3 max-h-64 overflow-y-auto">

{alarms.length === 0 && (
<p className="text-gray-400 text-sm">
Waiting for alarms...
</p>
)}

{alarms.map((alarm,i)=>{

const color = {
Critical:"text-red-600",
Major:"text-orange-500",
Minor:"text-yellow-500"
};

return(

<div
key={i}
className="flex justify-between border-b pb-2"
>

<div>

<p className="font-medium">
{alarm.device_name}
</p>

<p className="text-xs text-gray-500">
{alarm.description}
</p>

</div>

<span className={`text-sm font-semibold ${color[alarm.severity] || ""}`}>
{alarm.severity}
</span>

</div>

);

})}

</div>

</div>

  );
}
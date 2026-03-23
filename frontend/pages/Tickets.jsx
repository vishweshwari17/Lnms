import { useEffect, useState, useMemo } from "react";
import { getTickets } from "../api/api";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";

export default function Tickets() {

const [tickets,setTickets]=useState([]);
const [filter,setFilter]=useState("All");
const [severityFilter,setSeverityFilter]=useState("All");
const [search,setSearch]=useState("");
const [sortSeverity,setSortSeverity]=useState(false);
const [currentPage,setCurrentPage]=useState(1);

const ticketsPerPage=10;

const getDisplayTicketId = (ticket) => ticket.display_ticket_id || ticket.cnms_short_id || ticket.ticket_id || "";

/* =========================
   FORMAT TIME
========================= */
const formatTime = (time) => {
  if(!time) return "—";

  return new Date(time).toLocaleString("en-IN",{
    timeZone:"Asia/Kolkata",
    year:"numeric",
    month:"numeric",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit",
    hour12:true
  });
};

/* =========================
   FETCH TICKETS
========================= */
const fetchTickets = async () => {
  try{
    const res = await getTickets();

    if(res?.data?.tickets){
      // ✅ FORCE RE-RENDER (CRITICAL FIX)
      setTickets([...res.data.tickets]);
    }else{
      setTickets([]);
    }

  }catch(err){
    console.error("Ticket fetch error:",err);
  }
};

/* =========================
   AUTO REFRESH
========================= */
useEffect(()=>{
  fetchTickets();

  // 🔥 Faster refresh for real-time feel
  const interval = setInterval(fetchTickets,3000);

  return ()=>clearInterval(interval);
},[]);

/* =========================
   DEBUG (REMOVE LATER)
========================= */
useEffect(()=>{
  console.log("UPDATED TICKETS:",tickets);
},[tickets]);

/* =========================
   FILTER + SEARCH
========================= */
const filteredTickets = useMemo(()=>{

  let data=[...tickets];

  if(filter!=="All"){
    data=data.filter(
      t=>t.status?.toLowerCase()===filter.toLowerCase()
    );
  }

  if(severityFilter!=="All"){
    data=data.filter(
      t=>t.severity_calculated===severityFilter
    );
  }

  if(search){

    const term = search.toLowerCase();

    data=data.filter(t=>
      getDisplayTicketId(t)?.toLowerCase().includes(term) ||
      t.ticket_id?.toLowerCase().includes(term) ||
      t.device_name?.toLowerCase().includes(term) ||
      t.title?.toLowerCase().includes(term)
    );

  }

  return data;

},[tickets,filter,severityFilter,search]);

/* =========================
   SEVERITY SORT
========================= */
const severityOrder={
  Critical:3,
  Major:2,
  Minor:1
};

const sortedTickets = useMemo(()=>{

  if(!sortSeverity) return filteredTickets;

  return [...filteredTickets].sort(
    (a,b)=>
    (severityOrder[b.severity_calculated]||0)-
    (severityOrder[a.severity_calculated]||0)
  );

},[filteredTickets,sortSeverity]);

/* =========================
   PAGINATION
========================= */
const totalPages=Math.ceil(sortedTickets.length/ticketsPerPage);

const indexOfLast=currentPage*ticketsPerPage;
const indexOfFirst=indexOfLast-ticketsPerPage;

const currentTickets=sortedTickets.slice(indexOfFirst,indexOfLast);

useEffect(()=>{
  setCurrentPage(1);
},[filter,search,sortSeverity,severityFilter]);

/* =========================
   KPI
========================= */
const openCount=tickets.filter(t=>t.status==="Open").length;
const ackCount=tickets.filter(t=>t.status==="ACK").length;
const resolvedCount=tickets.filter(t=>t.status==="Resolved").length;
const conflictCount=tickets.filter((ticket)=>getSyncState(ticket)==="conflict").length;
const outOfSyncCount=tickets.filter((ticket)=>getSyncState(ticket)==="out_of_sync").length;

/* =========================
   UI
========================= */
return(

<div className="p-8 bg-gray-100 min-h-screen">

{/* HEADER */}
<div className="flex justify-between mb-8">

<h1 className="text-2xl font-bold">LNMS Tickets</h1>

<div className="flex items-center text-green-600 text-sm">
<span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
Live • Auto refresh
</div>

</div>

{/* KPI */}
<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">

<KPI title="Total Tickets" value={tickets.length}/>
<KPI title="Open" value={openCount} color="text-red-600"/>
<KPI title="ACK (CNMS)" value={ackCount} color="text-yellow-600"/>
<KPI title="Resolved" value={resolvedCount} color="text-green-600"/>
<KPI title="Conflicts" value={conflictCount} color="text-red-700"/>
<KPI title="Out of Sync" value={outOfSyncCount} color="text-orange-600"/>

</div>

{/* FILTER */}
<div className="flex gap-3 mb-6 flex-wrap">

{["All","Open","ACK","Resolved","Closed"].map(tab=>(
<button
key={tab}
onClick={()=>setFilter(tab)}
className={`px-4 py-2 rounded-xl text-sm ${
filter===tab
?"bg-blue-600 text-white"
:"bg-white shadow"
}`}
>
{tab}
</button>
))}

</div>

{/* SEARCH + SEVERITY */}
<div className="flex gap-4 mb-6 flex-wrap">

<input
type="text"
placeholder="Search ticket / device / title"
value={search}
onChange={(e)=>setSearch(e.target.value)}
className="px-4 py-2 border rounded-xl w-64"
/>

<select
value={severityFilter}
onChange={(e)=>setSeverityFilter(e.target.value)}
className="px-4 py-2 border rounded-xl"
>
<option value="All">All Severity</option>
<option value="Critical">Critical</option>
<option value="Major">Major</option>
<option value="Minor">Minor</option>
</select>

</div>

{/* TABLE */}
<div className="bg-white shadow rounded-2xl p-6 overflow-x-auto">

<table className="w-full text-sm">

<thead className="text-gray-500 border-b">

<tr>
<th className="text-left py-2">ID</th>
<th className="text-left py-2">Title</th>
<th className="text-left py-2">Device</th>

<th
className="cursor-pointer text-left py-2"
onClick={()=>setSortSeverity(!sortSeverity)}
>
Severity
</th>

<th>Status</th>
<th>Sync</th>
<th>Sent to CNMS</th>
<th>Resolved Time</th>
<th>Created</th>
<th>View</th>

</tr>

</thead>

<tbody>

{currentTickets.map(ticket=>(

<tr key={ticket.ticket_id} className="border-b hover:bg-gray-50">

<td className="py-3">{getDisplayTicketId(ticket)}</td>
<td className="py-3">{ticket.title}</td>
<td className="py-3">{ticket.device_name}</td>
<td className="py-3">{ticket.severity_calculated}</td>

<td>
<StatusBadge status={ticket.status}/>
</td>

<td className="py-3">
<SyncBadge status={getSyncState(ticket)}/>
</td>

{/* ✅ FIXED COLUMN */}
<td>
{ticket.sent_to_cnms_at
? (
  <span className="text-green-600 font-medium">
    {formatTime(ticket.sent_to_cnms_at)}
  </span>
)
: (
  <span className="text-yellow-600 font-medium">
    Pending
  </span>
)}
</td>

<td>
{ticket.resolved_at
? formatTime(ticket.resolved_at)
: "—"}
</td>

<td>
{formatTime(ticket.created_at)}
</td>

<td>
<Link
to={`/tickets/${ticket.ticket_id}`}
className="px-3 py-1 bg-gray-800 text-white rounded text-xs"
>
View
</Link>
</td>

</tr>

))}

</tbody>

</table>

</div>

{/* PAGINATION */}
<div className="flex justify-center items-center gap-3 mt-6">

<button
onClick={()=>setCurrentPage(p=>Math.max(p-1,1))}
disabled={currentPage===1}
className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
>
Prev
</button>

{Array.from({length:totalPages},(_,i)=>(
<button
key={i}
onClick={()=>setCurrentPage(i+1)}
className={`px-3 py-1 rounded ${
currentPage===i+1
?"bg-blue-600 text-white"
:"bg-gray-200"
}`}
>
{i+1}
</button>
))}

<button
onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages))}
disabled={currentPage===totalPages}
className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
>
Next
</button>

</div>

</div>

);

}

/* KPI */
function KPI({title,value,color}){

return(
<div className="bg-white p-4 rounded-xl shadow">
<p className="text-xs text-gray-400">{title}</p>
<p className={`text-xl font-bold ${color||""}`}>
{value}
</p>
</div>
);

}

function getSyncState(ticket){
const explicitStatus=String(ticket.sync_status||ticket.syncState||"").toLowerCase();
const hasConflict=Boolean(
ticket.sync_conflict||
ticket.has_conflict||
ticket.conflict_detected||
ticket.conflict
)||explicitStatus==="conflict";

if(hasConflict) return "conflict";

const outOfSync=Boolean(
ticket.out_of_sync||
ticket.is_out_of_sync||
ticket.sync_pending
)||explicitStatus==="out_of_sync";

if(outOfSync) return "out_of_sync";
if(ticket.sent_to_cnms_at||ticket.last_synced_at||explicitStatus==="synced") return "synced";
return "pending";
}

function SyncBadge({status}){
const styles={
synced:"bg-emerald-100 text-emerald-700",
pending:"bg-amber-100 text-amber-700",
out_of_sync:"bg-orange-100 text-orange-700",
conflict:"bg-red-100 text-red-700"
};

const labels={
synced:"Synced",
pending:"Pending",
out_of_sync:"Out of Sync",
conflict:"Conflict"
};

return(
<span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]||styles.pending}`}>
{labels[status]||labels.pending}
</span>
);
}

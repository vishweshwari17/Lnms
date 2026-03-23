export default function SLARisk(){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="font-semibold text-gray-700 mb-6">
SLA Risk Monitor
</h2>

<div className="space-y-4">

<div>

<div className="flex justify-between text-sm mb-1">
<span>High Risk</span>
<span className="text-red-500 font-semibold">3</span>
</div>

<div className="w-full bg-gray-200 h-2 rounded">
<div className="bg-red-500 h-2 rounded w-1/5"></div>
</div>

</div>


<div>

<div className="flex justify-between text-sm mb-1">
<span>Medium Risk</span>
<span className="text-yellow-500 font-semibold">5</span>
</div>

<div className="w-full bg-gray-200 h-2 rounded">
<div className="bg-yellow-500 h-2 rounded w-2/5"></div>
</div>

</div>


<div>

<div className="flex justify-between text-sm mb-1">
<span>Safe</span>
<span className="text-green-500 font-semibold">12</span>
</div>

<div className="w-full bg-gray-200 h-2 rounded">
<div className="bg-green-500 h-2 rounded w-3/5"></div>
</div>

</div>

</div>

</div>

);
}
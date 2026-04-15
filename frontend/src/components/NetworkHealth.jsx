export default function NetworkHealth({ healthScore }) {

  return (

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="font-semibold text-gray-700 mb-6">
Network Health Score
</h2>

<div className="flex items-center gap-6">

<div className="w-32 h-32 rounded-full border-8 border-green-500 flex items-center justify-center text-2xl font-bold text-green-600">

{healthScore}%

</div>

<div className="flex-1">

<p className="text-gray-500 text-sm mb-2">
Overall network performance
</p>

<div className="w-full bg-gray-200 rounded-full h-3">

<div
className="bg-green-500 h-3 rounded-full"
style={{width:`${healthScore}%`}}
></div>

</div>

</div>

</div>

</div>

  );
}
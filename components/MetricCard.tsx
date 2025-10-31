export default function MetricCard({ title, value, note, accent = "emerald" }: { title: string; value: string; note?: string; accent?: "emerald" | "sky" | "amber" | "rose" }) {
  const ring = {
    emerald: "ring-emerald-300",
    sky: "ring-sky-300",
    amber: "ring-amber-300",
    rose: "ring-rose-300",
  }[accent]
  const bar = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[accent]
  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm ring-1 ${ring}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-block h-2 w-2 rounded-full ${bar}`} />
        <div className="text-sm text-zinc-600">{title}</div>
      </div>
      <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      {note && <div className="text-xs text-zinc-500 mt-1">{note}</div>}
    </div>
  )
}
  
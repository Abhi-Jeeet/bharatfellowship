export default function MetricCard({ title, value, note, accent = "emerald", icon }: { title: string; value: string; note?: string; accent?: "emerald" | "sky" | "amber" | "rose"; icon?: React.ReactNode }) {
  const ring = {
    emerald: "ring-emerald-300",
    sky: "ring-sky-300",
    amber: "ring-amber-300",
    rose: "ring-rose-300",
  }[accent]
  const grad = {
    emerald: "bg-linear-to-br from-emerald-50 to-white",
    sky: "bg-linear-to-br from-sky-50 to-white",
    amber: "bg-linear-to-br from-amber-50 to-white",
    rose: "bg-linear-to-br from-rose-50 to-white",
  }[accent]
  const dot = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[accent]
  return (
    <div className={`p-4 rounded-xl shadow-sm ring-1 ${ring} ${grad}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          <div className="text-sm text-zinc-700 font-medium">{title}</div>
        </div>
        {icon && <div className="opacity-70">{icon}</div>}
      </div>
      <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      {note && <div className="text-xs text-zinc-600 mt-1">{note}</div>}
    </div>
  )
}
  
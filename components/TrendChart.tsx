"use client"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, AreaChart } from 'recharts'

export default function TrendChart({ data }: { data: any[] }) {
  // expect data = [{ month: 'Apr', individuals: 123, households: 98, wage: 300 }, ...]
  const order = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
  const idx = (m: string) => {
    const key = (m || '').slice(0,3)
    const i = order.indexOf(key)
    return i === -1 ? 99 : i
  }
  const ordered = [...(data || [])].sort((a,b)=> idx(a.month) - idx(b.month))
  return (
    <div className="bg-white p-3 rounded-xl shadow-sm ring-1 ring-sky-200">
      <h3 className="text-sm text-sky-700 mb-2">12-month trend</h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={ordered} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v:any, n:any)=> [Number(v).toLocaleString('en-IN'), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="individuals" name="Individuals" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="households" name="Households" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

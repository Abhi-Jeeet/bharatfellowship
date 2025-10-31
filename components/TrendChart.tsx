"use client"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function TrendChart({ data }: { data: any[] }) {
  // expect data = [{ month: 'Jan 2025', value: 12.3 }, ...]
  return (
    <div className="bg-white p-3 rounded-xl shadow-sm ring-1 ring-sky-200">
      <h3 className="text-sm text-sky-700 mb-2">Trend (last months)</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

"use client"
import { useEffect, useState } from "react"
import DistrictSelector from "../components/DistrictSelector"
import MetricCard from "../components/MetricCard"
import TrendChart from "../components/TrendChart"
import MetricInfo from "../components/MetricInfo"

export default function Page() {
  const [state, setState] = useState('Jharkhand')
  const [district, setDistrict] = useState('Ranchi')
  const [finYear, setFinYear] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`
  })
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'cards'|'table'>("cards")
  const [compare, setCompare] = useState(false)
  const [districtB, setDistrictB] = useState<string>('Dhanbad')
  const [recordsB, setRecordsB] = useState<any[]>([])
  const [cacheStatus, setCacheStatus] = useState<string>('')
  const [dataCount, setDataCount] = useState<{ received: number; total?: number }>({ received: 0 })
  const [limit, setLimit] = useState<number>(200)
  const [offset, setOffset] = useState<number>(0)

  useEffect(() => {
    fetchData(state, district, finYear)
  }, [state, district, finYear, limit, offset])

  useEffect(() => {
    if (compare) fetchDataB(state, districtB, finYear)
  }, [compare, state, districtB, finYear])

  async function fetchData(s: string, d: string, fy: string) {
    const cacheKey = `mgnrega:${s}:${d}:${fy}:${limit}:${offset}`
    
    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
          setCacheStatus('Client cache (localStorage)')
          setRecords(parsed.data || [])
          setDataCount({ received: parsed.data?.length || 0, total: parsed.total })
          // Still fetch fresh in background
        }
      }
    } catch {}

    try {
      setLoading(true)
      const res = await fetch(`/api/mgnrega?state=${encodeURIComponent(s)}&district=${encodeURIComponent(d)}&fin_year=${encodeURIComponent(fy)}&limit=${limit}&offset=${offset}`)
      const json = await res.json()
      const source = json.source || 'unknown'
      setCacheStatus(source === 'cache' ? 'Server cache (1hr TTL)' : source === 'cache-stale' ? 'Stale cache (upstream failed)' : 'Fresh from API')
      
      const recs: any[] = json.records || []
      setDataCount({ received: recs.length, total: json.total })
      
      // De-duplicate by month within FY (some datasets emit duplicate revisions)
      const byMonth = new Map<string, any>()
      for (const r of recs) {
        const key = `${(r.month||'').trim()}__${(r.fin_year||'').trim()}`
        const current = byMonth.get(key)
        if (!current) {
          byMonth.set(key, r)
        } else {
          // Choose the row with the larger "score" based on core totals
          const score = (x: any) =>
            Number(x.Total_Individuals_Worked||0) +
            Number(x.Total_Households_Worked||0) +
            Number(x.Total_Exp||0)
          if (score(r) > score(current)) byMonth.set(key, r)
        }
      }

      const deduped = Array.from(byMonth.values())

      // Sort month-wise in financial-year order: Apr..Mar
      const order = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      const idx = (m: string) => {
        const i = order.indexOf((m || '').slice(0,3))
        return i === -1 ? 99 : i
      }
      const sorted = [...deduped].sort((a,b) => idx(a.month) - idx(b.month))
      setRecords(sorted)
      
      // Save to localStorage cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: sorted, total: json.total }))
      } catch {}
    } catch (e) {
      console.error(e)
      // Fallback to localStorage if network fails
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          setRecords(parsed.data || [])
          setCacheStatus('Offline: Using cached data')
        } else {
          setRecords([])
          setCacheStatus('Error: No cache available')
        }
      } catch {
        setRecords([])
        setCacheStatus('Error: Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchDataB(s: string, d: string, fy: string) {
    try {
      const res = await fetch(`/api/mgnrega?state=${encodeURIComponent(s)}&district=${encodeURIComponent(d)}&fin_year=${encodeURIComponent(fy)}&limit=100`)
      const json = await res.json()
      const recs: any[] = json.records || []
      const byMonth = new Map<string, any>()
      for (const r of recs) {
        const key = `${(r.month||'').trim()}__${(r.fin_year||'').trim()}`
        if (!byMonth.has(key)) byMonth.set(key, r)
      }
      const order = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      const idx = (m: string) => { const i = order.indexOf((m||'').slice(0,3)); return i===-1?99:i }
      const sorted = Array.from(byMonth.values()).sort((a,b)=> idx(a.month)-idx(b.month))
      setRecordsB(sorted)
    } catch {
      setRecordsB([])
    }
  }

  // derive metrics from records
  const latest = records[0] || {}
  const households = latest.Total_Households_Worked || '—'
  const individuals = latest.Total_Individuals_Worked || '—'
  const avgWage = latest.Average_Wage_rate_per_day_per_person || '—'
  const pct15 = latest.percentage_payments_gererated_within_15_days || latest.percentage_payments_generated_within_15_days || '—'

  // build trend for last 6 months (use persondays_generated_lakh)
  const trend = records.slice(0, 6).map(r => ({
    month: r.month,
    value: Number(r.Total_Individuals_Worked || 0)
  })).reverse()

  // dynamic table headers from dataset
  const allFields: string[] = records[0] ? Object.keys(records[0]) : []
  const preferredOrder = [
    'month','fin_year','state_name','district_name',
    'Total_Households_Worked','Total_Individuals_Worked',
    'Average_Wage_rate_per_day_per_person','Wages','Total_Exp',
    'Women_Persondays','Number_of_Completed_Works','Number_of_Ongoing_Works',
    'Total_No_of_Active_Workers','Total_No_of_Active_Job_Cards'
  ]
  const orderedFields = allFields.sort((a,b)=>{
    const ia = preferredOrder.indexOf(a); const ib = preferredOrder.indexOf(b)
    return (ia===-1?999:ia) - (ib===-1?999:ib)
  })

  function labelize(key: string){
    return key.replaceAll('_',' ').replace(/\b([a-z])/g,(m)=>m.toUpperCase())
  }

  const displayKeys = orderedFields.slice(0, 14)

  function toNumber(x:any){ const n = Number(x); return Number.isFinite(n)? n : undefined }
  function fmtIN(x:any){ const n = toNumber(x); return n===undefined? String(x ?? '—') : n.toLocaleString('en-IN') }

  function downloadCsv(){
    if(!records.length) return
    const cols = orderedFields
    const head = cols.join(',')
    const lines = records.map(r=> cols.map(k=> JSON.stringify((r?.[k]??'')).replace(/^"|"$/g,'')).join(','))
    const csv = [head, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mgnrega_${state}_${district}_${finYear}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen w-full bg-linear-to-b from-emerald-50 via-sky-50 to-white px-2 sm:px-4">
      <section className="mb-4">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-zinc-200 p-3">
          <DistrictSelector onChange={(s, d, fy) => { setState(s); setDistrict(d); setFinYear(fy) }} />
          {cacheStatus && (
            <div className="mt-2 text-xs text-zinc-600 flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-zinc-100">📦 {cacheStatus}</span>
              {dataCount.received > 0 && (
                <span className="px-2 py-1 rounded bg-zinc-100">
                  {dataCount.received} records{dataCount.total && ` of ${dataCount.total} total`}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard accent="emerald" title="इस महीने लाभार्थी" value={formatNumber(households)} note="Households worked" />
        <MetricCard accent="sky" title="काम करने वाले व्यक्ति" value={formatNumber(individuals)} note="Individuals worked" />
        <MetricCard accent="amber" title="औसत वेतन (₹)" value={formatNumber(avgWage)} note={`Paid within 15 days: ${formatNumber(pct15)}%`} />
      </section>

      <MetricInfo />

      <section className="mb-2 flex items-center gap-2">
        <button onClick={()=>setView('cards')} className={`px-3 py-1.5 rounded-lg text-sm ${view==='cards'?'bg-emerald-600 text-white':'bg-white ring-1 ring-zinc-200'}`}>Readable</button>
        <button onClick={()=>setView('table')} className={`px-3 py-1.5 rounded-lg text-sm ${view==='table'?'bg-emerald-600 text-white':'bg-white ring-1 ring-zinc-200'}`}>All fields</button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-zinc-700 flex items-center gap-2"><input type="checkbox" checked={compare} onChange={(e)=>setCompare(e.target.checked)} /> Compare district</label>
          {compare && (
            <ComparePicker value={districtB} onChange={setDistrictB} />
          )}
        </div>
      </section>

      <section className="mb-4">
        {loading ? <div className="text-center py-12">Loading...</div> :
          <TrendChart data={trend} />
        }
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Monthly data</h2>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-zinc-700">Limit
              <select value={limit} onChange={(e)=>{ setOffset(0); setLimit(Number(e.target.value)) }} className="ml-1 p-1 rounded border">
                {[50,100,200,500].map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <button disabled={offset===0} onClick={()=> setOffset(Math.max(0, offset - limit))} className="px-2 py-1 rounded-lg text-sm bg-white ring-1 ring-zinc-200 disabled:opacity-50">Prev</button>
            <button disabled={dataCount.total!==undefined && (offset + limit) >= (dataCount.total||0)} onClick={()=> setOffset(offset + limit)} className="px-2 py-1 rounded-lg text-sm bg-white ring-1 ring-zinc-200 disabled:opacity-50">Next</button>
            <button onClick={downloadCsv} className="px-3 py-1.5 rounded-lg text-sm bg-sky-600 text-white">Download CSV</button>
          </div>
        </div>
        {records.length === 0 && <p className="text-sm text-gray-500">No data available</p>}

        {view==='cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {records.slice(0, 24).map((r,i)=> (
              <div key={i} className="bg-white rounded-xl shadow-sm ring-1 ring-emerald-200 p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-semibold text-zinc-800">{r.month} · {r.fin_year}</div>
                  <div className="text-xs text-zinc-500">{r.district_name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {displayKeys.filter(k=>!['month','fin_year','state_name','district_name'].includes(k)).map(k=> (
                    <div key={k} className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1">
                      <span className="text-zinc-500">{labelize(k)}</span>
                      <span className="font-medium text-zinc-800">{fmtIN(r[k])}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm ring-1 ring-zinc-200">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-zinc-50 sticky top-0">
                <tr>
                  {orderedFields.map((k) => (
                    <th key={k} className="text-left px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">{labelize(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    {orderedFields.map((k) => (
                      <td key={k} className="px-3 py-2 text-zinc-800 whitespace-nowrap">{fmtIN((r as any)[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {compare && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Comparison: {district} vs {districtB}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CompareCard title={`Individuals worked · ${district}`} data={records} />
            <CompareCard title={`Individuals worked · ${districtB}`} data={recordsB} />
          </div>
        </section>
      )}
      </main>
  )
}

function formatNumber(x: any) {
  if (x === '—' || x === undefined || x === null) return '—'
  return String(x)
}

function ComparePicker({ value, onChange }: { value: string; onChange: (v: string)=>void }) {
  const [options, setOptions] = useState<string[]>([] as string[])
  useEffect(()=>{
    (async ()=>{
      try {
        const res = await fetch('/data/jharkhand_districts.json')
        const json = await res.json()
        setOptions(json)
      } catch { setOptions([]) }
    })()
  },[])
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)} className="p-2 rounded border">
      {options.map((d)=> <option key={d} value={d}>{d}</option>)}
    </select>
  )
}

function CompareCard({ title, data }: { title: string; data: any[] }) {
  const series = data.map(r=> ({ month: r.month, value: Number(r.Total_Individuals_Worked||0) }))
  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 p-3">
      <div className="text-sm text-zinc-700 mb-2">{title}</div>
      <TrendChart data={series} />
    </div>
  )
}

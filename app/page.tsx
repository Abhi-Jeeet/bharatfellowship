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
  const [rawRecords, setRawRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'cards'|'table'>("cards")
  const [compare, setCompare] = useState(false)
  const [districtB, setDistrictB] = useState<string>('Dhanbad')
  const [recordsB, setRecordsB] = useState<any[]>([])
  const [cacheStatus, setCacheStatus] = useState<string>('')
  const [dataCount, setDataCount] = useState<{ received: number; total?: number }>({ received: 0 })
  const [limit, setLimit] = useState<number>(200)
  const [offset, setOffset] = useState<number>(0)
  const [loadingAll, setLoadingAll] = useState<boolean>(false)
  const [kpiRecord, setKpiRecord] = useState<any>({})
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalMonth, setModalMonth] = useState<string>("")
  const [modalFY, setModalFY] = useState<string>("")

  // Current month/year (calendar) and current FY string (Apr–Mar)
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const now = new Date()
  const currentMonthShort = monthShort[now.getMonth()]
  const y = now.getFullYear()
  const currentFY = now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`
  const apiPreview = `/api/mgnrega?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}&fin_year=${encodeURIComponent(finYear)}&limit=${limit}&offset=${offset}`

  useEffect(() => {
    // Reset counters when FY or selection changes
    setCacheStatus('')
    setDataCount({ received: 0 })
    fetchData(state, district, finYear)
  }, [state, district, finYear, limit, offset])

  // Always fetch KPI for current month/current FY irrespective of FY selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/mgnrega?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}&fin_year=${encodeURIComponent(currentFY)}&limit=500`)
        const json = await res.json()
        const recs: any[] = json.records || []
        // Filter to current calendar month label (matching first 3 letters)
        const target = recs.filter(r => String(r.month||'').slice(0,3).toLowerCase() === currentMonthShort.toLowerCase())
        const byMonth = new Map<string, any>()
        for (const r of target) {
          const key = `${(r.month||'').trim()}__${(r.fin_year||'').trim()}`
          const current = byMonth.get(key)
          if (!current) byMonth.set(key, r)
          else {
            const score = (x: any) => Number(x.Total_Exp||0)*1000 + Number(x.Total_Individuals_Worked||0)*10 + Number(x.Total_Households_Worked||0)
            if (score(r) > score(current)) byMonth.set(key, r)
          }
        }
        const val = Array.from(byMonth.values())[0] || {}
        setKpiRecord(val)
      } catch {
        setKpiRecord({})
      }
    })()
  }, [state, district])

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
      const cacheType = json.cacheType || ''
      if (source === 'cache') {
        const cacheLabel = cacheType === 'Upstash' ? 'Upstash cache (24hr TTL)' : cacheType === 'Redis' ? 'Redis cache (24hr TTL)' : cacheType === 'In-memory' ? 'In-memory cache (24hr TTL)' : 'Server cache (24hr TTL)'
        setCacheStatus(cacheLabel)
      } else if (source === 'cache-stale') {
        setCacheStatus('Stale cache (upstream failed)')
      } else {
        setCacheStatus(cacheType ? `Fresh from API (using ${cacheType} cache)` : 'Fresh from API')
      }
      
      const recs: any[] = json.records || []
      setRawRecords(recs)
      setDataCount({ received: recs.length, total: json.total })
      
      // De-duplicate by month within FY (pick latest snapshot - highest cumulative values)
      const byMonth = new Map<string, any>()
      for (const r of recs) {
        const key = `${(r.month||'').trim()}__${(r.fin_year||'').trim()}`
        const current = byMonth.get(key)
        if (!current) {
          byMonth.set(key, r)
        } else {
          // Score: prefer latest snapshot (highest cumulative totals)
          // These fields typically only increase as data gets updated
          const score = (x: any) =>
            Number(x.Total_Exp||0) * 1000 + // Most important indicator
            Number(x.Total_Individuals_Worked||0) * 10 +
            Number(x.Total_Households_Worked||0) +
            Number(x.Total_No_of_JobCards_issued||0) * 0.01 + // Cumulative total
            Number(x.Total_No_of_Workers||0) * 0.01 // Cumulative total
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

  async function fetchAllPages(s: string, d: string, fy: string) {
    setLoadingAll(true)
    try {
      const pageSize = limit
      let nextOffset = 0
      let total = Infinity as number
      const all: any[] = []
      while (nextOffset < total) {
        const url = `/api/mgnrega?state=${encodeURIComponent(s)}&district=${encodeURIComponent(d)}&fin_year=${encodeURIComponent(fy)}&limit=${pageSize}&offset=${nextOffset}`
        const res = await fetch(url)
        const json = await res.json()
        const recs: any[] = json.records || []
        total = Number(json.total || (nextOffset + recs.length))
        all.push(...recs)
        if (recs.length < pageSize) break
        nextOffset += pageSize
      }

      // Deduplicate and sort (pick latest snapshot)
      const byMonth = new Map<string, any>()
      for (const r of all) {
        const key = `${(r.month||'').trim()}__${(r.fin_year||'').trim()}__${(r.district_name||'').trim()}`
        const current = byMonth.get(key)
        if (!current) {
          byMonth.set(key, r)
        } else {
          // Score: prefer latest snapshot (highest cumulative totals)
          const score = (x: any) =>
            Number(x.Total_Exp||0) * 1000 +
            Number(x.Total_Individuals_Worked||0) * 10 +
            Number(x.Total_Households_Worked||0) +
            Number(x.Total_No_of_JobCards_issued||0) * 0.01 +
            Number(x.Total_No_of_Workers||0) * 0.01
          if (score(r) > score(current)) byMonth.set(key, r)
        }
      }
      const order = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      const idx = (m: string) => { const i = order.indexOf((m||'').slice(0,3)); return i===-1?99:i }
      const sorted = Array.from(byMonth.values()).sort((a,b)=> idx(a.month)-idx(b.month))
      setRecords(sorted)
      setDataCount({ received: sorted.length, total })
      setCacheStatus('Merged pages')
    } finally {
      setLoadingAll(false)
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

  // KPI metrics should always show current calendar month of current FY
  const latest = Object.keys(kpiRecord).length ? kpiRecord : (records.length > 0 ? records[records.length - 1] : {})
  const households = latest.Total_Households_Worked || '—'
  const individuals = latest.Total_Individuals_Worked || '—'
  const avgWage = latest.Average_Wage_rate_per_day_per_person || '—'
  const pct15 = latest.percentage_payments_gererated_within_15_days || latest.percentage_payments_generated_within_15_days || '—'

  // build trend for last 12 months (FY-aware), include multiple series
  const trend = records.length > 0 
    ? records.slice(-12).map(r => ({
        month: r.month,
        individuals: Number(r.Total_Individuals_Worked || 0),
        households: Number(r.Total_Households_Worked || 0)
      }))
    : []

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
          <DistrictSelector onChange={(s, d, fy) => { setState(s); setDistrict(d); setFinYear(fy); setOffset(0) }} />
          {cacheStatus && (
            <div className="mt-2 text-xs text-zinc-600 flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-zinc-100">📦 {cacheStatus}</span>
              {dataCount.received > 0 && (
                <span className="px-2 py-1 rounded bg-zinc-100">
                  {dataCount.received} records{dataCount.total && ` of ${dataCount.total} total`}
                </span>
              )}
              <a href={apiPreview} target="_blank" className="px-2 py-1 rounded bg-zinc-100 text-blue-700 underline">Open API URL</a>
            </div>
          )}
        </div>
      </section>

      <section id="highlights" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <MetricCard icon={<span>🏠</span>} accent="emerald" title={`इस महीने लाभार्थी — ${currentMonthShort} · ${currentFY}`} value={formatNumber(households)} note="Households worked (current month)" />
        <MetricCard icon={<span>👷</span>} accent="sky" title={`काम करने वाले व्यक्ति — ${currentMonthShort} · ${currentFY}`} value={formatNumber(individuals)} note="Individuals worked (current month)" />
        <MetricCard icon={<span>₹</span>} accent="amber" title={`औसत वेतन (₹) — ${currentMonthShort} · ${currentFY}`} value={formatNumber(avgWage)} note={`Paid within 15 days: ${formatNumber(pct15)}%`} />
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

      <section id="trends" className="mb-4">
        {loading ? <div className="text-center py-12">Loading...</div> :
          <TrendChart key={`${state}-${district}-${finYear}`} data={trend} />
        }
      </section>

      <section id="monthly">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Monthly data</h2>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-zinc-700">Limit
              <select value={limit} onChange={(e)=>{ setOffset(0); setLimit(Number(e.target.value)) }} className="ml-1 p-1 rounded border">
                {[50,100,200,500].map(v=> <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-700">Offset
              <input type="number" min={0} value={offset} onChange={(e)=> setOffset(Math.max(0, Number(e.target.value)||0))} className="ml-1 p-1 w-24 rounded border" />
            </label>
            <button disabled={offset===0} onClick={()=> setOffset(Math.max(0, offset - limit))} className="px-2 py-1 rounded-lg text-sm bg-white ring-1 ring-zinc-200 disabled:opacity-50">Prev</button>
            <button disabled={dataCount.total!==undefined && (offset + limit) >= (dataCount.total||0)} onClick={()=> setOffset(offset + limit)} className="px-2 py-1 rounded-lg text-sm bg-white ring-1 ring-zinc-200 disabled:opacity-50">Next</button>
            <button onClick={()=> fetchAllPages(state, district, finYear)} disabled={loadingAll} className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white disabled:opacity-50">{loadingAll? 'Merging…' : 'Fetch all pages'}</button>
            <button onClick={downloadCsv} className="px-3 py-1.5 rounded-lg text-sm bg-sky-600 text-white">Download CSV</button>
          </div>
        </div>
        {records.length === 0 && <p className="text-sm text-gray-500">No data available</p>}

        {view==='cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {records.slice(0, 24).map((r,i)=> (
              <button key={i} onClick={()=>{ setModalMonth(r.month); setModalFY(r.fin_year); setModalOpen(true) }} className="text-left bg-white rounded-xl shadow-sm ring-1 ring-emerald-200 p-3 hover:ring-emerald-300">
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
              </button>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={()=>setModalOpen(false)}>
          <div className="bg-white max-w-5xl w-full rounded-xl shadow-xl ring-1 ring-zinc-200 p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Monthly history — {modalMonth} · {modalFY} — {state} / {district}</h3>
              <button onClick={()=>setModalOpen(false)} className="px-3 py-1 rounded bg-zinc-100">Close</button>
            </div>
            <MonthSnapshots recs={rawRecords} month={modalMonth} finYear={modalFY} />
          </div>
        </div>
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
  const series = data.map(r=> ({
    month: r.month,
    individuals: Number(r.Total_Individuals_Worked || 0),
    households: Number(r.Total_Households_Worked || 0),
  }))
  return (
    <div className="bg-white rounded-xl ring-1 ring-zinc-200 p-3">
      <div className="text-sm text-zinc-700 mb-2">{title}</div>
      <TrendChart data={series} />
    </div>
  )
}

function MonthSnapshots({ recs, month, finYear }: { recs: any[]; month: string; finYear: string }) {
  const keyMatch = (r:any) => String(r.month||'').slice(0,3).toLowerCase() === String(month||'').slice(0,3).toLowerCase() && String(r.fin_year||'') === String(finYear||'')
  const arr = recs.filter(keyMatch)
  const score = (x: any) => Number(x.Total_Exp||0)*1000 + Number(x.Total_Individuals_Worked||0)*10 + Number(x.Total_Households_Worked||0)
  const sorted = arr.sort((a,b)=> score(a)-score(b))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-auto">
      {sorted.map((r, i) => (
        <div key={i} className="bg-white rounded-xl ring-1 ring-zinc-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Snapshot {i+1}</div>
            <div className="text-xs text-zinc-500">{r.district_name}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Households</span><span className="font-medium">{Number(r.Total_Households_Worked||0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Individuals</span><span className="font-medium">{Number(r.Total_Individuals_Worked||0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Avg Wage (₹)</span><span className="font-medium">{Number(r.Average_Wage_rate_per_day_per_person||0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Total Exp</span><span className="font-medium">{Number(r.Total_Exp||0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Completed Works</span><span className="font-medium">{Number(r.Number_of_Completed_Works||0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between bg-zinc-50 rounded-lg px-2 py-1"><span className="text-zinc-500">Ongoing Works</span><span className="font-medium">{Number(r.Number_of_Ongoing_Works||0).toLocaleString('en-IN')}</span></div>
          </div>
        </div>
      ))}
      {sorted.length===0 && <div className="text-sm text-zinc-600">No snapshots found for this month.</div>}
    </div>
  )
}

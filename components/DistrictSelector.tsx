"use client"
import { useState, useEffect } from "react"

export default function DistrictSelector({ onChange }: { onChange: (state: string, district: string, finYear: string) => void }) {
  const [state, setState] = useState(process.env.NEXT_PUBLIC_DEFAULT_STATE || 'Uttar Pradesh')
  const [district, setDistrict] = useState('Agra')
  const [finYear, setFinYear] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const fy = now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    return fy;
  })

  // minimal list to start — expand as needed
  const districts = state === 'Bihar'
    ? ['Patna', 'Gaya', 'Muzaffarpur', 'Ara']
    : ['Agra', 'Lucknow', 'Varanasi', 'Prayagraj']

  useEffect(() => {
    onChange(state, district, finYear)
  }, [state, district, finYear])

  async function detectLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords
      // reverse geocode via Nominatim
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
        const json = await res.json()
        const addr = json.address || {}
        // Nominatim may have different keys; try district or county or town
        const d = addr.county || addr.district || addr.town || addr.city || district
        setDistrict(d)
        // optionally set state using addr.state
        if (addr.state) setState(addr.state)
      } catch (e) {
        console.error(e)
      }
    }, (err) => {
      console.error(err)
    })
  }

  const finYears = (() => {
    const out: string[] = [];
    const now = new Date();
    const base = now.getFullYear();
    for (let i = 0; i < 7; i++) {
      const y = base - i;
      out.push(`${y - 1}-${y}`);
    }
    return out;
  })();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={state} onChange={(e) => setState(e.target.value)} className="p-2 rounded border">
          <option>Uttar Pradesh</option>
          <option>Bihar</option>
        </select>

        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="p-2 rounded border">
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={finYear} onChange={(e) => setFinYear(e.target.value)} className="p-2 rounded border">
          {finYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>

        <button onClick={detectLocation} className="px-3 py-2 bg-blue-600 text-white rounded">Auto-detect</button>
      </div>
      <p className="text-xs text-gray-500">Tip: Allow location to auto-select your district</p>
    </div>
  )
}

"use client"
import { useState, useEffect } from "react"
import JharkhandMap from "./JharkhandMap"

export default function DistrictSelector({ onChange }: { onChange: (state: string, district: string, finYear: string) => void }) {
  const [state, setState] = useState('Jharkhand')
  const [district, setDistrict] = useState('Ranchi')
  const [finYear, setFinYear] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const fy = now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    return fy;
  })
  const [detectedText, setDetectedText] = useState<string>("")
  const [viewMode, setViewMode] = useState<'dropdown' | 'map'>('dropdown')

  // Jharkhand districts
  const districts = [
    'Ranchi',
    'East Singhbhum',
    'West Singhbhum',
    'Seraikela Kharsawan',
    'Dhanbad',
    'Bokaro',
    'Hazaribagh',
    'Giridih',
    'Koderma',
    'Chatra',
    'Palamu',
    'Garhwa',
    'Latehar',
    'Lohardaga',
    'Gumla',
    'Simdega',
    'Khunti',
    'Ramgarh',
    'Deoghar',
    'Dumka',
    'Jamtara',
    'Godda',
    'Pakur',
    'Sahebganj'
  ]

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
        setDetectedText(`${d}${addr.state ? `, ${addr.state}` : ''}`)
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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    // Indian FY: Apr (3) to Mar (2). If we're in Apr or later, current FY is currentYear-currentYear+1
    const currentFYEnd = currentMonth >= 3 ? currentYear + 1 : currentYear;
    
    // Always include up to 2025-2026 (end year 2026)
    const maxEndYear = 2026;
    const startEndYear = Math.max(currentFYEnd, maxEndYear);
    
    // Generate from startEndYear backwards for 8 years
    for (let i = 0; i < 8; i++) {
      const endYear = startEndYear - i;
      if (endYear >= 2020) { // Don't go too far back
        out.push(`${endYear - 1}-${endYear}`);
      }
    }
    
    return out; // Most recent first
  })();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={state} onChange={(e) => setState(e.target.value)} className="p-2 rounded border">
            <option>Jharkhand</option>
          </select>

          {viewMode === 'dropdown' && (
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className="p-2 rounded border">
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          <select value={finYear} onChange={(e) => setFinYear(e.target.value)} className="p-2 rounded border">
            {finYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>

          <button onClick={detectLocation} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Auto-detect</button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('dropdown')}
            className={`px-3 py-2 rounded text-sm ${viewMode === 'dropdown' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
          >
            Dropdown
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-2 rounded text-sm ${viewMode === 'map' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
          >
            Map View
          </button>
        </div>
      </div>

      {viewMode === 'map' && (
        <div className="mt-2">
          <JharkhandMap 
            selectedDistrict={district} 
            onDistrictSelect={(d) => setDistrict(d)} 
          />
        </div>
      )}

      <p className="text-xs text-gray-500">
        {viewMode === 'dropdown' 
          ? "Tip: Allow location to auto-select your district" 
          : "Tip: Click on a district in the map to select it"}
      </p>
      {detectedText && (
        <p className="text-xs text-zinc-600">Detected location: {detectedText}</p>
      )}
    </div>
  )
}

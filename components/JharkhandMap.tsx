"use client"
import dynamic from "next/dynamic"

// Create a client-side only map component to avoid SSR issues with Leaflet
const MapComponent = dynamic(
  () => import("./JharkhandMapClient"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 p-4 h-[500px] flex items-center justify-center">
        <div className="text-zinc-600">Loading map...</div>
      </div>
    )
  }
)

interface JharkhandMapProps {
  selectedDistrict: string
  onDistrictSelect: (district: string) => void
}

export default function JharkhandMap(props: JharkhandMapProps) {
  return <MapComponent {...props} />
}

"use client"
import { useEffect, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix for Leaflet default icon in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  })
}

interface JharkhandMapProps {
  selectedDistrict: string
  onDistrictSelect: (district: string) => void
}

// Component to update map when selected district changes
function MapUpdater({ selectedDistrict }: { selectedDistrict: string }) {
  const map = useMap()
  
  useEffect(() => {
    // Optionally zoom to selected district or keep current view
    // map.setView([23.6102, 85.2799], 7)
  }, [selectedDistrict, map])
  
  return null
}

export default function JharkhandMapClient({ selectedDistrict, onDistrictSelect }: JharkhandMapProps) {
  const [geoJsonData, setGeoJsonData] = useState<any>(null)

  useEffect(() => {
    // Load GeoJSON data
    fetch("/data/jharkhand_districts.geojson")
      .then((res) => res.json())
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.error("Failed to load GeoJSON:", err))
  }, [])

  const getDistrictStyle = (feature: any) => {
    const isSelected = feature?.properties?.name === selectedDistrict
    return {
      fillColor: isSelected ? "#10b981" : "#94a3b8",
      fillOpacity: isSelected ? 0.7 : 0.4,
      color: isSelected ? "#059669" : "#64748b",
      weight: isSelected ? 3 : 1.5,
      opacity: 1,
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const districtName = feature.properties?.name || "Unknown"
    
    // Add tooltip
    layer.bindTooltip(districtName, {
      permanent: false,
      direction: "center",
      className: "map-tooltip"
    })

    // Add click handler
    layer.on({
      click: () => {
        onDistrictSelect(districtName)
      },
      mouseover: (e: any) => {
        const layer = e.target
        if (layer.feature.properties.name !== selectedDistrict) {
          layer.setStyle({
            fillColor: "#34d399",
            fillOpacity: 0.6,
            weight: 2,
          })
        }
      },
      mouseout: (e: any) => {
        const layer = e.target
        const isSelected = layer.feature.properties.name === selectedDistrict
        layer.setStyle({
          fillColor: isSelected ? "#10b981" : "#94a3b8",
          fillOpacity: isSelected ? 0.7 : 0.4,
          weight: isSelected ? 3 : 1.5,
        })
      },
    })
  }

  return (
    <div className="w-full bg-white rounded-xl shadow-sm ring-1 ring-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-700 mb-3">Click on a district to select</h3>
      <div className="w-full rounded-lg overflow-hidden" style={{ height: "500px" }}>
        <MapContainer
          center={[23.6102, 85.2799]}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geoJsonData && (
            <GeoJSON
              data={geoJsonData}
              style={getDistrictStyle}
              onEachFeature={onEachFeature}
            />
          )}
          <MapUpdater selectedDistrict={selectedDistrict} />
        </MapContainer>
      </div>
      {selectedDistrict && (
        <div className="mt-3 text-sm text-zinc-600">
          Selected: <span className="font-semibold text-emerald-600">{selectedDistrict}</span>
        </div>
      )}
      <style jsx global>{`
        .map-tooltip {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 500;
        }
        .leaflet-container {
          background-color: #f9fafb;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}


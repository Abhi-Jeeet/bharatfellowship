"use client"
import { useState } from "react"

export default function MetricInfo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3">
      <button onClick={()=>setOpen(!open)} className="px-3 py-1.5 text-sm rounded-lg bg-white ring-1 ring-zinc-200 hover:bg-zinc-50">
        {open? 'Hide help' : 'What do these mean?'}
      </button>
      {open && (
        <div className="mt-2 bg-white rounded-xl ring-1 ring-zinc-200 p-3 text-sm text-zinc-700">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>इस महीने लाभार्थी · Households worked</b>: महीने में काम पाने वाले घरों की संख्या।</li>
            <li><b>काम करने वाले व्यक्ति · Individuals worked</b>: महीने में काम पाने वाले लोगों की संख्या।</li>
            <li><b>औसत वेतन (₹) · Average wage</b>: एक दिन का औसत मजदूरी दर।</li>
            <li><b>15 दिन में भुगतान (%)</b>: कितने भुगतान 15 दिनों में पूरे हुए।</li>
          </ul>
        </div>
      )}
    </div>
  )
}



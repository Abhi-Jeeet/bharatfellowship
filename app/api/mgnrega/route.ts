import { NextResponse } from 'next/server'

type CacheEntry = { ts: number; data: any }
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const cache = new Map<string, CacheEntry>()

export async function GET(req: Request) {
  const url = new URL(req.url)
  const state = url.searchParams.get('state') || process.env.NEXT_PUBLIC_DEFAULT_STATE || 'Bihar'
  const district = url.searchParams.get('district') || ''
  const limit = url.searchParams.get('limit') || '200'
  const finYear = url.searchParams.get('fin_year') || ''

  const cacheKey = `${state}::${district}::${finYear}::${limit}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.ts < CACHE_TTL) {
    return NextResponse.json({ source: 'cache', records: cached.data })
  }

  // build data.gov.in request
  const resource = process.env.MGNREGA_RESOURCE_ID || process.env.RESOURCE_ID
  const apiKey = process.env.DATA_GOV_API_KEY || process.env.DATA_API_KEY
  if (!resource || !apiKey) {
    return NextResponse.json({ error: 'Missing RESOURCE_ID or DATA_API_KEY in env' }, { status: 500 })
  }

  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit
  })
  params.append('filters[state_name]', state)
  if (district) params.append('filters[district_name]', district)
  if (finYear) params.append('filters[fin_year]', finYear)

  const upstream = `https://api.data.gov.in/resource/${resource}?${params.toString()}`

  try {
    const r = await fetch(upstream, { next: { revalidate: 3600 } })
    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({ error: 'Upstream error', details: text }, { status: 502 })
    }
    const json = await r.json()
    let records = json.records || []

    // Fallback: if no records, retry with UPPERCASE filters (dataset often stores uppercase names)
    if (records.length === 0) {
      try {
        const p2 = new URLSearchParams({
          'api-key': apiKey,
          format: 'json',
          limit
        })
        p2.append('filters[state_name]', state.toUpperCase())
        if (district) p2.append('filters[district_name]', district.toUpperCase())
        if (finYear) p2.append('filters[fin_year]', finYear)
        const u2 = `https://api.data.gov.in/resource/${resource}?${p2.toString()}`
        const r2 = await fetch(u2, { next: { revalidate: 3600 } })
        if (r2.ok) {
          const j2 = await r2.json()
          records = j2.records || []
        }
      } catch {}
    }

    // cache
    cache.set(cacheKey, { ts: now, data: records })

    return NextResponse.json({ source: 'upstream', records })
  } catch (err) {
    // on failure, if cache exists return it
    if (cached) return NextResponse.json({ source: 'cache-stale', records: cached.data })
    return NextResponse.json({ error: 'Failed to fetch', details: String(err) }, { status: 500 })
  }
}

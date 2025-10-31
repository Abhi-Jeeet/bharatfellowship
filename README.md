## MGNREGA District Dashboard (Uttar Pradesh)

Citizen-facing dashboard to view monthly MGNREGA performance of a district (low-literacy friendly, bilingual).

### Setup

1) Install deps and run dev server:
```bash
npm install
npm run dev
```

2) Create environment variables (e.g. in `.env.local`):
```bash
DATA_GOV_API_KEY=your_api_key_here
MGNREGA_RESOURCE_ID=your_resource_id_here
```

The API proxy is available at `/api/mgnrega?state=Uttar%20Pradesh&district=Lucknow&month=01&year=2025`.

### Resilience & Caching

- Server in-memory TTL cache (24h) in `lib/cache.ts` to reduce upstream calls.
- Client-side localStorage cache for last-good copy per district-month.
- Next.js `revalidate` hints (24h) for CDN-friendly caching where available.
- If upstream fails or is rate-limited, UI shows cached data with a clear message.

For production scale, back the cache with Redis/KV and set up a daily warm-up job (e.g. Vercel Cron) to prefetch all UP districts.

### Geolocation

On load, the app requests location and uses OpenStreetMap Nominatim to detect state/district and pre-select if within Uttar Pradesh. User can override anytime.

### Extending

- Add other states by placing a JSON of districts under `public/data/` and wiring a selector.
- Map real field names from the MGNREGA dataset to update KPI derivations in `app/page.tsx`.
- Replace in-memory cache with Redis for multi-node deployments.


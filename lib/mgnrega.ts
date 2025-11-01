import { cache } from "./cache";

type MgnregaParams = {
  state: string;
  district: string;
  month?: string; // e.g., "Oct"
  year?: string; // e.g., "2025-2026"
  limit?: string; // optional api limit
  stateField?: string;
  districtField?: string;
  monthField?: string;
  yearField?: string;
};

export type MgnregaRecord = Record<string, unknown>;

export type MgnregaResponse = {
  ok: boolean;
  records: MgnregaRecord[];
  meta?: Record<string, unknown>;
  fromCache?: boolean;
  error?: string;
};

function buildCacheKey(params: MgnregaParams): string {
  const { state, district, month, year } = params;
  const m = month ?? "all";
  const y = year ?? "all";
  return `mgnrega:${state}:${district}:${y}-${m}`.toLowerCase();
}

function getBaseUrl(resourceId: string, apiKey: string): string {
  // data.gov.in resource format API
  // Example: https://api.data.gov.in/resource/<resource_id>?api-key=...&format=json
  return `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(
    apiKey
  )}&format=json`;
}

export async function fetchMgnregaMonthly(
  params: MgnregaParams
): Promise<MgnregaResponse> {
  const apiKey = process.env.DATA_GOV_API_KEY;
  const resourceId = process.env.MGNREGA_RESOURCE_ID;

  const key = buildCacheKey(params);
  const cached = await cache.get<MgnregaResponse>(key);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  if (!apiKey || !resourceId) {
    const message =
      "Missing DATA_GOV_API_KEY or MGNREGA_RESOURCE_ID env. Returning empty records.";
    const fallback: MgnregaResponse = { ok: false, records: [], error: message };
    return fallback;
  }

  const baseUrl = getBaseUrl(resourceId, apiKey);

  // Defaults matched to: ee03643a-ee4c-48c2-ac30-9f2ff26ab722
  // Fields: state_name, district_name, month (e.g., "Oct"), fin_year (e.g., "2025-2026")
  const stateField = params.stateField || process.env.MGNREGA_FIELD_STATE || "state_name";
  const districtField = params.districtField || process.env.MGNREGA_FIELD_DISTRICT || "district_name";
  const monthField = params.monthField || process.env.MGNREGA_FIELD_MONTH || "month";
  const yearField = params.yearField || process.env.MGNREGA_FIELD_YEAR || "fin_year";

  const url = new URL(baseUrl);
  url.searchParams.set(`filters[${stateField}]`, params.state);
  url.searchParams.set(`filters[${districtField}]`, params.district);
  if (params.month) url.searchParams.set(`filters[${monthField}]`, params.month);
  if (params.year) url.searchParams.set(`filters[${yearField}]`, params.year);
  // Increase limit to fetch single row or small set
  url.searchParams.set("limit", params.limit || "100");

  try {
    const res = await fetch(url.toString(), {
      // Next.js caching hint; still do our own TTL cache for resilience
      next: { revalidate: 24 * 60 * 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const errText = await res.text();
      const failure: MgnregaResponse = {
        ok: false,
        records: [],
        error: `Upstream error ${res.status}: ${errText}`,
      };
      return failure;
    }
    const json = (await res.json()) as { records?: MgnregaRecord[] };
    let records = json.records ?? [];

    // If no records for the requested month, try previous months (max 6) automatically
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;
    let usedFallback = false;
    let fallbackMonth: string | undefined;
    let fallbackYear: string | undefined;
    if (records.length === 0) {
      try {
        // Start from current date and go back up to 6 months
        const now = new Date();
        for (let i = 1; i <= 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mName = monthNames[d.getMonth()];
          const y = d.getFullYear();
          const finYear = d.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
          const tryUrl = new URL(baseUrl);
          tryUrl.searchParams.set(`filters[${stateField}]`, params.state);
          tryUrl.searchParams.set(`filters[${districtField}]`, params.district);
          tryUrl.searchParams.set(`filters[${monthField}]`, mName);
          tryUrl.searchParams.set(`filters[${yearField}]`, finYear);
          tryUrl.searchParams.set("limit", "100");
          const r = await fetch(tryUrl.toString(), { headers: { Accept: "application/json" } });
          if (r.ok) {
            const jj = (await r.json()) as { records?: MgnregaRecord[] };
            if ((jj.records ?? []).length > 0) {
              records = jj.records ?? [];
              usedFallback = true;
              fallbackMonth = mName;
              fallbackYear = finYear;
              break;
            }
          }
        }
      } catch {
        // ignore fallback errors
      }
    }

    // If still no records, probe schema with an unfiltered sample to help users map fields
    let meta: Record<string, unknown> | undefined = undefined;
    if (records.length === 0) {
      try {
        const probeUrl = new URL(baseUrl);
        probeUrl.searchParams.set("limit", "1");
        const probeRes = await fetch(probeUrl.toString(), { headers: { Accept: "application/json" } });
        if (probeRes.ok) {
          const probeJson = (await probeRes.json()) as { records?: MgnregaRecord[] };
          const sample = probeJson.records?.[0] || {};
          meta = { availableFields: Object.keys(sample) };
        }
      } catch {
        // ignore probe errors
      }
    }

    if (!meta) meta = {};
    if (usedFallback) {
      meta.usedFallback = true;
      meta.fallbackMonth = fallbackMonth;
      meta.fallbackYear = fallbackYear;
    }

    const value: MgnregaResponse = { ok: true, records, meta };

    // Cache for 24h by default
    await cache.set(key, value, 24 * 60 * 60 * 1000);
    return value;
  } catch (e) {
    const failure: MgnregaResponse = {
      ok: false,
      records: [],
      error: e instanceof Error ? e.message : "Unknown error",
    };
    return failure;
  }
}

export function formatMonthYear(date: Date): { month: string; year: string } {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return { month, year };
}



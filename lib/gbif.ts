/**
 * GBIF v1 occurrence search. Browser-side.
 * https://www.gbif.org/developer/occurrence
 * CORS-enabled.
 */
import { withCache } from "./cache";
import { resolveCounty } from "./county-resolver";

const API = "https://api.gbif.org/v1";

/**
 * iNaturalist research-grade observations are mirrored into GBIF as this
 * dataset. We already pull the same observations directly from the iNat API
 * with richer metadata, so filtering them here prevents double-counting in
 * the distribution aggregator and the records table.
 */
const INAT_DATASET_KEY = "50c9509d-22c7-4a22-a47d-8c48425ef4a7";

interface RawGbifOccurrence {
  key: number;
  occurrenceID?: string;
  scientificName?: string;
  stateProvince?: string;
  county?: string;
  eventDate?: string;
  year?: number;
  month?: number;
  day?: number;
  recordedBy?: string;
  identifiedBy?: string;
  references?: string;
  license?: string;
  basisOfRecord?: string;
  datasetKey?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
}

interface RawGbifResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  count: number;
  results: RawGbifOccurrence[];
}

export interface GbifOccurrence {
  id: number;
  county: string | null;
  date: string | null;
  observer: string | null;
  license: string | null;
  detailUrl: string;
}

function normalizeCounty(c: string | undefined): string | null {
  if (!c) return null;
  // GBIF often returns "Monroe County" — strip the suffix.
  return c.replace(/\s+County$/i, "").trim();
}

function formatDate(occ: RawGbifOccurrence): string | null {
  if (occ.eventDate) {
    // GBIF eventDate often "2024-06-14/2024-06-14" or "2024-06-14T00:00:00".
    return occ.eventDate.split("T")[0].split("/")[0];
  }
  if (occ.year && occ.month && occ.day) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${occ.year}-${pad(occ.month)}-${pad(occ.day)}`;
  }
  if (occ.year) return String(occ.year);
  return null;
}

export async function fetchGbifOccurrences(
  taxonKey: number,
  limit: number = 50,
  options: { force?: boolean } = {}
): Promise<GbifOccurrence[]> {
  if (!Number.isInteger(taxonKey) || taxonKey <= 0) return [];
  return withCache(
    "gbif-occ",
    `${taxonKey}-${limit}`,
    async () => {
      const params = new URLSearchParams({
        taxonKey: String(taxonKey),
        country: "US",
        stateProvince: "Indiana",
        hasCoordinate: "true",
        limit: String(limit),
      });
      const res = await fetch(`${API}/occurrence/search?${params.toString()}`);
      if (!res.ok) throw new Error(`GBIF ${res.status} ${res.statusText}`);
      const data = (await res.json()) as RawGbifResponse;
      // Drop iNat-sourced occurrences — we get those from the iNat API.
      const deduped = data.results.filter(
        (occ) => occ.datasetKey !== INAT_DATASET_KEY
      );
      // Resolve county from coords for any record missing the county field.
      const counties = await Promise.all(
        deduped.map(async (occ) => {
          const fromField = normalizeCounty(occ.county);
          if (fromField) return fromField;
          if (
            typeof occ.decimalLongitude === "number" &&
            typeof occ.decimalLatitude === "number"
          ) {
            return resolveCounty(occ.decimalLongitude, occ.decimalLatitude);
          }
          return null;
        })
      );
      return deduped.map((occ, i) => ({
        id: occ.key,
        county: counties[i],
        date: formatDate(occ),
        observer: occ.recordedBy || occ.identifiedBy || null,
        license: occ.license || null,
        detailUrl: `https://www.gbif.org/occurrence/${occ.key}`,
      }));
    },
    { force: options.force }
  );
}

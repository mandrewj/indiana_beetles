/**
 * Live county-level distribution for an Indiana species.
 * Merges GBIF + iNaturalist occurrence records and aggregates by county.
 * 24h localStorage cache.
 */
import { fetchGbifOccurrences } from "./gbif";
import { fetchINatObservations } from "./inaturalist";
import { withCache } from "./cache";
import { COUNTY_LOOKUP } from "./counties";
import { taxonIdOrNull } from "./types";

const PER_SOURCE_LIMIT = 300;

export interface LiveDistribution {
  /** Per-county record count. Counties with zero records are omitted. */
  countyCounts: Record<string, number>;
  /** Total records across both sources. */
  total: number;
  /** Per-source totals — used for the "0 records" guard. */
  gbifTotal: number;
  inatTotal: number;
}

const KNOWN_COUNTY_NAMES = new Set(Object.keys(COUNTY_LOOKUP));

function normalizeCounty(name: string | null | undefined): string | null {
  if (!name) return null;
  // Strip trailing "County", normalize "Saint" → "St.".
  let n = name.replace(/\s+County$/i, "").trim();
  if (n.startsWith("Saint ")) n = n.replace(/^Saint /, "St. ");
  if (KNOWN_COUNTY_NAMES.has(n)) return n;
  // Try a case-insensitive lookup.
  for (const known of KNOWN_COUNTY_NAMES) {
    if (known.toLowerCase() === n.toLowerCase()) return known;
  }
  return null;
}

export async function fetchLiveDistribution(species: {
  id: string;
  gbif_taxon_key: number | string | null;
  inat_taxon_id: number | string | null;
}): Promise<LiveDistribution> {
  const gbifKey = taxonIdOrNull(species.gbif_taxon_key);
  const inatId = taxonIdOrNull(species.inat_taxon_id);

  return withCache(
    "distribution",
    `${species.id}-${gbifKey ?? "x"}-${inatId ?? "x"}`,
    async () => {
      const [gbif, inat] = await Promise.all([
        gbifKey
          ? fetchGbifOccurrences(gbifKey, PER_SOURCE_LIMIT).catch(() => [])
          : Promise.resolve([]),
        inatId
          ? fetchINatObservations(inatId, PER_SOURCE_LIMIT).catch(() => [])
          : Promise.resolve([]),
      ]);

      const counts: Record<string, number> = {};
      for (const r of gbif) {
        const c = normalizeCounty(r.county);
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      }
      for (const r of inat) {
        const c = normalizeCounty(r.county);
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      }
      return {
        countyCounts: counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        gbifTotal: gbif.length,
        inatTotal: inat.length,
      };
    }
  );
}

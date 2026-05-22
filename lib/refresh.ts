/**
 * Client-side refresh: given a Species record, fetch fresh GBIF + iNat data,
 * verify the taxon IDs still resolve to the same canonical name, and return
 * a delta that the caller commits back to the JSON file.
 *
 * Manually-entered fields (diagnosis, body_size_mm, diagnostic_characters,
 * references, images, etc.) are NEVER touched here. Only:
 *   - inat_taxon_id, gbif_taxon_key  (re-verified, swapped if stale)
 *   - counties, county_record_counts (snapshotted from live data)
 *   - last_refreshed                  (now)
 */
import { fetchLiveDistribution } from "./distribution";
import type { Species } from "./types";
import { taxonIdOrNull } from "./types";

export interface RefreshDelta {
  inat_taxon_id: number | null;
  gbif_taxon_key: number | null;
  counties: string[];
  county_record_counts: Record<string, number>;
  last_refreshed: string;

  // Display-only diffs:
  inatIdChanged: boolean;
  gbifKeyChanged: boolean;
  inatIdPrev: number | null;
  gbifKeyPrev: number | null;
  countiesAdded: string[];
  countiesRemoved: string[];
  recordTotal: number;
}

async function verifyOrLookupINat(
  scientificName: string,
  currentId: number | null
): Promise<number | null> {
  // If we have a current ID, verify it still resolves to the same name.
  if (currentId !== null) {
    try {
      const res = await fetch(`https://api.inaturalist.org/v1/taxa/${currentId}`);
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ name?: string }>;
        };
        const name = data.results?.[0]?.name;
        if (name && name.toLowerCase() === scientificName.toLowerCase()) {
          return currentId;
        }
      }
    } catch {
      // Fall through to lookup-by-name.
    }
  }
  // Fresh lookup by name (strict match against the canonical iNat name).
  try {
    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=10`
    );
    if (!res.ok) return currentId;
    const data = (await res.json()) as {
      results?: Array<{ id: number; name?: string }>;
    };
    const target = scientificName.toLowerCase();
    for (const r of data.results ?? []) {
      if (r.name && r.name.toLowerCase() === target) return r.id;
    }
  } catch {
    // Leave the existing ID in place rather than nulling it on a transient error.
  }
  return currentId;
}

async function verifyOrLookupGbif(
  scientificName: string,
  currentKey: number | null
): Promise<number | null> {
  if (currentKey !== null) {
    try {
      const res = await fetch(
        `https://api.gbif.org/v1/species/${currentKey}`
      );
      if (res.ok) {
        const data = (await res.json()) as { canonicalName?: string };
        if (
          data.canonicalName &&
          data.canonicalName.toLowerCase() === scientificName.toLowerCase()
        ) {
          return currentKey;
        }
      }
    } catch {
      // Fall through.
    }
  }
  try {
    const url = new URL("https://api.gbif.org/v1/species/match");
    url.searchParams.set("name", scientificName);
    url.searchParams.set("strict", "true");
    url.searchParams.set("kingdom", "Animalia");
    const res = await fetch(url.toString());
    if (!res.ok) return currentKey;
    const data = (await res.json()) as {
      usageKey?: number;
      speciesKey?: number;
      canonicalName?: string;
    };
    const key = data.usageKey ?? data.speciesKey ?? null;
    if (
      key &&
      data.canonicalName &&
      data.canonicalName.toLowerCase() === scientificName.toLowerCase()
    ) {
      return key;
    }
  } catch {
    // ignore
  }
  return currentKey;
}

export async function refreshSpecies(species: Species): Promise<RefreshDelta> {
  const inatPrev = taxonIdOrNull(species.inat_taxon_id);
  const gbifPrev = taxonIdOrNull(species.gbif_taxon_key);

  // 1. Re-verify (and re-lookup if needed) both IDs in parallel.
  const [inatNew, gbifNew] = await Promise.all([
    verifyOrLookupINat(species.scientific_name, inatPrev),
    verifyOrLookupGbif(species.scientific_name, gbifPrev),
  ]);

  // 2. Fetch fresh county distribution using the (possibly updated) IDs.
  const dist = await fetchLiveDistribution(
    {
      id: species.id,
      gbif_taxon_key: gbifNew,
      inat_taxon_id: inatNew,
    },
    { force: true }
  );

  const counties = Object.keys(dist.countyCounts).sort((a, b) =>
    a.localeCompare(b)
  );

  const prevCountiesSet = new Set(species.counties ?? []);
  const newCountiesSet = new Set(counties);
  const countiesAdded = counties.filter((c) => !prevCountiesSet.has(c));
  const countiesRemoved = (species.counties ?? []).filter(
    (c) => !newCountiesSet.has(c)
  );

  return {
    inat_taxon_id: inatNew,
    gbif_taxon_key: gbifNew,
    counties,
    county_record_counts: dist.countyCounts,
    last_refreshed: new Date().toISOString().slice(0, 10),
    inatIdChanged: inatPrev !== inatNew,
    gbifKeyChanged: gbifPrev !== gbifNew,
    inatIdPrev: inatPrev,
    gbifKeyPrev: gbifPrev,
    countiesAdded,
    countiesRemoved,
    recordTotal: dist.total,
  };
}

/**
 * Apply a RefreshDelta on top of the existing species record, preserving all
 * manually-entered fields, and return the JSON content ready to commit.
 */
export function applyRefreshDelta(
  species: Species,
  delta: RefreshDelta
): string {
  const next: Species & { last_refreshed?: string } = {
    ...species,
    inat_taxon_id: delta.inat_taxon_id,
    gbif_taxon_key: delta.gbif_taxon_key,
    counties: delta.counties,
    county_record_counts: delta.county_record_counts,
    last_refreshed: delta.last_refreshed,
  };
  return JSON.stringify(next, null, 2) + "\n";
}

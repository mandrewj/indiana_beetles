/**
 * Server-side: find Indiana-observed species under a family that aren't yet
 * in our dataset. Drives /admin/discover/[family].
 *
 * Source of truth for "in our dataset" is taxonomy.json — anything listed
 * under any family there is considered known, even if the per-species
 * treatment file hasn't been written yet.
 */
import "server-only";

import type { Family, TaxonomyFamily } from "./types";
import { getAllFamilies, getTaxonomy } from "./content";

const INDIANA_PLACE_ID = 20;

export interface CandidateSpecies {
  scientific_name: string;
  /** Parsed from the binomial; first whitespace-separated token. */
  genus: string;
  common_name: string | null;
  inat_taxon_id: number;
  inat_obs_count: number;
  default_photo_url: string | null;
  /** Suggested slug — lower_snake_case of scientific_name. */
  suggested_id: string;
}

export interface DiscoverResult {
  family: Family;
  taxonomyFamily: TaxonomyFamily | null;
  candidates: CandidateSpecies[];
  /** Total species iNat reports for Indiana under this family. */
  totalIndianaSpecies: number;
  /** Species already in the dataset under this family. */
  knownCount: number;
}

interface RawTaxon {
  id: number;
  name?: string;
  rank?: string;
  preferred_common_name?: string;
  default_photo?: { medium_url?: string };
}

interface RawSpeciesCount {
  count: number;
  taxon: RawTaxon;
}

interface RawSpeciesCountsResponse {
  total_results: number;
  results: RawSpeciesCount[];
}

function toSlug(scientificName: string): string {
  return scientificName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseGenus(scientificName: string): string {
  const head = scientificName.split(/\s+/)[0] ?? "";
  return head.toLowerCase();
}

/**
 * Find Indiana species iNat has observations of under the family's iNat
 * taxon, minus species already in our dataset.
 */
export async function discoverFamily(familyId: string): Promise<DiscoverResult> {
  const [allFamilies, taxonomy] = await Promise.all([
    getAllFamilies(),
    getTaxonomy(),
  ]);
  const family = allFamilies.find((f) => f.id === familyId);
  if (!family) {
    throw new Error(`Unknown family: ${familyId}`);
  }
  const taxonomyFamily =
    taxonomy.families.find((f) => f.id === familyId) ?? null;

  const inatId = Number(family.inat_taxon_id);
  if (!Number.isInteger(inatId) || inatId <= 0) {
    return {
      family,
      taxonomyFamily,
      candidates: [],
      totalIndianaSpecies: 0,
      knownCount: taxonomyFamily
        ? taxonomyFamily.genera.reduce((n, g) => n + g.species.length, 0)
        : 0,
    };
  }

  // Build a set of every species name already in the dataset (across all
  // families, in case iNat places a species under a different family than
  // we've categorized it).
  const knownNames = new Set<string>();
  for (const fam of taxonomy.families) {
    for (const gen of fam.genera) {
      for (const sp of gen.species) {
        knownNames.add(sp.name);
      }
    }
  }

  const url = new URL(
    "https://api.inaturalist.org/v1/observations/species_counts"
  );
  url.searchParams.set("taxon_id", String(inatId));
  url.searchParams.set("place_id", String(INDIANA_PLACE_ID));
  url.searchParams.set("hrank", "species");
  url.searchParams.set("lrank", "species");
  url.searchParams.set("per_page", "500");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 * 30 }, // 30-minute server cache
  });
  if (!res.ok) {
    throw new Error(`iNat species_counts: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as RawSpeciesCountsResponse;

  const candidates: CandidateSpecies[] = [];
  for (const row of data.results) {
    const t = row.taxon;
    if (!t || t.rank !== "species" || !t.name) continue;
    if (knownNames.has(t.name)) continue;
    candidates.push({
      scientific_name: t.name,
      genus: parseGenus(t.name),
      common_name: t.preferred_common_name ?? null,
      inat_taxon_id: t.id,
      inat_obs_count: row.count,
      default_photo_url: t.default_photo?.medium_url ?? null,
      suggested_id: toSlug(t.name),
    });
  }

  const knownCount = taxonomyFamily
    ? taxonomyFamily.genera.reduce((n, g) => n + g.species.length, 0)
    : 0;

  return {
    family,
    taxonomyFamily,
    candidates,
    totalIndianaSpecies: data.total_results,
    knownCount,
  };
}

/**
 * Quick per-family progress count for the discover landing page.
 * Returns { totalIndianaSpecies, knownCount } from iNat — used to size up
 * pending work per family without forcing the editor to open each one.
 */
export async function familyDiscoverSummary(family: Family): Promise<{
  totalIndianaSpecies: number;
  knownCount: number;
}> {
  const inatId = Number(family.inat_taxon_id);
  const taxonomy = await getTaxonomy();
  const taxonomyFamily = taxonomy.families.find((f) => f.id === family.id);
  const knownCount = taxonomyFamily
    ? taxonomyFamily.genera.reduce((n, g) => n + g.species.length, 0)
    : 0;
  if (!Number.isInteger(inatId) || inatId <= 0) {
    return { totalIndianaSpecies: 0, knownCount };
  }
  const url = new URL(
    "https://api.inaturalist.org/v1/observations/species_counts"
  );
  url.searchParams.set("taxon_id", String(inatId));
  url.searchParams.set("place_id", String(INDIANA_PLACE_ID));
  url.searchParams.set("hrank", "species");
  url.searchParams.set("lrank", "species");
  url.searchParams.set("per_page", "1");
  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) return { totalIndianaSpecies: 0, knownCount };
    const data = (await res.json()) as RawSpeciesCountsResponse;
    return { totalIndianaSpecies: data.total_results, knownCount };
  } catch {
    return { totalIndianaSpecies: 0, knownCount };
  }
}

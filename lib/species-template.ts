/**
 * Build the JSON payload for a newly approved species, plus the updated
 * taxonomy.json that registers it (and auto-creates the genus stub if the
 * genus doesn't yet exist).
 *
 * Used by the Discover client to assemble the two-file commit body.
 */

import type {
  IndianaStatus,
  Species,
  Taxonomy,
  TaxonomyFamily,
  TaxonomyGenus,
} from "./types";

export interface ApprovalInput {
  familyId: string;
  /** lower_snake_case slug, becomes data/species/{id}.json filename. */
  id: string;
  scientific_name: string;
  /** Lowercase genus id (e.g. "calosoma"). */
  genus: string;
  /** Display name (e.g. "Calosoma"). */
  genus_display: string;
  authority?: string;
  common_name?: string;
  indiana_status?: IndianaStatus;
  inat_taxon_id?: number | null;
  gbif_taxon_key?: number | null;
}

/**
 * Build the species JSON content. Manual-entry fields are scaffolded as
 * empty so editors can fill them in via Decap once the species lands.
 */
export function buildSpeciesJSON(input: ApprovalInput): string {
  const sp: Species = {
    id: input.id,
    scientific_name: input.scientific_name,
    authority: input.authority,
    common_name: input.common_name,
    family: input.familyId,
    genus: input.genus,
    indiana_status: input.indiana_status ?? "confirmed",
    gbif_taxon_key:
      typeof input.gbif_taxon_key === "number" ? input.gbif_taxon_key : null,
    inat_taxon_id:
      typeof input.inat_taxon_id === "number" ? input.inat_taxon_id : null,
    diagnosis: "",
    body_size_mm: "",
    diagnostic_characters: [],
    phenology: [],
    phenology_peak: [],
    counties: [],
    images: [],
    similar_species: [],
    references: [],
  };
  return JSON.stringify(sp, null, 2) + "\n";
}

/**
 * Insert (or no-op if already present) a species under the given family +
 * genus in the supplied taxonomy. Auto-creates the genus stub if needed.
 * Returns the new taxonomy object (input is not mutated) plus a flag noting
 * whether a genus was added.
 */
export function insertSpeciesIntoTaxonomy(
  taxonomy: Taxonomy,
  input: ApprovalInput
): { taxonomy: Taxonomy; createdGenus: boolean } {
  const next: Taxonomy = {
    families: taxonomy.families.map((fam) =>
      fam.id !== input.familyId ? fam : { ...fam, genera: fam.genera.map((g) => ({ ...g, species: g.species.slice() })) }
    ),
  };
  const family = next.families.find((f) => f.id === input.familyId);
  if (!family) {
    // Family missing from taxonomy — defer to caller, this shouldn't happen
    // for the families we treat. Return unchanged.
    return { taxonomy: next, createdGenus: false };
  }

  let genus = family.genera.find((g) => g.id === input.genus);
  let createdGenus = false;
  if (!genus) {
    genus = {
      id: input.genus,
      name: input.genus_display,
      species: [],
    } as TaxonomyGenus;
    family.genera.push(genus);
    family.genera.sort((a, b) => a.name.localeCompare(b.name));
    createdGenus = true;
  }

  // Skip duplicate insert.
  if (genus.species.some((s) => s.id === input.id)) {
    return { taxonomy: next, createdGenus };
  }

  genus.species.push({
    id: input.id,
    name: input.scientific_name,
    authority: input.authority,
    common_name: input.common_name,
    indiana_status: input.indiana_status ?? "confirmed",
  });
  genus.species.sort((a, b) => a.name.localeCompare(b.name));
  return { taxonomy: next, createdGenus };
}

/**
 * Title-case helper so the auto-created genus display name matches the
 * binomial parsing on the iNat side (where "Calosoma" comes pre-capitalized).
 */
export function titleCase(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function ancestor(genus: string): TaxonomyGenus {
  return { id: genus, name: titleCase(genus), species: [] };
}

export { ancestor as buildGenusStub };

export function serializeTaxonomy(t: Taxonomy): string {
  return JSON.stringify(t, null, 2) + "\n";
}

/**
 * Helper kept here for surface-symmetry with the genus stub builder, in case
 * future schema additions need it.
 */
export function familyHasGenus(family: TaxonomyFamily, genusId: string): boolean {
  return family.genera.some((g) => g.id === genusId);
}

/**
 * Domain types matching the flat-JSON schemas under /data/.
 * Source of truth for these shapes is HANDOFF.md §2.
 */

export type IndianaStatus =
  | "confirmed"
  | "historical"
  | "adventive"
  | "excluded";

export type ImageType =
  | "habitus"
  | "detail"
  | "habitat"
  | "larva"
  | "genitalia";

export interface DiagnosticCharacter {
  label: string;
  value: string;
  note?: string;
}

export interface SpeciesImage {
  url: string;
  credit: string;
  caption?: string;
  type: ImageType;
}

export interface Species {
  id: string;
  scientific_name: string;
  authority?: string;
  common_name?: string;
  family: string;
  genus: string;
  indiana_status: IndianaStatus;
  gbif_taxon_key: number | null;
  inat_taxon_id: number | null;
  diagnosis: string;
  body_size_mm: string;
  diagnostic_characters: DiagnosticCharacter[];
  phenology: number[];
  phenology_peak: number[];
  counties: string[];
  county_record_counts?: Record<string, number>;
  images: SpeciesImage[];
  similar_species: string[];
  similar_species_notes?: Record<string, string>;
  references: string[];
}

export interface Family {
  id: string;
  name: string;
  common_name: string;
  authority?: string;
  diagnosis: string;
  species_count: number;
  genus_count: number;
  confirmed_count?: number;
  historical_count?: number;
  adventive_count?: number;
  genus_notes?: Record<string, string>;
  inat_taxon_id?: number | string | null;
}

export interface TaxonomyGenus {
  id: string;
  name: string;
  authority?: string;
  species: Array<{
    id: string;
    name: string;
    authority?: string;
    common_name?: string;
    indiana_status: IndianaStatus;
  }>;
}

export interface TaxonomyFamily {
  id: string;
  name: string;
  common_name: string;
  authority?: string;
  sort_index: number;
  genera: TaxonomyGenus[];
}

export interface Taxonomy {
  families: TaxonomyFamily[];
}

export type KeyGoto = number | string;

export interface KeyLead {
  text: string;
  image_url?: string;
  goto: KeyGoto;
}

export interface KeyCouplet {
  id: number;
  lead_a: KeyLead;
  lead_b: KeyLead;
}

export type KeyScope = "families" | "genera" | "species";

export interface KeyBase {
  type: "dichotomous";
  scope: KeyScope;
  title: string;
  family?: string;
  couplets: KeyCouplet[];
}

export interface GenusSubKey {
  genus: string;
  title: string;
  couplets: KeyCouplet[];
}

export interface DichotomousKey extends KeyBase {
  genus_keys?: GenusSubKey[];
}

export interface GlossaryEntry {
  term: string;
  def: string;
  image_url?: string;
}

export interface Glossary {
  entries: GlossaryEntry[];
}

export type CountyLookup = Record<string, string>;

/**
 * Decap writes empty number fields as `""` rather than `null` — normalize to
 * either a positive integer or `null` so downstream guards and API calls
 * don't accidentally treat the empty string as "set."
 */
export function taxonIdOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

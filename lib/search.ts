/**
 * Slim, build-time-derived search index used by the site Nav.
 * Server-only — built in app/layout.tsx and passed to the client Nav.
 */
import "server-only";

import { getAllFamilies, getTaxonomy } from "./content";

export type SearchType = "family" | "genus" | "species";

export interface SearchEntry {
  type: SearchType;
  /** Display name (italic for genus/species, plain for family). */
  name: string;
  /** Common name when available. Also indexed. */
  common?: string;
  /** Where clicking the entry should navigate. */
  href: string;
  /** Context shown next to the entry (e.g. family for a species). */
  context?: string;
}

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const [families, taxonomy] = await Promise.all([
    getAllFamilies(),
    getTaxonomy(),
  ]);

  const entries: SearchEntry[] = [];

  for (const f of families) {
    entries.push({
      type: "family",
      name: f.name,
      common: f.common_name,
      href: `/browse/${f.id}`,
    });
  }

  for (const tf of taxonomy.families) {
    for (const g of tf.genera) {
      entries.push({
        type: "genus",
        name: g.name,
        href: `/browse/${tf.id}/${g.id}`,
        context: tf.name,
      });
      for (const s of g.species) {
        entries.push({
          type: "species",
          name: s.name,
          common: s.common_name,
          href: `/browse/${tf.id}/${g.id}/${s.id}`,
          context: `${tf.name} · ${g.name}`,
        });
      }
    }
  }

  return entries;
}

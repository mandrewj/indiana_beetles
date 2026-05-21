import "server-only";

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  CountyLookup,
  DichotomousKey,
  Family,
  Glossary,
  Species,
  Taxonomy,
  TaxonomyFamily,
} from "./types";

const DATA_DIR = join(process.cwd(), "data");

async function readJSON<T>(relPath: string): Promise<T> {
  const raw = await readFile(join(DATA_DIR, relPath), "utf8");
  return JSON.parse(raw) as T;
}

async function listJSON(subdir: string): Promise<string[]> {
  const entries = await readdir(join(DATA_DIR, subdir));
  return entries.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

export async function getTaxonomy(): Promise<Taxonomy> {
  return readJSON<Taxonomy>("taxonomy.json");
}

export async function getAllFamilyIds(): Promise<string[]> {
  return listJSON("families");
}

export async function getFamily(id: string): Promise<Family> {
  return readJSON<Family>(`families/${id}.json`);
}

export async function getAllFamilies(): Promise<Family[]> {
  const ids = await getAllFamilyIds();
  return Promise.all(ids.map((id) => getFamily(id)));
}

export async function getAllSpeciesIds(): Promise<string[]> {
  return listJSON("species");
}

export async function getSpecies(id: string): Promise<Species> {
  return readJSON<Species>(`species/${id}.json`);
}

export async function getAllSpecies(): Promise<Species[]> {
  const ids = await getAllSpeciesIds();
  return Promise.all(ids.map((id) => getSpecies(id)));
}

export async function getSpeciesByFamily(familyId: string): Promise<Species[]> {
  const all = await getAllSpecies();
  return all.filter((s) => s.family === familyId);
}

export async function getCountyLookup(): Promise<CountyLookup> {
  return readJSON<CountyLookup>("county-lookup.json");
}

export async function getGlossary(): Promise<Glossary> {
  // Decap writes the glossary as { entries: [...] } but the prototype file
  // is a bare array. Accept both.
  const raw = await readJSON<Glossary | Glossary["entries"]>("glossary.json");
  return Array.isArray(raw) ? { entries: raw } : raw;
}

export async function getFamilyKey(): Promise<DichotomousKey> {
  return readJSON<DichotomousKey>("keys/family-key.json");
}

export async function getKey(filename: string): Promise<DichotomousKey> {
  return readJSON<DichotomousKey>(`keys/${filename}.json`);
}

export async function getAllKeyFiles(): Promise<string[]> {
  return listJSON("keys");
}

/**
 * Walks the taxonomy tree to find the family→genus context for a species.
 * Returned shape mirrors what page components need to render breadcrumbs.
 */
export async function findSpeciesContext(speciesId: string): Promise<{
  family: TaxonomyFamily;
  genusId: string;
} | null> {
  const tax = await getTaxonomy();
  for (const fam of tax.families) {
    for (const gen of fam.genera) {
      if (gen.species.some((s) => s.id === speciesId)) {
        return { family: fam, genusId: gen.id };
      }
    }
  }
  return null;
}

/* eslint-disable */
/**
 * Bulk-import Indiana species for one or more families.
 *
 * For each family:
 *   1. Ensure the family JSON exists (create stub if missing).
 *   2. Fill family.diagnosis from Wikipedia if blank.
 *   3. Pull iNat species_counts scoped to Indiana, count >= 2.
 *   4. Filter to species not already in taxonomy.json.
 *   5. For each new species:
 *       - GBIF match → authority + taxon key
 *       - iNat /taxa/{id} → preferred_common_name + wikipedia_summary
 *       - iNat /observations/histogram → phenology
 *       - iNat /observations (limit=300) → counties (point-in-polygon)
 *       - Parse body_size_mm from the wikipedia_summary
 *       - Write data/species/<id>.json
 *   6. Fill family.genus_notes[g.id] from Wikipedia for each new genus.
 *   7. Update data/taxonomy.json atomically.
 *   8. Commit + push per family.
 *
 * Fields are filled only when blank — existing editorial content is preserved.
 *
 * Usage:
 *   npm run bulk:import -- <family-id> [more-families…]
 *   npm run bulk:import -- all                      (the canonical 15-family set)
 *   npm run bulk:import -- carabidae --dry-run      (no writes, no commits)
 *   npm run bulk:import -- lucanidae --no-commit    (writes JSON, skips git)
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");
const SPECIES_DIR = join(DATA_DIR, "species");
const FAMILIES_DIR = join(DATA_DIR, "families");
const TAXONOMY_PATH = join(DATA_DIR, "taxonomy.json");
const COUNTY_TOPOJSON_PATH = join(ROOT, "public", "data", "indiana-counties.json");

const INDIANA_PLACE_ID = 20;
const MIN_COUNT = 2;
const SPECIES_OBS_LIMIT = 300;
const POLITE_DELAY_MS = 800;

const TARGET_FAMILIES = [
  "curculionidae",
  "carabidae",
  "tenebrionidae",
  "melandryidae",
  "cantharidae",
  "bostrichidae",
  "cerambycidae",
  "lucanidae",
  "scarabaeidae",
  "chrysomelidae",
  "silvanidae",
  "anthicidae",
  "meloidae",
  "coccinellidae",
  "elateridae",
];

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const DRY_RUN = flags.has("--dry-run");
const NO_COMMIT = flags.has("--no-commit") || DRY_RUN;
const NO_PUSH = flags.has("--no-push") || DRY_RUN;

function targetFamilies(): string[] {
  if (positional.length === 0) {
    throw new Error(
      "Specify family ids: e.g. `lucanidae carabidae` or `all`."
    );
  }
  if (positional.includes("all")) return TARGET_FAMILIES;
  return positional;
}

// ─────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function titleCase(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
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

let lastLog = Date.now();
function log(line: string) {
  const elapsed = ((Date.now() - lastLog) / 1000).toFixed(1);
  lastLog = Date.now();
  process.stdout.write(`[${elapsed.padStart(5)}s] ${line}\n`);
}

// ─────────────────────────────────────────────────────────────
// County resolver (point-in-polygon over the bundled topojson)
// ─────────────────────────────────────────────────────────────

let countyFeatures: any[] | null = null;

async function loadCountyFeatures() {
  if (countyFeatures) return countyFeatures;
  const raw = await readFile(COUNTY_TOPOJSON_PATH, "utf8");
  const topo = JSON.parse(raw);
  const fc = feature(topo, topo.objects.counties) as any;
  countyFeatures = fc.features;
  return countyFeatures!;
}

async function resolveCounty(
  lng: number,
  lat: number
): Promise<string | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const features = await loadCountyFeatures();
  for (const f of features) {
    if (geoContains(f, [lng, lat])) {
      return f.properties?.name ?? null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// API clients
// ─────────────────────────────────────────────────────────────

interface RawTaxon {
  id: number;
  name?: string;
  preferred_common_name?: string;
  wikipedia_url?: string;
  wikipedia_summary?: string;
  default_photo?: any;
}

async function inatFetch<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) {
    log(`  ! iNat ${res.status} ${url}`);
    return null;
  }
  return (await res.json()) as T;
}

async function gbifFetch<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function lookupINatFamily(name: string): Promise<number | null> {
  const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=family&per_page=10`;
  const data = await inatFetch<{ results?: Array<{ id: number; name?: string }> }>(url);
  if (!data?.results) return null;
  const target = name.toLowerCase();
  for (const r of data.results) {
    if (r.name && r.name.toLowerCase() === target) return r.id;
  }
  return null;
}

async function lookupINatGenus(name: string): Promise<number | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    name
  )}`;
  const data = await inatFetch<{
    results?: Array<{ id: number; name?: string }>;
  }>(
    `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=genus&per_page=5`
  );
  if (!data?.results) return null;
  const target = name.toLowerCase();
  for (const r of data.results) {
    if (r.name && r.name.toLowerCase() === target) return r.id;
  }
  return null;
}

async function fetchTaxon(id: number): Promise<RawTaxon | null> {
  const data = await inatFetch<{ results?: RawTaxon[] }>(
    `https://api.inaturalist.org/v1/taxa/${id}`
  );
  return data?.results?.[0] ?? null;
}

async function fetchSpeciesCountsForFamily(
  familyTaxonId: number
): Promise<Array<{ count: number; taxon: RawTaxon }>> {
  // species_counts caps at per_page=500; almost no IN family exceeds this.
  const data = await inatFetch<{
    total_results: number;
    results: Array<{ count: number; taxon: RawTaxon }>;
  }>(
    `https://api.inaturalist.org/v1/observations/species_counts?taxon_id=${familyTaxonId}&place_id=${INDIANA_PLACE_ID}&hrank=species&lrank=species&per_page=500`
  );
  return data?.results ?? [];
}

interface GbifMatch {
  key?: number;
  authority?: string;
}

async function gbifMatch(name: string): Promise<GbifMatch> {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&strict=true&kingdom=Animalia`;
  const data = await gbifFetch<{
    usageKey?: number;
    speciesKey?: number;
    canonicalName?: string;
    authorship?: string;
  }>(url);
  if (!data) return {};
  const key = data.usageKey ?? data.speciesKey;
  if (
    key &&
    data.canonicalName &&
    data.canonicalName.toLowerCase() === name.toLowerCase()
  ) {
    return { key, authority: data.authorship?.trim() || undefined };
  }
  return {};
}

interface INatObs {
  observed_on?: string;
  observed_on_string?: string;
  geojson?: { coordinates?: [number, number] };
  place_guess?: string;
}

async function fetchPhenology(
  taxonId: number
): Promise<{ active: number[]; peak: number[] }> {
  const data = await inatFetch<{
    results?: { month_of_year?: Record<string, number> };
  }>(
    `https://api.inaturalist.org/v1/observations/histogram?taxon_id=${taxonId}&place_id=${INDIANA_PLACE_ID}&date_field=observed&interval=month_of_year`
  );
  const raw = data?.results?.month_of_year ?? {};
  const counts: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const m = Number(k);
    if (Number.isInteger(m) && m >= 1 && m <= 12 && v > 0) counts[m] = v;
  }
  const months = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const max = months.length ? Math.max(...months.map((m) => counts[m])) : 0;
  const peak = months.filter((m) => counts[m] >= max * 0.5);
  return { active: months, peak };
}

async function fetchCountyDistribution(
  inatTaxonId: number
): Promise<{ counts: Record<string, number>; counties: string[] }> {
  const data = await inatFetch<{
    results: INatObs[];
  }>(
    `https://api.inaturalist.org/v1/observations?taxon_id=${inatTaxonId}&place_id=${INDIANA_PLACE_ID}&per_page=${SPECIES_OBS_LIMIT}&order=desc&order_by=observed_on&quality_grade=research`
  );
  const counts: Record<string, number> = {};
  for (const obs of data?.results ?? []) {
    const coords = obs.geojson?.coordinates;
    if (!coords) continue;
    const county = await resolveCounty(coords[0], coords[1]);
    if (county) counts[county] = (counts[county] ?? 0) + 1;
  }
  const counties = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  return { counts, counties };
}

// ─────────────────────────────────────────────────────────────
// Content extraction (size, diagnosis paraphrase)
// ─────────────────────────────────────────────────────────────

/** Truncate an HTML/markup-free summary to N sentences (rough split). */
function firstSentences(text: string, n: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(" ");
}

const SIZE_PATTERNS: RegExp[] = [
  // Range first — prefer.  "5–12 mm", "5-12 mm", "5 to 12 mm"
  /(\d+(?:\.\d+)?)\s*[–\-—]\s*(\d+(?:\.\d+)?)\s*mm/i,
  /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*mm/i,
  // Single value w/ context.  "about 8 mm", "approximately 8 mm", "8 mm long"
  /(?:about|approximately|around|~)?\s*(\d+(?:\.\d+)?)\s*mm(?:\s+(?:in\s+)?(?:length|long))/i,
];

function extractSize(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const re of SIZE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (m[2]) return `${m[1]}–${m[2]}`;
    if (m[1]) return m[1];
  }
  // cm fallback
  const cm = text.match(/(\d+(?:\.\d+)?)\s*[–\-—]\s*(\d+(?:\.\d+)?)\s*cm/i);
  if (cm) {
    const lo = parseFloat(cm[1]) * 10;
    const hi = parseFloat(cm[2]) * 10;
    return `${lo}–${hi}`;
  }
  return null;
}

interface WikiContent {
  diagnosis: string | null;
  size: string | null;
  url: string | null;
}

async function fetchWikipediaSummary(title: string): Promise<{
  extract?: string;
  content_url?: string;
} | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  return {
    extract: data.extract,
    content_url: data.content_urls?.desktop?.page,
  };
}

/** Resolve content for a taxon: prefer iNat's wikipedia_summary, then direct
 *  Wikipedia REST. Returns short diagnosis + best-effort size. */
async function fetchTaxonContent(
  taxon: RawTaxon | null,
  fallbackTitle: string,
  diagnosisSentences: number
): Promise<WikiContent> {
  let text = taxon?.wikipedia_summary ?? "";
  let url = taxon?.wikipedia_url ?? null;
  if (!text) {
    const wiki = await fetchWikipediaSummary(fallbackTitle);
    if (wiki?.extract) {
      text = wiki.extract;
      url = wiki.content_url ?? url;
    }
  }
  // iNat's wikipedia_summary often contains HTML; strip tags.
  const cleaned = text.replace(/<[^>]*>/g, "");
  return {
    diagnosis: cleaned ? firstSentences(cleaned, diagnosisSentences) : null,
    size: extractSize(cleaned),
    url,
  };
}

// ─────────────────────────────────────────────────────────────
// File IO helpers
// ─────────────────────────────────────────────────────────────

async function readJSON<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJSON(path: string, data: any) {
  if (DRY_RUN) return;
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

async function loadFamily(familyId: string): Promise<any | null> {
  const path = join(FAMILIES_DIR, `${familyId}.json`);
  if (!existsSync(path)) return null;
  return readJSON(path);
}

async function saveFamily(familyId: string, data: any) {
  const path = join(FAMILIES_DIR, `${familyId}.json`);
  await writeJSON(path, data);
}

async function loadTaxonomy(): Promise<any> {
  return readJSON(TAXONOMY_PATH);
}

async function saveTaxonomy(t: any) {
  await writeJSON(TAXONOMY_PATH, t);
}

async function speciesExists(id: string): Promise<boolean> {
  return existsSync(join(SPECIES_DIR, `${id}.json`));
}

async function loadSpecies(id: string): Promise<any | null> {
  const path = join(SPECIES_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return readJSON(path);
}

async function saveSpecies(id: string, data: any) {
  await writeJSON(join(SPECIES_DIR, `${id}.json`), data);
}

// ─────────────────────────────────────────────────────────────
// Taxonomy operations
// ─────────────────────────────────────────────────────────────

function knownSpeciesNames(taxonomy: any): Set<string> {
  const set = new Set<string>();
  for (const fam of taxonomy.families) {
    for (const gen of fam.genera) {
      for (const sp of gen.species) set.add(sp.name);
    }
  }
  return set;
}

function ensureFamilyInTaxonomy(taxonomy: any, familyId: string, familyName: string) {
  let fam = taxonomy.families.find((f: any) => f.id === familyId);
  if (!fam) {
    fam = {
      id: familyId,
      name: familyName,
      common_name: "",
      authority: "",
      sort_index: taxonomy.families.length + 1,
      genera: [],
    };
    taxonomy.families.push(fam);
  }
  return fam;
}

function ensureGenusInTaxonomy(
  taxFamily: any,
  genusId: string,
  genusName: string
) {
  let gen = taxFamily.genera.find((g: any) => g.id === genusId);
  let createdGenus = false;
  if (!gen) {
    gen = { id: genusId, name: genusName, species: [] };
    taxFamily.genera.push(gen);
    taxFamily.genera.sort((a: any, b: any) => a.name.localeCompare(b.name));
    createdGenus = true;
  }
  return { genus: gen, createdGenus };
}

function addSpeciesToGenus(
  genus: any,
  species: { id: string; name: string; authority?: string; common_name?: string; indiana_status: string }
) {
  if (genus.species.some((s: any) => s.id === species.id)) return;
  genus.species.push(species);
  genus.species.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

// ─────────────────────────────────────────────────────────────
// Per-species processing
// ─────────────────────────────────────────────────────────────

interface ProcessedSpecies {
  id: string;
  scientific_name: string;
  authority?: string;
  common_name?: string;
  genus: string;
  genus_display: string;
  inat_taxon_id: number;
  gbif_taxon_key: number | null;
}

async function processSpecies(
  familyId: string,
  candidate: { count: number; taxon: RawTaxon }
): Promise<ProcessedSpecies | null> {
  const taxon = candidate.taxon;
  if (!taxon.name) return null;
  const id = toSlug(taxon.name);
  const genus = parseGenus(taxon.name);
  const genusDisplay = titleCase(genus);

  const existing = await loadSpecies(id);

  // Get fuller taxon data for wikipedia_summary etc.
  const fullTaxon = await fetchTaxon(taxon.id);
  await sleep(POLITE_DELAY_MS);

  // GBIF for authority + key
  const gbif = await gbifMatch(taxon.name);
  await sleep(POLITE_DELAY_MS);

  // Distribution + phenology (these are 2 iNat calls)
  const dist = await fetchCountyDistribution(taxon.id);
  await sleep(POLITE_DELAY_MS);
  const pheno = await fetchPhenology(taxon.id);
  await sleep(POLITE_DELAY_MS);

  // Content from Wikipedia / iNat summary
  const content = await fetchTaxonContent(fullTaxon, taxon.name, 2);

  const today = new Date().toISOString().slice(0, 10);
  const baseRefs: string[] = content.url
    ? [`Source: Wikipedia, *${content.url}*, retrieved ${today}.`]
    : [];

  if (existing) {
    // Only fill blank fields, preserve everything else.
    if (isBlank(existing.diagnosis) && content.diagnosis) {
      existing.diagnosis = content.diagnosis;
    }
    if (isBlank(existing.body_size_mm) && content.size) {
      existing.body_size_mm = content.size;
    }
    if (isBlank(existing.phenology) && pheno.active.length > 0) {
      existing.phenology = pheno.active;
      existing.phenology_peak = pheno.peak;
    }
    if (isBlank(existing.counties) && dist.counties.length > 0) {
      existing.counties = dist.counties;
      existing.county_record_counts = dist.counts;
    }
    if (isBlank(existing.gbif_taxon_key) && gbif.key) {
      existing.gbif_taxon_key = gbif.key;
    }
    if (isBlank(existing.inat_taxon_id)) {
      existing.inat_taxon_id = taxon.id;
    }
    if (isBlank(existing.authority) && gbif.authority) {
      existing.authority = gbif.authority;
    }
    if (isBlank(existing.common_name) && fullTaxon?.preferred_common_name) {
      existing.common_name = fullTaxon.preferred_common_name;
    }
    if (isBlank(existing.references) && baseRefs.length > 0) {
      existing.references = baseRefs;
    }
    existing.last_refreshed = today;
    await saveSpecies(id, existing);
  } else {
    const speciesData = {
      id,
      scientific_name: taxon.name,
      authority: gbif.authority,
      common_name: fullTaxon?.preferred_common_name ?? undefined,
      family: familyId,
      genus,
      indiana_status: "confirmed",
      gbif_taxon_key: gbif.key ?? null,
      inat_taxon_id: taxon.id,
      diagnosis: content.diagnosis ?? "",
      body_size_mm: content.size ?? "",
      diagnostic_characters: [],
      phenology: pheno.active,
      phenology_peak: pheno.peak,
      counties: dist.counties,
      county_record_counts: dist.counts,
      images: [],
      similar_species: [],
      references: baseRefs,
      last_refreshed: today,
    };
    await saveSpecies(id, speciesData);
  }

  return {
    id,
    scientific_name: taxon.name,
    authority: gbif.authority,
    common_name: fullTaxon?.preferred_common_name,
    genus,
    genus_display: genusDisplay,
    inat_taxon_id: taxon.id,
    gbif_taxon_key: gbif.key ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Per-family processing
// ─────────────────────────────────────────────────────────────

async function processFamily(familyId: string) {
  log(`\n══════════════════════════════════════════════`);
  log(`Family: ${familyId}`);
  log(`══════════════════════════════════════════════`);

  const familyName = titleCase(familyId);

  // 1. Load or create family JSON.
  let family = await loadFamily(familyId);
  let familyTaxonId = Number(family?.inat_taxon_id);

  if (!family) {
    log(`  Creating family stub for ${familyName}`);
    family = {
      id: familyId,
      name: familyName,
      common_name: "",
      authority: "",
      diagnosis: "",
      species_count: 0,
      genus_count: 0,
      confirmed_count: null,
      historical_count: null,
      adventive_count: null,
    };
  }

  // 2. Resolve iNat taxon ID for the family if missing.
  if (!Number.isInteger(familyTaxonId) || familyTaxonId <= 0) {
    const lookup = await lookupINatFamily(familyName);
    if (lookup) {
      familyTaxonId = lookup;
      family.inat_taxon_id = lookup;
      log(`  Found iNat family taxon ${lookup}`);
    } else {
      log(`  ⚠ Could not resolve iNat taxon for family ${familyName}; skipping`);
      return;
    }
    await sleep(POLITE_DELAY_MS);
  }

  // 3. Enrich family diagnosis from Wikipedia if blank.
  if (isBlank(family.diagnosis)) {
    const famTaxon = await fetchTaxon(familyTaxonId);
    await sleep(POLITE_DELAY_MS);
    const content = await fetchTaxonContent(famTaxon, familyName, 3);
    if (content.diagnosis) {
      family.diagnosis = content.diagnosis;
      log(`  Filled family.diagnosis from Wikipedia (${content.diagnosis.length} chars)`);
    }
    if (isBlank(family.common_name) && famTaxon?.preferred_common_name) {
      family.common_name = famTaxon.preferred_common_name;
    }
  }

  // 4. Fetch all Indiana species under this family.
  log(`  Fetching species_counts (place_id=${INDIANA_PLACE_ID}, count >= ${MIN_COUNT})`);
  const all = await fetchSpeciesCountsForFamily(familyTaxonId);
  await sleep(POLITE_DELAY_MS);
  const candidates = all.filter((c) => c.count >= MIN_COUNT && c.taxon?.rank === "species" && c.taxon?.name);
  log(`  ${candidates.length} candidates (filtered from ${all.length})`);

  // 5. Load taxonomy and figure out which candidates are new.
  const taxonomy = await loadTaxonomy();
  const known = knownSpeciesNames(taxonomy);
  const newCandidates = candidates.filter((c) => !known.has(c.taxon.name!));
  log(`  ${newCandidates.length} new (after taxonomy filter)`);

  const taxFamily = ensureFamilyInTaxonomy(taxonomy, familyId, family.name);
  const genusEnrichSet = new Set<string>();
  let processed = 0;

  // 6. Process each candidate.
  for (let i = 0; i < newCandidates.length; i++) {
    const c = newCandidates[i];
    log(`  [${i + 1}/${newCandidates.length}] ${c.taxon.name} (${c.count} obs)`);
    try {
      const result = await processSpecies(familyId, c);
      if (!result) continue;
      const { genus: g, createdGenus } = ensureGenusInTaxonomy(
        taxFamily,
        result.genus,
        result.genus_display
      );
      addSpeciesToGenus(g, {
        id: result.id,
        name: result.scientific_name,
        authority: result.authority,
        common_name: result.common_name,
        indiana_status: "confirmed",
      });
      genusEnrichSet.add(result.genus);
      if (createdGenus) {
        log(`    + new genus: ${result.genus_display}`);
      }
      processed++;
    } catch (err) {
      log(`    ✗ ${(err as Error).message}`);
    }
  }

  // 7. Also enrich genera that already exist (with new species added) — fill
  //    family.genus_notes from Wikipedia where blank.
  if (!family.genus_notes) family.genus_notes = {};
  for (const genusId of genusEnrichSet) {
    if (!isBlank(family.genus_notes[genusId])) continue;
    const genusName = titleCase(genusId);
    log(`  Enriching genus note: ${genusName}`);
    const lookup = await fetchWikipediaSummary(genusName);
    if (lookup?.extract) {
      family.genus_notes[genusId] = firstSentences(
        lookup.extract.replace(/<[^>]*>/g, ""),
        1
      );
    }
    await sleep(POLITE_DELAY_MS);
  }

  // 8. Persist.
  await saveFamily(familyId, family);
  await saveTaxonomy(taxonomy);
  log(`  ${processed} species processed; family + taxonomy written`);

  // 9. Commit.
  if (NO_COMMIT) {
    log(`  (no-commit: skipping git)`);
    return;
  }
  try {
    execSync("git add -A", { stdio: "inherit" });
    const commitMsg = `Bulk import: ${family.name} — ${processed} species\n\nWikipedia + iNat enrichment via scripts/bulk-import.ts.`;
    execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { stdio: "inherit" });
    if (!NO_PUSH) {
      execSync("git push", { stdio: "inherit" });
    }
  } catch (err) {
    log(`  ⚠ git step failed: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  const families = targetFamilies();
  log(`Targets (${families.length}): ${families.join(", ")}`);
  log(`Mode: ${DRY_RUN ? "DRY-RUN" : NO_COMMIT ? "NO-COMMIT" : NO_PUSH ? "COMMIT-ONLY" : "COMMIT+PUSH"}`);

  // Ensure base dirs.
  for (const d of [SPECIES_DIR, FAMILIES_DIR]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }

  for (const familyId of families) {
    await processFamily(familyId);
  }
  log(`\nDone.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

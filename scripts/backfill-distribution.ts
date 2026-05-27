/* eslint-disable */
/**
 * One-off backfill: rebuild county_record_counts (and `counties`,
 * `last_refreshed`) for every species in data/species/*.json by combining
 * iNaturalist research-grade observations with GBIF non-iNat records.
 *
 * Why this exists: an earlier revision of scripts/bulk-import.ts only used
 * iNat when seeding county_record_counts, so GBIF-only records (museum
 * specimens, etc.) never made it into the distribution map. The map treats
 * any populated county_record_counts as an admin override and skips the
 * live combined fetch, so those records were effectively invisible.
 *
 * Touches ONLY:
 *   - counties
 *   - county_record_counts
 *   - last_refreshed
 *
 * Manually-curated fields (diagnosis, body_size_mm, diagnostic_characters,
 * images, references) are preserved byte-for-byte except for the three
 * fields above.
 *
 * Usage:
 *   npm run data:backfill-distribution            (writes JSON + git commit)
 *   npm run data:backfill-distribution -- --dry-run
 *   npm run data:backfill-distribution -- --no-commit
 *   npm run data:backfill-distribution -- --only acalymma_vittatum,calosoma_externum
 *   npm run data:backfill-distribution -- --resume   (skip species already touched today)
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");
const SPECIES_DIR = join(DATA_DIR, "species");
const COUNTY_TOPOJSON_PATH = join(ROOT, "public", "data", "indiana-counties.json");

const INDIANA_PLACE_ID = 20;
const SPECIES_OBS_LIMIT = 300;
const POLITE_DELAY_MS = 800;
const INAT_GBIF_DATASET_KEY = "50c9509d-22c7-4a22-a47d-8c48425ef4a7";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const DRY_RUN = flags.has("--dry-run");
const NO_COMMIT = flags.has("--no-commit") || DRY_RUN;
const NO_PUSH = flags.has("--no-push") || DRY_RUN;
const RESUME = flags.has("--resume");

function readOption(name: string): string | null {
  const i = args.findIndex((a) => a === name);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  for (const a of args) {
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
  }
  return null;
}

const ONLY = readOption("--only");
const ONLY_SET = ONLY
  ? new Set(
      ONLY.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let lastLog = Date.now();
function log(line: string) {
  const elapsed = ((Date.now() - lastLog) / 1000).toFixed(1);
  lastLog = Date.now();
  process.stdout.write(`[${elapsed.padStart(5)}s] ${line}\n`);
}

// ─── County resolver ─────────────────────────────────────────────

let countyFeatures: any[] | null = null;

async function loadCountyFeatures() {
  if (countyFeatures) return countyFeatures;
  const raw = await readFile(COUNTY_TOPOJSON_PATH, "utf8");
  const topo = JSON.parse(raw);
  const fc = feature(topo, topo.objects.counties) as any;
  countyFeatures = fc.features;
  return countyFeatures!;
}

async function resolveCounty(lng: number, lat: number): Promise<string | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const features = await loadCountyFeatures();
  for (const f of features) {
    if (geoContains(f, [lng, lat])) {
      return f.properties?.name ?? null;
    }
  }
  return null;
}

// ─── API fetchers ─────────────────────────────────────────────────

interface INatObs {
  geojson?: { coordinates?: [number, number] };
}

async function fetchINatCounts(
  inatTaxonId: number
): Promise<Record<string, number>> {
  const url = `https://api.inaturalist.org/v1/observations?taxon_id=${inatTaxonId}&place_id=${INDIANA_PLACE_ID}&per_page=${SPECIES_OBS_LIMIT}&order=desc&order_by=observed_on&quality_grade=research`;
  const res = await fetch(url);
  if (!res.ok) {
    log(`  ! iNat ${res.status} on ${inatTaxonId}`);
    return {};
  }
  const data = (await res.json()) as { results?: INatObs[] };
  const counts: Record<string, number> = {};
  for (const obs of data.results ?? []) {
    const coords = obs.geojson?.coordinates;
    if (!coords) continue;
    const county = await resolveCounty(coords[0], coords[1]);
    if (county) counts[county] = (counts[county] ?? 0) + 1;
  }
  return counts;
}

interface RawGbifOcc {
  datasetKey?: string;
  county?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
}

async function fetchGbifCounts(
  gbifTaxonKey: number
): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    taxonKey: String(gbifTaxonKey),
    country: "US",
    stateProvince: "Indiana",
    hasCoordinate: "true",
    limit: String(SPECIES_OBS_LIMIT),
  });
  const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    log(`  ! GBIF ${res.status} on ${gbifTaxonKey}`);
    return {};
  }
  const data = (await res.json()) as { results?: RawGbifOcc[] };
  const counts: Record<string, number> = {};
  for (const occ of data.results ?? []) {
    if (occ.datasetKey === INAT_GBIF_DATASET_KEY) continue;
    let county: string | null = null;
    if (occ.county) {
      county = occ.county.replace(/\s+County$/i, "").trim() || null;
    }
    if (
      !county &&
      typeof occ.decimalLatitude === "number" &&
      typeof occ.decimalLongitude === "number"
    ) {
      county = await resolveCounty(occ.decimalLongitude, occ.decimalLatitude);
    }
    if (county) counts[county] = (counts[county] ?? 0) + 1;
  }
  return counts;
}

// ─── Per-species processing ────────────────────────────────────────

function toIntOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

interface SpeciesShape {
  id?: string;
  scientific_name?: string;
  inat_taxon_id?: number | string | null;
  gbif_taxon_key?: number | string | null;
  counties?: string[];
  county_record_counts?: Record<string, number>;
  last_refreshed?: string;
  [k: string]: unknown;
}

async function processFile(file: string, today: string): Promise<{
  changed: boolean;
  inatTotal: number;
  gbifTotal: number;
  countyTotal: number;
}> {
  const path = join(SPECIES_DIR, file);
  const raw = await readFile(path, "utf8");
  const species = JSON.parse(raw) as SpeciesShape;

  const inatId = toIntOrNull(species.inat_taxon_id);
  const gbifKey = toIntOrNull(species.gbif_taxon_key);

  if (inatId === null && gbifKey === null) {
    return { changed: false, inatTotal: 0, gbifTotal: 0, countyTotal: 0 };
  }

  const counts: Record<string, number> = {};
  let inatTotal = 0;
  let gbifTotal = 0;

  if (inatId !== null) {
    const inatCounts = await fetchINatCounts(inatId);
    for (const [c, n] of Object.entries(inatCounts)) {
      counts[c] = (counts[c] ?? 0) + n;
      inatTotal += n;
    }
    await sleep(POLITE_DELAY_MS);
  }
  if (gbifKey !== null) {
    const gbifCounts = await fetchGbifCounts(gbifKey);
    for (const [c, n] of Object.entries(gbifCounts)) {
      counts[c] = (counts[c] ?? 0) + n;
      gbifTotal += n;
    }
    // GBIF tolerates a fast cadence; small delay just to be polite.
    await sleep(200);
  }

  const counties = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  const countyTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  const prevCounts = species.county_record_counts ?? {};
  const prevCounties = species.counties ?? [];
  const prevSig = JSON.stringify({ counts: prevCounts, counties: prevCounties });
  const nextSig = JSON.stringify({ counts, counties });

  if (prevSig === nextSig && species.last_refreshed === today) {
    return { changed: false, inatTotal, gbifTotal, countyTotal };
  }

  species.counties = counties;
  species.county_record_counts = counts;
  species.last_refreshed = today;

  if (!DRY_RUN) {
    await writeFile(path, JSON.stringify(species, null, 2) + "\n");
  }
  return { changed: true, inatTotal, gbifTotal, countyTotal };
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  log(`Mode: ${DRY_RUN ? "DRY-RUN" : NO_COMMIT ? "NO-COMMIT" : NO_PUSH ? "COMMIT-ONLY" : "COMMIT+PUSH"}`);
  if (ONLY_SET) log(`--only filter: ${[...ONLY_SET].join(", ")}`);
  if (RESUME) log(`--resume: skipping species whose last_refreshed === today`);

  const today = new Date().toISOString().slice(0, 10);

  const allFiles = (await readdir(SPECIES_DIR)).filter((f) =>
    f.endsWith(".json")
  );
  let files = allFiles;
  if (ONLY_SET) {
    files = allFiles.filter((f) => ONLY_SET.has(f.replace(/\.json$/, "")));
  }

  log(`Total species files: ${files.length} (of ${allFiles.length} in tree)`);

  let changed = 0;
  let skipped = 0;
  let errored = 0;
  let totalGbif = 0;
  let totalInat = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const id = f.replace(/\.json$/, "");

    if (RESUME) {
      const raw = await readFile(join(SPECIES_DIR, f), "utf8");
      const sp = JSON.parse(raw) as SpeciesShape;
      if (sp.last_refreshed === today) {
        skipped++;
        continue;
      }
    }

    try {
      const result = await processFile(f, today);
      if (result.changed) {
        changed++;
        totalGbif += result.gbifTotal;
        totalInat += result.inatTotal;
        log(
          `[${i + 1}/${files.length}] ${id} → ${result.countyTotal} records (iNat ${result.inatTotal} + GBIF ${result.gbifTotal})`
        );
      } else {
        skipped++;
      }
    } catch (err) {
      errored++;
      log(`[${i + 1}/${files.length}] ${id} ✗ ${(err as Error).message}`);
    }
  }

  log(
    `\nDone. changed=${changed} skipped=${skipped} errored=${errored} totalGbif=${totalGbif} totalInat=${totalInat}`
  );

  if (NO_COMMIT) {
    log(`(no-commit: skipping git)`);
    return;
  }
  if (changed === 0) {
    log(`(nothing to commit)`);
    return;
  }

  try {
    execSync("git add data/species", { stdio: "inherit" });
    const commitMsg = `Backfill distribution snapshots: include GBIF\n\nRebuild county_record_counts for ${changed} species via scripts/backfill-distribution.ts.\nMerges iNat research-grade observations with GBIF non-iNat records.`;
    execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { stdio: "inherit" });
    if (!NO_PUSH) execSync("git push", { stdio: "inherit" });
  } catch (err) {
    log(`⚠ git step failed: ${(err as Error).message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

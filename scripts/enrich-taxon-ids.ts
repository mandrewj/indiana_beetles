/**
 * One-shot: walk every species JSON file under data/species/, query iNat
 * (and optionally GBIF) for the scientific name, write the matched taxon IDs
 * back. Skips files that already have valid IDs unless --force is passed.
 *
 * Usage:  npm run data:taxon-ids
 *         npm run data:taxon-ids -- --force        (re-fetch even if set)
 *         npm run data:taxon-ids -- --skip-gbif    (iNat only)
 *         npm run data:taxon-ids -- --skip-inat    (GBIF only)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SPECIES_DIR = join(process.cwd(), "data", "species");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const SKIP_GBIF = args.has("--skip-gbif");
const SKIP_INAT = args.has("--skip-inat");

interface SpeciesShape {
  id: string;
  scientific_name?: string;
  gbif_taxon_key?: number | string | null;
  inat_taxon_id?: number | string | null;
  [k: string]: unknown;
}

function isValidId(v: unknown): boolean {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return true;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isInteger(n) && n > 0;
  }
  return false;
}

async function lookupINat(name: string): Promise<number | null> {
  const url =
    "https://api.inaturalist.org/v1/taxa?q=" +
    encodeURIComponent(name) +
    "&rank=species&per_page=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iNat ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ id: number; name?: string }> };
  const top = data.results?.[0];
  if (!top) return null;
  // Sanity check: top result's name should fuzzy-match the queried name.
  if (top.name && top.name.toLowerCase() !== name.toLowerCase()) {
    process.stdout.write(`  ! iNat top match was "${top.name}" (queried "${name}") — using anyway\n`);
  }
  return top.id;
}

async function lookupGbif(name: string): Promise<number | null> {
  const url =
    "https://api.gbif.org/v1/species/match?name=" +
    encodeURIComponent(name) +
    "&strict=false";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GBIF ${res.status}`);
  const data = (await res.json()) as {
    usageKey?: number;
    speciesKey?: number;
    matchType?: string;
    canonicalName?: string;
  };
  const key = data.usageKey ?? data.speciesKey;
  if (!key) return null;
  if (data.canonicalName && data.canonicalName.toLowerCase() !== name.toLowerCase()) {
    process.stdout.write(`  ! GBIF top match was "${data.canonicalName}" (queried "${name}") — using anyway\n`);
  }
  return key;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const files = (await readdir(SPECIES_DIR)).filter((f) => f.endsWith(".json"));
  process.stdout.write(`Found ${files.length} species files.\n\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const path = join(SPECIES_DIR, file);
    const raw = await readFile(path, "utf8");
    const sp = JSON.parse(raw) as SpeciesShape;
    const name = sp.scientific_name;
    if (!name) {
      process.stdout.write(`SKIP  ${sp.id} — no scientific_name\n`);
      skipped++;
      continue;
    }

    const needsInat = !SKIP_INAT && (FORCE || !isValidId(sp.inat_taxon_id));
    const needsGbif = !SKIP_GBIF && (FORCE || !isValidId(sp.gbif_taxon_key));

    if (!needsInat && !needsGbif) {
      process.stdout.write(`OK    ${name} (already populated)\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`---- ${name}\n`);

    if (needsInat) {
      try {
        const id = await lookupINat(name);
        if (id) {
          sp.inat_taxon_id = id;
          process.stdout.write(`  iNat  ✓ ${id}\n`);
        } else {
          process.stdout.write(`  iNat  ✗ no match\n`);
        }
      } catch (e) {
        process.stdout.write(`  iNat  ✗ ${(e as Error).message}\n`);
        failed++;
      }
      await sleep(400); // polite to iNat rate limits
    }

    if (needsGbif) {
      try {
        const key = await lookupGbif(name);
        if (key) {
          sp.gbif_taxon_key = key;
          process.stdout.write(`  GBIF  ✓ ${key}\n`);
        } else {
          process.stdout.write(`  GBIF  ✗ no match\n`);
        }
      } catch (e) {
        process.stdout.write(`  GBIF  ✗ ${(e as Error).message}\n`);
        failed++;
      }
      await sleep(400);
    }

    await writeFile(path, JSON.stringify(sp, null, 2) + "\n");
    updated++;
  }

  process.stdout.write(
    `\nDone. Updated ${updated}, skipped ${skipped}, ${failed} API failure${failed === 1 ? "" : "s"}.\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

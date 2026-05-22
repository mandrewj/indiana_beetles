/**
 * One-shot: walk every species JSON file under data/species/, query iNat
 * (and optionally GBIF) for the scientific name, write the matched taxon IDs
 * back. Strict by default — verifies the matched taxon's name equals the
 * queried name (case-insensitive) before accepting; otherwise logs and
 * leaves the field as null so a human can resolve.
 *
 * Usage:  npm run data:taxon-ids
 *         npm run data:taxon-ids -- --force        (re-fetch + verify even if set)
 *         npm run data:taxon-ids -- --verify       (verify existing IDs only)
 *         npm run data:taxon-ids -- --skip-gbif    (iNat only)
 *         npm run data:taxon-ids -- --skip-inat    (GBIF only)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SPECIES_DIR = join(process.cwd(), "data", "species");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const VERIFY = args.has("--verify");
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

async function fetchINatTaxonName(id: number): Promise<string | null> {
  const res = await fetch(`https://api.inaturalist.org/v1/taxa/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ name?: string }> };
  return data.results?.[0]?.name ?? null;
}

async function lookupINat(name: string): Promise<number | null> {
  // Scan up to 10 candidates and require an exact (case-insensitive) name
  // match. Falls through to null if no candidate matches — better to leave
  // the field empty than to bind a wrong species like Clemensia albata to
  // Calosoma scrutator (iNat ID 81672 was wrong in the prototype data).
  const url =
    "https://api.inaturalist.org/v1/taxa?q=" +
    encodeURIComponent(name) +
    "&rank=species&per_page=10";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iNat ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ id: number; name?: string }> };
  const target = name.toLowerCase();
  for (const r of data.results ?? []) {
    if (r.name && r.name.toLowerCase() === target) return r.id;
  }
  return null;
}

async function lookupGbif(name: string): Promise<number | null> {
  const url =
    "https://api.gbif.org/v1/species/match?name=" +
    encodeURIComponent(name) +
    "&strict=true&kingdom=Animalia";
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
  // GBIF's strict mode + canonicalName check.
  if (
    data.canonicalName &&
    data.canonicalName.toLowerCase() !== name.toLowerCase()
  ) {
    return null;
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

    // In --verify mode, re-resolve existing IDs and reject mismatches.
    if (VERIFY) {
      if (!SKIP_INAT && isValidId(sp.inat_taxon_id)) {
        const id = Number(sp.inat_taxon_id);
        const actualName = await fetchINatTaxonName(id);
        if (actualName && actualName.toLowerCase() !== name.toLowerCase()) {
          process.stdout.write(
            `BAD   ${name} — iNat ${id} resolves to "${actualName}" (clearing)\n`
          );
          sp.inat_taxon_id = null;
        }
        await sleep(400);
      }
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

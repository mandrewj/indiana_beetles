/**
 * One-shot: walk every family JSON file under data/families/, query iNat
 * for the family-level taxon, write the inat_taxon_id back. Mirrors
 * enrich-taxon-ids.ts but for families (rank=family vs rank=species).
 *
 * Usage:  npm run data:family-ids
 *         npm run data:family-ids -- --force   (re-fetch even if set)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FAMILIES_DIR = join(process.cwd(), "data", "families");
const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");

interface FamilyShape {
  id: string;
  name?: string;
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

async function lookupFamily(name: string): Promise<number | null> {
  const url =
    "https://api.inaturalist.org/v1/taxa?q=" +
    encodeURIComponent(name) +
    "&rank=family&per_page=10";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iNat ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ id: number; name?: string }> };
  const target = name.toLowerCase();
  for (const r of data.results ?? []) {
    if (r.name && r.name.toLowerCase() === target) return r.id;
  }
  return null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const files = (await readdir(FAMILIES_DIR)).filter((f) => f.endsWith(".json"));
  process.stdout.write(`Found ${files.length} family files.\n\n`);

  for (const file of files) {
    const path = join(FAMILIES_DIR, file);
    const raw = await readFile(path, "utf8");
    const fam = JSON.parse(raw) as FamilyShape;
    if (!fam.name) {
      process.stdout.write(`SKIP  ${fam.id} — no name\n`);
      continue;
    }
    if (!FORCE && isValidId(fam.inat_taxon_id)) {
      process.stdout.write(`OK    ${fam.name} (already populated)\n`);
      continue;
    }
    try {
      const id = await lookupFamily(fam.name);
      if (id) {
        fam.inat_taxon_id = id;
        await writeFile(path, JSON.stringify(fam, null, 2) + "\n");
        process.stdout.write(`---- ${fam.name}  iNat ✓ ${id}\n`);
      } else {
        process.stdout.write(`---- ${fam.name}  iNat ✗ no match\n`);
      }
    } catch (e) {
      process.stdout.write(`---- ${fam.name}  iNat ✗ ${(e as Error).message}\n`);
    }
    await sleep(400);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

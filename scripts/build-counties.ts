/**
 * One-shot build script (committed output, run rarely):
 *
 *   1. Fetch us-atlas counties-10m.json (TopoJSON of US counties).
 *   2. Filter to Indiana (state FIPS = 18) — 92 features.
 *   3. Write the filtered TopoJSON to public/data/indiana-counties.json
 *      (loaded by the choropleth at runtime).
 *   4. Derive a canonical { countyName: stateCountyFIPS } map and write to
 *      data/county-lookup.json (used to join GBIF/iNat coordinates to
 *      counties and to look up the polygon for a record).
 *
 * Run with:  npm run data:counties
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const US_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

const ROOT = process.cwd();
const TOPO_OUT = join(ROOT, "public", "data", "indiana-counties.json");
const FIPS_OUT = join(ROOT, "data", "county-lookup.json");

interface TopoArcEntry {
  type: string;
  id?: string;
  arcs?: unknown;
  geometries?: TopoArcEntry[];
  properties?: { name?: string };
}

interface UsAtlas {
  type: "Topology";
  arcs: number[][][];
  transform?: unknown;
  bbox?: number[];
  objects: {
    counties: { type: "GeometryCollection"; geometries: TopoArcEntry[] };
    states: { type: "GeometryCollection"; geometries: TopoArcEntry[] };
    nation: { type: "GeometryCollection"; geometries: TopoArcEntry[] };
  };
}

async function main() {
  process.stdout.write(`Fetching ${US_ATLAS_URL} … `);
  const res = await fetch(US_ATLAS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch us-atlas: ${res.status} ${res.statusText}`);
  }
  const topo = (await res.json()) as UsAtlas;
  process.stdout.write("ok\n");

  const indianaCounties = topo.objects.counties.geometries.filter(
    (g) => typeof g.id === "string" && g.id.startsWith("18")
  );

  if (indianaCounties.length !== 92) {
    throw new Error(
      `Expected 92 Indiana counties, got ${indianaCounties.length}.`
    );
  }

  // Slim TopoJSON: keep arcs (shared by all geometries), drop other states'
  // counties + the states/nation objects we don't need.
  const slim = {
    type: topo.type,
    transform: topo.transform,
    bbox: topo.bbox,
    arcs: topo.arcs,
    objects: {
      counties: {
        type: "GeometryCollection" as const,
        geometries: indianaCounties,
      },
    },
  };

  await mkdir(join(ROOT, "public", "data"), { recursive: true });
  await writeFile(TOPO_OUT, JSON.stringify(slim));
  process.stdout.write(
    `Wrote ${TOPO_OUT.replace(ROOT + "/", "")} (${indianaCounties.length} counties)\n`
  );

  // Derive name → FIPS. us-atlas uses "St. Joseph" with period; we preserve
  // exactly as the source has it so downstream string matching works.
  const lookup: Record<string, string> = {};
  for (const c of indianaCounties) {
    const name = c.properties?.name;
    if (!name || !c.id) continue;
    lookup[name] = c.id;
  }

  // Sort alphabetically for stable diffs.
  const sorted = Object.fromEntries(
    Object.entries(lookup).sort(([a], [b]) => a.localeCompare(b))
  );

  await writeFile(FIPS_OUT, JSON.stringify(sorted, null, 2) + "\n");
  process.stdout.write(
    `Wrote ${FIPS_OUT.replace(ROOT + "/", "")} (${Object.keys(sorted).length} entries)\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

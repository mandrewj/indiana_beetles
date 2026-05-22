/**
 * Client-side resolver: [lng, lat] → Indiana county name.
 *
 * Loads /data/indiana-counties.json (pre-baked by scripts/build-counties.ts)
 * once per session, converts to GeoJSON features, runs a point-in-polygon
 * test using d3-geo's geoContains.
 *
 * Used as a fallback when iNat's place_guess string doesn't contain a "Co."
 * marker (most don't) and when GBIF's `county` field is missing.
 */
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { INDIANA_COUNTIES_TOPOJSON_URL } from "./counties";

type CountyProps = { name?: string };
type CountyFeature = Feature<Geometry, CountyProps>;

let __cached: Promise<CountyFeature[] | null> | null = null;

function loadFeatures(): Promise<CountyFeature[] | null> {
  if (__cached) return __cached;
  __cached = (async () => {
    try {
      const res = await fetch(INDIANA_COUNTIES_TOPOJSON_URL);
      if (!res.ok) return null;
      const topo = (await res.json()) as Topology;
      const fc = feature(
        topo,
        topo.objects.counties as GeometryCollection<CountyProps>
      ) as { features: CountyFeature[] };
      return fc.features;
    } catch {
      return null;
    }
  })();
  return __cached;
}

/**
 * Look up the Indiana county containing [lng, lat]. Returns the canonical
 * county name (e.g. "St. Joseph") or null if the point is outside Indiana
 * (or the polygons couldn't be loaded).
 */
export async function resolveCounty(
  lng: number,
  lat: number
): Promise<string | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const features = await loadFeatures();
  if (!features) return null;
  for (const f of features) {
    if (geoContains(f, [lng, lat])) {
      return f.properties?.name ?? null;
    }
  }
  return null;
}

/**
 * Batch variant — resolve N points at once. Loads features once, scans
 * features for each point. Returns aligned array of names (null if outside).
 */
export async function resolveCounties(
  points: Array<[number, number] | null>
): Promise<Array<string | null>> {
  const features = await loadFeatures();
  if (!features) return points.map(() => null);
  return points.map((p) => {
    if (!p) return null;
    const [lng, lat] = p;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    for (const f of features) {
      if (geoContains(f, [lng, lat])) {
        return f.properties?.name ?? null;
      }
    }
    return null;
  });
}

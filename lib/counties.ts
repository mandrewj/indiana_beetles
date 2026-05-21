/**
 * Runtime helpers for Indiana county geometry.
 * The actual TopoJSON is pre-baked into /public/data/indiana-counties.json
 * by scripts/build-counties.ts and is fetched lazily by client components.
 */

import type { CountyLookup } from "./types";
import countyLookup from "@/data/county-lookup.json";

const LOOKUP = countyLookup as CountyLookup;

export function fipsFor(countyName: string): string | undefined {
  return LOOKUP[countyName];
}

export function countyNameFor(fips: string): string | undefined {
  for (const [name, code] of Object.entries(LOOKUP)) {
    if (code === fips) return name;
  }
  return undefined;
}

export const ALL_COUNTY_NAMES: ReadonlyArray<string> = Object.keys(LOOKUP).sort(
  (a, b) => a.localeCompare(b)
);

export const COUNTY_LOOKUP: CountyLookup = LOOKUP;

export const INDIANA_COUNTIES_TOPOJSON_URL = "/data/indiana-counties.json";

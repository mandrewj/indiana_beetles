/**
 * iNaturalist v1 API client. Browser-side.
 * Endpoint: https://api.inaturalist.org/v1
 * CORS-enabled, no auth required for read-only queries.
 *
 * Place IDs of interest:
 *   Indiana (US state): 30
 */
import { withCache } from "./cache";

const API = "https://api.inaturalist.org/v1";
const INDIANA_PLACE_ID = 30;

interface RawINatPhoto {
  id: number;
  license_code: string | null;
  url: string;
  attribution?: string;
}

interface RawINatPlace {
  name?: string;
  display_name?: string;
}

interface RawINatUser {
  login?: string;
  name?: string;
}

interface RawINatObservation {
  id: number;
  uuid: string;
  observed_on?: string | null;
  observed_on_string?: string | null;
  uri: string;
  license_code: string | null;
  user?: RawINatUser;
  place_guess?: string;
  places?: RawINatPlace[];
  photos: RawINatPhoto[];
}

interface RawINatResponse {
  total_results: number;
  results: RawINatObservation[];
}

export interface INatPhoto {
  id: number;
  url: string;
  largeUrl: string;
  license: string;
  observationUrl: string;
  observationId: number;
  user: string;
  county: string | null;
  date: string | null;
}

export interface INatObservation {
  id: number;
  observationUrl: string;
  date: string | null;
  user: string;
  county: string | null;
  license: string;
}

const COUNTY_FROM_PLACE_GUESS = /([A-Z][a-z\.]+(?:\s[A-Z][a-z]+)*) Co\.?/;

function extractCounty(obs: RawINatObservation): string | null {
  // Prefer parsing place_guess — iNat returns things like
  // "Bloomington, Monroe Co., IN, US".
  if (obs.place_guess) {
    const m = obs.place_guess.match(COUNTY_FROM_PLACE_GUESS);
    if (m) return m[1];
  }
  // Fallback: a place named "<X> County, ..." in obs.places.
  for (const place of obs.places ?? []) {
    const name = place.name || place.display_name || "";
    const m = name.match(/^([A-Z][a-z\.]+(?:\s[A-Z][a-z]+)*) County/);
    if (m) return m[1];
  }
  return null;
}

function squareUrl(url: string): string {
  // iNat photo URLs come back at "square" by default; "medium" looks better.
  // The path segment to replace is `/square.` → `/medium.`.
  return url.replace(/\/(square|small|thumb)\./, "/medium.");
}

function largeUrl(url: string): string {
  return url.replace(/\/(square|small|thumb|medium)\./, "/large.");
}

async function fetchObservations(params: URLSearchParams): Promise<RawINatResponse> {
  const url = `${API}/observations?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`iNat ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as RawINatResponse;
}

/**
 * Top community photos for a taxon in Indiana — best-of for the gallery.
 */
export async function fetchTopINatPhotos(
  taxonId: number,
  limit: number = 12
): Promise<INatPhoto[]> {
  if (!Number.isInteger(taxonId) || taxonId <= 0) return [];
  return withCache(
    "inat-photos",
    `${taxonId}-${limit}`,
    async () => {
      const params = new URLSearchParams({
        taxon_id: String(taxonId),
        place_id: String(INDIANA_PLACE_ID),
        photos: "true",
        per_page: String(limit),
        order: "desc",
        order_by: "votes",
      });
      const data = await fetchObservations(params);
      const photos: INatPhoto[] = [];
      for (const obs of data.results) {
        const ph = obs.photos[0];
        if (!ph) continue;
        photos.push({
          id: ph.id,
          url: squareUrl(ph.url),
          largeUrl: largeUrl(ph.url),
          license: ph.license_code ?? "all rights reserved",
          observationUrl: obs.uri,
          observationId: obs.id,
          user: obs.user?.login ?? obs.user?.name ?? "unknown",
          county: extractCounty(obs),
          date: obs.observed_on ?? obs.observed_on_string ?? null,
        });
      }
      return photos;
    }
  );
}

/**
 * Recent Indiana observations (for the Records table).
 */
export async function fetchINatObservations(
  taxonId: number,
  limit: number = 50
): Promise<INatObservation[]> {
  if (!Number.isInteger(taxonId) || taxonId <= 0) return [];
  return withCache(
    "inat-obs",
    `${taxonId}-${limit}`,
    async () => {
      const params = new URLSearchParams({
        taxon_id: String(taxonId),
        place_id: String(INDIANA_PLACE_ID),
        per_page: String(limit),
        order: "desc",
        order_by: "observed_on",
        quality_grade: "research",
      });
      const data = await fetchObservations(params);
      return data.results.map((obs) => ({
        id: obs.id,
        observationUrl: obs.uri,
        date: obs.observed_on ?? obs.observed_on_string ?? null,
        user: obs.user?.login ?? obs.user?.name ?? "unknown",
        county: extractCounty(obs),
        license: obs.license_code ?? "all rights reserved",
      }));
    }
  );
}

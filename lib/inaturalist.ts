/**
 * iNaturalist v1 API client. Browser-side.
 * Endpoint: https://api.inaturalist.org/v1
 * CORS-enabled, no auth required for read-only queries.
 *
 * Place IDs of interest:
 *   Indiana (US state): 30
 */
import { withCache } from "./cache";
import { resolveCounty } from "./county-resolver";

const API = "https://api.inaturalist.org/v1";
// Indiana, US — verified via /v1/places/autocomplete. (place_id 30 is
// North Carolina; we had it wrong in earlier revisions.)
const INDIANA_PLACE_ID = 20;

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

interface RawINatGeoJSON {
  coordinates?: [number, number];
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
  geojson?: RawINatGeoJSON;
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

export interface INatTaxonThumbnail {
  taxonId: number;
  url: string;
  attribution: string;
}

const COUNTY_FROM_PLACE_GUESS = /([A-Z][a-z\.]+(?:\s[A-Z][a-z]+)*) Co\.?/;
const COUNTY_FROM_NAME = /^([A-Z][a-z\.]+(?:\s[A-Z][a-z]+)*) County/;

function stringCountyOnly(obs: RawINatObservation): string | null {
  // Try place_guess first — iNat returns things like
  // "Bloomington, Monroe Co., IN, US" when the observer entered a city +
  // county locality. Most observations don't have this form, so this
  // resolves only the well-formatted minority.
  if (obs.place_guess) {
    const m = obs.place_guess.match(COUNTY_FROM_PLACE_GUESS);
    if (m) return m[1];
  }
  for (const place of obs.places ?? []) {
    const name = place.name || place.display_name || "";
    const m = name.match(COUNTY_FROM_NAME);
    if (m) return m[1];
  }
  return null;
}

/**
 * Resolve county for an observation. Tries place_guess parsing first
 * (cheap, no extra fetch); falls back to point-in-polygon against the
 * pre-baked Indiana county geometry when coordinates are present.
 */
async function resolveObsCounty(obs: RawINatObservation): Promise<string | null> {
  const fromString = stringCountyOnly(obs);
  if (fromString) return fromString;
  const coords = obs.geojson?.coordinates;
  if (coords && coords.length === 2) {
    return resolveCounty(coords[0], coords[1]);
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
      const withPhotos = data.results.filter((obs) => obs.photos[0]);
      const counties = await Promise.all(withPhotos.map(resolveObsCounty));
      withPhotos.forEach((obs, i) => {
        const ph = obs.photos[0];
        photos.push({
          id: ph.id,
          url: squareUrl(ph.url),
          largeUrl: largeUrl(ph.url),
          license: ph.license_code ?? "all rights reserved",
          observationUrl: obs.uri,
          observationId: obs.id,
          user: obs.user?.login ?? obs.user?.name ?? "unknown",
          county: counties[i],
          date: obs.observed_on ?? obs.observed_on_string ?? null,
        });
      });
      return photos;
    }
  );
}

/**
 * Batched lookup of default photos for a set of iNat taxon IDs.
 * iNat's /v1/taxa endpoint accepts a comma-separated `id=...` list and
 * returns each taxon with its `default_photo`. Used by the family and
 * genus pages to show real beetle thumbnails when no admin image has
 * been uploaded yet.
 */
export async function fetchTaxaDefaultPhotos(
  taxonIds: number[]
): Promise<Record<number, INatTaxonThumbnail>> {
  const valid = taxonIds.filter((id) => Number.isInteger(id) && id > 0);
  if (valid.length === 0) return {};
  const key = valid.slice().sort((a, b) => a - b).join(",");
  return withCache("inat-default-photos", key, async () => {
    const url = `${API}/taxa?id=${key}&per_page=${valid.length}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iNat ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        default_photo?: {
          square_url?: string;
          small_url?: string;
          medium_url?: string;
          attribution?: string;
        };
      }>;
    };
    const out: Record<number, INatTaxonThumbnail> = {};
    for (const t of data.results ?? []) {
      const p = t.default_photo;
      if (!p) continue;
      const photoUrl = p.medium_url || p.small_url || p.square_url;
      if (!photoUrl) continue;
      out[t.id] = {
        taxonId: t.id,
        url: photoUrl,
        attribution: p.attribution ?? "iNaturalist",
      };
    }
    return out;
  });
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
      const counties = await Promise.all(data.results.map(resolveObsCounty));
      return data.results.map((obs, i) => ({
        id: obs.id,
        observationUrl: obs.uri,
        date: obs.observed_on ?? obs.observed_on_string ?? null,
        user: obs.user?.login ?? obs.user?.name ?? "unknown",
        county: counties[i],
        license: obs.license_code ?? "all rights reserved",
      }));
    }
  );
}

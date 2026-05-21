# Handoff to Claude Code

This document maps every artifact in the design prototype to its destination in the production Next.js codebase, documents the data schema field-by-field, and lists the open work items.

---

## 1. Migration plan

### A. Scaffold (do this first)

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
# (Merge the included next.config.js + package.json overrides afterwards)
npm install d3 topojson-client lucide-react papaparse jspdf jspdf-autotable
npm install -D @types/d3 decap-server
```

### B. Port the design system

The prototype's `styles.css` is the canonical visual definition. Convert each block to the Tailwind config layer:

| Prototype CSS | Tailwind destination |
|---|---|
| `:root` token block | `tailwind.config.ts` → `theme.extend.colors` / `fontFamily` / `boxShadow` |
| `.btn`, `.card`, `.chip` | `@layer components` in `globals.css` |
| `.dx`, `.dx-size`, `.dx-char-*` (Diagnosis card) | One-off CSS or a `<DiagnosisCard>` component with utility classes |
| `.ind-map`, `.county` (D3 styles) | One-off `@layer components` — D3 needs class selectors, not utilities |
| `.admin-*`, `.fset`, `.frow`, `.bip-*` | One-off `@layer components` — admin UI uses Decap, so most of this is reference only |

Lato is loaded via `next/font/google`:

```ts
// app/layout.tsx
import { Lato } from "next/font/google";
const lato = Lato({ subsets: ["latin"], weight: ["300","400","700","900"], variable: "--font-sans" });
```

### C. Port the React components

| Prototype file | Production destination |
|---|---|
| `app.jsx` (router + Tweaks panel) | `app/layout.tsx` + remove Tweaks (prototype-only) |
| `common.jsx` → Nav, Footer, Icon | `components/Nav.tsx`, `components/Footer.tsx`, replace inline Icon with `lucide-react` |
| `common.jsx` → IndianaMap | `components/IndianaMap.tsx`. **Fetch us-atlas once at build time** into `public/data/indiana-counties.geojson` rather than at runtime. |
| `common.jsx` → SpeciesImageGallery | `components/SpeciesImageGallery.tsx` — wire up the real iNat fetch in `useEffect`. |
| `common.jsx` → RecordsTable | `components/RecordsTable.tsx` |
| `pages.jsx` → Home | `app/page.tsx` |
| `pages.jsx` → FamilyPage | `app/browse/[family]/page.tsx` with `generateStaticParams()` |
| `pages.jsx` → SpeciesPage | `app/browse/[family]/[genus]/[species]/page.tsx` |
| `pages.jsx` → Diagnosis, Phenology, Distribution, Records, References blocks | `components/species/*.tsx` |
| `key.jsx` → DichotomousKey | `components/DichotomousKey.tsx` — keep three render modes |
| `admin.jsx` | **Reference only.** Decap CMS provides the actual admin UI. The prototype's custom-widget patterns (status picker, month picker, county map) can be ported as Decap custom widgets — see `admin/widgets/` below. |

### D. Wire content reads

The prototype's `data.js` is an inlined-data shim. In production, each page reads JSON directly:

```ts
// app/browse/[family]/[genus]/[species]/page.tsx
import speciesData from "@/data/species/[id].json";
// or use fs at build time:
import { readFile } from "node:fs/promises";
const sp = JSON.parse(await readFile(`data/species/${params.species}.json`, "utf8"));
```

For `generateStaticParams`, glob all species files at build time.

### E. Custom Decap widgets (optional, recommended)

Decap's defaults render the species form correctly but the prototype's specialized inputs make editing far nicer. Port these as custom widgets:

| Prototype control | Decap widget destination |
|---|---|
| Status picker (4-tile semantic) | `admin/widgets/status-picker.js` |
| Month picker (active / peak cycle) | `admin/widgets/phenology-picker.js` |
| Indiana county map selector | `admin/widgets/county-map.js` |
| Diagnostic-characters repeater (capped at 3) | Use built-in `list` widget with `max: 3` (already in config.yml) |
| Batch import from GBIF / iNat | This is **outside Decap's scope** — implement as a separate admin tool. Either: (a) a `/admin-tools` Next.js route gated by GitHub auth, or (b) a Node CLI script run by editors. Recommend (b) for trustworthiness; CLI can write JSON files directly. |

---

## 2. Data schema

### `/data/taxonomy.json`
Top-level family→genus→species hierarchy. Build-time index — not edited directly.

### `/data/families/[id].json`
```ts
{
  id: string;             // lower_snake_case
  name: string;           // "Carabidae"
  common_name: string;    // "Ground Beetles"
  authority: string;
  diagnosis: string;      // 2-4 sentence prose, asterisks for italic
  species_count: number;  // IN
  genus_count: number;    // IN
  confirmed_count?: number;
  historical_count?: number;
  adventive_count?: number;
}
```

### `/data/species/[id].json`
```ts
{
  id: string;
  scientific_name: string;
  authority: string;
  common_name: string;
  family: string;                       // family id
  genus: string;                        // genus id
  indiana_status: "confirmed" | "historical" | "adventive" | "excluded";
  gbif_taxon_key: number | null;
  inat_taxon_id: number | null;
  diagnosis: string;
  body_size_mm: string;                 // free-form, e.g. "25–35"
  diagnostic_characters: Array<{
    label: string;                      // "Elytral color"
    value: string;                      // "Brilliant metallic green"
    note?: string;                      // amplifying note shown under value
  }>;                                   // capped at 3
  phenology: number[];                  // 1–12, active months
  phenology_peak: number[];             // 1–12, subset of phenology
  counties: string[];                   // county names from data/county-lookup.json
  county_record_counts?: Record<string, number>;
  images: Array<{
    url: string;                        // /images/species/[id]/<file>.jpg
    credit: string;
    caption?: string;
    type: "habitus" | "detail" | "habitat" | "larva" | "genitalia";
  }>;
  similar_species: string[];            // species ids
  similar_species_notes?: Record<string, string>;
  references: string[];                 // citations (markdown italic with *...*)
}
```

### `/data/keys/[id]-key.json`
Two structures supported. Renderer detects via `scope`:

**Structure A** — `scope: "species"`:
```ts
{
  type: "dichotomous";
  scope: "species";
  family: string;                       // family id
  title: string;
  couplets: Array<{
    id: number;
    lead_a: { text: string; image_url?: string; goto: number | string };
    lead_b: { text: string; image_url?: string; goto: number | string };
  }>;
}
```
`goto` is either another couplet id (number) or a taxon id (string).

**Structure B** — `scope: "genera"` adds:
```ts
{
  ...                                   // same shape as above plus:
  genus_keys: Array<{
    genus: string;                      // genus id
    title: string;
    couplets: ...                       // same shape
  }>;
}
```

The top-level `family-key.json` uses `scope: "families"` and terminates at family ids.

### `/data/glossary.json`
Array of `{ term, def, image_url? }`.

### `/data/county-lookup.json`
`{ "Marion": "18097", ... }`. **The values in the prototype are placeholders.** Replace with real Census 2010 county FIPS codes during migration — these are used to join GBIF/iNat occurrence coordinates to county polygons.

---

## 3. Open work

- **Logo**: drop the InsectID-brand.png into `/public/images/insectID.png` and replace the placeholder beetle mark in `components/Nav.tsx`. Aspect ratio is ~2.31:1 — never style with equal width/height.
- **Real county FIPS table**: replace `/data/county-lookup.json` placeholders with TIGER 2010 codes.
- **GBIF & iNat fetch implementations**: the prototype mocks these. Production endpoints documented in the original spec — see `app/api/...` removal note (no API routes; client-side `fetch` from page components).
- **Custom Decap widgets** for status picker, month picker, county map selector (see Section 1.E).
- **Batch importer CLI** — separate from Decap, implements `Sync from GBIF/iNat` as a Node script that writes scaffolded JSON files.
- **OAuth proxy** — host `decap-server` somewhere accessible (small Vercel deploy or a Cloudflare Worker) and set `backend.base_url` in `public/admin/config.yml`.
- **Validation**: GBIF/iNat taxon-key verification on save (Decap supports a `pattern` validator; for live lookups, use the editor preview hook).
- **Other family treatments**: `/data/families/*.json` and `/data/species/*.json` outside Carabidae are scaffolded stubs only.

---

## 4. Prototype-only artifacts (do not port)

- `tweaks-panel.jsx` and Tweaks references in `app.jsx` — design exploration tool, not a product feature.
- `data.js` — inlined-data shim. The `/data/*.json` files are canonical.
- Hash-based routing (`location.hash`) — Next.js App Router replaces this entirely.
- The mock iNat photo tiles in `SpeciesImageGallery` — production wires up the real fetch.
- The mock candidate-taxa lists (`MISSING_FROM_GBIF`, `MISSING_FROM_INAT`) in `admin.jsx` — replaced by the real importer CLI.

---

## 5. Style guide reference

`uploads/STYLE_GUIDE.md` is the InsectID lab visual system. Lato everywhere, blue-800 headings, blue-600 accent, cool gray surfaces, viridis choropleth. Don't substitute another sequential ramp for the map — viridis is colorblind-safe and matches the rest of the lab's properties.

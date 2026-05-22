# CLAUDE.md — guidance for future Claude sessions on this project

## Behavior

- **Always ask clarifying questions when the request is ambiguous or has more than one reasonable interpretation.** This project has a lot of cross-cutting concerns (CMS schema ↔ runtime types ↔ external API shapes ↔ caching) and a small misread can cascade into a wrong design. Prefer one round-trip with the user over a confident wrong answer.
- Use `AskUserQuestion` when there are two or three concrete options to pick between (architecture, UX direction, scope cuts). Don't ask about trivia like file names or whitespace.
- This is a Vercel Hobby tier deployment with no database. The user explicitly chose to stay on free Vercel + Decap-commits-to-GitHub. If a feature would require a database, scheduled job, or paid plan, surface that before designing the implementation.

## Architecture you should remember

- **Static-by-default Next.js.** No `output: 'export'` flag (we dropped it so the OAuth functions can live in the same project), but every page is prerendered at build time. Only `/api/auth` and `/api/callback` are dynamic.
- **No database.** Source of truth is the flat JSON files in `data/`. Decap edits commit them to GitHub. Vercel rebuilds on push.
- **Live data is client-side.** GBIF + iNat fetches run in the browser, cached 24h in `localStorage` via `lib/cache.ts`. Bump `VERSION` in that file when the cached payload shape changes — old entries become unreadable and refetch on next visit.
- **iNat scope.** Indiana is iNat `place_id=20` (not 30; 30 is North Carolina — we hit that bug once). The gallery + tile grid try Indiana first, then fall back to global if there are zero Indiana observations.
- **County resolution.** Most iNat `place_guess` strings don't include "Co." — point-in-polygon against the bundled Indiana TopoJSON (`lib/county-resolver.ts`) is the authoritative path. Used as a fallback in both `lib/inaturalist.ts` and `lib/gbif.ts`.
- **iNat ↔ GBIF dedup.** iNaturalist research-grade observations are mirrored into GBIF as dataset `50c9509d-22c7-4a22-a47d-8c48425ef4a7`. `lib/gbif.ts` filters them out so the distribution aggregator + records table don't double-count — the iNat side serves those records directly with richer metadata.

## Decap quirks worth knowing

- Custom widgets must register **before** `CMS.init()` runs. We use `window.CMS_MANUAL_INIT = true` in `public/admin/index.html` so `widgets.js` can register before validation. Don't change that pattern lightly.
- The `registerWidget` schema argument validates the **field config object**, not the value. Don't pass `{type: "string"}` (that was a real bug — it broke `status-picker` and the validator surfaced misleading errors on other unrelated fields).
- Decap writes empty number fields as `""`, not `null`. Use `taxonIdOrNull()` from `lib/types.ts` for any taxon-id check; bare `!= null` lets empty strings through.
- Preview pane is disabled per-collection (`editor: { preview: false }`). If we ever want a real preview, it would mean rebuilding species-page components inside Decap's separate React tree — sizable work; ask before starting.

## When you add an external API call

- Add to `lib/` with a clear naming convention (`fetchXxx`), wrap with `withCache()`.
- Guard against invalid IDs at the function boundary (`if (!Number.isInteger(id) || id <= 0) return [];`) — saves an external request and silent corruption.
- If the cached payload shape changes, bump `lib/cache.ts` `VERSION`.

## Family counts: literature estimate vs. treated

`family.species_count` and `family.genus_count` are **literature estimates** of total Indiana fauna for that family. They're hand-set in the JSON, not derived. The actual count of species in our dataset comes from walking `taxonomy.json` (e.g. `taxFamily.genera.length`).

UI shows both as **`treated/estimated`** (e.g. "3 of 92 species treated"). Don't auto-update the estimates from Discover; the `counts_reference` field on each family captures the citation behind the totals (e.g. "Larochelle & Larivière 2003"). The `notes` field is for family-level editorial remarks.

## Things to leave alone unless explicitly asked

- `data/county-lookup.json` and `public/data/indiana-counties.json` are committed outputs of `scripts/build-counties.ts`. Don't hand-edit; regenerate with `npm run data:counties`.
- The prototype's CSS lives in `app/globals.css` and many component classes (`.btn`, `.feat`, `.dx`, `.ind-map`, `.species-row`, etc.) are referenced by name throughout. Don't refactor to pure Tailwind unless the user asks — the cost is high and the rendering is currently correct.

## Common operations

- **Add a new species/family treatment:** Editors do this via Decap. If asked to do it from the CLI, write the JSON file directly under `data/species/` or `data/families/`, then run `npm run data:taxon-ids` to populate the IDs.
- **Fix a wrong iNat ID:** `npm run data:taxon-ids -- --verify` re-resolves existing IDs against `/v1/taxa/{id}` and clears mismatches. Then run again to refill.
- **Force-invalidate browser caches after a query-scoping change:** Bump `lib/cache.ts` VERSION.

## Deploy verification checklist

After a non-trivial push, verify on the live site:
1. `npx next build` locally — type errors + prerendering still pass.
2. Hit `/admin/` after deploy — Decap loads without config errors.
3. Hit a species page — gallery + records + distribution all populate.
4. Hit `/browse` — family-plate thumbnails load from iNat.
5. Browser console clean (no 4xx/5xx, no React warnings).

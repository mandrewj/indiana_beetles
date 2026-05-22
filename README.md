# Beetles of Indiana

Live at **https://indiana-beetles.vercel.app**.

A scientific reference and identification tool for the beetle fauna (Order Coleoptera) of Indiana, USA. Next.js 14 App Router, TypeScript, Tailwind, deployed on Vercel.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | App Router routes (Home, Browse, Family, Genus, Species, Identify, Glossary, About, Admin landing) plus `/api/auth` + `/api/callback` (Decap OAuth proxy as Vercel Functions). |
| `components/` | Shared UI: Nav, Footer, IndianaMap, DichotomousKey, SpeciesImageGallery, INatTileGrid, RecordsTable, SpeciesThumb, Badges, Placeholders, and `components/species/*` section blocks. |
| `lib/` | `content.ts` (server-only filesystem readers), `types.ts`, `gbif.ts` + `inaturalist.ts` (client-side fetchers), `distribution.ts` (county aggregator), `cache.ts` (versioned localStorage cache), `county-resolver.ts` (point-in-polygon resolver), `counties.ts` (FIPS lookup). |
| `data/` | Flat-JSON content — one file per species, family, key. Source of truth. Edited through Decap. |
| `public/admin/` | Decap CMS mount: `config.yml`, custom `widgets.js`, `styles.css`, `index.html`. |
| `public/data/` | Pre-baked Indiana county TopoJSON (rebuilt with `npm run data:counties`). |
| `scripts/` | One-shot build helpers: county geometry + FIPS, taxon-ID enrichment for species + families. |

## Local development

```bash
npm install
npm run dev               # next dev → http://localhost:3000
npm run cms:dev           # decap-server local proxy (alternative to /api/auth)
npm run data:counties     # rebuild public/data/indiana-counties.json + data/county-lookup.json
npm run data:taxon-ids    # populate iNat + GBIF IDs across data/species/
npm run data:taxon-ids -- --verify  # re-validate existing IDs, clear mismatches
npm run data:family-ids   # populate iNat IDs across data/families/
```

## Architecture notes

- **Static-by-default.** Every page except `/api/*` is prerendered at build time. The site reads `data/*.json` from the filesystem during the Next build; runtime traffic doesn't touch the JSON files.
- **Live data without a database.** GBIF and iNaturalist are queried client-side per species page, with a 24-hour `localStorage` cache (`lib/cache.ts`). The county choropleth uses point-in-polygon against the bundled TopoJSON, so distribution updates whenever an editor sets a taxon ID — no server, no scheduled job.
- **Decap CMS commits to GitHub directly.** Editors hit `/admin/` → authenticate via GitHub OAuth (proxy in `app/api/auth/` + `app/api/callback/`) → save → push → Vercel rebuilds. Custom widgets live in `public/admin/widgets.js`: `taxon-lookup` (number input + auto-lookup button), `status-picker`, `phenology-picker`, `county-map`.

## Deployment

The Vercel project is wired to the `main` branch of `mandrewj/indiana_beetles`. Push to `main` → live in ~60 seconds. The same is true for Decap saves: they land as commits on `main` and trigger a redeploy automatically.

**Required env vars on the Vercel project**: `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` (from the GitHub OAuth app at [github.com/settings/developers](https://github.com/settings/developers)).

## Style system

InsectID lab palette: Lato everywhere, `blue-800` (#0A3F95) headings, `blue-600` (#116dff) primary, viridis for the choropleth, Okabe-Ito for any future categorical encoding. Tokens are duplicated in both `tailwind.config.ts` (utility classes) and `app/globals.css` (CSS variables consumed by component classes ported from the original prototype).

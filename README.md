# Beetles of Indiana

A scientific reference and identification tool for the beetle fauna (Order Coleoptera) of Indiana, USA. Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | App Router routes — Home, Browse, Family, Species, Identify, Distribution, Glossary, About, Admin landing, `/api/auth` + `/api/callback` (Decap OAuth proxy). |
| `components/` | Shared UI primitives — Nav, Footer, IndianaMap, DichotomousKey, SpeciesImageGallery, RecordsTable, Badges, Placeholders, and the species-page section blocks. |
| `lib/` | Server-only content readers (`content.ts`), typed schemas (`types.ts`), GBIF + iNat clients (`gbif.ts`, `inaturalist.ts`), localStorage cache (`cache.ts`), county helpers (`counties.ts`). |
| `data/` | Flat-JSON content (one file per species, family, key). Source of truth for everything the site shows. Edited via Decap. |
| `public/admin/` | Decap CMS mount — `config.yml` defines the collections, `index.html` boots the Decap bundle. |
| `public/data/` | Pre-baked Indiana county geometry (committed; rebuilt with `npm run data:counties`). |
| `scripts/` | One-shot build helpers — county geometry + canonical FIPS. |

## Local development

```bash
npm install
npm run dev          # → http://localhost:3000
npm run cms:dev      # → starts decap-server proxy (alt. to /api/auth in dev)
npm run data:counties  # → rebuild county geometry + FIPS map
```

## Deployment

1. **GitHub repo**: push the contents of this directory to a GitHub repo on `main`.
2. **Vercel project**: import the repo at [vercel.com/new](https://vercel.com/new). Framework preset auto-detected.
3. **Env vars** (Project → Settings → Environment Variables):
   - `OAUTH_GITHUB_CLIENT_ID`
   - `OAUTH_GITHUB_CLIENT_SECRET`
4. **GitHub OAuth app**: create one at [github.com/settings/developers](https://github.com/settings/developers).
   - Homepage URL: `https://<your-vercel-domain>`
   - Authorization callback URL: `https://<your-vercel-domain>/api/callback`
   - Copy Client ID + Secret into the Vercel env vars above.
5. **Decap config**: in `public/admin/config.yml`, replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPO` and `REPLACE_WITH_YOUR_DOMAIN` with your actual values, then commit and push.

After that, the editor lives at `https://<your-domain>/admin/`. Each save commits to GitHub and triggers a fresh Vercel deploy automatically.

## Style guide

The visual system is tuned to match the InsectID lab's other properties: Lato everywhere, blue-800 headings, blue-600 accent, viridis for choropleths, Okabe-Ito for categorical encodings. See the dropped-in token definitions in `tailwind.config.ts` and `app/globals.css`.

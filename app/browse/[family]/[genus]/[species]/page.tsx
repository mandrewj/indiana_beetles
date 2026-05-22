import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  findSpeciesContext,
  getAllSpecies,
  getSpecies,
  getTaxonomy,
} from "@/lib/content";
import { RankLabel, StatusBadge } from "@/components/Badges";
import { SpeciesImageGallery } from "@/components/SpeciesImageGallery";
import { Diagnosis } from "@/components/species/Diagnosis";
import { Phenology } from "@/components/species/Phenology";
import { Distribution } from "@/components/species/Distribution";
import { Records } from "@/components/species/Records";
import { References } from "@/components/species/References";
import {
  SimilarSpecies,
  buildSimilarCandidates,
} from "@/components/species/SimilarSpecies";

interface PageParams {
  family: string;
  genus: string;
  species: string;
}

export async function generateStaticParams() {
  const taxonomy = await getTaxonomy();
  const allSpecies = await getAllSpecies();
  const params: PageParams[] = [];
  for (const sp of allSpecies) {
    const ctx = await findSpeciesContext(sp.id);
    if (!ctx) continue;
    params.push({
      family: ctx.family.id,
      genus: ctx.genusId,
      species: sp.id,
    });
  }
  return params;
}

export async function generateMetadata({ params }: { params: PageParams }) {
  try {
    const sp = await getSpecies(params.species);
    return {
      title: `${sp.scientific_name}${sp.common_name ? ` — ${sp.common_name}` : ""}`,
    };
  } catch {
    return { title: "Species" };
  }
}

export default async function SpeciesPage({ params }: { params: PageParams }) {
  let species;
  try {
    species = await getSpecies(params.species);
  } catch {
    notFound();
  }

  const ctx = await findSpeciesContext(species.id);
  if (!ctx) notFound();
  if (
    ctx.family.id !== params.family ||
    ctx.genusId !== params.genus
  ) {
    notFound();
  }

  const taxonomy = await getTaxonomy();
  const genus = ctx.family.genera.find((g) => g.id === ctx.genusId);
  const similar = buildSimilarCandidates(species, taxonomy);

  const familyDisplay = ctx.family.name;
  const genusDisplay = genus?.name ?? species.genus;
  const shortLabel = species.scientific_name.replace(/^(\w)\w+\s/, "$1. ");

  return (
    <div className="page">
      <div className="container">
        <div className="crumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/browse">Browse</Link>
          <span className="sep">/</span>
          <Link href={`/browse/${ctx.family.id}`}>{familyDisplay}</Link>
          <span className="sep">/</span>
          <Link
            href={`/browse/${ctx.family.id}/${ctx.genusId}`}
            className="sci"
            style={{ fontStyle: "italic" }}
          >
            {genusDisplay}
          </Link>
          <span className="sep">/</span>
          <span className="current sci">
            <em>{shortLabel}</em>
          </span>
        </div>
      </div>

      <div className="container">
        <div className="sp-hero">
          <div className="top">
            <RankLabel>Species</RankLabel>
            <StatusBadge status={species.indiana_status} />
            <div style={{ flex: 1 }} />
            <div
              className="taxon-refs"
              style={{
                fontSize: 11.5,
                color: "var(--gray-500)",
                display: "flex",
                gap: 14,
                letterSpacing: "0.04em",
                fontFamily: "var(--font-mono)",
              }}
            >
              {species.gbif_taxon_key && (
                <a
                  href={`https://www.gbif.org/species/${species.gbif_taxon_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="taxon-ref"
                >
                  GBIF&nbsp;{species.gbif_taxon_key}
                  <ExternalLink
                    size={10}
                    style={{ marginLeft: 4, verticalAlign: "-1px" }}
                  />
                </a>
              )}
              {species.inat_taxon_id && (
                <a
                  href={`https://www.inaturalist.org/taxa/${species.inat_taxon_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="taxon-ref"
                >
                  iNat&nbsp;{species.inat_taxon_id}
                  <ExternalLink
                    size={10}
                    style={{ marginLeft: 4, verticalAlign: "-1px" }}
                  />
                </a>
              )}
            </div>
          </div>
          <h1>
            <em>{species.scientific_name}</em>{" "}
            {species.authority && (
              <span className="auth">{species.authority}</span>
            )}
          </h1>
          {species.common_name && (
            <div className="common">{species.common_name}</div>
          )}
          <div className="meta-line">
            <span>
              <em>{familyDisplay}</em>
            </span>
            {species.body_size_mm && (
              <>
                <span className="sep" />
                <span>{species.body_size_mm} mm</span>
              </>
            )}
            <span className="sep" />
            <span>
              {species.indiana_status === "confirmed"
                ? "Confirmed in Indiana"
                : species.indiana_status === "historical"
                ? "Historical Indiana records"
                : species.indiana_status === "adventive"
                ? "Adventive in Indiana"
                : "Excluded"}
            </span>
          </div>
        </div>
      </div>

      <div className="container sp-body">
        <div className="sp-2col">
          <div className="left">
            <SpeciesImageGallery species={species} />
            {similar.length > 0 && (
              <div style={{ marginTop: "var(--pad-5)" }}>
                <SimilarSpecies species={species} candidates={similar} />
              </div>
            )}
          </div>
          <div className="right">
            <Diagnosis species={species} />
            <Phenology species={species} />
            <Distribution species={species} />
            <Records species={species} />
            <References species={species} />
          </div>
        </div>
      </div>
    </div>
  );
}

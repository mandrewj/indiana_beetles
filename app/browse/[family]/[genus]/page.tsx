import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllSpecies,
  getFamily,
  getTaxonomy,
} from "@/lib/content";
import { RankLabel, StatusBadge } from "@/components/Badges";
import { SpeciesThumb } from "@/components/SpeciesThumb";

interface PageParams {
  family: string;
  genus: string;
}

export async function generateStaticParams() {
  const taxonomy = await getTaxonomy();
  const params: PageParams[] = [];
  for (const fam of taxonomy.families) {
    for (const gen of fam.genera) {
      params.push({ family: fam.id, genus: gen.id });
    }
  }
  return params;
}

export async function generateMetadata({ params }: { params: PageParams }) {
  const taxonomy = await getTaxonomy();
  const fam = taxonomy.families.find((f) => f.id === params.family);
  const gen = fam?.genera.find((g) => g.id === params.genus);
  if (!gen) return { title: "Genus" };
  return { title: `${gen.name} (${fam?.name})` };
}

export default async function GenusPage({ params }: { params: PageParams }) {
  const [taxonomy, family, allSpecies] = await Promise.all([
    getTaxonomy(),
    getFamily(params.family).catch(() => null),
    getAllSpecies(),
  ]);
  if (!family) notFound();
  const taxFamily = taxonomy.families.find((f) => f.id === params.family);
  const genus = taxFamily?.genera.find((g) => g.id === params.genus);
  if (!taxFamily || !genus) notFound();

  // Build a quick id→species lookup for the species in this genus that have
  // full treatment files (so we can show body size, status, etc.).
  const treated = new Map(allSpecies.map((s) => [s.id, s]));

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/browse">Browse</Link>
        <span className="sep">/</span>
        <Link href={`/browse/${family.id}`}>{family.name}</Link>
        <span className="sep">/</span>
        <span className="current sci">
          <em>{genus.name}</em>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--pad-5)",
          alignItems: "end",
          marginBottom: "var(--pad-4)",
        }}
      >
        <div>
          <RankLabel>Genus</RankLabel>
          <h1
            className="display sci"
            style={{
              fontSize: 56,
              margin: "6px 0 4px",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            {genus.name}
          </h1>
          {genus.authority && (
            <div
              style={{
                color: "var(--gray-500)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              {genus.authority}
            </div>
          )}
          {family.genus_notes?.[genus.id] && (
            <p
              style={{
                color: "var(--text-500)",
                lineHeight: 1.65,
                marginTop: "var(--pad-3)",
                maxWidth: "60ch",
              }}
            >
              {family.genus_notes[genus.id]}
            </p>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto",
            gap: "10px 24px",
            alignContent: "end",
          }}
        >
          <div>
            <div className="rank">Species in IN</div>
            <div
              className="display"
              style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}
            >
              {genus.species.length}
            </div>
          </div>
          <div>
            <div className="rank">Family</div>
            <Link
              href={`/browse/${family.id}`}
              className="display"
              style={{ fontSize: 18, lineHeight: 1.2, marginTop: 4 }}
            >
              {family.name}
            </Link>
          </div>
        </div>
      </div>

      <div className="species-list">
        {genus.species.map((s) => {
          const t = treated.get(s.id);
          return (
            <Link
              key={s.id}
              className="species-row"
              href={`/browse/${family.id}/${genus.id}/${s.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <SpeciesThumb
                species={{
                  id: s.id,
                  inat_taxon_id: t?.inat_taxon_id,
                  adminImageUrl: t?.images?.[0]?.url ?? null,
                }}
              />
              <div>
                <div className="name">
                  <em>{s.name}</em>
                  {s.authority && (
                    <span
                      style={{
                        color: "var(--text-500)",
                        marginLeft: 6,
                        fontStyle: "normal",
                        fontSize: 12,
                      }}
                    >
                      {s.authority}
                    </span>
                  )}
                </div>
                {s.common_name && (
                  <div className="common">{s.common_name}</div>
                )}
                {t?.body_size_mm && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--gray-500)",
                      marginTop: 2,
                    }}
                  >
                    {t.body_size_mm} mm
                  </div>
                )}
              </div>
              <StatusBadge status={s.indiana_status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

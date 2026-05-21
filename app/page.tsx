import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SpecimenPh } from "@/components/Placeholders";
import { StatusBadge } from "@/components/Badges";
import { getAllFamilies, getAllSpecies, getTaxonomy } from "@/lib/content";
import { findSpeciesContext } from "@/lib/content";

export default async function Home() {
  const [families, taxonomy, species] = await Promise.all([
    getAllFamilies(),
    getTaxonomy(),
    getAllSpecies(),
  ]);

  const totalSpecies = families.reduce((acc, f) => acc + (f.species_count ?? 0), 0);
  const totalGenera = families.reduce((acc, f) => acc + (f.genus_count ?? 0), 0);
  const totalConfirmed = families.reduce(
    (acc, f) => acc + (f.confirmed_count ?? 0),
    0
  );
  const totalHistorical = families.reduce(
    (acc, f) => acc + (f.historical_count ?? 0),
    0
  );
  const totalAdventive = families.reduce(
    (acc, f) => acc + (f.adventive_count ?? 0),
    0
  );

  // Featured: first six confirmed species we have full treatments for.
  const featuredSpecies = species
    .filter((s) => s.indiana_status === "confirmed")
    .slice(0, 6);
  const featuredContexts = await Promise.all(
    featuredSpecies.map(async (s) => ({
      species: s,
      ctx: await findSpeciesContext(s.id),
    }))
  );

  return (
    <div className="page">
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">
                Order Coleoptera · A field reference for Indiana, USA
              </div>
              <h1>
                Beetles of <em>Indiana</em>.
              </h1>
              <p className="hero-desc">
                A taxonomic reference and identification tool for the beetle
                fauna of Indiana — bringing together vetted morphological
                descriptions, dichotomous keys, county-level distribution data
                from GBIF and iNaturalist, and a community-contributed image
                library into one continuously updated resource.
              </p>
              <div className="hero-meta">
                <span>Continuously updated</span>
                <span>·</span>
                <span>GBIF + iNaturalist</span>
                <span>·</span>
                <span>92 counties</span>
                <span>·</span>
                <span>Open license</span>
              </div>
            </div>
            <div className="hero-spec">
              <SpecimenPh seed="hero" label="Featured specimen plate" />
              <div className="hero-label">
                <div className="row">
                  <span className="k">Plate</span>
                  <span className="v">01 / 12</span>
                </div>
                <div className="row">
                  <span className="k">Species</span>
                  <span className="v">
                    <em>Calosoma scrutator</em>
                  </span>
                </div>
                <div className="row">
                  <span className="k">Locality</span>
                  <span className="v">Monroe Co., IN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="quick-row">
          <Link className="quick" href="/browse">
            <div className="num">01 — Browse</div>
            <h3>By taxonomic family</h3>
            <p>
              {families.length} families currently treated — drill into genera
              and species, with diagnostic keys and full checklists for each.
            </p>
            <div className="go">
              <span>Open family index</span>
              <ArrowRight size={14} />
            </div>
          </Link>
          <Link className="quick" href="/identify">
            <div className="num">02 — Identify</div>
            <h3>A specimen in hand</h3>
            <p>
              Step through a dichotomous key from family to species. Backtrack
              at any couplet; switch to a full printed-style key whenever you
              prefer.
            </p>
            <div className="go">
              <span>Start the family key</span>
              <ArrowRight size={14} />
            </div>
          </Link>
          <Link className="quick" href="/distribution">
            <div className="num">03 — Distribution</div>
            <h3>County-level occurrence</h3>
            <p>
              An interactive choropleth of all 92 counties, filterable by
              family, genus, or species. Records merged from GBIF +
              iNaturalist.
            </p>
            <div className="go">
              <span>Open map explorer</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </section>

      <section className="container">
        <div className="stats">
          <div className="stat">
            <div className="lbl">Families treated</div>
            <div className="num">{families.length}</div>
            <div className="sub">of an estimated 92 in IN</div>
          </div>
          <div className="stat">
            <div className="lbl">Genera</div>
            <div className="num">{totalGenera.toLocaleString()}</div>
            <div className="sub">across all treated families</div>
          </div>
          <div className="stat">
            <div className="lbl">Species records</div>
            <div className="num">{totalSpecies.toLocaleString()}</div>
            <div className="sub">
              {totalConfirmed.toLocaleString()} confirmed ·{" "}
              {totalHistorical.toLocaleString()} historical ·{" "}
              {totalAdventive.toLocaleString()} adventive
            </div>
          </div>
          <div className="stat">
            <div className="lbl">Occurrence records</div>
            <div className="num">live</div>
            <div className="sub">GBIF + iNat · merged</div>
          </div>
        </div>
      </section>

      {featuredContexts.length > 0 && (
        <section className="container featured-row">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "var(--pad-4)",
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0, whiteSpace: "nowrap" }}>Recently added</h2>
            <Link
              className="nav-link"
              style={{ whiteSpace: "nowrap" }}
              href="/browse"
            >
              Browse all families <ArrowRight size={12} />
            </Link>
          </div>
          <div className="feat-grid">
            {featuredContexts.map(({ species: s, ctx }, i) => {
              const href = ctx
                ? `/browse/${ctx.family.id}/${ctx.genusId}/${s.id}`
                : "/browse";
              return (
                <Link key={s.id} className="feat" href={href}>
                  <SpecimenPh
                    seed={`${s.id}_feat`}
                    ratio="4/3"
                    label={`plate ${String(i + 1).padStart(2, "0")}`}
                  />
                  <div className="meta">
                    <div>
                      <span className="name">
                        <em>{s.scientific_name}</em>
                      </span>
                    </div>
                    {s.common_name && (
                      <div className="common">{s.common_name}</div>
                    )}
                    <div className="row">
                      <span className="fam">
                        {ctx?.family.name ?? s.family}
                      </span>
                      <StatusBadge status={s.indiana_status} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="container" style={{ padding: "var(--pad-5) 0" }}>
        <div
          className="card card-pad"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--pad-5)",
          }}
        >
          <div>
            <div className="eyebrow">Project note</div>
            <h3
              className="display"
              style={{ fontSize: 28, margin: "10px 0", lineHeight: 1.15 }}
            >
              The Carabidae treatment is the most complete on the site.
            </h3>
            <p style={{ color: "var(--text-500)", lineHeight: 1.65 }}>
              Other families are scaffolded with diagnoses and species counts,
              and will be filled in progressively. The dichotomous key already
              covers all {families.length} family-level couplets and reaches
              Carabidae genus and species keys without leaving the page.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Link className="btn btn-primary" href="/browse/carabidae">
                Open Carabidae <ArrowRight size={12} />
              </Link>
              <Link className="btn" href="/about">
                Read the about page
              </Link>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-500)", lineHeight: 1.9 }}>
            <div
              style={{
                borderBottom: "1px solid var(--surface-3)",
                paddingBottom: 8,
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontSize: 11,
                color: "var(--gray-600)",
                fontWeight: 700,
              }}
            >
              Coverage snapshot
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr auto",
                gap: "6px 14px",
                alignItems: "baseline",
                fontFamily: "var(--font-mono)",
              }}
            >
              {taxonomy.families.slice(0, 6).map((f) => (
                <FamilySnapshotRow
                  key={f.id}
                  family={f}
                  speciesCount={
                    families.find((x) => x.id === f.id)?.species_count ?? 0
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FamilySnapshotRow({
  family,
  speciesCount,
}: {
  family: { id: string; name: string };
  speciesCount: number;
}) {
  return (
    <>
      <span style={{ color: "var(--blue-600)", fontWeight: 700 }}>
        {String(speciesCount).padStart(3, " ")}
      </span>
      <span>
        <em>{family.name}</em>
      </span>
      <span style={{ color: "var(--gray-500)", whiteSpace: "nowrap" }}>
        species IN
      </span>
    </>
  );
}

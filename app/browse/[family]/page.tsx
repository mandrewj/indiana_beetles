import { notFound } from "next/navigation";
import Link from "next/link";
import { FamilyView } from "./FamilyView";
import {
  getAllFamilyIds,
  getFamily,
  getTaxonomy,
  getAllKeyFiles,
  getKey,
  getAllSpecies,
} from "@/lib/content";
import { RankLabel } from "@/components/Badges";
import { ArrowRight } from "lucide-react";

export async function generateStaticParams() {
  const ids = await getAllFamilyIds();
  return ids.map((family) => ({ family }));
}

export async function generateMetadata({
  params,
}: {
  params: { family: string };
}) {
  try {
    const fam = await getFamily(params.family);
    return { title: fam.name };
  } catch {
    return { title: "Family" };
  }
}

export default async function FamilyPage({
  params,
}: {
  params: { family: string };
}) {
  let family;
  try {
    family = await getFamily(params.family);
  } catch {
    notFound();
  }

  const [taxonomy, allKeyFiles, allSpecies] = await Promise.all([
    getTaxonomy(),
    getAllKeyFiles(),
    getAllSpecies(),
  ]);

  const taxonomyFamily = taxonomy.families.find((f) => f.id === family.id);
  const familyKeyFile = allKeyFiles.find(
    (name) => name === `${family.id}-key`
  );
  const familyKey = familyKeyFile ? await getKey(familyKeyFile) : null;
  const speciesByFamily = allSpecies.filter((s) => s.family === family.id);

  if (!taxonomyFamily) {
    return (
      <div
        className="page container"
        style={{ padding: "var(--pad-5) 0" }}
      >
        <div className="crumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/browse">Browse</Link>
          <span className="sep">/</span>
          <span className="current">{family.name}</span>
        </div>
        <div className="fp-hero">
          <div className="title">
            <RankLabel>Family</RankLabel>
            <h1>{family.name}</h1>
            <div className="auth">{family.authority}</div>
            <div className="common">{family.common_name}</div>
            <p className="diagnosis">{family.diagnosis}</p>
            <div className="meta-grid">
              <div className="mi">
                <div className="lbl">Genera in IN</div>
                <div className="val">{family.genus_count}</div>
              </div>
              <div className="mi">
                <div className="lbl">Species in IN</div>
                <div className="val">{family.species_count}</div>
              </div>
              <div className="mi">
                <div className="lbl">Coverage</div>
                <div className="val" style={{ fontSize: 18, lineHeight: 1.3 }}>
                  Diagnosis only
                </div>
              </div>
            </div>
            <div style={{ marginTop: "var(--pad-3)" }}>
              <Link href="/browse/carabidae" className="btn btn-primary">
                See an example treatment <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FamilyView
      family={family}
      taxonomy={taxonomyFamily}
      familyKey={familyKey}
      speciesByFamily={speciesByFamily}
    />
  );
}

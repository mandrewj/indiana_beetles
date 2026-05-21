import Link from "next/link";
import { SpecimenPh } from "../Placeholders";
import type { Species, TaxonomyFamily } from "@/lib/types";

interface Props {
  species: Species;
  /** Index resolved from taxonomy + per-species notes — supplied by parent. */
  candidates: Array<{
    id: string;
    name: string;
    family: string;
    genus: string;
    note?: string;
  }>;
}

export function SimilarSpecies({ species, candidates }: Props) {
  if (candidates.length === 0) return null;
  return (
    <div>
      <div className="sec-head">
        <h3>Similar species</h3>
        <span className="meta">{candidates.length} compare</span>
      </div>
      <div className="similar-grid">
        {candidates.map((s) => (
          <Link
            key={s.id}
            href={`/browse/${s.family}/${s.genus}/${s.id}`}
            className="similar"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <SpecimenPh seed={`${s.id}_sim`} ratio="1" />
            <div className="name">
              <em>{s.name}</em>
            </div>
            {s.note && (
              <div
                style={{
                  color: "var(--text-500)",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {s.note}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper for parent pages: given the species and the full taxonomy, return the
 * candidate list with display name, family, genus, and note for each.
 */
export function buildSimilarCandidates(
  species: Species,
  taxonomy: { families: TaxonomyFamily[] }
): Props["candidates"] {
  const index = new Map<
    string,
    { id: string; name: string; family: string; genus: string }
  >();
  for (const fam of taxonomy.families) {
    for (const gen of fam.genera) {
      for (const sp of gen.species) {
        index.set(sp.id, {
          id: sp.id,
          name: sp.name,
          family: fam.id,
          genus: gen.id,
        });
      }
    }
  }
  return species.similar_species
    .map((id) => index.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((s) => ({
      ...s,
      note: species.similar_species_notes?.[s.id],
    }));
}

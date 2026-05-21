"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RankLabel } from "@/components/Badges";
import { IndianaMap } from "@/components/IndianaMap";
import type { Family, Species, Taxonomy } from "@/lib/types";

interface Props {
  families: Family[];
  species: Species[];
  taxonomy: Taxonomy;
}

export function DistributionView({ families, species, taxonomy }: Props) {
  const [familyId, setFamilyId] = useState<string>("");
  const [genusId, setGenusId] = useState<string>("");
  const [speciesId, setSpeciesId] = useState<string>("");

  const generaForFamily = useMemo(() => {
    if (!familyId) return [];
    return taxonomy.families.find((f) => f.id === familyId)?.genera ?? [];
  }, [familyId, taxonomy]);

  const speciesForGenus = useMemo(() => {
    if (!familyId) return [] as Species[];
    return species.filter(
      (s) => s.family === familyId && (!genusId || s.genus === genusId)
    );
  }, [familyId, genusId, species]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    let scope: Species[] = species;
    if (familyId) scope = scope.filter((s) => s.family === familyId);
    if (genusId) scope = scope.filter((s) => s.genus === genusId);
    if (speciesId) scope = scope.filter((s) => s.id === speciesId);
    for (const sp of scope) {
      for (const [c, n] of Object.entries(sp.county_record_counts ?? {})) {
        out[c] = (out[c] ?? 0) + n;
      }
    }
    return out;
  }, [families, species, familyId, genusId, speciesId]);

  const scopeLabel = speciesId
    ? species.find((s) => s.id === speciesId)?.scientific_name ?? ""
    : genusId
    ? generaForFamily.find((g) => g.id === genusId)?.name ?? ""
    : familyId
    ? families.find((f) => f.id === familyId)?.name ?? ""
    : "all treated species";

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span className="current">Distribution</span>
      </div>
      <RankLabel>Map Explorer</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 48, margin: "6px 0 4px", lineHeight: 1 }}
      >
        County-level occurrence
      </h1>
      <p style={{ color: "var(--text-500)", marginBottom: "var(--pad-4)" }}>
        Choropleth of Indiana&apos;s 92 counties. Filter by family, genus, or
        species — currently showing {scopeLabel}.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
          gap: "var(--pad-4)",
        }}
      >
        <div className="card card-pad">
          <div className="rank">Filter</div>
          <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gray-600)",
              }}
            >
              Family
              <select
                value={familyId}
                onChange={(e) => {
                  setFamilyId(e.target.value);
                  setGenusId("");
                  setSpeciesId("");
                }}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: 6,
                  borderRadius: 4,
                  border: "1px solid var(--surface-3)",
                  fontFamily: "inherit",
                }}
              >
                <option value="">All families</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gray-600)",
              }}
            >
              Genus
              <select
                value={genusId}
                onChange={(e) => {
                  setGenusId(e.target.value);
                  setSpeciesId("");
                }}
                disabled={!familyId}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: 6,
                  borderRadius: 4,
                  border: "1px solid var(--surface-3)",
                  fontFamily: "inherit",
                }}
              >
                <option value="">All genera</option>
                {generaForFamily.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gray-600)",
              }}
            >
              Species
              <select
                value={speciesId}
                onChange={(e) => setSpeciesId(e.target.value)}
                disabled={!speciesForGenus.length}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: 6,
                  borderRadius: 4,
                  border: "1px solid var(--surface-3)",
                  fontFamily: "inherit",
                }}
              >
                <option value="">All species</option>
                {speciesForGenus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.scientific_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="hr-thin" />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFamilyId("");
                setGenusId("");
                setSpeciesId("");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
        <div className="card card-pad">
          <IndianaMap counts={counts} height={520} />
        </div>
      </div>
    </div>
  );
}

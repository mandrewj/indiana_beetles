"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { SpeciesThumb } from "@/components/SpeciesThumb";
import { RankLabel } from "@/components/Badges";
import type { Family } from "@/lib/types";

type Sort = "taxonomic" | "alpha" | "species";

interface Treated {
  genera: number;
  species: number;
}

export function BrowseView({
  families,
  treated,
}: {
  families: Family[];
  treated: Record<string, Treated>;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("taxonomic");

  const totals = useMemo(() => {
    const estSpecies = families.reduce((n, f) => n + (f.species_count ?? 0), 0);
    const estGenera = families.reduce((n, f) => n + (f.genus_count ?? 0), 0);
    const treatedSpecies = Object.values(treated).reduce(
      (n, t) => n + t.species,
      0
    );
    const treatedGenera = Object.values(treated).reduce(
      (n, t) => n + t.genera,
      0
    );
    return { estSpecies, estGenera, treatedSpecies, treatedGenera };
  }, [families, treated]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let xs = families.slice();
    if (q) {
      xs = xs.filter((f) =>
        (`${f.name} ${f.common_name}`).toLowerCase().includes(q)
      );
    }
    if (sort === "alpha") xs.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "species")
      xs.sort((a, b) => (b.species_count ?? 0) - (a.species_count ?? 0));
    return xs;
  }, [families, query, sort]);

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span className="current">Browse</span>
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
          <RankLabel>Family Index</RankLabel>
          <h1
            className="display"
            style={{ fontSize: 56, margin: "6px 0 4px", lineHeight: 1 }}
          >
            All families
          </h1>
          <p style={{ color: "var(--text-500)", maxWidth: "58ch" }}>
            {families.length} families currently treated.{" "}
            <strong>{totals.treatedSpecies.toLocaleString()}</strong> of{" "}
            an estimated {totals.estSpecies.toLocaleString()} Indiana species
            are documented in the dataset, across{" "}
            <strong>{totals.treatedGenera.toLocaleString()}</strong> of {totals.estGenera.toLocaleString()}{" "}
            estimated genera. Click a family to open its diagnosis, key, and
            checklist.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="cl-search">
            <Search size={12} />
            <input
              placeholder="Filter families…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${sort === "taxonomic" ? "btn-primary" : ""}`}
              onClick={() => setSort("taxonomic")}
            >
              Taxonomic
            </button>
            <button
              type="button"
              className={`btn btn-sm ${sort === "alpha" ? "btn-primary" : ""}`}
              onClick={() => setSort("alpha")}
            >
              Alphabetical
            </button>
            <button
              type="button"
              className={`btn btn-sm ${sort === "species" ? "btn-primary" : ""}`}
              onClick={() => setSort("species")}
            >
              By species count
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--pad-3)",
        }}
      >
        {filtered.map((f, i) => (
          <Link key={f.id} className="feat" href={`/browse/${f.id}`}>
            <SpeciesThumb
              species={{
                id: f.id,
                inat_taxon_id: f.inat_taxon_id,
                adminImageUrl: f.representative_image_url ?? null,
              }}
              className="img"
              ratio="4/3"
              placeholderLabel={`Plate ${String(i + 1).padStart(2, "0")}`}
            />
            <div className="meta">
              <span className="rank">Family</span>
              <div className="name" style={{ fontStyle: "normal" }}>
                {f.name}
              </div>
              <div className="common">{f.common_name}</div>
              <div className="row">
                <span className="fam">
                  {treated[f.id]?.species ?? 0}/{f.species_count} sp ·{" "}
                  {treated[f.id]?.genera ?? 0}/{f.genus_count} gen
                </span>
                <ArrowRight size={12} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "var(--pad-5)",
            color: "var(--gray-500)",
          }}
        >
          No families match &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}

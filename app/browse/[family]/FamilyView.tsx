"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { RankLabel, StatusBadge } from "@/components/Badges";
import { SpecimenPh } from "@/components/Placeholders";
import { IndianaMap } from "@/components/IndianaMap";
import { DichotomousKey, type KeyMode } from "@/components/DichotomousKey";
import type {
  DichotomousKey as DichotomousKeyType,
  Family,
  Species,
  TaxonomyFamily,
} from "@/lib/types";

type Tab = "species" | "key" | "checklist";

interface Props {
  family: Family;
  taxonomy: TaxonomyFamily;
  familyKey: DichotomousKeyType | null;
  speciesByFamily: Species[];
}

export function FamilyView({
  family,
  taxonomy,
  familyKey,
  speciesByFamily,
}: Props) {
  const [tab, setTab] = useState<Tab>("species");

  const familyWideCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const sp of speciesByFamily) {
      for (const [county, n] of Object.entries(
        sp.county_record_counts ?? {}
      )) {
        out[county] = (out[county] ?? 0) + n;
      }
    }
    return out;
  }, [speciesByFamily]);

  return (
    <div className="page">
      <div className="container">
        <div className="crumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/browse">Browse</Link>
          <span className="sep">/</span>
          <span className="current">{family.name}</span>
        </div>
      </div>

      <div className="container">
        <div className="fp-hero">
          <div className="title">
            <RankLabel>Family</RankLabel>
            <h1>{family.name}</h1>
            {family.authority && <div className="auth">{family.authority}</div>}
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
              {family.confirmed_count != null && (
                <div className="mi">
                  <div className="lbl">Confirmed</div>
                  <div className="val">{family.confirmed_count}</div>
                </div>
              )}
            </div>
          </div>
          <div>
            <RankLabel>Family-level distribution</RankLabel>
            <p
              style={{
                color: "var(--text-500)",
                fontSize: 13.5,
                margin: "4px 0 14px",
              }}
            >
              Aggregated record counts across treated species in the family.
            </p>
            <IndianaMap counts={familyWideCounts} />
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "species" ? "active" : ""}`}
            onClick={() => setTab("species")}
          >
            Genera &amp; Species{" "}
            <span className="ct">{taxonomy.genera.length} shown</span>
          </button>
          {familyKey && (
            <button
              type="button"
              className={`tab ${tab === "key" ? "active" : ""}`}
              onClick={() => setTab("key")}
            >
              Identification Key
            </button>
          )}
          <button
            type="button"
            className={`tab ${tab === "checklist" ? "active" : ""}`}
            onClick={() => setTab("checklist")}
          >
            Checklist <span className="ct">{family.species_count}</span>
          </button>
        </div>

        {tab === "species" && (
          <GeneraAndSpeciesTab family={family} taxonomy={taxonomy} />
        )}
        {tab === "key" && familyKey && (
          <FamilyKeyTab
            family={family}
            taxonomy={taxonomy}
            familyKey={familyKey}
            speciesByFamily={speciesByFamily}
          />
        )}
        {tab === "checklist" && (
          <ChecklistTab family={family} taxonomy={taxonomy} />
        )}
      </div>
    </div>
  );
}

function GeneraAndSpeciesTab({
  family,
  taxonomy,
}: {
  family: Family;
  taxonomy: TaxonomyFamily;
}) {
  return (
    <div style={{ padding: "var(--pad-3) 0 var(--pad-5)" }}>
      {taxonomy.genera.map((g) => (
        <div key={g.id} className="genus-block">
          <div className="genus-head">
            <div>
              <span className="rank">Genus</span>
              <span className="name" style={{ marginLeft: 10 }}>
                {g.name}
              </span>
              {g.authority && <span className="auth">{g.authority}</span>}
            </div>
            <div className="ct">{g.species.length} species in IN</div>
          </div>
          {family.genus_notes?.[g.id] && (
            <p
              style={{
                color: "var(--text-500)",
                maxWidth: "72ch",
                marginTop: 0,
              }}
            >
              {family.genus_notes[g.id]}
            </p>
          )}
          <div className="species-list">
            {g.species.map((s) => (
              <Link
                key={s.id}
                className="species-row"
                href={`/browse/${family.id}/${g.id}/${s.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <SpecimenPh seed={`${s.id}_row`} />
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
                </div>
                <StatusBadge status={s.indiana_status} />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FamilyKeyTab({
  family,
  taxonomy,
  familyKey,
  speciesByFamily,
}: {
  family: Family;
  taxonomy: TaxonomyFamily;
  familyKey: DichotomousKeyType;
  speciesByFamily: Species[];
}) {
  const lookup = useMemo(() => {
    const m: Record<string, string> = {};
    taxonomy.genera.forEach((g) => {
      m[g.id] = g.name;
      g.species.forEach((s) => {
        m[s.id] = s.name;
      });
    });
    return m;
  }, [taxonomy]);

  const childKey = (genusId: string): DichotomousKeyType | null =>
    familyKey.genus_keys?.find((k) => k.genus === genusId)
      ? ({
          type: "dichotomous",
          scope: "species",
          title: familyKey.genus_keys.find((k) => k.genus === genusId)!.title,
          couplets: familyKey.genus_keys.find((k) => k.genus === genusId)!
            .couplets,
        } as DichotomousKeyType)
      : null;

  const resultLink = (id: string): string | null => {
    // Try species first, then fall back to family-level.
    const sp = speciesByFamily.find((s) => s.id === id);
    if (sp) return `/browse/${family.id}/${sp.genus}/${sp.id}`;
    return null;
  };

  const [mode] = useState<KeyMode>("couplet");

  return (
    <div
      style={{
        padding: "var(--pad-3) 0 var(--pad-5)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        gap: "var(--pad-4)",
      }}
    >
      <DichotomousKey
        mode={mode}
        initialKey={familyKey}
        lookupChildKey={childKey}
        taxonNameLookup={(id) => lookup[id] || id}
        resultLink={resultLink}
      />
      <div>
        <div className="sec">
          <div className="sec-head">
            <h3>About this key</h3>
          </div>
          <p
            style={{
              color: "var(--text-500)",
              fontSize: 13.5,
              lineHeight: 1.65,
            }}
          >
            Genus-level couplets resolve to embedded species keys without
            leaving the page. Where character images are present, click for the
            full plate.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistTab({
  family,
  taxonomy,
}: {
  family: Family;
  taxonomy: TaxonomyFamily;
}) {
  const [q, setQ] = useState("");
  const all = useMemo(() => {
    const rows: Array<{
      genus: string;
      species: string;
      authority?: string;
      common?: string;
      status: string;
    }> = [];
    taxonomy.genera.forEach((g) =>
      g.species.forEach((s) =>
        rows.push({
          genus: g.name,
          species: s.name,
          authority: s.authority,
          common: s.common_name,
          status: s.indiana_status,
        })
      )
    );
    return rows;
  }, [taxonomy]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter((r) =>
      `${r.species} ${r.common ?? ""} ${r.genus}`.toLowerCase().includes(t)
    );
  }, [all, q]);

  return (
    <div style={{ padding: "var(--pad-3) 0 var(--pad-5)" }}>
      <div className="cl-toolbar">
        <div>
          <RankLabel>Checklist</RankLabel>
          <h3 className="display" style={{ fontSize: 26, margin: "4px 0 0" }}>
            {family.name} of Indiana
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--text-500)",
              fontSize: 13,
            }}
          >
            {filtered.length} of {all.length} entries shown
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="cl-search">
            <Search size={12} />
            <input
              placeholder="Filter by species…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className="btn">
            <Download size={12} /> CSV
          </button>
          <button type="button" className="btn">
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Genus</th>
            <th>Species</th>
            <th>Authority</th>
            <th>Common name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i}>
              <td>
                <em style={{ color: "var(--text-500)" }}>{r.genus}</em>
              </td>
              <td>
                <em>{r.species}</em>
              </td>
              <td
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--text-500)",
                }}
              >
                {r.authority}
              </td>
              <td>{r.common}</td>
              <td>
                <StatusBadge status={r.status as never} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

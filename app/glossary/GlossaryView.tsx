"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RankLabel } from "@/components/Badges";
import type { GlossaryEntry } from "@/lib/types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function GlossaryView({ entries }: { entries: GlossaryEntry[] }) {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string>("all");

  const available = useMemo(
    () => new Set(entries.map((t) => t.term[0]?.toUpperCase()).filter(Boolean)),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((t) => {
      if (letter !== "all" && t.term[0]?.toUpperCase() !== letter) return false;
      if (q && !(t.term + " " + t.def).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, query, letter]);

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <a href="/">Home</a>
        <span className="sep">/</span>
        <span className="current">Glossary</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--pad-5)",
          alignItems: "end",
          marginBottom: "var(--pad-3)",
        }}
      >
        <div>
          <RankLabel>Glossary</RankLabel>
          <h1
            className="display"
            style={{ fontSize: 56, margin: "6px 0 4px", lineHeight: 1 }}
          >
            Morphological terms
          </h1>
          <p style={{ color: "var(--text-500)", maxWidth: "56ch" }}>
            {entries.length} terms compiled from the keys and species
            treatments on this site.
          </p>
        </div>
        <div className="cl-search">
          <Search size={12} />
          <input
            placeholder="Search terms or definitions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: "var(--pad-4)",
          paddingBottom: "var(--pad-3)",
          borderBottom: "1px solid var(--surface-3)",
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${letter === "all" ? "btn-primary" : ""}`}
          onClick={() => setLetter("all")}
        >
          All
        </button>
        {LETTERS.map((L) => {
          const enabled = available.has(L);
          return (
            <button
              key={L}
              type="button"
              className={`btn btn-sm ${letter === L ? "btn-primary" : ""}`}
              disabled={!enabled}
              style={{
                minWidth: 28,
                justifyContent: "center",
                padding: "5px 0",
                opacity: enabled ? 1 : 0.35,
                cursor: enabled ? "pointer" : "not-allowed",
              }}
              onClick={() => enabled && setLetter(L)}
            >
              {L}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "var(--pad-3) var(--pad-5)",
        }}
      >
        {filtered.map((t) => (
          <div
            key={t.term}
            style={{
              borderTop: "1px solid var(--surface-3)",
              padding: "var(--pad-3) 0",
            }}
          >
            <div className="display" style={{ fontSize: 22 }}>
              {t.term}
            </div>
            <p
              style={{
                color: "var(--text-500)",
                margin: "4px 0 0",
                lineHeight: 1.6,
              }}
            >
              {t.def}
            </p>
          </div>
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
          No glossary terms match.
        </div>
      )}
    </div>
  );
}

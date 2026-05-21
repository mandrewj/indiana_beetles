"use client";

import Link from "next/link";
import { useState } from "react";
import { RankLabel } from "@/components/Badges";
import { DichotomousKey, type KeyMode } from "@/components/DichotomousKey";
import type { DichotomousKey as DichotomousKeyType } from "@/lib/types";

interface Props {
  familyKey: DichotomousKeyType;
  childKeyMap: Record<string, DichotomousKeyType>;
  taxonNames: Record<string, string>;
  speciesRoutes: Record<string, string>;
}

export function IdentifyView({
  familyKey,
  childKeyMap,
  taxonNames,
  speciesRoutes,
}: Props) {
  const [mode, setMode] = useState<KeyMode>("couplet");

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span className="current">Identify</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "var(--pad-4)",
          marginTop: "var(--pad-3)",
        }}
      >
        <div>
          <RankLabel>Hierarchical key</RankLabel>
          <h1
            className="display"
            style={{
              fontSize: 48,
              margin: "6px 0 4px",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            Identify a specimen
          </h1>
          <p
            style={{
              color: "var(--text-500)",
              maxWidth: "64ch",
              marginBottom: "var(--pad-4)",
            }}
          >
            Step through a dichotomous key starting at the family level. When
            you reach a family, the key continues into the family&apos;s genus
            key, and then into the appropriate genus&apos;s species key — all
            without leaving the page.
          </p>

          <div style={{ display: "flex", gap: 6, marginBottom: "var(--pad-3)" }}>
            {(["couplet", "cards", "compare"] as KeyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn btn-sm ${mode === m ? "btn-primary" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "couplet"
                  ? "Couplet"
                  : m === "cards"
                  ? "Card stack"
                  : "Compare"}
              </button>
            ))}
          </div>

          <DichotomousKey
            mode={mode}
            initialKey={familyKey}
            lookupChildKey={(id) => childKeyMap[id] ?? null}
            taxonNameLookup={(id) => taxonNames[id] ?? id}
            resultLink={(id) => speciesRoutes[id] ?? null}
          />
        </div>
        <div>
          <div className="sec">
            <div className="sec-head">
              <h3>Tips</h3>
            </div>
            <ul
              style={{
                paddingLeft: 18,
                color: "var(--text-500)",
                fontSize: 13.5,
                lineHeight: 1.7,
              }}
            >
              <li>Examine the specimen under 10× magnification before starting.</li>
              <li>Tarsal segmentation is critical — the apparent count differs from true.</li>
              <li>If a couplet is ambiguous, try both branches and compare results.</li>
              <li>Toggle <em>Full key</em> to see the full numbered key for the current level.</li>
            </ul>
          </div>
          <div className="sec">
            <div className="sec-head">
              <h3>Coverage</h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "4px 12px",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
              }}
            >
              <span>Families in family key</span>
              <span>{familyKey.couplets.length} couplets</span>
              <span>Nested keys available</span>
              <span>{Object.keys(childKeyMap).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

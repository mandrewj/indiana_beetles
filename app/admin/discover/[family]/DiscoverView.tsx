"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Loader2, X } from "lucide-react";
import { commitFiles } from "@/lib/github-commit";
import {
  buildSpeciesJSON,
  insertSpeciesIntoTaxonomy,
  serializeTaxonomy,
  titleCase,
  type ApprovalInput,
} from "@/lib/species-template";
import type { CandidateSpecies } from "@/lib/discover";
import type { Family, Taxonomy } from "@/lib/types";

interface Props {
  family: Family;
  candidates: CandidateSpecies[];
  taxonomy: Taxonomy;
}

type RowState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "done"; commitUrl: string; createdGenus: boolean }
  | { phase: "error"; message: string };

export function DiscoverView({ family, candidates, taxonomy }: Props) {
  const [query, setQuery] = useState("");
  // Track an evolving taxonomy locally so successive approvals see prior
  // additions (and avoid clobbering each other in the multi-file commits).
  const [workingTaxonomy, setWorkingTaxonomy] = useState<Taxonomy>(taxonomy);
  const [states, setStates] = useState<Record<string, RowState>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      `${c.scientific_name} ${c.common_name ?? ""}`.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => b.inat_obs_count - a.inat_obs_count),
    [filtered]
  );

  async function approve(candidate: CandidateSpecies) {
    setStates((s) => ({ ...s, [candidate.suggested_id]: { phase: "submitting" } }));

    // Look up GBIF for authority + key. Non-fatal if missing.
    let gbifTaxonKey: number | null = null;
    let authority: string | undefined;
    try {
      const url = new URL("https://api.gbif.org/v1/species/match");
      url.searchParams.set("name", candidate.scientific_name);
      url.searchParams.set("strict", "true");
      url.searchParams.set("kingdom", "Animalia");
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as {
          usageKey?: number;
          speciesKey?: number;
          canonicalName?: string;
          authorship?: string;
        };
        const key = data.usageKey ?? data.speciesKey;
        if (
          key &&
          data.canonicalName &&
          data.canonicalName.toLowerCase() === candidate.scientific_name.toLowerCase()
        ) {
          gbifTaxonKey = key;
          authority = data.authorship?.trim() || undefined;
        }
      }
    } catch {
      // Leave GBIF fields empty if the lookup fails.
    }

    const input: ApprovalInput = {
      familyId: family.id,
      id: candidate.suggested_id,
      scientific_name: candidate.scientific_name,
      genus: candidate.genus,
      genus_display: titleCase(candidate.genus),
      authority,
      common_name: candidate.common_name ?? undefined,
      indiana_status: "confirmed",
      inat_taxon_id: candidate.inat_taxon_id,
      gbif_taxon_key: gbifTaxonKey,
    };

    const speciesJSON = buildSpeciesJSON(input);
    const { taxonomy: nextTaxonomy, createdGenus } = insertSpeciesIntoTaxonomy(
      workingTaxonomy,
      input
    );
    const taxonomyJSON = serializeTaxonomy(nextTaxonomy);

    const result = await commitFiles(
      `Discover: add ${input.scientific_name}`,
      [
        { path: `data/species/${input.id}.json`, content: speciesJSON },
        { path: `data/taxonomy.json`, content: taxonomyJSON },
      ]
    );

    if (result.ok) {
      setWorkingTaxonomy(nextTaxonomy);
      setStates((s) => ({
        ...s,
        [candidate.suggested_id]: {
          phase: "done",
          commitUrl: result.commit.url,
          createdGenus,
        },
      }));
    } else {
      setStates((s) => ({
        ...s,
        [candidate.suggested_id]: { phase: "error", message: result.error },
      }));
    }
  }

  return (
    <div>
      <div className="cl-toolbar" style={{ marginBottom: "var(--pad-3)" }}>
        <div>
          <RankBadge>{candidates.length} pending</RankBadge>
        </div>
        <div className="cl-search">
          <input
            placeholder="Filter by scientific or common name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            padding: "var(--pad-5)",
            textAlign: "center",
            color: "var(--gray-500)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {candidates.length === 0 ? (
            <>
              No iNaturalist Indiana observations under this family that
              aren&apos;t already in the dataset. 🎉
            </>
          ) : (
            <>No candidate matches the filter.</>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--pad-2)" }}>
          {sorted.map((c) => {
            const state = states[c.suggested_id] ?? { phase: "idle" };
            return (
              <CandidateRow
                key={c.suggested_id}
                family={family}
                candidate={c}
                state={state}
                onApprove={() => approve(c)}
                onDismiss={() =>
                  setStates((s) => {
                    const next = { ...s };
                    delete next[c.suggested_id];
                    return next;
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  family,
  candidate,
  state,
  onApprove,
  onDismiss,
}: {
  family: Family;
  candidate: CandidateSpecies;
  state: RowState;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr auto",
        gap: "var(--pad-3)",
        alignItems: "center",
        padding: "var(--pad-2) var(--pad-3)",
      }}
    >
      {candidate.default_photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={candidate.default_photo_url}
          alt={candidate.scientific_name}
          loading="lazy"
          style={{
            width: 80,
            height: 60,
            objectFit: "cover",
            borderRadius: 4,
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: 80,
            height: 60,
            borderRadius: 4,
            background: "var(--surface-2)",
          }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--text-600)",
          }}
        >
          {candidate.scientific_name}
        </div>
        {candidate.common_name && (
          <div style={{ color: "var(--gray-600)", fontSize: 13 }}>
            {candidate.common_name}
          </div>
        )}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--gray-500)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 2,
          }}
        >
          {candidate.inat_obs_count.toLocaleString()} IN obs · genus{" "}
          {titleCase(candidate.genus)} ·{" "}
          <a
            href={`https://www.inaturalist.org/taxa/${candidate.inat_taxon_id}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--blue-600)" }}
          >
            iNat {candidate.inat_taxon_id}
            <ExternalLink
              size={9}
              style={{ verticalAlign: "-1px", marginLeft: 3 }}
            />
          </a>
        </div>
      </div>
      <div>
        {state.phase === "idle" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onApprove}
          >
            Add to dataset <ArrowRight size={12} />
          </button>
        )}
        {state.phase === "submitting" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--gray-600)",
              fontSize: 13,
            }}
          >
            <Loader2 size={14} className="bin-spin" />
            Committing…
          </div>
        )}
        {state.phase === "done" && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                color: "var(--blue-800)",
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "flex-end",
              }}
            >
              <Check size={14} /> Added{state.createdGenus ? " (new genus)" : ""}
            </div>
            <div style={{ marginTop: 4, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <a
                href={state.commitUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "var(--gray-600)" }}
              >
                view commit
                <ExternalLink
                  size={9}
                  style={{ verticalAlign: "-1px", marginLeft: 3 }}
                />
              </a>
              <Link
                href={`/browse/${family.id}/${candidate.genus}/${candidate.suggested_id}`}
                style={{ fontSize: 12 }}
              >
                view page →
              </Link>
            </div>
          </div>
        )}
        {state.phase === "error" && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                color: "var(--status-excluded)",
                fontSize: 12,
                maxWidth: 240,
              }}
            >
              {state.message}
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 6 }}
              onClick={onDismiss}
            >
              <X size={12} /> Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RankBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--blue-800)",
        background: "var(--blue-50)",
        padding: "4px 10px",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

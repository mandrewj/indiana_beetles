"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { commitFiles, type CommitFile } from "@/lib/github-commit";
import {
  buildSpeciesJSON,
  insertSpeciesIntoTaxonomy,
  serializeTaxonomy,
  titleCase,
  type ApprovalInput,
} from "@/lib/species-template";
import { fetchLiveDistribution } from "@/lib/distribution";
import { fetchPhenology } from "@/lib/inaturalist";
import type { CandidateSpecies } from "@/lib/discover";
import type { Family, Taxonomy } from "@/lib/types";

interface Props {
  family: Family;
  candidates: CandidateSpecies[];
  taxonomy: Taxonomy;
}

const STAGE_LIMIT = 10;

type RowPhase =
  | "idle"
  | "preparing"
  | "staged"
  | "committed"
  | "error";

interface RowMeta {
  phase: RowPhase;
  /** Set once the GBIF lookup has run successfully. */
  input?: ApprovalInput;
  /** When committed. */
  commitUrl?: string;
  /** Whether the genus was newly created by this approval. */
  createdGenus?: boolean;
  /** When error. */
  message?: string;
}

type RowMap = Record<string, RowMeta>;

interface StagePayload {
  gbifKey: number | null;
  authority?: string;
  countyCounts: Record<string, number>;
  counties: string[];
  phenology: number[];
  phenologyPeak: number[];
}

async function gatherStageData(
  candidate: CandidateSpecies
): Promise<StagePayload> {
  // GBIF match + iNat distribution + iNat phenology in parallel. Each can
  // fail independently — staging still proceeds with partial data.
  const gbifP = (async () => {
    try {
      const url = new URL("https://api.gbif.org/v1/species/match");
      url.searchParams.set("name", candidate.scientific_name);
      url.searchParams.set("strict", "true");
      url.searchParams.set("kingdom", "Animalia");
      const res = await fetch(url.toString());
      if (!res.ok) return {};
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
        data.canonicalName.toLowerCase() ===
          candidate.scientific_name.toLowerCase()
      ) {
        return { key, authority: data.authorship?.trim() || undefined };
      }
    } catch {
      /* leave empty */
    }
    return {} as { key?: number; authority?: string };
  })();

  const phenoP = fetchPhenology(candidate.inat_taxon_id, undefined, {
    force: true,
  }).catch(() => ({ active: [], peak: [], monthCounts: {}, total: 0 }));

  const gbif = await gbifP;
  const pheno = await phenoP;

  // Distribution needs the GBIF key (if any) — fetch after gbif resolves.
  const dist = await fetchLiveDistribution(
    {
      id: candidate.suggested_id,
      gbif_taxon_key: gbif.key ?? null,
      inat_taxon_id: candidate.inat_taxon_id,
    },
    { force: true }
  ).catch(() => ({
    countyCounts: {},
    total: 0,
    gbifTotal: 0,
    inatTotal: 0,
  }));

  return {
    gbifKey: typeof gbif.key === "number" ? gbif.key : null,
    authority: gbif.authority,
    countyCounts: dist.countyCounts,
    counties: Object.keys(dist.countyCounts).sort((a, b) =>
      a.localeCompare(b)
    ),
    phenology: pheno.active,
    phenologyPeak: pheno.peak,
  };
}

function buildApprovalInput(
  family: Family,
  candidate: CandidateSpecies,
  payload: StagePayload
): ApprovalInput {
  return {
    familyId: family.id,
    id: candidate.suggested_id,
    scientific_name: candidate.scientific_name,
    genus: candidate.genus,
    genus_display: titleCase(candidate.genus),
    authority: payload.authority,
    common_name: candidate.common_name ?? undefined,
    indiana_status: "confirmed",
    inat_taxon_id: candidate.inat_taxon_id,
    gbif_taxon_key: payload.gbifKey,
    counties: payload.counties,
    county_record_counts: payload.countyCounts,
    phenology: payload.phenology,
    phenology_peak: payload.phenologyPeak,
    last_refreshed: new Date().toISOString().slice(0, 10),
  };
}

export function DiscoverView({ family, candidates, taxonomy }: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<RowMap>({});
  const [batchPhase, setBatchPhase] = useState<"idle" | "committing">("idle");
  const [batchError, setBatchError] = useState<string | null>(null);
  // Track an evolving taxonomy locally so successive batches see the
  // previous batch's additions (and don't overwrite them).
  const [workingTaxonomy, setWorkingTaxonomy] = useState<Taxonomy>(taxonomy);

  const stagedIds = useMemo(
    () =>
      Object.entries(rows)
        .filter(([, r]) => r.phase === "staged")
        .map(([id]) => id),
    [rows]
  );

  const stagedInputs = useMemo(
    () =>
      stagedIds
        .map((id) => rows[id]?.input)
        .filter((x): x is ApprovalInput => Boolean(x)),
    [rows, stagedIds]
  );

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

  function setRow(id: string, patch: Partial<RowMeta>) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { phase: "idle" }), ...patch },
    }));
  }

  async function stage(candidate: CandidateSpecies) {
    if (stagedIds.length >= STAGE_LIMIT) return;
    setRow(candidate.suggested_id, { phase: "preparing", message: undefined });
    try {
      const payload = await gatherStageData(candidate);
      const input = buildApprovalInput(family, candidate, payload);
      setRow(candidate.suggested_id, { phase: "staged", input });
    } catch (err) {
      setRow(candidate.suggested_id, {
        phase: "error",
        message: (err as Error).message,
      });
    }
  }

  function unstage(id: string) {
    setRow(id, { phase: "idle", input: undefined });
  }

  function clearAll() {
    setRows((prev) => {
      const next: RowMap = {};
      for (const [id, r] of Object.entries(prev)) {
        // Preserve committed history; only drop staged + errored rows.
        if (r.phase === "committed") next[id] = r;
      }
      return next;
    });
    setBatchError(null);
  }

  async function commitBatch() {
    if (stagedInputs.length === 0) return;
    setBatchPhase("committing");
    setBatchError(null);

    // Start from the working taxonomy (carries prior batches' additions).
    let workingTax: Taxonomy = workingTaxonomy;
    const createdGenusFor: Record<string, boolean> = {};
    const files: CommitFile[] = [];
    for (const input of stagedInputs) {
      files.push({
        path: `data/species/${input.id}.json`,
        content: buildSpeciesJSON(input),
      });
      const { taxonomy: nextTax, createdGenus } = insertSpeciesIntoTaxonomy(
        workingTax,
        input
      );
      workingTax = nextTax;
      createdGenusFor[input.id] = createdGenus;
    }
    files.push({
      path: `data/taxonomy.json`,
      content: serializeTaxonomy(workingTax),
    });

    const message =
      stagedInputs.length === 1
        ? `Discover: add ${stagedInputs[0].scientific_name}`
        : `Discover: add ${stagedInputs.length} ${family.name} species`;

    const result = await commitFiles(message, files);

    if (result.ok) {
      // Persist the new taxonomy so the NEXT batch builds on top of this one
      // rather than restarting from the server-rendered prop.
      setWorkingTaxonomy(workingTax);
      setRows((prev) => {
        const next = { ...prev };
        for (const input of stagedInputs) {
          next[input.id] = {
            phase: "committed",
            input,
            commitUrl: result.commit.url,
            createdGenus: createdGenusFor[input.id],
          };
        }
        return next;
      });
    } else {
      setBatchError(result.error);
    }
    setBatchPhase("idle");
  }

  const remainingSlots = STAGE_LIMIT - stagedIds.length;

  return (
    <div>
      {(stagedInputs.length > 0 || batchError) && (
        <StagedPanel
          stagedInputs={stagedInputs}
          taxonomy={taxonomy}
          batchPhase={batchPhase}
          batchError={batchError}
          onUnstage={unstage}
          onClear={clearAll}
          onCommit={commitBatch}
        />
      )}

      <div className="cl-toolbar" style={{ marginBottom: "var(--pad-3)" }}>
        <div>
          <RankBadge>
            {candidates.length} pending
            {stagedInputs.length > 0
              ? ` · ${stagedInputs.length}/${STAGE_LIMIT} staged`
              : ""}
          </RankBadge>
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
            const meta = rows[c.suggested_id] ?? { phase: "idle" as const };
            const stageDisabled =
              meta.phase === "idle" && remainingSlots <= 0;
            return (
              <CandidateRow
                key={c.suggested_id}
                family={family}
                candidate={c}
                meta={meta}
                stageDisabled={stageDisabled}
                onStage={() => stage(c)}
                onUnstage={() => unstage(c.suggested_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StagedPanel({
  stagedInputs,
  taxonomy,
  batchPhase,
  batchError,
  onUnstage,
  onClear,
  onCommit,
}: {
  stagedInputs: ApprovalInput[];
  taxonomy: Taxonomy;
  batchPhase: "idle" | "committing";
  batchError: string | null;
  onUnstage: (id: string) => void;
  onClear: () => void;
  onCommit: () => void;
}) {
  // Surface which staged species would create a brand-new genus stub so the
  // editor knows what's about to land.
  const newGenera = useMemo(() => {
    const existing = new Set<string>();
    for (const fam of taxonomy.families) {
      for (const g of fam.genera) existing.add(g.id);
    }
    const set = new Set<string>();
    for (const inp of stagedInputs) {
      if (!existing.has(inp.genus)) set.add(inp.genus);
    }
    return set;
  }, [stagedInputs, taxonomy]);

  return (
    <div
      className="card"
      style={{
        padding: "var(--pad-3)",
        marginBottom: "var(--pad-3)",
        borderTop: "2px solid var(--blue-600)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--pad-2)",
          gap: "var(--pad-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="rank">Staged for commit</div>
          <div
            className="display"
            style={{ fontSize: 22, lineHeight: 1.1, marginTop: 2 }}
          >
            {stagedInputs.length} species
            {newGenera.size > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--blue-600)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                + {newGenera.size} new genus
                {newGenera.size === 1 ? "" : "es"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClear}
            disabled={batchPhase !== "idle" || stagedInputs.length === 0}
          >
            <Trash2 size={12} /> Clear all
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCommit}
            disabled={batchPhase !== "idle" || stagedInputs.length === 0}
          >
            {batchPhase === "committing" ? (
              <>
                <Loader2 size={14} className="bin-spin" /> Committing…
              </>
            ) : (
              <>
                Commit {stagedInputs.length} species <ArrowRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>

      {batchError && (
        <div
          style={{
            padding: "var(--pad-2) var(--pad-3)",
            background: "var(--status-excluded-bg)",
            color: "var(--status-excluded)",
            borderRadius: 4,
            fontSize: 13,
            marginBottom: "var(--pad-2)",
          }}
        >
          {batchError}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
        }}
      >
        {stagedInputs.map((inp) => (
          <div
            key={inp.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "4px 8px",
              borderRadius: 4,
              background: "var(--surface-1)",
            }}
          >
            <em style={{ flex: 1, color: "var(--text-600)" }}>
              {inp.scientific_name}
              {inp.authority && (
                <span
                  style={{
                    marginLeft: 6,
                    fontStyle: "normal",
                    color: "var(--gray-500)",
                    fontSize: 11.5,
                  }}
                >
                  {inp.authority}
                </span>
              )}
            </em>
            {newGenera.has(inp.genus) && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--blue-600)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                new genus: {titleCase(inp.genus)}
              </span>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => onUnstage(inp.id)}
              disabled={batchPhase !== "idle"}
              title="Remove from batch"
              aria-label={`Unstage ${inp.scientific_name}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateRow({
  family,
  candidate,
  meta,
  stageDisabled,
  onStage,
  onUnstage,
}: {
  family: Family;
  candidate: CandidateSpecies;
  meta: RowMeta;
  stageDisabled: boolean;
  onStage: () => void;
  onUnstage: () => void;
}) {
  const dimmed =
    meta.phase === "staged" ||
    meta.phase === "committed" ||
    meta.phase === "preparing";

  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr auto",
        gap: "var(--pad-3)",
        alignItems: "center",
        padding: "var(--pad-2) var(--pad-3)",
        opacity: dimmed ? 0.75 : 1,
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
        {meta.phase === "idle" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onStage}
            disabled={stageDisabled}
            title={stageDisabled ? "Batch is full — commit or unstage one" : undefined}
          >
            Stage for commit <ArrowRight size={12} />
          </button>
        )}
        {meta.phase === "preparing" && (
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
            Looking up GBIF…
          </div>
        )}
        {meta.phase === "staged" && (
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
              <Check size={14} /> Staged
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onUnstage}
              style={{ marginTop: 4 }}
            >
              <X size={12} /> Unstage
            </button>
          </div>
        )}
        {meta.phase === "committed" && meta.commitUrl && (
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
              <Check size={14} /> Added
              {meta.createdGenus ? " (new genus)" : ""}
            </div>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <a
                href={meta.commitUrl}
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
        {meta.phase === "error" && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                color: "var(--status-excluded)",
                fontSize: 12,
                maxWidth: 240,
              }}
            >
              {meta.message}
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 6 }}
              onClick={onUnstage}
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

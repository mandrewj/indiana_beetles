"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { commitFiles, type CommitFile } from "@/lib/github-commit";
import {
  applyRefreshDelta,
  refreshSpecies,
  type RefreshDelta,
} from "@/lib/refresh";
import type { Family, Species } from "@/lib/types";

interface Props {
  family: Family;
  species: Species[];
}

const STAGE_LIMIT = 30;

type RowPhase = "idle" | "preparing" | "staged" | "committed" | "error";

interface RowMeta {
  phase: RowPhase;
  delta?: RefreshDelta;
  commitUrl?: string;
  message?: string;
}

type RowMap = Record<string, RowMeta>;

export function RefreshView({ family, species }: Props) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<RowMap>({});
  const [batchPhase, setBatchPhase] = useState<"idle" | "committing">("idle");
  const [batchError, setBatchError] = useState<string | null>(null);

  const stagedIds = useMemo(
    () =>
      Object.entries(rows)
        .filter(([, r]) => r.phase === "staged")
        .map(([id]) => id),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return species;
    return species.filter((s) =>
      `${s.scientific_name} ${s.common_name ?? ""}`.toLowerCase().includes(q)
    );
  }, [species, query]);

  function setRow(id: string, patch: Partial<RowMeta>) {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { phase: "idle" }), ...patch },
    }));
  }

  async function stage(sp: Species) {
    if (stagedIds.length >= STAGE_LIMIT) return;
    setRow(sp.id, { phase: "preparing", message: undefined });
    try {
      const delta = await refreshSpecies(sp);
      setRow(sp.id, { phase: "staged", delta });
    } catch (err) {
      setRow(sp.id, { phase: "error", message: (err as Error).message });
    }
  }

  function unstage(id: string) {
    setRow(id, { phase: "idle", delta: undefined });
  }

  function clearAll() {
    setRows((prev) => {
      const next: RowMap = {};
      for (const [id, r] of Object.entries(prev)) {
        if (r.phase === "committed") next[id] = r;
      }
      return next;
    });
    setBatchError(null);
  }

  async function commitBatch() {
    const stagedRows = stagedIds
      .map((id) => ({ id, meta: rows[id] }))
      .filter((r) => r.meta?.delta);
    if (stagedRows.length === 0) return;

    setBatchPhase("committing");
    setBatchError(null);

    const files: CommitFile[] = [];
    for (const { id, meta } of stagedRows) {
      const sp = species.find((s) => s.id === id);
      if (!sp || !meta?.delta) continue;
      files.push({
        path: `data/species/${sp.id}.json`,
        content: applyRefreshDelta(sp, meta.delta),
      });
    }

    const message =
      stagedRows.length === 1
        ? `Refresh: ${species.find((s) => s.id === stagedRows[0].id)?.scientific_name ?? stagedRows[0].id}`
        : `Refresh: ${stagedRows.length} ${family.name} species`;

    const result = await commitFiles(message, files);

    if (result.ok) {
      setRows((prev) => {
        const next = { ...prev };
        for (const { id } of stagedRows) {
          next[id] = {
            ...next[id],
            phase: "committed",
            commitUrl: result.commit.url,
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
  const stagedDeltas = stagedIds
    .map((id) => rows[id]?.delta)
    .filter((d): d is RefreshDelta => Boolean(d));
  const stagedSpecies = stagedIds
    .map((id) => species.find((s) => s.id === id))
    .filter((s): s is Species => Boolean(s));

  return (
    <div>
      {(stagedIds.length > 0 || batchError) && (
        <StagedPanel
          stagedSpecies={stagedSpecies}
          stagedDeltas={stagedDeltas}
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
            {species.length} species
            {stagedIds.length > 0
              ? ` · ${stagedIds.length}/${STAGE_LIMIT} staged`
              : ""}
          </RankBadge>
        </div>
        <div className="cl-search">
          <input
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "var(--pad-5)",
            textAlign: "center",
            color: "var(--gray-500)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-card)",
          }}
        >
          No species match.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--pad-2)" }}>
          {filtered.map((sp) => {
            const meta = rows[sp.id] ?? { phase: "idle" as const };
            const stageDisabled =
              meta.phase === "idle" && remainingSlots <= 0;
            return (
              <SpeciesRow
                key={sp.id}
                family={family}
                species={sp}
                meta={meta}
                stageDisabled={stageDisabled}
                onStage={() => stage(sp)}
                onUnstage={() => unstage(sp.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StagedPanel({
  stagedSpecies,
  stagedDeltas,
  batchPhase,
  batchError,
  onUnstage,
  onClear,
  onCommit,
}: {
  stagedSpecies: Species[];
  stagedDeltas: RefreshDelta[];
  batchPhase: "idle" | "committing";
  batchError: string | null;
  onUnstage: (id: string) => void;
  onClear: () => void;
  onCommit: () => void;
}) {
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
            {stagedSpecies.length} species
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClear}
            disabled={batchPhase !== "idle" || stagedSpecies.length === 0}
          >
            <Trash2 size={12} /> Clear all
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCommit}
            disabled={batchPhase !== "idle" || stagedSpecies.length === 0}
          >
            {batchPhase === "committing" ? (
              <>
                <Loader2 size={14} className="bin-spin" /> Committing…
              </>
            ) : (
              <>
                Commit {stagedSpecies.length} refresh{stagedSpecies.length === 1 ? "" : "es"} <ArrowRight size={12} />
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
          maxHeight: 360,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {stagedSpecies.map((sp, i) => {
          const d = stagedDeltas[i];
          if (!d) return null;
          const idChange =
            d.inatIdChanged || d.gbifKeyChanged;
          return (
            <div
              key={sp.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: 4,
                background: "var(--surface-1)",
              }}
            >
              <em style={{ flex: 1, color: "var(--text-600)" }}>
                {sp.scientific_name}
              </em>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--gray-500)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {d.counties.length} counties · {d.recordTotal} records
                {d.countiesAdded.length > 0 && (
                  <span style={{ color: "var(--blue-600)", marginLeft: 6 }}>
                    +{d.countiesAdded.length}
                  </span>
                )}
                {d.countiesRemoved.length > 0 && (
                  <span style={{ color: "var(--status-excluded)", marginLeft: 4 }}>
                    −{d.countiesRemoved.length}
                  </span>
                )}
                {idChange && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--cyan-600)",
                    }}
                  >
                    id updated
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => onUnstage(sp.id)}
                disabled={batchPhase !== "idle"}
                title="Remove from batch"
                aria-label={`Unstage ${sp.scientific_name}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeciesRow({
  family,
  species,
  meta,
  stageDisabled,
  onStage,
  onUnstage,
}: {
  family: Family;
  species: Species;
  meta: RowMeta;
  stageDisabled: boolean;
  onStage: () => void;
  onUnstage: () => void;
}) {
  const dimmed =
    meta.phase === "staged" ||
    meta.phase === "committed" ||
    meta.phase === "preparing";

  const lastRefreshed = species.last_refreshed;

  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "var(--pad-3)",
        alignItems: "center",
        padding: "var(--pad-2) var(--pad-3)",
        opacity: dimmed ? 0.85 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--text-600)",
          }}
        >
          {species.scientific_name}
        </div>
        {species.common_name && (
          <div style={{ color: "var(--gray-600)", fontSize: 13 }}>
            {species.common_name}
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
          {species.counties?.length ?? 0} counties on file ·{" "}
          {lastRefreshed
            ? `last refreshed ${lastRefreshed}`
            : "never refreshed"}
        </div>
      </div>
      <div>
        {meta.phase === "idle" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onStage}
            disabled={stageDisabled}
            title={
              stageDisabled
                ? "Batch is full — commit or unstage one"
                : undefined
            }
          >
            <RefreshCw size={12} /> Stage refresh
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
            Fetching live data…
          </div>
        )}
        {meta.phase === "staged" && meta.delta && (
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
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--gray-500)",
                textAlign: "right",
                marginTop: 2,
              }}
            >
              {meta.delta.counties.length} counties · {meta.delta.recordTotal} records
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
              <Check size={14} /> Refreshed
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
                href={`/browse/${family.id}/${species.genus}/${species.id}`}
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
                maxWidth: 280,
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

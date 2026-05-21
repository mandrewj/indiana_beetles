"use client";

import { useEffect, useMemo, useState } from "react";
import { IndianaMap } from "../IndianaMap";
import { fetchLiveDistribution } from "@/lib/distribution";
import { taxonIdOrNull } from "@/lib/types";
import type { Species } from "@/lib/types";

interface State {
  counts: Record<string, number>;
  source: "admin" | "live" | "empty";
  total: number;
  loading: boolean;
}

export function Distribution({ species }: { species: Species }) {
  const [selected, setSelected] = useState<string | null>(null);

  // Admin override wins when set. Otherwise we fall back to live data.
  const adminCounts = species.county_record_counts ?? {};
  const hasAdminCounts = Object.keys(adminCounts).length > 0;
  const gbifKey = taxonIdOrNull(species.gbif_taxon_key);
  const inatId = taxonIdOrNull(species.inat_taxon_id);
  const canFetchLive = !hasAdminCounts && (gbifKey !== null || inatId !== null);

  const [state, setState] = useState<State>({
    counts: hasAdminCounts ? adminCounts : {},
    source: hasAdminCounts ? "admin" : "empty",
    total: Object.values(adminCounts).reduce((a, b) => a + b, 0),
    loading: canFetchLive,
  });

  useEffect(() => {
    if (!canFetchLive) return;
    let live = true;
    fetchLiveDistribution(species)
      .then((res) => {
        if (!live) return;
        setState({
          counts: res.countyCounts,
          source:
            res.total > 0
              ? "live"
              : "empty",
          total: res.total,
          loading: false,
        });
      })
      .catch(() => {
        if (live) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      live = false;
    };
  }, [species, canFetchLive]);

  const counts = state.counts;
  const present = Object.keys(counts).length;

  const { total, top3, average } = useMemo(() => {
    const entries = Object.entries(counts);
    const total = entries.reduce((acc, [, n]) => acc + n, 0);
    const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const average = entries.length ? total / entries.length : 0;
    return { total, top3: sorted, average };
  }, [counts]);

  const sourceLabel =
    state.source === "admin"
      ? "Admin-curated counts"
      : state.source === "live"
      ? "Live · GBIF + iNaturalist"
      : state.loading
      ? "Fetching…"
      : "No records yet";

  return (
    <div className="sec">
      <div className="sec-head">
        <h3>Distribution</h3>
        <span className="meta">
          {present}/92 counties · {total} records · {sourceLabel}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: "var(--pad-4)",
          alignItems: "start",
        }}
      >
        <IndianaMap
          counts={counts}
          onCounty={(co) => setSelected(co.name)}
          selected={selected}
        />
        <div
          style={{
            border: "1px solid var(--surface-3)",
            padding: "var(--pad-3)",
            background: "var(--surface-0)",
            borderRadius: 6,
          }}
        >
          {selected ? (
            <>
              <div className="rank">Selected county</div>
              <div className="display" style={{ fontSize: 24, marginTop: 4 }}>
                {selected}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--gray-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {counts[selected] || 0} record
                {counts[selected] === 1 ? "" : "s"}
              </div>
              <div className="hr-thin" />
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setSelected(null)}
              >
                Clear selection
              </button>
            </>
          ) : state.loading ? (
            <>
              <div className="rank">Fetching distribution</div>
              <p
                style={{
                  color: "var(--text-500)",
                  fontSize: 13.5,
                  marginTop: 4,
                }}
              >
                Pulling Indiana occurrence records from GBIF and iNaturalist
                and aggregating by county. Cached locally for 24 hours.
              </p>
            </>
          ) : present === 0 ? (
            <>
              <div className="rank">No records</div>
              <p
                style={{
                  color: "var(--text-500)",
                  fontSize: 13.5,
                  marginTop: 4,
                }}
              >
                No Indiana occurrence records found for this species in GBIF or
                iNaturalist
                {gbifKey === null && inatId === null
                  ? " (taxon IDs not set)"
                  : ""}
                .
              </p>
            </>
          ) : (
            <>
              <div className="rank">Pick a county</div>
              <p
                style={{
                  color: "var(--text-500)",
                  fontSize: 13.5,
                  marginTop: 4,
                }}
              >
                Click any county in the choropleth to view its record count.
              </p>
              <div className="hr-thin" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "4px 12px",
                  fontSize: 13,
                }}
              >
                {top3.map(([name, count], i) => (
                  <Row
                    key={name}
                    label={i === 0 ? "Top county" : i === 1 ? "2nd" : "3rd"}
                    value={`${name} (${count})`}
                  />
                ))}
                {present > 0 && (
                  <Row
                    label="Avg / county"
                    value={average.toFixed(1)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </>
  );
}

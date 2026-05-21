"use client";

import { useMemo, useState } from "react";
import { IndianaMap } from "../IndianaMap";
import type { Species } from "@/lib/types";

export function Distribution({ species }: { species: Species }) {
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(
    () => species.county_record_counts ?? {},
    [species.county_record_counts]
  );
  const present = species.counties.length;

  const { total, top3, average } = useMemo(() => {
    const entries = Object.entries(counts);
    const total = entries.reduce((acc, [, n]) => acc + n, 0);
    const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const average = entries.length ? total / entries.length : 0;
    return { total, top3: sorted, average };
  }, [counts]);

  return (
    <div className="sec">
      <div className="sec-head">
        <h3>Distribution</h3>
        <span className="meta">
          {present}/92 counties · {total} records
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
                Toggle source filters from the records table below.
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

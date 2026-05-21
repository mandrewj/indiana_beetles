"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export interface OccurrenceRecord {
  county: string;
  date: string;
  observer: string;
  source: "gbif" | "inat";
  license?: string;
  url?: string;
}

type Filter = "all" | "gbif" | "inat";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "gbif", label: "GBIF" },
  { id: "inat", label: "iNat" },
];

interface RecordsTableProps {
  records: OccurrenceRecord[];
  /** Locale-formatted timestamp from the cache, or null while live. */
  lastFetched?: string | null;
}

export function RecordsTable({ records, lastFetched }: RecordsTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered =
    filter === "all" ? records : records.filter((r) => r.source === filter);

  return (
    <div className="records">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map((o) => (
            <button
              key={o.id}
              className={`btn btn-sm ${filter === o.id ? "btn-primary" : ""}`}
              onClick={() => setFilter(o.id)}
              type="button"
            >
              {o.label}
            </button>
          ))}
        </div>
        {lastFetched && (
          <div className="last-fetched">
            <RefreshCw size={12} />
            Last fetched {lastFetched} · cached
          </div>
        )}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>County</th>
            <th>Date</th>
            <th>Observer</th>
            <th>Source</th>
            <th>License</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, i) => (
            <tr key={i}>
              <td>{r.county}</td>
              <td>{r.date}</td>
              <td>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.source === "inat" ? `@${r.observer}` : r.observer}
                  </a>
                ) : r.source === "inat" ? (
                  `@${r.observer}`
                ) : (
                  r.observer
                )}
              </td>
              <td>
                <span className={`src ${r.source}`}>
                  {r.source === "inat" ? "iNat" : "GBIF"}
                </span>
              </td>
              <td>{r.license || "—"}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "var(--gray-500)" }}>
                No records match this filter yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

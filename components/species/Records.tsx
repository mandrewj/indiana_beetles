"use client";

import { useEffect, useState } from "react";
import {
  RecordsTable,
  type OccurrenceRecord,
} from "@/components/RecordsTable";
import { fetchGbifOccurrences } from "@/lib/gbif";
import { fetchINatObservations } from "@/lib/inaturalist";
import type { Species } from "@/lib/types";
import { taxonIdOrNull } from "@/lib/types";

const LIMIT_PER_SOURCE = 50;

export function Records({ species }: { species: Species }) {
  const [records, setRecords] = useState<OccurrenceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const gbifKey = taxonIdOrNull(species.gbif_taxon_key);
  const inatId = taxonIdOrNull(species.inat_taxon_id);

  useEffect(() => {
    let live = true;
    setRecords(null);
    setError(null);

    const gbifP = gbifKey
      ? fetchGbifOccurrences(gbifKey, LIMIT_PER_SOURCE).catch(() => [])
      : Promise.resolve([]);
    const inatP = inatId
      ? fetchINatObservations(inatId, LIMIT_PER_SOURCE).catch(() => [])
      : Promise.resolve([]);

    Promise.all([gbifP, inatP])
      .then(([gbif, inat]) => {
        if (!live) return;
        const merged: OccurrenceRecord[] = [];
        for (const r of gbif) {
          merged.push({
            county: r.county ?? "—",
            date: r.date ?? "—",
            observer: r.observer ?? "—",
            source: "gbif",
            license: r.license ?? undefined,
            url: r.detailUrl,
          });
        }
        for (const r of inat) {
          merged.push({
            county: r.county ?? "—",
            date: r.date ?? "—",
            observer: r.user,
            source: "inat",
            license: r.license,
            url: r.observationUrl,
          });
        }
        merged.sort((a, b) => (a.date < b.date ? 1 : -1));
        setRecords(merged);
        setLastFetched(new Date().toLocaleDateString());
      })
      .catch((err: Error) => {
        if (!live) return;
        setError(err.message);
      });

    return () => {
      live = false;
    };
  }, [species.id, gbifKey, inatId]);

  if (gbifKey === null && inatId === null) return null;

  return (
    <div className="sec">
      <div className="sec-head">
        <h3>Observation records</h3>
        <span className="meta">GBIF + iNaturalist</span>
      </div>
      {error && (
        <div
          style={{
            padding: "var(--pad-3)",
            color: "var(--gray-600)",
            background: "var(--surface-2)",
            borderRadius: 4,
            fontSize: 13,
            marginBottom: "var(--pad-3)",
          }}
        >
          Some sources failed to load: {error}
        </div>
      )}
      {records === null ? (
        <div
          style={{
            padding: "var(--pad-4)",
            color: "var(--gray-500)",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Loading records from GBIF and iNaturalist…
        </div>
      ) : (
        <RecordsTable records={records} lastFetched={lastFetched} />
      )}
    </div>
  );
}

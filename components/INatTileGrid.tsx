"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  fetchTopINatPhotos,
  type INatPhoto,
} from "@/lib/inaturalist";

interface Props {
  taxonId: number;
  speciesId: string;
}

export function INatTileGrid({ taxonId, speciesId }: Props) {
  const [photos, setPhotos] = useState<INatPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPhotos(null);
    setError(null);
    fetchTopINatPhotos(taxonId, 12)
      .then((res) => {
        if (!live) return;
        setPhotos(res);
      })
      .catch((err: Error) => {
        if (!live) return;
        setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [taxonId, speciesId]);

  const status = error
    ? "Unavailable"
    : photos === null
    ? "Loading…"
    : photos.length === 0
    ? "No Indiana observations yet"
    : `${photos.length} CC-licensed photos`;

  return (
    <div className="gallery-source-band">
      <div className="head">
        <div className="title">Community observations · iNaturalist</div>
        <div className="ct">{status}</div>
      </div>
      {photos === null ? (
        <div className="inat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="inat-tile"
              style={{ background: "var(--surface-2)" }}
            />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <div className="inat-grid">
          {photos.map((p) => (
            <a
              key={p.id}
              className="inat-tile"
              href={p.observationUrl}
              target="_blank"
              rel="noreferrer"
              title={`@${p.user} · ${p.county ?? ""} ${
                p.county ? "Co. · " : ""
              }${p.date ?? ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Observation by ${p.user}`}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div className="corner">
                {(p.license || "rr").replace("cc-", "").toUpperCase()}
              </div>
              <div className="bottom">
                <span>@{p.user}</span>
                {p.county && <span>{p.county}</span>}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "var(--pad-4)",
            textAlign: "center",
            color: "var(--gray-500)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-card)",
            fontSize: 13,
          }}
        >
          {error ? (
            <>
              Could not load iNaturalist data ({error}).{" "}
              <a
                href={`https://www.inaturalist.org/taxa/${taxonId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open on iNaturalist
                <ExternalLink size={10} style={{ verticalAlign: "-1px", marginLeft: 4 }} />
              </a>
            </>
          ) : (
            "No research-grade Indiana observations on iNaturalist yet."
          )}
        </div>
      )}
    </div>
  );
}

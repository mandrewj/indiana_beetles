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

/**
 * Compress iNat license codes into a short, single-line badge.
 *   cc-by-nc → "BY-NC"
 *   cc-by    → "BY"
 *   cc0      → "CC0"
 *   null / "all rights reserved" → "©"
 */
function licenseBadge(code: string | null | undefined): string {
  if (!code) return "©";
  const c = code.toLowerCase();
  if (c === "all rights reserved") return "©";
  return c.replace(/^cc-?/, "").toUpperCase();
}

interface State {
  photos: INatPhoto[];
  scope: "indiana" | "global";
}

export function INatTileGrid({ taxonId, speciesId }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setState(null);
    setError(null);
    (async () => {
      try {
        const indiana = await fetchTopINatPhotos(taxonId, 9);
        if (!live) return;
        if (indiana.length > 0) {
          setState({ photos: indiana, scope: "indiana" });
          return;
        }
        const global = await fetchTopINatPhotos(taxonId, 9, null);
        if (!live) return;
        setState({ photos: global, scope: "global" });
      } catch (err) {
        if (!live) return;
        setError((err as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [taxonId, speciesId]);

  const photos = state?.photos ?? null;
  const scope = state?.scope;

  const status = error
    ? "Unavailable"
    : photos === null
    ? "Loading…"
    : photos.length === 0
    ? "No observations yet"
    : scope === "global"
    ? `${photos.length} photos (no Indiana observations)`
    : `${photos.length} Indiana photos`;

  const title =
    scope === "global"
      ? "Photos · iNaturalist (global)"
      : "Community observations · iNaturalist (Indiana)";

  return (
    <div className="gallery-source-band">
      <div className="head">
        <div className="title">{title}</div>
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
              <div className="corner" title={p.license || "all rights reserved"}>
                {licenseBadge(p.license)}
              </div>
              <div className="bottom">
                <span title={`@${p.user}`}>@{p.user}</span>
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
            "No observations with photos on iNaturalist yet."
          )}
        </div>
      )}
    </div>
  );
}

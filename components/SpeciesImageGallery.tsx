"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Ph } from "./Placeholders";
import type { Species, SpeciesImage } from "@/lib/types";
import { taxonIdOrNull } from "@/lib/types";
import { INatTileGrid } from "./INatTileGrid";
import { fetchTopINatPhotos, type INatPhoto } from "@/lib/inaturalist";

export function SpeciesImageGallery({ species }: { species: Species }) {
  const admin: SpeciesImage[] = species.images ?? [];
  const [iIdx, setIIdx] = useState(0);
  const activeAdmin = admin.length ? admin[Math.min(iIdx, admin.length - 1)] : null;
  const inatId = taxonIdOrNull(species.inat_taxon_id);

  // When admin hasn't curated any images, fall back to the top community
  // photo from iNaturalist (Indiana-scoped, votes-sorted).
  const [inatFallback, setInatFallback] = useState<INatPhoto | null>(null);
  useEffect(() => {
    if (admin.length > 0 || inatId === null) {
      setInatFallback(null);
      return;
    }
    let live = true;
    fetchTopINatPhotos(inatId, 1)
      .then((photos) => {
        if (!live) return;
        setInatFallback(photos[0] ?? null);
      })
      .catch(() => {
        if (live) setInatFallback(null);
      });
    return () => {
      live = false;
    };
  }, [admin.length, inatId]);

  return (
    <div className="gallery">
      {activeAdmin ? (
        <>
          <div className="gallery-main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeAdmin.url}
              alt={activeAdmin.caption ?? species.scientific_name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              onError={(e) => {
                // Image not yet uploaded — collapse to placeholder.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <Ph
              label={`Admin · ${activeAdmin.type}`}
              style={{ position: "absolute", inset: 0 }}
            />
          </div>
          <div className="gallery-credit">
            <div>
              <strong style={{ color: "var(--text-600)" }}>
                {activeAdmin.credit}
              </strong>
              <span className="lic">{activeAdmin.type}</span>{" "}
              {activeAdmin.caption}
            </div>
          </div>
          {admin.length > 1 && (
            <div className="gallery-strip">
              {admin.map((im, i) => (
                <div
                  key={i}
                  className={`thumb ${i === iIdx ? "active" : ""}`}
                  onClick={() => setIIdx(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={im.url}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : inatFallback ? (
        <>
          <a
            className="gallery-main"
            href={inatFallback.observationUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={inatFallback.largeUrl}
              alt={`${species.scientific_name} — observation by ${inatFallback.user}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </a>
          <div className="gallery-credit">
            <div>
              <strong style={{ color: "var(--text-600)" }}>
                @{inatFallback.user}
              </strong>
              <span className="lic">
                {(inatFallback.license || "rr").toUpperCase()}
              </span>{" "}
              via iNaturalist
              {inatFallback.county && <> · {inatFallback.county} Co.</>}
              {inatFallback.date && <> · {inatFallback.date}</>}
            </div>
            <a
              href={inatFallback.observationUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open observation{" "}
              <ExternalLink size={10} style={{ verticalAlign: "-1px" }} />
            </a>
          </div>
        </>
      ) : (
        <div className="gallery-main">
          <Ph
            label={
              inatId === null
                ? "No images yet — set the iNaturalist taxon ID to enable community photos"
                : "Loading…"
            }
            style={{ position: "absolute", inset: 0 }}
          />
        </div>
      )}

      {inatId !== null && (
        <INatTileGrid taxonId={inatId} speciesId={species.id} />
      )}

      {inatId !== null && (
        <div className="gallery-credit" style={{ marginTop: 10 }}>
          <span>
            Photos are CC-licensed by their respective observers — click any
            tile to view the observation on iNaturalist.
          </span>
          <a
            href={`https://www.inaturalist.org/observations?taxon_id=${inatId}&place_id=30&photos=true`}
            target="_blank"
            rel="noreferrer"
          >
            View all <ExternalLink size={10} style={{ verticalAlign: "-1px" }} />
          </a>
        </div>
      )}
    </div>
  );
}

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
  const inatId = taxonIdOrNull(species.inat_taxon_id);

  const [iIdx, setIIdx] = useState(0);
  const [adminBroken, setAdminBroken] = useState(false);
  const [inatFallback, setInatFallback] = useState<INatPhoto | null>(null);

  // Reset error state if the user clicks a different thumbnail or the species
  // changes.
  useEffect(() => {
    setAdminBroken(false);
  }, [species.id, iIdx]);

  const [fallbackIsGlobal, setFallbackIsGlobal] = useState(false);

  // Prefetch the iNat top photo so we can swap to it instantly if the admin
  // image fails to load (or if there are no admin images at all). Try
  // Indiana first; if there are no Indiana observations with photos, fall
  // back to the best photo anywhere on iNaturalist.
  useEffect(() => {
    if (inatId === null) {
      setInatFallback(null);
      setFallbackIsGlobal(false);
      return;
    }
    let live = true;
    (async () => {
      try {
        const indiana = await fetchTopINatPhotos(inatId, 1);
        if (!live) return;
        if (indiana[0]) {
          setInatFallback(indiana[0]);
          setFallbackIsGlobal(false);
          return;
        }
        const global = await fetchTopINatPhotos(inatId, 1, null);
        if (!live) return;
        setInatFallback(global[0] ?? null);
        setFallbackIsGlobal(global[0] != null);
      } catch {
        if (live) {
          setInatFallback(null);
          setFallbackIsGlobal(false);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [inatId]);

  const activeAdmin = admin.length ? admin[Math.min(iIdx, admin.length - 1)] : null;
  const showAdmin = activeAdmin !== null && !adminBroken;

  return (
    <div className="gallery">
      {showAdmin ? (
        <>
          <div className="gallery-main">
            {/* Ph first (background) — img stacks on top once it loads. */}
            <Ph
              label={`Admin · ${activeAdmin.type}`}
              style={{ position: "absolute", inset: 0 }}
            />
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
              onError={() => setAdminBroken(true)}
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
              {fallbackIsGlobal && (
                <span style={{ color: "var(--gray-500)", marginLeft: 8 }}>
                  (no Indiana observations yet — showing best photo globally)
                </span>
              )}
              {adminBroken && !fallbackIsGlobal && (
                <span style={{ color: "var(--gray-500)", marginLeft: 8 }}>
                  (admin image unavailable — showing community photo)
                </span>
              )}
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
            href={`https://www.inaturalist.org/observations?taxon_id=${inatId}&place_id=20&photos=true`}
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

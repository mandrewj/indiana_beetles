"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Ph } from "./Placeholders";
import type { Species, SpeciesImage } from "@/lib/types";
import { INatTileGrid } from "./INatTileGrid";

export function SpeciesImageGallery({ species }: { species: Species }) {
  const admin: SpeciesImage[] = species.images ?? [];
  const [iIdx, setIIdx] = useState(0);
  const activeAdmin = admin.length ? admin[Math.min(iIdx, admin.length - 1)] : null;

  return (
    <div className="gallery">
      {activeAdmin ? (
        <>
          <div className="gallery-main">
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
      ) : (
        <div className="gallery-main">
          <Ph
            label="No editor-curated images yet"
            style={{ position: "absolute", inset: 0 }}
          />
        </div>
      )}

      {species.inat_taxon_id != null && (
        <INatTileGrid taxonId={species.inat_taxon_id} speciesId={species.id} />
      )}

      {species.inat_taxon_id != null && (
        <div className="gallery-credit" style={{ marginTop: 10 }}>
          <span>
            Photos are CC-licensed by their respective observers — click any
            tile to view the observation on iNaturalist.
          </span>
          <a
            href={`https://www.inaturalist.org/observations?taxon_id=${species.inat_taxon_id}&place_id=30&photos=true`}
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

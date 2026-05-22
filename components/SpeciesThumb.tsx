"use client";

import { useEffect, useState } from "react";
import { SpecimenPh } from "./Placeholders";
import { fetchTaxaDefaultPhotos } from "@/lib/inaturalist";
import { taxonIdOrNull } from "@/lib/types";

interface MiniTaxon {
  id: string;
  inat_taxon_id?: number | string | null;
  /** Optional admin image URL — takes precedence over iNat. */
  adminImageUrl?: string | null;
}

interface Props {
  species: MiniTaxon;
  /** CSS class for the wrapper element. Defaults to "thumb". */
  className?: string;
  /** CSS aspect-ratio value, e.g. "4/3". */
  ratio?: string;
  /** Label shown on the placeholder if no image is found. */
  placeholderLabel?: string;
  /** Extra style merged into the wrapper (e.g. position:absolute for hero). */
  wrapperStyle?: React.CSSProperties;
  /** Hide the attribution overlay (e.g. when the parent already credits). */
  hideAttribution?: boolean;
}

interface ResolvedPhoto {
  url: string;
  /** "iNat" when sourced from fetchTaxaDefaultPhotos, "admin" when from the
   *  curator-uploaded URL. Drives the attribution overlay. */
  source: "inat" | "admin";
  /** iNat-supplied attribution string (HTML-stripped) when source=inat. */
  attribution?: string;
}

// Module-level batch coalescer: when many <SpeciesThumb> mount in the same
// render pass (e.g. all species on a family page), we collect their iNat
// taxon IDs for ~50ms and fire a single /v1/taxa request.
const PENDING: Map<
  number,
  Array<(p: { url: string; attribution: string } | null) => void>
> = new Map();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const RESOLVED: Map<number, { url: string; attribution: string } | null> = new Map();

function requestPhoto(
  taxonId: number
): Promise<{ url: string; attribution: string } | null> {
  if (RESOLVED.has(taxonId)) {
    return Promise.resolve(RESOLVED.get(taxonId) ?? null);
  }
  return new Promise((resolve) => {
    const waiters = PENDING.get(taxonId) ?? [];
    waiters.push(resolve);
    PENDING.set(taxonId, waiters);
    if (flushTimer === null) {
      flushTimer = setTimeout(flush, 50);
    }
  });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function flush() {
  flushTimer = null;
  const ids = Array.from(PENDING.keys());
  const drained = new Map(PENDING);
  PENDING.clear();
  try {
    const photos = await fetchTaxaDefaultPhotos(ids);
    for (const id of ids) {
      const p = photos[id];
      const out = p
        ? { url: p.url, attribution: stripHtml(p.attribution ?? "iNaturalist") }
        : null;
      RESOLVED.set(id, out);
      drained.get(id)?.forEach((cb) => cb(out));
    }
  } catch {
    for (const id of ids) {
      RESOLVED.set(id, null);
      drained.get(id)?.forEach((cb) => cb(null));
    }
  }
}

export function SpeciesThumb({
  species,
  className,
  ratio,
  placeholderLabel,
  wrapperStyle: extraStyle,
  hideAttribution,
}: Props) {
  const inatId = taxonIdOrNull(species.inat_taxon_id);
  const adminUrl = species.adminImageUrl?.trim() ?? null;

  const [resolved, setResolved] = useState<ResolvedPhoto | null>(
    adminUrl ? { url: adminUrl, source: "admin" } : null
  );
  const [adminBroken, setAdminBroken] = useState(false);

  useEffect(() => {
    setAdminBroken(false);
    setResolved(adminUrl ? { url: adminUrl, source: "admin" } : null);
  }, [species.id, adminUrl]);

  useEffect(() => {
    if ((adminUrl && !adminBroken) || inatId === null) return;
    let live = true;
    requestPhoto(inatId).then((p) => {
      if (!live) return;
      if (p) setResolved({ url: p.url, source: "inat", attribution: p.attribution });
      else setResolved(null);
    });
    return () => {
      live = false;
    };
  }, [inatId, adminUrl, adminBroken]);

  const cls = className ?? "thumb";
  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    ...(ratio ? { aspectRatio: ratio } : null),
    ...extraStyle,
  };

  if (resolved) {
    const showCredit =
      !hideAttribution && resolved.source === "inat" && resolved.attribution;
    return (
      <div className={cls} style={wrapperStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          loading="lazy"
          onError={() => {
            if (adminUrl && !adminBroken) {
              setAdminBroken(true);
              setResolved(null);
            }
          }}
        />
        {showCredit && (
          <div
            className="thumb-attrib"
            title={resolved.attribution}
          >
            <span className="src">iNat</span>
            <span className="who">{resolved.attribution}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <SpecimenPh
      seed={`${species.id}_thumb`}
      ratio={ratio}
      label={placeholderLabel}
      style={ratio ? undefined : { width: "100%", height: "100%" }}
    />
  );
}

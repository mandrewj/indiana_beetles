"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { interpolateViridis } from "d3-scale-chromatic";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { INDIANA_COUNTIES_TOPOJSON_URL } from "@/lib/counties";

type CountyProps = { name?: string };
type CountyFeature = Feature<Geometry, CountyProps>;

interface IndianaMapProps {
  /** Map of county name → record count. */
  counts?: Record<string, number>;
  /** Currently selected county name (highlighted). */
  selected?: string | null;
  /** Click handler for a county. */
  onCounty?: (info: { name: string; count: number }) => void;
  /** Pixel height cap. */
  height?: number;
}

let __cached: Promise<CountyFeature[] | null> | null = null;

function loadCounties(): Promise<CountyFeature[] | null> {
  if (__cached) return __cached;
  __cached = (async () => {
    try {
      const res = await fetch(INDIANA_COUNTIES_TOPOJSON_URL);
      if (!res.ok) return null;
      const topo = (await res.json()) as Topology;
      const fc = feature(
        topo,
        topo.objects.counties as GeometryCollection<CountyProps>
      ) as FeatureCollection<Geometry, CountyProps>;
      return fc.features;
    } catch {
      return null;
    }
  })();
  return __cached;
}

export function IndianaMap({
  counts = {},
  selected,
  onCounty,
  height = 360,
}: IndianaMapProps) {
  const [features, setFeatures] = useState<CountyFeature[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadCounties().then((fs) => {
      if (!live) return;
      if (fs && fs.length > 0) setFeatures(fs);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const max = useMemo(
    () => Math.max(1, ...Object.values(counts)),
    [counts]
  );

  const ramp = useMemo(() => {
    const viridis = [0.15, 0.32, 0.5, 0.7, 0.92].map(interpolateViridis);
    return ["#F1F3F5", ...viridis];
  }, []);

  const colorFor = (n: number): string => {
    if (!n) return ramp[0];
    const t = n / max;
    return ramp[Math.min(ramp.length - 1, 1 + Math.floor(t * (ramp.length - 1)))];
  };

  if (failed) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-2)",
          border: "1px solid var(--surface-3)",
          color: "var(--gray-500)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Map data unavailable
      </div>
    );
  }

  if (!features) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-2)",
          border: "1px solid var(--surface-3)",
          color: "var(--gray-500)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Loading county geometry…
      </div>
    );
  }

  const W = 600;
  const H = 600;
  const fc: FeatureCollection<Geometry, CountyProps> = {
    type: "FeatureCollection",
    features,
  };
  const proj = geoMercator().fitSize([W - 8, H - 8], fc);
  const path = geoPath(proj);

  return (
    <div>
      <svg
        className="ind-map"
        viewBox={`0 0 ${W} ${H}`}
        style={{ maxHeight: height, aspectRatio: "1/1" }}
      >
        {features.map((f, i) => {
          const name = f.properties?.name ?? "";
          const n = counts[name] || 0;
          const isSel = selected === name;
          return (
            <path
              key={i}
              className={`county ${isSel ? "selected" : ""}`}
              d={path(f) || undefined}
              fill={colorFor(n)}
              onClick={() => onCounty?.({ name, count: n })}
            >
              <title>{`${name} County — ${n} record${n === 1 ? "" : "s"}`}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-legend">
        {ramp.map((c, i) => (
          <div
            key={i}
            className="swatch"
            style={{
              background: c,
              borderRightWidth: i < ramp.length - 1 ? 0 : 1,
            }}
          />
        ))}
        <span className="lbl">
          0 → {max}+ records · {features.length} counties
        </span>
      </div>
    </div>
  );
}

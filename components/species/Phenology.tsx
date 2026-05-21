import type { Species } from "@/lib/types";

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function Phenology({ species }: { species: Species }) {
  const peak = new Set(species.phenology_peak);
  const active = new Set(species.phenology);
  return (
    <div className="sec">
      <div className="sec-head">
        <h3>Phenology</h3>
        <span className="meta">Adult activity, monthly</span>
      </div>
      <div className="pheno">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const cls = peak.has(m) ? "on" : active.has(m) ? "partial" : "";
          return <div key={m} className={`m ${cls}`} />;
        })}
      </div>
      <div className="pheno-labels">
        {MONTH_LETTERS.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--gray-500)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "var(--blue-600)",
              verticalAlign: "-1px",
              marginRight: 4,
            }}
          />{" "}
          Peak
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "var(--blue-300)",
              verticalAlign: "-1px",
              marginRight: 4,
            }}
          />{" "}
          Active
        </span>
      </div>
    </div>
  );
}

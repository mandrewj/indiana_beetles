import type { Species } from "@/lib/types";

export function Diagnosis({ species }: { species: Species }) {
  return (
    <div className="sec">
      <div className="sec-head">
        <h3>Diagnosis</h3>
        <span className="meta">Field characters</span>
      </div>
      <div className="dx">
        <p className="dx-prose">{species.diagnosis}</p>

        <div className="dx-size">
          <div className="dx-size-label">Body length</div>
          <div className="dx-size-value">
            {species.body_size_mm}
            <span className="dx-size-unit">mm</span>
          </div>
        </div>

        <div className="dx-chars">
          <div className="dx-chars-label">Key diagnostic characters</div>
          <div className="dx-chars-list">
            {species.diagnostic_characters.slice(0, 3).map((c, i) => (
              <div className="dx-char" key={i}>
                <div className="dx-char-num">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="dx-char-k">{c.label}</div>
                  <div className="dx-char-v">{c.value}</div>
                  {c.note && <div className="dx-char-n">{c.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

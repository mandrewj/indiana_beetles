import type { Species } from "@/lib/types";

/**
 * Citations may include `*italic*` markdown — we render those as <em>.
 * No other HTML is interpreted; non-asterisk characters are escaped by React.
 */
function renderCitation(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function References({ species }: { species: Species }) {
  if (!species.references?.length) return null;
  return (
    <div className="sec">
      <div className="sec-head">
        <h3>References</h3>
      </div>
      <ol className="refs" style={{ paddingLeft: 20 }}>
        {species.references.map((r, i) => (
          <li key={i}>{renderCitation(r)}</li>
        ))}
      </ol>
    </div>
  );
}

import { ExternalLink } from "lucide-react";

export function SignedInAs({ login }: { login: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        background: "var(--blue-50)",
        border: "1px solid var(--blue-100)",
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.06em",
        color: "var(--blue-800)",
        textTransform: "uppercase",
        marginBottom: "var(--pad-3)",
      }}
    >
      Signed in as{" "}
      <a
        href={`https://github.com/${login}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: "var(--blue-800)", fontWeight: 700 }}
      >
        @{login}
        <ExternalLink size={9} style={{ verticalAlign: "-1px", marginLeft: 3 }} />
      </a>
    </div>
  );
}

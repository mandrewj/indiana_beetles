import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RankLabel } from "@/components/Badges";
import { getAllFamilies, getAllSpecies } from "@/lib/content";
import { readGhTokenFromCookies } from "@/lib/auth";

export const metadata = {
  title: "Refresh species",
};

export const dynamic = "force-dynamic";

export default async function RefreshLanding() {
  if (!readGhTokenFromCookies()) {
    return (
      <div
        className="page container"
        style={{ padding: "var(--pad-5) 0", maxWidth: 640, margin: "0 auto" }}
      >
        <RankLabel>Editor tools</RankLabel>
        <h1
          className="display"
          style={{ fontSize: 36, margin: "6px 0 12px", lineHeight: 1 }}
        >
          Sign in required
        </h1>
        <p style={{ color: "var(--text-500)" }}>
          Refresh writes back to GitHub via your Decap session. Open the CMS
          editor first to authenticate.
        </p>
        <div style={{ marginTop: "var(--pad-3)" }}>
          <a className="btn btn-primary" href="/admin/">
            Open the CMS editor
          </a>
        </div>
      </div>
    );
  }

  const [families, allSpecies] = await Promise.all([
    getAllFamilies(),
    getAllSpecies(),
  ]);

  const summaries = families
    .map((f) => {
      const inFamily = allSpecies.filter((s) => s.family === f.id);
      const stale = inFamily.filter((s) => !s.last_refreshed).length;
      const oldest = inFamily.reduce<string | null>((acc, s) => {
        if (!s.last_refreshed) return acc;
        if (!acc) return s.last_refreshed;
        return s.last_refreshed < acc ? s.last_refreshed : acc;
      }, null);
      return { family: f, total: inFamily.length, stale, oldest };
    })
    .filter((s) => s.total > 0);

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/admin">Admin</Link>
        <span className="sep">/</span>
        <span className="current">Refresh</span>
      </div>
      <RankLabel>Editor tools</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 48, margin: "6px 0 4px", lineHeight: 1 }}
      >
        Refresh existing species
      </h1>
      <p
        style={{
          color: "var(--text-500)",
          maxWidth: "64ch",
          marginBottom: "var(--pad-4)",
        }}
      >
        Snapshot live GBIF + iNat data into the species JSON files: county
        distribution, record counts, and re-verified taxon IDs.
        Diagnoses, body sizes, and other manually-entered fields are left
        untouched.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "var(--pad-3)",
        }}
      >
        {summaries
          .slice()
          .sort((a, b) => b.stale - a.stale)
          .map(({ family, total, stale, oldest }) => (
            <Link
              key={family.id}
              href={`/admin/refresh/${family.id}`}
              className="quick"
            >
              <div className="num">{family.name}</div>
              <h3 style={{ fontStyle: "italic" }}>{family.common_name}</h3>
              <p>
                {total} species in dataset ·{" "}
                <strong style={{ color: stale > 0 ? "var(--blue-600)" : "var(--gray-500)" }}>
                  {stale} never refreshed
                </strong>
                {oldest && stale === 0 ? <> · oldest refresh {oldest}</> : null}
              </p>
              <div className="go">
                <span>Review &amp; refresh</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RankLabel } from "@/components/Badges";
import { getAllFamilies } from "@/lib/content";
import { familyDiscoverSummary } from "@/lib/discover";
import { readGhTokenFromCookies } from "@/lib/auth";

export const metadata = {
  title: "Discover species",
};

export default async function DiscoverLanding() {
  const authed = readGhTokenFromCookies() !== null;
  if (!authed) {
    return <SignInGate />;
  }

  const families = await getAllFamilies();
  // Pull summaries in parallel — each is a single iNat call with a 30-min
  // server-side revalidate window so this is cheap on subsequent loads.
  const summaries = await Promise.all(
    families.map(async (f) => ({
      family: f,
      ...(await familyDiscoverSummary(f)),
    }))
  );

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/admin">Admin</Link>
        <span className="sep">/</span>
        <span className="current">Discover</span>
      </div>
      <RankLabel>Editor tools</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 48, margin: "6px 0 4px", lineHeight: 1 }}
      >
        Discover new species
      </h1>
      <p
        style={{
          color: "var(--text-500)",
          maxWidth: "64ch",
          marginBottom: "var(--pad-4)",
        }}
      >
        Pick a family to see Indiana-observed species on iNaturalist that
        aren&apos;t yet in the dataset. Approve one and it lands as a commit on
        the repo with auto-populated taxonomy + IDs; you can flesh out diagnosis,
        body size, and characters via Decap afterwards.
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
          .sort((a, b) => {
            const pa = Math.max(0, a.totalIndianaSpecies - a.knownCount);
            const pb = Math.max(0, b.totalIndianaSpecies - b.knownCount);
            return pb - pa;
          })
          .map(({ family, totalIndianaSpecies, knownCount }) => {
            const pending = Math.max(0, totalIndianaSpecies - knownCount);
            return (
              <Link
                key={family.id}
                href={`/admin/discover/${family.id}`}
                className="quick"
              >
                <div className="num">{family.name}</div>
                <h3 style={{ fontStyle: "italic" }}>{family.common_name}</h3>
                <p>
                  {totalIndianaSpecies} Indiana species on iNat ·{" "}
                  {knownCount} in dataset ·{" "}
                  <strong style={{ color: pending > 0 ? "var(--blue-600)" : "var(--gray-500)" }}>
                    {pending} candidate{pending === 1 ? "" : "s"}
                  </strong>
                </p>
                <div className="go">
                  <span>{pending > 0 ? "Review candidates" : "All caught up"}</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function SignInGate() {
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
        Discover and Refresh use the same GitHub login as Decap. Open the CMS
        editor first — once you&apos;ve signed in there, return to this page.
      </p>
      <div style={{ marginTop: "var(--pad-3)" }}>
        <a className="btn btn-primary" href="/admin/">
          Open the CMS editor
        </a>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { RankLabel } from "@/components/Badges";
import { SignedInAs } from "@/components/admin/SignedInAs";
import { discoverFamily } from "@/lib/discover";
import { getTaxonomy } from "@/lib/content";
import { getAuthedLogin } from "@/lib/auth";
import { DiscoverView } from "./DiscoverView";

// Always server-render: auth + iNat data must be fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { family: string };
}) {
  return { title: `Discover · ${params.family}` };
}

export default async function DiscoverFamilyPage({
  params,
}: {
  params: { family: string };
}) {
  const login = await getAuthedLogin();
  if (!login) {
    return (
      <div
        className="page container"
        style={{ padding: "var(--pad-5) 0", maxWidth: 640, margin: "0 auto" }}
      >
        <RankLabel>Discover</RankLabel>
        <h1
          className="display"
          style={{ fontSize: 36, margin: "6px 0 12px", lineHeight: 1 }}
        >
          Sign in required
        </h1>
        <p style={{ color: "var(--text-500)" }}>
          Open the CMS editor and authenticate with GitHub first, then return
          here.
        </p>
        <div style={{ marginTop: "var(--pad-3)" }}>
          <a className="btn btn-primary" href="/admin/">
            Open the CMS editor
          </a>
        </div>
      </div>
    );
  }

  let result;
  try {
    result = await discoverFamily(params.family);
  } catch {
    notFound();
  }

  // Pass the current taxonomy down so the client can compute the updated
  // file content for each approval without an extra round-trip.
  const taxonomy = await getTaxonomy();

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/admin">Admin</Link>
        <span className="sep">/</span>
        <Link href="/admin/discover">Discover</Link>
        <span className="sep">/</span>
        <span className="current">{result.family.name}</span>
      </div>
      <SignedInAs login={login} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--pad-5)",
          alignItems: "end",
          marginBottom: "var(--pad-4)",
        }}
      >
        <div>
          <RankLabel>Discover</RankLabel>
          <h1
            className="display"
            style={{ fontSize: 48, margin: "6px 0 4px", lineHeight: 1 }}
          >
            {result.family.name}
          </h1>
          <p
            style={{
              color: "var(--text-500)",
              margin: "4px 0 0",
              maxWidth: "56ch",
            }}
          >
            iNaturalist reports{" "}
            <strong>{result.totalIndianaSpecies}</strong> species observed in
            Indiana under this family. <strong>{result.knownCount}</strong>{" "}
            are already in the dataset.{" "}
            <strong style={{ color: "var(--blue-600)" }}>
              {result.candidates.length} candidate
              {result.candidates.length === 1 ? "" : "s"}
            </strong>{" "}
            below.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto",
            gap: "10px 24px",
            alignContent: "end",
          }}
        >
          <div>
            <div className="rank">In dataset</div>
            <div className="display" style={{ fontSize: 36, lineHeight: 1 }}>
              {result.knownCount}
            </div>
          </div>
          <div>
            <div className="rank">Candidates</div>
            <div
              className="display"
              style={{
                fontSize: 36,
                lineHeight: 1,
                color: result.candidates.length > 0 ? "var(--blue-600)" : "var(--gray-500)",
              }}
            >
              {result.candidates.length}
            </div>
          </div>
        </div>
      </div>

      <DiscoverView
        family={result.family}
        candidates={result.candidates}
        taxonomy={taxonomy}
      />
    </div>
  );
}

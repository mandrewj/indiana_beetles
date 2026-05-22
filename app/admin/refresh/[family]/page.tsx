import Link from "next/link";
import { notFound } from "next/navigation";
import { RankLabel } from "@/components/Badges";
import { getAllFamilies, getAllSpecies } from "@/lib/content";
import { readGhTokenFromCookies } from "@/lib/auth";
import { RefreshView } from "./RefreshView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { family: string };
}) {
  return { title: `Refresh · ${params.family}` };
}

export default async function RefreshFamilyPage({
  params,
}: {
  params: { family: string };
}) {
  if (!readGhTokenFromCookies()) {
    return (
      <div
        className="page container"
        style={{ padding: "var(--pad-5) 0", maxWidth: 640, margin: "0 auto" }}
      >
        <RankLabel>Refresh</RankLabel>
        <h1
          className="display"
          style={{ fontSize: 36, margin: "6px 0 12px", lineHeight: 1 }}
        >
          Sign in required
        </h1>
        <p style={{ color: "var(--text-500)" }}>
          Open the CMS editor and authenticate with GitHub first.
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
  const family = families.find((f) => f.id === params.family);
  if (!family) notFound();

  const speciesInFamily = allSpecies
    .filter((s) => s.family === family.id)
    .sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));

  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <div className="crumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <Link href="/admin">Admin</Link>
        <span className="sep">/</span>
        <Link href="/admin/refresh">Refresh</Link>
        <span className="sep">/</span>
        <span className="current">{family.name}</span>
      </div>
      <RankLabel>Refresh</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 48, margin: "6px 0 4px", lineHeight: 1 }}
      >
        {family.name}
      </h1>
      <p
        style={{
          color: "var(--text-500)",
          margin: "4px 0 var(--pad-4)",
          maxWidth: "60ch",
        }}
      >
        {speciesInFamily.length} species in dataset. Stage up to 10 for a
        single batched commit — each species snapshots live GBIF + iNat data
        and re-verifies taxon IDs.
      </p>

      <RefreshView family={family} species={speciesInFamily} />
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { RankLabel } from "@/components/Badges";

export const metadata = {
  title: "Admin",
};

/**
 * The actual editor is a Decap CMS instance mounted at /admin/index.html
 * (served straight out of /public/admin/). This page is a thin landing for
 * editors who hit the route without the trailing /index.html.
 */
export default function AdminLandingPage() {
  return (
    <div
      className="page container"
      style={{
        padding: "var(--pad-5) 0",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <RankLabel>Editor portal</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 40, margin: "6px 0 12px", lineHeight: 1 }}
      >
        Beetles of Indiana — Admin
      </h1>
      <p style={{ color: "var(--text-500)" }}>
        Authoring is handled through Decap CMS. Open the editor to add or
        revise species treatments, family pages, identification keys, and the
        glossary. Every save is committed back to the GitHub repository, which
        triggers a redeploy automatically.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: "var(--pad-3)", flexWrap: "wrap" }}>
        <a className="btn btn-primary" href="/admin/index.html">
          Open the editor <ArrowRight size={12} />
        </a>
        <Link className="btn" href="/admin/discover">
          Discover new species <ArrowRight size={12} />
        </Link>
        <Link className="btn" href="/about">
          About this project
        </Link>
      </div>

      <div
        className="card card-pad"
        style={{ marginTop: "var(--pad-5)" }}
      >
        <div className="rank">Looking for the live data?</div>
        <p style={{ color: "var(--text-500)", fontSize: 13.5 }}>
          Every JSON file under <code>/data/</code> in the repo is the source
          of truth for one collection in the editor. Pull requests are welcome
          for typo fixes and citation updates from contributors who prefer
          Git.
        </p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="nav-link"
          style={{ fontSize: 13 }}
        >
          Open the repository{" "}
          <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
        </a>
      </div>
    </div>
  );
}

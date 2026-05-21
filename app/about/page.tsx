import { RankLabel } from "@/components/Badges";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="page container" style={{ padding: "var(--pad-5) 0" }}>
      <RankLabel>About</RankLabel>
      <h1
        className="display"
        style={{ fontSize: 48, margin: "6px 0 var(--pad-3)", lineHeight: 1 }}
      >
        About the project
      </h1>
      <div style={{ maxWidth: "62ch" }}>
        <p style={{ color: "var(--text-500)", lineHeight: 1.7 }}>
          <em>Beetles of Indiana</em> is a continuously updated scientific
          reference and identification tool covering the beetle fauna (Order
          Coleoptera) of Indiana, USA. The project aggregates taxonomic
          literature, occurrence data from <strong>GBIF</strong> and{" "}
          <strong>iNaturalist</strong>, and community-contributed photography
          into a single resource for naturalists, educators, and professional
          entomologists.
        </p>
        <p style={{ color: "var(--text-500)", lineHeight: 1.7 }}>
          The site is statically generated from a public GitHub repository;
          content is authored through a no-code editor and committed on save.
          New treatments, key revisions, and image additions are released
          continuously.
        </p>
        <p style={{ color: "var(--text-500)", lineHeight: 1.7 }}>
          <strong>Citation:</strong> Holcombe, J. &amp; Burrack, R. (eds.).
          2026. <em>Beetles of Indiana.</em> Retrieved from
          beetlesofindiana.org on [DATE].
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>About</h4>
            <p style={{ margin: 0, maxWidth: "42ch" }}>
              A scientific reference and identification tool for the beetle
              fauna (Order Coleoptera) of Indiana, USA. Maintained by the
              project team and contributing entomologists; built on open data
              from GBIF and iNaturalist.
            </p>
          </div>
          <div>
            <h4>Browse</h4>
            <Link href="/browse">Families</Link>
            <Link href="/browse">Genera index</Link>
            <Link href="/browse">Recent additions</Link>
            <Link href="/browse">Adventive species</Link>
          </div>
          <div>
            <h4>Data</h4>
            <a
              href="https://www.gbif.org/occurrence/search?country=US&state_province=Indiana"
              target="_blank"
              rel="noreferrer"
            >
              GBIF Indiana{" "}
              <ExternalLink size={11} style={{ verticalAlign: "-2px" }} />
            </a>
            <a
              href="https://www.inaturalist.org/observations?place_id=20&taxon_id=47208"
              target="_blank"
              rel="noreferrer"
            >
              iNaturalist (Indiana, Coleoptera){" "}
              <ExternalLink size={11} style={{ verticalAlign: "-2px" }} />
            </a>
            <Link href="/about">Download checklists</Link>
            <Link href="/about">Citation</Link>
          </div>
          <div>
            <h4>Contribute</h4>
            <Link href="/admin">Submit a record</Link>
            <Link href="/admin">Suggest a correction</Link>
            <Link href="/about">Image attribution policy</Link>
            <Link href="/about">Contact editors</Link>
          </div>
        </div>
        <div className="copy">
          <span>© 2026 Beetles of Indiana · CC BY-NC 4.0</span>
          <span>v0.4.0</span>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SiteSearch } from "./SiteSearch";
import type { SearchEntry } from "@/lib/search";

const NAV_ITEMS = [
  { href: "/browse", match: ["/browse"], label: "Browse" },
  { href: "/identify", match: ["/identify"], label: "Identify" },
  { href: "/glossary", match: ["/glossary"], label: "Glossary" },
  { href: "/about", match: ["/about"], label: "About" },
  { href: "/admin", match: ["/admin"], label: "Admin" },
];

function isActive(pathname: string, matches: string[]): boolean {
  return matches.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export function Nav({ searchIndex }: { searchIndex: SearchEntry[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <Image
            src="/images/insectID.png"
            alt="InsectID"
            width={92}
            height={40}
            priority
            style={{ height: 32, width: "auto" }}
          />
          <span className="brand-name">Beetles of Indiana</span>
          <span className="brand-sub">Coleoptera · IN</span>
        </Link>
        <div className="nav-links">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(pathname, item.match) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <SiteSearch index={searchIndex} />
        </div>
      </div>
    </nav>
  );
}

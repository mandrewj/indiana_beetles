import { NextResponse } from "next/server";
import { buildSearchIndex } from "@/lib/search";

/**
 * Site search index, prerendered once at build time as a static JSON file.
 * SiteSearch fetches it lazily on first focus. Keep this out of the root
 * layout — inlining it there embedded ~200KB into every page's HTML + RSC,
 * which multiplied across ~1,600 prerendered pages per deployment.
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await buildSearchIndex());
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchEntry } from "@/lib/search";

interface Props {
  index: SearchEntry[];
}

interface Scored {
  entry: SearchEntry;
  score: number;
}

const MAX_RESULTS = 10;

function score(entry: SearchEntry, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const common = (entry.common ?? "").toLowerCase();
  // Prefix matches outrank substring matches; sci-name prefix beats common.
  if (name.startsWith(q)) return 100;
  if (common && common.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (common && common.includes(q)) return 40;
  return 0;
}

function typeLabel(t: SearchEntry["type"]): string {
  return t === "family" ? "Family" : t === "genus" ? "Genus" : "Species";
}

function nameStyle(t: SearchEntry["type"]): React.CSSProperties {
  return t === "family"
    ? { fontStyle: "normal", fontWeight: 700 }
    : { fontStyle: "italic", fontWeight: 700 };
}

export function SiteSearch({ index }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo<SearchEntry[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const scored: Scored[] = [];
    for (const entry of index) {
      const s = score(entry, q);
      if (s > 0) scored.push({ entry, score: s });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.name.localeCompare(b.entry.name);
    });
    return scored.slice(0, MAX_RESULTS).map((x) => x.entry);
  }, [index, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // "/" focuses the input when nothing else is focused (matches the kbd hint).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function navigate(entry: SearchEntry) {
    setOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      navigate(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="nav-search">
        <Search size={14} />
        <input
          ref={inputRef}
          placeholder="Search taxa…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="site-search-dropdown"
        />
        <kbd>/</kbd>
      </div>
      {showDropdown && (
        <div
          id="site-search-dropdown"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 340,
            maxWidth: 460,
            background: "var(--surface-0)",
            border: "1px solid var(--surface-3)",
            borderRadius: 6,
            boxShadow: "var(--shadow-card)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: "var(--pad-3)",
                color: "var(--gray-500)",
                fontSize: 13,
              }}
            >
              No matches for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              {results.map((entry, i) => (
                <li
                  key={`${entry.type}-${entry.href}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => navigate(entry)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    columnGap: 10,
                    rowGap: 1,
                    background: i === activeIdx ? "var(--blue-50)" : "transparent",
                    borderBottom: "1px solid var(--surface-3)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--gray-500)",
                      alignSelf: "center",
                      gridRow: "1 / 3",
                    }}
                  >
                    {typeLabel(entry.type)}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--text-600)",
                      ...nameStyle(entry.type),
                    }}
                  >
                    {entry.name}
                    {entry.common && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontStyle: "normal",
                          fontWeight: 400,
                          color: "var(--gray-600)",
                          fontSize: 12.5,
                        }}
                      >
                        — {entry.common}
                      </span>
                    )}
                  </span>
                  {entry.context && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--gray-500)",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {entry.context}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

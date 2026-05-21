"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Grid as GridIcon,
  List as ListIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { SpecimenPh } from "./Placeholders";
import type {
  DichotomousKey as DichotomousKeyType,
  KeyCouplet,
  KeyLead,
} from "@/lib/types";

export type KeyMode = "couplet" | "cards" | "compare";

type ResolvedTarget =
  | { kind: "couplet"; id: number }
  | { kind: "taxon"; id: string };

function resolveLead(lead: KeyLead): ResolvedTarget {
  if (typeof lead.goto === "number") return { kind: "couplet", id: lead.goto };
  return { kind: "taxon", id: lead.goto };
}

function leadShortLabel(text: string): string {
  const words = text.split(/\s+/).slice(0, 6).join(" ");
  return words.length < text.length ? `${words}…` : words;
}

interface LevelHistory {
  coupletId: number;
  leadText: string | null;
}

interface Level {
  key: DichotomousKeyType;
  history: LevelHistory[];
}

interface Result {
  id: string;
  kind: "species" | "genus";
  note?: string;
}

export interface DichotomousKeyProps {
  mode?: KeyMode;
  initialKey: DichotomousKeyType;
  /** When a `genera`-scope lead points at a genus id, return the sub-key. */
  lookupChildKey?: (id: string) => DichotomousKeyType | null;
  /** Map a taxon id (family / genus / species) → display name. */
  taxonNameLookup?: (id: string) => string;
  /** Whether reaching a species result navigates to its page. */
  resultLink?: (id: string) => string | null;
}

export function DichotomousKey({
  mode = "couplet",
  initialKey,
  lookupChildKey,
  taxonNameLookup,
  resultLink,
}: DichotomousKeyProps) {
  const router = useRouter();
  const [levels, setLevels] = useState<Level[]>(() => [
    {
      key: initialKey,
      history: [
        { coupletId: initialKey.couplets[0].id, leadText: null },
      ],
    },
  ]);
  const [showFull, setShowFull] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    setLevels([
      {
        key: initialKey,
        history: [
          { coupletId: initialKey.couplets[0].id, leadText: null },
        ],
      },
    ]);
    setResult(null);
    setShowFull(false);
  }, [initialKey]);

  const top = levels[levels.length - 1];
  const cur = top.history[top.history.length - 1];
  const couplet = top.key.couplets.find((c) => c.id === cur.coupletId);

  function choose(lead: KeyLead) {
    const res = resolveLead(lead);
    if (res.kind === "couplet") {
      const next = top.key.couplets.find((c) => c.id === res.id);
      if (!next) return;
      setLevels((prev) => {
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            history: [
              ...last.history,
              { coupletId: res.id, leadText: leadShortLabel(lead.text) },
            ],
          },
        ];
      });
      return;
    }

    // Taxon target — depends on the current key's scope.
    if (top.key.scope === "genera" || top.key.scope === "families") {
      const childKey = lookupChildKey?.(res.id) ?? null;
      if (childKey) {
        setLevels((prev) => [
          ...prev,
          {
            key: childKey,
            history: [
              { coupletId: childKey.couplets[0].id, leadText: null },
            ],
          },
        ]);
      } else {
        setResult({
          id: res.id,
          kind: top.key.scope === "families" ? "genus" : "genus",
          note:
            "No nested key available yet — browse this taxon directly.",
        });
      }
    } else {
      setResult({ id: res.id, kind: "species" });
    }
  }

  function back() {
    if (result) {
      setResult(null);
      return;
    }
    setLevels((prev) => {
      const last = prev[prev.length - 1];
      if (last.history.length > 1) {
        return [
          ...prev.slice(0, -1),
          { ...last, history: last.history.slice(0, -1) },
        ];
      }
      if (prev.length > 1) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }

  function reset() {
    setLevels([
      {
        key: initialKey,
        history: [
          { coupletId: initialKey.couplets[0].id, leadText: null },
        ],
      },
    ]);
    setResult(null);
  }

  function jumpToLevel(levelIdx: number) {
    setLevels((prev) =>
      prev.slice(0, levelIdx + 1).map((lv, i) =>
        i === levelIdx
          ? {
              ...lv,
              history: [
                { coupletId: lv.key.couplets[0].id, leadText: null },
              ],
            }
          : lv
      )
    );
    setResult(null);
  }

  const crumbs = useMemo(
    () =>
      levels.map((lv, i) => ({
        levelIdx: i,
        label: lv.key.title.replace(
          /^Key to (Species of |Genera of |Families of )?/i,
          ""
        ),
      })),
    [levels]
  );

  const totalGuess = Math.max(4, top.key.couplets.length);
  const stepsTaken = top.history.length - 1;
  const canBack = top.history.length > 1 || levels.length > 1;

  return (
    <div className="key-frame">
      <div className="head">
        <div className="title">{top.key.title}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className={`btn btn-sm ${!showFull ? "btn-primary" : ""}`}
            onClick={() => setShowFull(false)}
          >
            <GridIcon size={12} /> Step
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showFull ? "btn-primary" : ""}`}
            onClick={() => setShowFull(true)}
          >
            <ListIcon size={12} /> Full key
          </button>
        </div>
      </div>

      <div className="key-trail">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <span
              className={`seg ${
                i === crumbs.length - 1 && !result ? "current" : ""
              }`}
              onClick={() => jumpToLevel(i)}
            >
              {c.label}
            </span>
            {i < crumbs.length - 1 && <span className="arr">→</span>}
          </Fragment>
        ))}
        {result && (
          <>
            <span className="arr">→</span>
            <span className="current">
              {taxonNameLookup ? taxonNameLookup(result.id) : result.id} (result)
            </span>
          </>
        )}
      </div>

      {result ? (
        <div className="result-card">
          <SpecimenPh seed={result.id} label={result.kind} />
          <div>
            <div className="lbl">
              {result.kind === "species"
                ? "Identification result"
                : "Genus result"}
            </div>
            <div className="name">
              {taxonNameLookup ? taxonNameLookup(result.id) : result.id}
            </div>
            {result.note && <div className="common">{result.note}</div>}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {result.kind === "species" && resultLink?.(result.id) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const href = resultLink?.(result.id);
                    // Routes are computed from species ids at runtime, so the
                    // typed-routes generic can't narrow them — accept the
                    // string at the boundary.
                    if (href) router.push(href as never);
                  }}
                >
                  View species page <ArrowRight size={12} />
                </button>
              )}
              <button type="button" className="btn" onClick={reset}>
                <RefreshCw size={12} /> Start over
              </button>
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {stepsTaken} {stepsTaken === 1 ? "step" : "steps"}
            <br />
            {levels.length} {levels.length === 1 ? "key" : "keys"}
          </div>
        </div>
      ) : showFull ? (
        <FullKeyList
          keyData={top.key}
          onJump={(id) => {
            setLevels((prev) => {
              const last = prev[prev.length - 1];
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  history: [{ coupletId: id, leadText: null }],
                },
              ];
            });
          }}
          onChoose={choose}
          taxonNameLookup={taxonNameLookup}
        />
      ) : mode === "cards" ? (
        <CardKeyMode
          couplet={couplet}
          onChoose={choose}
          stepsTaken={stepsTaken}
          totalGuess={totalGuess}
        />
      ) : mode === "compare" ? (
        <CompareKeyMode couplet={couplet} onChoose={choose} />
      ) : (
        <CoupletMode couplet={couplet} onChoose={choose} />
      )}

      {!result && (
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--surface-3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--gray-500)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          <span>
            Step {stepsTaken + 1} · Key level {levels.length}/
            {Math.max(levels.length, 3)}
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            {canBack && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={back}
              >
                <ArrowLeft size={12} /> Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={reset}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function CoupletMode({
  couplet,
  onChoose,
}: {
  couplet?: KeyCouplet;
  onChoose: (lead: KeyLead) => void;
}) {
  if (!couplet) return null;
  return (
    <div className="couplet">
      <div className="num">{couplet.id}</div>
      {(["lead_a", "lead_b"] as const).map((slot) => {
        const lead = couplet[slot];
        const letter = slot === "lead_a" ? "a" : "b";
        return (
          <div key={slot} className="lead" onClick={() => onChoose(lead)}>
            <div className="letter">{letter}</div>
            <div className="text">
              {lead.text}
              <span className="arrow">
                →{" "}
                {typeof lead.goto === "number"
                  ? `couplet ${lead.goto}`
                  : lead.goto}
              </span>
            </div>
            <SpecimenPh seed={`${couplet.id}_${letter}`} label="character" />
          </div>
        );
      })}
    </div>
  );
}

function CardKeyMode({
  couplet,
  onChoose,
  stepsTaken,
  totalGuess,
}: {
  couplet?: KeyCouplet;
  onChoose: (lead: KeyLead) => void;
  stepsTaken: number;
  totalGuess: number;
}) {
  if (!couplet) return null;
  const pct = Math.min(95, ((stepsTaken + 1) / (totalGuess + 1)) * 100);
  return (
    <div className="card-key">
      <div className="progress">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pq">Question {stepsTaken + 1}</div>
      <div className="question">Which best describes the specimen?</div>
      <div className="choices">
        {(["lead_a", "lead_b"] as const).map((slot, i) => {
          const lead = couplet[slot];
          const letter = i === 0 ? "A." : "B.";
          return (
            <div
              key={slot}
              className="choice"
              onClick={() => onChoose(lead)}
            >
              <SpecimenPh
                seed={`${couplet.id}_card_${slot}`}
                label={`option ${letter.toLowerCase()}`}
              />
              <div className="text">
                <span className="letter">{letter}</span>
                {lead.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareKeyMode({
  couplet,
  onChoose,
}: {
  couplet?: KeyCouplet;
  onChoose: (lead: KeyLead) => void;
}) {
  if (!couplet) return null;
  return (
    <div className="compare-key">
      <div className="row">
        {(["lead_a", "lead_b"] as const).map((slot) => {
          const lead = couplet[slot];
          const letter = slot === "lead_a" ? "a" : "b";
          return (
            <div
              key={slot}
              className="side"
              onClick={() => onChoose(lead)}
            >
              <div className="text">
                <div className="rank" style={{ marginBottom: 4 }}>
                  Lead {letter}
                </div>
                {lead.text}
              </div>
              <SpecimenPh seed={`${couplet.id}_cmp_${letter}`} />
            </div>
          );
        })}
      </div>
      <div className="vs">— or —</div>
    </div>
  );
}

function FullKeyList({
  keyData,
  onJump,
  onChoose,
  taxonNameLookup,
}: {
  keyData: DichotomousKeyType;
  onJump: (id: number) => void;
  onChoose: (lead: KeyLead) => void;
  taxonNameLookup?: (id: string) => string;
}) {
  return (
    <div className="full-key">
      {keyData.couplets.map((cp) => (
        <div className="cp" key={cp.id}>
          <div className="id">{cp.id}.</div>
          <div className="leads">
            {(["lead_a", "lead_b"] as const).map((k) => {
              const lead = cp[k];
              return (
                <div className="l" key={k}>
                  <div className="ltr">{k === "lead_a" ? "a." : "b."}</div>
                  <div>{lead.text}</div>
                  <div
                    className="go"
                    onClick={() => {
                      if (typeof lead.goto === "number") onJump(lead.goto);
                      else onChoose(lead);
                    }}
                  >
                    {typeof lead.goto === "number"
                      ? `→ ${lead.goto}`
                      : `→ ${
                          taxonNameLookup
                            ? taxonNameLookup(lead.goto)
                            : lead.goto
                        }`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

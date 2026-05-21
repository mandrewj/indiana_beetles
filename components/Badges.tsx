import type { ReactNode } from "react";
import type { IndianaStatus } from "@/lib/types";

const STATUS_LABELS: Record<IndianaStatus, string> = {
  confirmed: "Confirmed",
  historical: "Historical",
  adventive: "Adventive",
  excluded: "Excluded",
};

export function StatusBadge({ status }: { status: IndianaStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RankLabel({ children }: { children: ReactNode }) {
  return <span className="rank">{children}</span>;
}

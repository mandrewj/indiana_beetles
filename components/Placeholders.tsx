import type { CSSProperties } from "react";

interface PhProps {
  label?: string;
  style?: CSSProperties;
  ratio?: string;
}

export function Ph({ label, style, ratio }: PhProps) {
  return (
    <div
      className="ph-image"
      style={{
        ...(ratio ? { aspectRatio: ratio } : null),
        ...style,
      }}
    >
      {label && <div className="label">{label}</div>}
    </div>
  );
}

interface SpecimenPhProps extends PhProps {
  seed: string;
}

export function SpecimenPh({ seed, label, style, ratio }: SpecimenPhProps) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = 200 + (n % 60);
  const tone = 92 + (n % 4);
  const sat = 1 + (n % 3);
  const bg = `oklch(${tone}% ${sat / 100} ${hue})`;
  return (
    <div
      className="ph-image"
      style={{
        background: `
          repeating-linear-gradient(135deg,
            rgba(15, 23, 42, 0.04) 0 8px,
            rgba(15, 23, 42, 0.07) 8px 16px),
          ${bg}`,
        ...(ratio ? { aspectRatio: ratio } : null),
        ...style,
      }}
    >
      {label && <div className="label">{label}</div>}
    </div>
  );
}

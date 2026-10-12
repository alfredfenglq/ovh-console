import { useState } from "react";

/**
 * 柱状图(scaffold-master BarChart 的 React 移植,窄版):
 * bars-plot 网格 + bar-slot/bar-col;highlight 柱青柠高亮(其余中性);
 * 失败量从柱顶叠红;悬停出读数。稀疏(≤2 根有值)时柱顶直接标数值。
 */
export interface BarItem {
  label: string;
  value: number;
  failed?: number;
  highlight?: boolean;
}

export function BarChart({ items, height = 120, unit = "" }: { items: BarItem[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const nonEmpty = items.filter((i) => i.value > 0).length;

  return (
    <div className="bars" style={{ height: height + 26 }}>
      <div className="bars-plot" style={{ height }}>
        {items.map((it, i) => {
          const h = (it.value / max) * 100;
          const failedH = it.failed ? (it.failed / max) * 100 : 0;
          return (
            <div
              key={it.label}
              className={`bar-slot${hover === i ? " is-hover" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {it.value > 0 && (
                <div
                  className={`bar-col${it.highlight ? " is-highlight" : ""}`}
                  style={{ height: `${Math.max(h, 3)}%`, transition: `height .6s cubic-bezier(.16,1,.3,1) ${i * 40}ms` }}
                  title={`${it.label}: ${it.value}${unit}`}
                >
                  {failedH > 0 && <div className="bar-failed" style={{ height: `${(failedH / Math.max(h, 3)) * 100}%` }} />}
                  {nonEmpty <= 2 && (
                    <span className="lane-block-count" style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", color: "var(--ink-muted)" }}>
                      {it.value}
                    </span>
                  )}
                </div>
              )}
              {hover === i && it.value > 0 && (
                <span className="bar-readout tnum" style={{ position: "absolute", bottom: `calc(${Math.max(h, 3)}% + 4px)`, fontSize: 10.5, color: "var(--ink)" }}>
                  {it.value}{unit}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="bars-labels">
        {items.map((it, i) => (
          <span key={it.label} title={it.label} style={{ fontSize: 10.5, color: hover === i ? "var(--ink)" : "var(--ink-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

/**
 * 时间轴泳道(scaffold-master Swimlane 的 React 移植):
 * 泳道 = 分组(如机房),块 = 事件(如库存变化/重试),横向 = 当天时间;
 * 「现在」线每分钟推进;失败块红描边,慢事件斜线。
 * 窗口默认聚焦「首块 −1h ~ 现在 +1h」(至少 6 小时),角上按钮切全天。
 */
export interface SwimBlock {
  at: string;
  /** 块长(毫秒),事件型传 0 → 渲染为固定宽度点块 */
  durationMs?: number;
  count?: number;
  failed?: boolean;
  slow?: boolean;
  label?: string;
  onClick?: () => void;
}
export interface SwimLane {
  name: string;
  blocks: SwimBlock[];
}

export function Swimlane({ lanes, nowTick = 60_000 }: { lanes: SwimLane[]; nowTick?: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [allDay, setAllDay] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), nowTick);
    return () => clearInterval(t);
  }, [nowTick]);

  const dayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const { t0, t1 } = useMemo(() => {
    const times = lanes.flatMap((l) => l.blocks.map((b) => new Date(b.at).getTime())).filter((n) => !Number.isNaN(n));
    if (allDay || times.length === 0) return { t0: dayStart, t1: dayStart + 86_400_000 };
    const first = Math.min(...times);
    let start = first - 3_600_000;
    let end = now + 3_600_000;
    if (end - start < 6 * 3_600_000) {
      const mid = (start + end) / 2;
      start = mid - 3 * 3_600_000;
      end = mid + 3 * 3_600_000;
    }
    return { t0: Math.max(dayStart, start), t1: end };
  }, [lanes, now, allDay, dayStart]);

  const pos = (ts: number) => ((ts - t0) / (t1 - t0)) * 100;
  const visible = lanes.filter((l) => l.blocks.some((b) => {
    const t = new Date(b.at).getTime();
    return t >= t0 && t <= t1;
  }));
  const fmtH = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  };

  return (
    <div className="swimlane">
      <div className="band-tools" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button type="button" className="pg-btn" onClick={() => setAllDay((v) => !v)}>
          {allDay ? "↔ 聚焦" : "☐ 全天"}
        </button>
      </div>
      {/* 时间刻度行 */}
      <div style={{ display: "grid", gridTemplateColumns: "var(--swim-label-w) 1fr", gap: 8, marginBottom: 4 }}>
        <span />
        <div style={{ position: "relative", height: 16, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f} style={{ position: "absolute", left: `${f * 100}%`, transform: f === 1 ? "translateX(-100%)" : f === 0.5 ? "translateX(-50%)" : "none" }}>
              {fmtH(t0 + f * (t1 - t0))}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {visible.length === 0 && (
          <div className="empty" style={{ padding: "18px 8px" }}>
            <span className="empty-title" style={{ fontSize: 12, color: "var(--ink-faint)" }}>窗口内没有事件</span>
          </div>
        )}
        {visible.map((lane) => (
          <div key={lane.name} style={{ display: "grid", gridTemplateColumns: "var(--swim-label-w) 1fr", gap: 8, alignItems: "center", minHeight: "var(--lane-h)", borderTop: "1px solid var(--line)" }}>
            <span className="cell-sub" style={{ fontFamily: "var(--font-mono)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={lane.name}>
              {lane.name}
            </span>
            <div style={{ position: "relative", height: 26 }}>
              {lane.blocks.map((b, i) => {
                const t = new Date(b.at).getTime();
                if (t < t0 || t > t1) return null;
                const w = b.durationMs ? Math.max(0.6, (b.durationMs / (t1 - t0)) * 100) : 1.6;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`lane-block${b.failed ? " is-failed" : ""}${b.slow ? " is-slow" : ""}`}
                    style={{ position: "absolute", left: `${pos(t)}%`, width: `${w}%`, minWidth: 10, height: 20, top: 3 }}
                    title={`${b.label ?? ""} ${new Date(b.at).toLocaleTimeString()}`}
                    onClick={b.onClick}
                  >
                    {b.count != null && b.count > 1 ? <span className="lane-block-count">{b.count}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {/* 现在线 */}
        {now >= t0 && now <= t1 && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: `calc(var(--swim-label-w) + 8px + ${pos(now)}% * (100% - var(--swim-label-w) - 8px) / 100)`, top: 0, bottom: 0, width: 1.5, background: "var(--red-text)", opacity: 0.55 }}
          />
        )}
      </div>
    </div>
  );
}

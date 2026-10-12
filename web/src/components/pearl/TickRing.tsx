import { useEffect, useState } from "react";

/**
 * 刻度环(scaffold-master TickRing 的 React 移植):
 * 60 根径向刻度按数值点亮(每 5 根一根主刻度),末端一枚亮帽;
 * 中心大读数 + 上标单位 + 等宽小标签。
 * 动效用 CSS transition(stroke 不参与,改用整组 opacity 入场),reduced-motion 由全局规则兜底。
 */
export function TickRing({
  value,
  label,
  unit = "%",
  size = 168,
  ticks = 60,
  decimals = 0,
}: {
  value: number | null | undefined;
  label: string;
  unit?: string;
  size?: number;
  ticks?: number;
  decimals?: number;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);
  const pct = Math.min(100, Math.max(0, Number(value ?? 0)));
  const lit = Math.round((pct / 100) * ticks);

  const marks = Array.from({ length: ticks }, (_, i) => {
    const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const inner = major ? 0.37 : 0.4;
    return {
      x1: 0.5 + Math.cos(a) * inner,
      y1: 0.5 + Math.sin(a) * inner,
      x2: 0.5 + Math.cos(a) * (0.48),
      y2: 0.5 + Math.sin(a) * (0.48),
      on: i < lit,
      major,
    };
  });
  const capA = ((lit - 0.5) / ticks) * Math.PI * 2 - Math.PI / 2;
  const cap = lit > 0 ? { x: 0.5 + Math.cos(capA) * 0.53, y: 0.5 + Math.sin(capA) * 0.53 } : null;

  return (
    <div className="tick-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 1 1" width={size} height={size} aria-hidden="true">
        {marks.map((m, i) => (
          <line
            key={i}
            className={`ring-tick${m.major ? " is-major" : ""}${m.on ? " is-on" : ""}`}
            x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
            style={{ transition: `stroke .5s ease ${i * 12}ms` }}
          />
        ))}
        {cap && <circle className="ring-cap" cx={cap.x} cy={cap.y} r={0.022} style={{ opacity: entered ? 1 : 0, transition: "opacity .4s ease .3s" }} />}
      </svg>
      <div className="tick-ring-center">
        <span className="tick-ring-value tnum">
          {value == null ? "—" : pct.toFixed(decimals)}
          <sup>{unit}</sup>
        </span>
        <span className="tick-ring-label">{label}</span>
      </div>
    </div>
  );
}

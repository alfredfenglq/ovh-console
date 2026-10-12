import { PartyPopper } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HardwareLottery } from "@/hooks/use-server-control";

/**
 * 中奖报告的珍珠皮肤呈现:等级标题 + 「订购 vs 实配」双深色铭牌对比。
 * SpecPlate(规格铭牌)是仪器化语汇里"设备读数板"的载体 —— 两张铭牌并排,
 * 实际值列用青柠高亮,升级幅度一目了然。经典皮肤继续用琥珀横幅(原版)。
 */
export function LotteryReportPearl({ lottery }: { lottery: HardwareLottery }) {
  const { t } = useTranslation();
  if (!lottery.checked || !lottery.won) return null;
  const tier = Math.min(lottery.tier || 1, 3);
  const byKind = (k: string) => lottery.items.find((i) => i.kind === k);
  const cpu = byKind("cpu");
  const mem = byKind("memory");
  const disk = byKind("disk");

  const gainText = (item?: { gainPct?: number; mediaUp?: boolean }) => {
    if (!item) return null;
    if (item.gainPct && item.gainPct >= 1) return t("maint.overview.lottery.gainPct", { pct: Math.round(item.gainPct) });
    if (item.mediaUp) return t("maint.overview.lottery.gainMedia");
    return null;
  };

  return (
    <div className="relative border border-amber-400/40 bg-amber-400/5 rounded-2xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <PartyPopper className={`mt-0.5 flex-shrink-0 text-amber-500 ${tier === 3 ? "w-5 h-5" : "w-4 h-4"}`} />
        <div className="leading-relaxed min-w-0">
          <span className="text-[13px] font-semibold text-amber-600 dark:text-amber-300">
            {t(`maint.overview.lottery.title${tier}`)}
          </span>{" "}
          <span className="text-[12px] text-muted-foreground">
            {t("maint.overview.lottery.bannerDesc", {
              items: lottery.items
                .map((i) => {
                  const label = t(`maint.overview.lottery.kind.${i.kind}`);
                  const g = gainText(i);
                  return g ? `${label} ${g}` : label;
                })
                .join(" · "),
            })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 订购侧铭牌 */}
        <dl className="spec-plate">
          <div className="spec-title">{t("maint.overview.lottery.plateOrdered")}</div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.cpu")}</dt>
            <dd>{cpu?.ordered ?? "—"}</dd>
          </div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.memory")}</dt>
            <dd>{mem?.ordered ?? "—"}</dd>
          </div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.disk")}</dt>
            <dd className="pr-2" style={{ wordBreak: "break-all" }}>
              {disk?.ordered ?? "—"}
            </dd>
          </div>
        </dl>

        {/* 实配侧铭牌:中奖项青柠高亮 */}
        <dl className="spec-plate">
          <div className="spec-title">{t("maint.overview.lottery.plateActual")}</div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.cpu")}</dt>
            <dd className={cpu ? "is-lime" : ""}>{cpu?.actual ?? "—"}</dd>
          </div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.memory")}</dt>
            <dd className={mem ? "is-lime" : ""}>
              {mem?.actual ?? "—"}
              {gainText(mem) && <span style={{ color: "var(--plate-soft)", fontWeight: 500 }}> · {gainText(mem)}</span>}
            </dd>
          </div>
          <div className="spec-row">
            <dt>{t("maint.overview.lottery.kind.disk")}</dt>
            <dd className={disk ? "is-lime" : ""} style={{ wordBreak: "break-all" }}>
              {disk?.actual ?? "—"}
              {gainText(disk) && <span style={{ color: "var(--plate-soft)", fontWeight: 500 }}> · {gainText(disk)}</span>}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

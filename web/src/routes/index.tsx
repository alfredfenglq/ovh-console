import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  Server,
  CheckCircle2,
  ChevronRight,
  Plus,
  Clock,
  Link2,
  Bot,
  Bell,
  Info,
  CheckCheck,
  Calendar,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { UpdateButton } from "@/components/common/UpdateButton";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/common/Chip";
import { StatusDot } from "@/components/common/StatusDot";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadFailed, LoadFailedBanner, errorMessage } from "@/components/common/LoadFailed";
import { Skeleton } from "@/components/common/Skeleton";
import { MetricRing } from "@/components/common/MetricRing";
import { useIsNarrow } from "@/hooks/use-narrow";
import { useStats } from "@/hooks/use-stats";
import { DashboardPearl } from "@/components/pearl/DashboardPearl";
import { useQueueList, type QueueItem } from "@/hooks/use-queue";
import { useSystemMetrics, useAppVersion, useUpdateCheck } from "@/hooks/use-system-metrics";

/** 仪表盘:3 KPI + 活跃队列 / 系统状态 + 系统监控(CPU / 内存 / 磁盘 / 网络) */
export const Route = createFileRoute("/")({
  component: DashboardPearl,
});

/** 字节短格式:1.5 GB / 11.4 GB 这种 */
function formatBytesShort(n: number): string {
  if (!n || n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

/* ---------- 小组件 ---------- */

/**
 * KPI 卡片。
 *
 * value 为 undefined = 这个数我们没拿到,一律显示「—」。
 * 以前写的是 `value ?? 0`,请求一失败仪表盘就变成"活跃队列 0 / 服务器总数 0 /
 * 下单成功 0" —— 三条看起来很确定的业务结论,全是假的。
 * failed 只负责在卡片上补一句"读取失败",让用户知道该重试而不是该重新建单。
 */
function KpiCard({
  label,
  value,
  extra,
  icon: Icon,
  linkTo,
  linkText,
  loading,
  failed,
}: {
  label: string;
  value: number | undefined;
  extra?: React.ReactNode;
  icon: LucideIcon;
  linkTo: string;
  linkText: string;
  loading?: boolean;
  /** 请求失败(区别于"还在加载"和"后端真的返回 0") */
  failed?: boolean;
}) {
  const { t } = useTranslation();
  const valueUnknown = value === undefined;
  return (
    <Card>
      {/* 手机端三张卡并排,每张只有 ~120px 宽 —— 圆形图标、"查看队列 >" 这类
          装饰在这个宽度里会把数字挤到换行,所以它们只在 sm+ 出现。
          手机上留下的是这张卡真正要说的两件事:这是什么数、它是多少。 */}
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between sm:mb-4">
          <span className="text-[11px] sm:text-[13px] text-muted-foreground font-medium leading-tight">
            {label}
          </span>
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-secondary items-center justify-center">
            <Icon className="w-5 h-5 text-foreground" strokeWidth={1.75} />
          </div>
        </div>
        <div className="flex items-baseline flex-wrap gap-x-1.5 mt-1 sm:mt-0">
          {loading ? (
            <Skeleton className="w-12 sm:w-16 h-8 sm:h-10 rounded-md" />
          ) : (
            <span
              className={`text-[24px] sm:text-[32px] font-bold leading-none ${valueUnknown ? "text-muted-foreground" : ""}`}
              title={valueUnknown ? t("dashboard.valueUnknown") : undefined}
            >
              {valueUnknown ? "—" : value}
            </span>
          )}
          {extra}
        </div>
        {failed && (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-destructive">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            {t("dashboard.readFailed")}
          </p>
        )}
        <Link to={linkTo} className="hidden sm:inline-flex mt-3 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {linkText}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function QueueStatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "running")
    return (
      <Chip tone="success">
        <StatusDot tone="success" pulse size="xs" />
        {t("dashboard.running")}
      </Chip>
    );
  if (status === "pending")
    return (
      <Chip tone="warning">
        <StatusDot tone="warning" size="xs" />
        {t("dashboard.pending")}
      </Chip>
    );
  return (
    <Chip tone="default">
      <StatusDot tone="muted" size="xs" />
      {t("dashboard.paused")}
    </Chip>
  );
}

/**
 * 系统状态行。
 *
 * ok 是个 boolean,天然只有"是 / 否"两格 —— 而数据没读到时正确答案是第三格"不知道"。
 * 挤进"否"就会把 offText 说出口:"暂无任务"、"待启用",两句都是在替后端下结论。
 * unknown 就是那第三格:灰点 + 一句"读取失败 / 读取中…",不承诺任何业务事实。
 */
function SystemRow({
  icon,
  label,
  ok,
  onText,
  offText,
  neutralOff,
  warnOff,
  unknown,
  unknownText,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  onText: string;
  offText: string;
  neutralOff?: boolean;
  warnOff?: boolean;
  /** 数据没拿到(加载中或请求失败):既不是 on 也不是 off */
  unknown?: boolean;
  unknownText?: string;
}) {
  const { t } = useTranslation();
  const dotTone = unknown
    ? "muted"
    : ok
      ? "success"
      : warnOff
        ? "warning"
        : neutralOff
          ? "muted"
          : "danger";
  const text = unknown ? (unknownText ?? t("dashboard.readFailed")) : ok ? onText : offText;
  return (
    <div className="flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors">
      <div className="inline-flex items-center gap-2 text-[13px]">
        <span className="text-muted-foreground">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="inline-flex items-center gap-1.5">
        <StatusDot tone={dotTone as any} pulse={!unknown && ok} size="xs" />
        <span className={`text-xs ${!unknown && ok ? "font-medium" : "text-muted-foreground"}`}>{text}</span>
      </div>
    </div>
  );
}

/**
 * 未知态的监控环:只画灰轨道,中心是「—」。
 *
 * 几何参数照抄 MetricRing,保证跟旁边有数据的环大小、位置、缺口方向完全一致,
 * 切换时不跳版。存在的唯一理由是 MetricRing 的 percent 是必填 number ——
 * 没有一个 number 能表达"不知道",0 只会被读成"空闲"。
 */
function MetricRingUnknown({
  label,
  hint,
  title,
  failed,
  size,
}: {
  label: string;
  hint: string;
  title?: string;
  failed?: boolean;
  size?: number;
}) {
  // 尺寸口径必须跟 MetricRing 完全一致,否则同一行里"有数据"和"没读到"
  // 两种格子会一大一小,刷新时来回跳版
  const narrow = useIsNarrow();
  size = size ?? (narrow ? 68 : 96);
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const visibleArc = 0.75 * c;

  return (
    <div
      className="flex flex-col-reverse sm:flex-row items-center sm:justify-between gap-2 sm:gap-4 px-2.5 py-3 sm:px-5 sm:py-4 h-full"
      title={title}
    >
      <div className="min-w-0 text-center sm:text-left">
        <div className="text-[11px] sm:text-[12px] text-muted-foreground truncate">{label}</div>
        <div
          className={`mt-0.5 sm:mt-1 text-[11px] sm:text-[18px] font-semibold tabular-nums inline-flex items-center gap-1 ${
            failed ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {failed && <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />}
          <span className="truncate">{hint}</span>
        </div>
      </div>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(135deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-border"
            strokeDasharray={`${visibleArc} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-semibold text-muted-foreground">—</span>
        </div>
      </div>
    </div>
  );
}


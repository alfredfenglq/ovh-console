import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Bell, Bot, Cpu, HardDrive, Link2, MemoryStick, Server, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmtDateTime } from "@/i18n/format";
import { useStats } from "@/hooks/use-stats";
import { useQueueList } from "@/hooks/use-queue";
import { useSystemMetrics, useAppVersion, useUpdateCheck } from "@/hooks/use-system-metrics";
import { UpdateButton } from "@/components/common/UpdateButton";
import { TickRing } from "@/components/pearl/TickRing";

/**
 * 珍珠皮肤的工作台(scaffold-master 版式):
 * 页头(日期 + 问候 + 描述) → Bento 网格:
 *   hero(8 列)  活跃队列大读数 + 三项读数组 + 操作按钮
 *   side(4 列)  系统状态三行(API 连接 / 自动抢购 / 服务器监控)+ 版本
 *   wide(8 列)  宿主机资源三读数(CPU/内存/磁盘)
 *   narrow(4 列) 最近队列条目
 * 与经典皮肤共用同一批数据 hooks(同 query key 同 queryFn,缓存互通)。
 */

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return "dashboard.greetNight";
  if (h < 12) return "dashboard.greetMorning";
  if (h < 18) return "dashboard.greetAfternoon";
  return "dashboard.greetEvening";
}

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}G`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)}M`;
  return `${(n / 1024).toFixed(0)}K`;
}

function SideRow({
  icon,
  label,
  on,
  onText,
  offText,
  unknown,
}: {
  icon: React.ReactNode;
  label: string;
  on: boolean;
  onText: string;
  offText: string;
  unknown?: boolean;
}) {
  return (
    <div className="activity">
      <span className="side-ico m-groove">{icon}</span>
      <span className="activity-main">{label}</span>
      {unknown ? (
        <span className="delta-pill" style={{ background: "var(--hover-bg)", color: "var(--ink-soft)" }}>…</span>
      ) : on ? (
        <span className="delta-pill is-up">{onText}</span>
      ) : (
        <span className="delta-pill is-down">{offText}</span>
      )}
    </div>
  );
}

export function DashboardPearl() {
  const { t } = useTranslation();
  const stats = useStats();
  const queue = useQueueList();
  const sys = useSystemMetrics();
  const version = useAppVersion();
  // UpdateButton 在 check 为空时直接 return null —— 必须把检查结果传进去,
  // 否则按钮永远不渲染(经典版当年就为这个留过注释,移植时漏了)
  const update = useUpdateCheck();

  const s = stats.data;
  const unknown = stats.isError || stats.isPending;
  const recentQueue = (queue.data || []).slice(0, 5);

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <span className="page-date">{fmtDateTime(new Date().toISOString())}</span>
          <h1 className="page-title">{t(greetingKey())}</h1>
          <p className="page-desc">{t("dashboard.subtitle")}</p>
        </div>

      </header>

      <div className="bento-grid">
        {/* 主卡:活跃队列 */}
        <section className="bento bento-hero">
          <div className="hero-head">
            <span className="eyebrow">{t("dashboard.kpi.activeQueues")}</span>
            <span className="bento-meta">{stats.isPending ? "…" : s ? `SNIPER / ${s.totalServers ?? 0} SRV` : "—"}</span>
          </div>
          <div className="hero-body relative">
            {/* 3D 火箭插图(3dicons.co,CC0):点睛 hero 右侧留白;仅 md+ 显示,
                浮动动画只动 transform,偏好减少动效时静止 */}
            <img
              src="/illustrations/rocket-3d.png"
              alt=""
              aria-hidden="true"
              className="hero-illo hidden md:block"
              draggable={false}
            />
            <div className="hero-figure">
              <div className="metric metric-xl">
                <span className="metric-figure">
                  {stats.isPending ? "—" : s?.activeQueues ?? 0}
                </span>
              </div>
              <div className="hero-delta">
                <span className="faint">{t("dashboard.heroDeltaHint")}</span>
                <span className="delta-pill is-new">{t("dashboard.kpi.wonCount", { n: s?.purchaseSuccess ?? 0 })}</span>
              </div>
              <dl className="hero-readouts">
                <div>
                  <dt>{t("dashboard.kpi.totalServers")}</dt>
                  <dd className="tnum">{s?.totalServers ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.kpi.available")}</dt>
                  <dd className="tnum">{s?.availableServers ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.kpi.purchaseFailed")}</dt>
                  <dd className="tnum">{s?.purchaseFailed ?? "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="hero-actions">
              <Link to="/queue" className="pill-btn is-dark">
                {t("dashboard.kpi.viewQueue")} <ArrowRight size={14} />
              </Link>
              <Link to="/servers" className="pill-btn">
                {t("dashboard.kpi.viewServers")}
              </Link>
            </div>
          </div>
        </section>

        {/* 侧块:系统状态 + 版本 */}
        <section className="bento bento-side">
          <div className="side-top">
            <span className="side-label">{t("dashboard.systemStatus")}</span>
            <span className="side-ico m-groove">
              <Activity size={16} />
            </span>
          </div>
          <div className="activity-list">
            <SideRow
              icon={<Link2 size={15} />}
              label={t("dashboard.apiConn")}
              on={!!s && !stats.isError}
              onText={t("dashboard.connected")}
              offText={t("dashboard.disconnected")}
              unknown={stats.isPending}
            />
            <SideRow
              icon={<Bot size={15} />}
              label={t("dashboard.autoSnipe")}
              on={(s?.activeQueues || 0) > 0}
              onText={t("dashboard.running")}
              offText={t("dashboard.noTasks")}
              unknown={unknown}
            />
            <SideRow
              icon={<Bell size={15} />}
              label={t("dashboard.serverMonitor")}
              on={!!s?.monitorRunning}
              onText={t("dashboard.running")}
              offText={t("dashboard.standby")}
              unknown={unknown}
            />
          </div>
          <div className="side-foot" style={{ flexWrap: "wrap", rowGap: 6 }}>
            <span className="faint">{t("dashboard.systemVersion")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 4 }}>
              {/* 更新按钮跟随版本号:没新版本时组件返回 null,只显示版本。
                  有更新时这一串较长,放不下就整体换行左对齐,不向左挤压标签 */}
              <UpdateButton check={update.data} />
              <span className="mono-time">v{version.data || "—"}</span>
            </span>
          </div>
        </section>

        {/* 宽块:宿主机资源三读数 */}
        <section className="bento bento-wide">
          <div className="bento-head">
            <span className="eyebrow">{t("dashboard.hostMetrics")}</span>
            <span className="bento-meta">
              {sys.data ? `${sys.data.host.hostname} · ${sys.data.host.platform}` : "…"}
            </span>
          </div>
          <div className="ring-wrap">
            <TickRing value={sys.data?.cpu.percent} label="CPU" />
            <TickRing value={sys.data?.memory.percent} label="MEM" />
            <TickRing value={sys.data?.disk.percent} label="DISK" />
          </div>
          {(sys.data?.memory || sys.data?.disk) && (
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
              <span className="readout-sub">
                {t("dashboard.memory")} {t("dashboard.usedFree", { used: fmtBytes(sys.data.memory.usedBytes), free: fmtBytes(sys.data.memory.totalBytes - sys.data.memory.usedBytes) })}
              </span>
              <span className="readout-sub">
                {t("dashboard.disk")} {t("dashboard.usedFree", { used: fmtBytes(sys.data.disk.usedBytes), free: fmtBytes(sys.data.disk.totalBytes - sys.data.disk.usedBytes) })} · {sys.data.disk.path}
              </span>
              {sys.data ? <span className="readout-sub">{t("dashboard.cores", { n: sys.data.cpu.cores })}</span> : null}
            </div>
          )}
        </section>

        {/* 窄块:最近队列 */}
        <section className="bento bento-narrow">
          <div className="bento-head">
            <span className="eyebrow">{t("dashboard.recentQueue")}</span>
            <Link to="/queue" className="quick-go" style={{ fontSize: 12 }}>
              {t("dashboard.viewAll")} <ArrowRight size={12} style={{ display: "inline", verticalAlign: "-2px" }} />
            </Link>
          </div>
          {recentQueue.length === 0 ? (
            <div className="empty" style={{ padding: "14px 4px" }}>
              <span className="empty-ico">
                <Server size={16} />
              </span>
              <span className="empty-title">{t("dashboard.queueEmpty")}</span>
            </div>
          ) : (
            <div className="activity-list">
              {recentQueue.map((q) => (
                <div className="activity" key={q.id}>
                  <span className="side-ico m-groove">
                    <ShieldCheck size={14} />
                  </span>
                  <span className="activity-main">
                    <span className="cell-title" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {q.planCode}
                    </span>
                    <span className="cell-sub">{q.datacenter}</span>
                  </span>
                  <span className="delta-pill">{q.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

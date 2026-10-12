import type { LucideIcon } from "lucide-react";
import { useSkin } from "@/lib/skin";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * 统一的页面顶部 header：左侧 icon 方块 + 标题 + 描述，右侧操作按钮。
 *
 * 按皮肤出两套结构：
 * - classic：原版(侧栏图标方块 + 28px 标题;手机端瘦一圈省首屏 —— 见原注释)
 * - pearl：scaffold-master 的 page-head 节奏(28px 大标题 -.03em 字距 +
 *   描述 + page-actions),页头即仪器面板的起始读数,不再画图标方块
 */
export function PageHeader({ icon: Icon, title, description, action }: PageHeaderProps) {
  const skin = useSkin();
  if (skin === "pearl") {
    return (
      <header className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-desc">{description}</p>}
        </div>
        {action && <div className="page-actions">{action}</div>}
      </header>
    );
  }
  return (
    <div className="flex items-start justify-between gap-2 sm:gap-4">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* 图标方块只在 sm+ 出现 */}
        <div className="hidden sm:flex w-11 h-11 rounded-xl bg-secondary items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-foreground" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          {/* 标题在手机端由顶栏承担,这里再写一遍就是同一句话占两行。
              sm+ 顶栏是完整面包屑,标题才回到页面里。 */}
          <h1 className="hidden sm:block text-[28px] font-bold text-foreground leading-tight tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[11px] sm:text-[14px] text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {/* 按钮容器不能用 flex-shrink-0:它让容器保持 max-content 宽度,
          于是 flex-wrap 永远不触发 —— VPS 补货页四个按钮在手机上
          422px 塞进 366px,把整页撑出横向滚动条。
          min-w-0 + 允许收缩,按钮才会真的换行。 */}
      {action && (
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end min-w-0">
          {action}
        </div>
      )}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * 统一的页面顶部 header（珍珠玻璃版式 page-head）：
 * 28px 大标题（-.03em 字距）+ 描述 + 右侧操作区。
 * icon prop 仅为兼容全站调用保留，不再参与渲染。
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
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

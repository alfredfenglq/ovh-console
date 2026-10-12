import type { ReactNode } from "react";

/**
 * 珍珠皮肤列表页结构件(1:1 对照 scaffold-master 的 ListPage 版式,
 * 样式全部来自已移植的 pearl/components.css,本文件只提供结构):
 *
 *   PearlSearchForm   查询区(.search-form):字段 + search-actions
 *   PearlPanel        面板外壳(.panel,配 app-card 材质)
 *   PearlPanelHead    面板头(.panel-head):眉标标题 + panel-meta + panel-tools
 *   PearlCellMain     行单元(.cell-main):cell-title + cell-sub
 *
 * 页面重建用法:经典分支保持原样,pearl 分支换这套结构,逻辑/hooks 全部共用。
 */

export function PearlSearchForm({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`search-form m-surface ${className || ""}`}>{children}</div>;
}

export function PearlPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`app-card panel ${className || ""}`}>{children}</section>;
}

export function PearlPanelHead({
  eyebrow,
  meta,
  tools,
}: {
  eyebrow: ReactNode;
  meta?: ReactNode;
  tools?: ReactNode;
}) {
  return (
    <header className="panel-head">
      <div className="flex items-center gap-3 min-w-0">
        <span className="eyebrow">{eyebrow}</span>
        {meta ? <span className="panel-meta">{meta}</span> : null}
      </div>
      {tools ? <div className="panel-tools">{tools}</div> : null}
    </header>
  );
}

export function PearlCellMain({
  title,
  sub,
  leading,
}: {
  title: ReactNode;
  sub?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <div className="cell-main">
      {leading}
      <div className="min-w-0">
        <div className="cell-title">{title}</div>
        {sub ? <div className="cell-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

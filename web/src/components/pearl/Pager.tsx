import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * 分页条(scaffold-master pager 的 React 移植):
 * 「第 x–y 条 / 共 n 条」+ 上一页/页码/下一页。
 * 受控组件:page 从 1 起;pageSize 由调用方定;total 变化时自动夹回末页。
 */
export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(page, pages);
  const from = total === 0 ? 0 : (safe - 1) * pageSize + 1;
  const to = Math.min(total, safe * pageSize);

  const window: number[] = [];
  for (let p = Math.max(1, safe - 2); p <= Math.min(pages, safe + 2); p++) window.push(p);

  const btn = (active: boolean) =>
    `pg-btn${active ? " is-active" : ""}`;

  return (
    <div className="pager" style={{ padding: "12px 20px" }}>
      <span className="pager-info">
        <b>{from}–{to}</b> / {total}
      </span>
      <div className="pager-ctrl">
        <button type="button" className="pg-btn" disabled={safe <= 1} onClick={() => onChange(safe - 1)} aria-label={t("common.prevPage")}>
          <ChevronLeft size={14} />
        </button>
        {window[0] > 1 && <span className="pager-info">…</span>}
        {window.map((p) => (
          <button key={p} type="button" className={btn(p === safe)} onClick={() => onChange(p)}>
            {p}
          </button>
        ))}
        {window[window.length - 1] < pages && <span className="pager-info">…</span>}
        <button type="button" className="pg-btn" disabled={safe >= pages} onClick={() => onChange(safe + 1)} aria-label={t("common.nextPage")}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/** usePaged:page 状态 + total 变化时夹回末页(日志流式追加场景) */
export function usePaged(total: number, pageSize: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (page > pages) {
    setPage(pages);
    return { page: pages, setPage };
  }
  return { page, setPage };
}

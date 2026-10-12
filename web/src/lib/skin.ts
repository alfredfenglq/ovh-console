import { useSyncExternalStore } from "react";
import pearlCssUrl from "@/styles/pearl-bundle.css?url";

/**
 * 皮肤(设计主题):classic = 原版 UI,pearl = 珍珠玻璃体系(scaffold-master)。
 *
 * 两套并存、互不影响的关键:
 * - 珍珠样式打包成独立 CSS 资产,只在切到 pearl 时以 <link> 挂到 <head>,
 *   切回 classic 立即摘除 —— 经典皮肤下珍珠规则一行都不在文档里
 * - tailwind 语义 token 的珍珠取值写在 pearl-bundle.css 里,作用域
 *   [data-skin="pearl"],经典皮肤的 globals.css 取值不动
 * - 外壳按皮肤二选一渲染:classic = 原 Sidebar/TopBar/BottomTabs,
 *   pearl = AppShell(舞台框 + 导航轨 + 凝结顶栏)
 */
export type Skin = "classic" | "pearl";

const KEY = "ovh_ui_skin";
const LINK_ID = "pearl-skin-stylesheet";

function readInitial(): Skin {
  try {
    const v = localStorage.getItem(KEY);
    return v === "pearl" ? "pearl" : "classic";
  } catch {
    return "classic";
  }
}

let current: Skin = readInitial();
const listeners = new Set<() => void>();

function apply(skin: Skin) {
  const html = document.documentElement;
  if (skin === "pearl") {
    html.dataset.skin = "pearl";
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      link.href = pearlCssUrl;
      document.head.appendChild(link);
    }
  } else {
    delete html.dataset.skin;
    document.getElementById(LINK_ID)?.remove();
  }
  // theme-color meta 跟着皮肤的画布走(theme.ts 只认明暗两态的默认值)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const dark = html.classList.contains("dark");
    meta.setAttribute(
      "content",
      skin === "pearl" ? (dark ? "#121517" : "#f6f8f7") : dark ? "#0f0f0f" : "#ffffff",
    );
  }
}

// 模块加载即应用一次(在 index.html 静态渲染之后、React 挂载之前调用最理想,
// main.tsx 顶部已 import 本模块并立即 apply)
apply(current);

export function setSkin(skin: Skin) {
  if (skin === current) return;
  current = skin;
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    /* 隐私模式等存不进就算了,本次会话内仍然生效 */
  }
  apply(skin);
  listeners.forEach((l) => l());
}

export function toggleSkin() {
  setSkin(current === "pearl" ? "classic" : "pearl");
}

export function useSkin(): Skin {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
}

/**
 * 皮肤层。2026-10-12 起经典皮肤已删除,全站只有珍珠玻璃一种 —— 本模块保留
 * 是为了让 11 处 `useSkin()` 调用点和三千行 `[data-skin="pearl"]` 作用域 CSS
 * 原样工作:html 永远带 data-skin="pearl",useSkin 恒返回 "pearl"。
 */
export type Skin = "pearl";

document.documentElement.dataset.skin = "pearl";

export function useSkin(): Skin {
  return "pearl";
}

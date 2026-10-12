import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomTabs } from "@/components/layout/BottomTabs";

/** 经典皮肤的外壳:与重构前完全一致,一行未动 */
export function ClassicShell() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        {/* 底部内边距要同时让出标签栏(52px)和 iPhone 的 home 指示条,
            否则页面最后一行内容会被压在标签栏底下读不到 */}
        <main // 只设 pt,不用 py —— py-3 会生成 padding-bottom,跟 .pb-tabbar 同为单类选择器,
        // 谁生效取决于 Tailwind 的输出顺序,结果是底部内容被标签栏盖住。
        className="flex-1 px-3 sm:px-6 lg:px-10 pt-3 sm:pt-8 overflow-y-auto pb-tabbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}

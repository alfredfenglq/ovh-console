import { createRootRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ClassicShell } from "@/components/layout/ClassicShell";
import { CommandPalette } from "@/components/common/CommandPalette";
import { AuthGate } from "@/components/common/AuthGate";
import { OvhCredsGate } from "@/components/common/OvhCredsGate";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSkin } from "@/lib/skin";

/**
 * 根路由:两层 gate(外到内)通过后才见业务页面 ——
 *   1. AuthGate     验证后端访问密码(X-API-Key)
 *   2. OvhCredsGate 强制 OVH API 凭据就位
 *
 * 外壳按皮肤二选一(见 lib/skin.ts):
 *   classic = 原版(侧栏 + 顶栏 + 移动端底部标签) —— 默认,结构未动
 *   pearl   = 珍珠玻璃(舞台设备框 + 导航轨滑块 + 凝结顶栏 + 移动抽屉)
 * 页面组件两套皮肤共用;颜色 token 在 pearl-bundle.css 按 [data-skin=pearl] 覆盖。
 */
export const Route = createRootRoute({
  component: () => {
    const skin = useSkin();
    return (
      <TooltipProvider delayDuration={300}>
        <AuthGate>
          <OvhCredsGate>
            {skin === "pearl" ? <AppShell /> : <ClassicShell />}
            <CommandPalette />
          </OvhCredsGate>
        </AuthGate>
      </TooltipProvider>
    );
  },
});

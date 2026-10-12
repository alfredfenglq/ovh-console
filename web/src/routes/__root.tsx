import { createRootRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/common/CommandPalette";
import { AuthGate } from "@/components/common/AuthGate";
import { OvhCredsGate } from "@/components/common/OvhCredsGate";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * 根路由:两层 gate(外到内)通过后才见业务页面 ——
 *   1. AuthGate     验证后端访问密码(X-API-Key)
 *   2. OvhCredsGate 强制 OVH API 凭据就位
 * 外壳为珍珠玻璃体系(经典皮肤已于 2026-10-12 删除)。
 */
export const Route = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={300}>
      <AuthGate>
        <OvhCredsGate>
          <AppShell />
          <CommandPalette />
        </OvhCredsGate>
      </AuthGate>
    </TooltipProvider>
  ),
});

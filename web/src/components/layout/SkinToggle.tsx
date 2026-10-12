import { Gem } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSkin, toggleSkin } from "@/lib/skin";
import { cn } from "@/lib/utils";

/**
 * 皮肤切换(经典 ↔ 珍珠玻璃)。两个外壳的顶栏都放它,
 * 让用户在任何一套皮肤下都能切回另一套 —— 主题入口不能只在其中一个主题里。
 */
export function SkinToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const skin = useSkin();
  const pearl = skin === "pearl";
  return (
    <button
      type="button"
      onClick={toggleSkin}
      aria-label={pearl ? t("shell.skinToClassic") : t("shell.skinToPearl")}
      title={pearl ? t("shell.skinToClassic") : t("shell.skinToPearl")}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Gem className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}

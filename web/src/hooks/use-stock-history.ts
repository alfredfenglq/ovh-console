import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useActiveAccount } from "@/hooks/use-active-account";

/**
 * 库存变化事件聚合:fan-out 拉全部订阅的 history(与账单详情同一模式,
 * 后端只有按订阅的端点),客户端合成 事件流 供热力格(7×24)与泳道(当天按机房)消费。
 * kind: "server" | "vps" 决定端点前缀。
 */
export interface StockEvent {
  ts: string;
  datacenter: string;
  status: string;
  changeType: string;
  planCode: string;
}

export function useStockEvents(
  subs: { planCode: string }[] | undefined,
  kind: "server" | "vps",
) {
  const [accountId] = useActiveAccount();
  const prefix = kind === "server" ? "/monitor" : "/vps-monitor";
  return useQuery({
    // 订阅集合变化(增删)必须换 key;accountId 防跨账户串缓存
    queryKey: ["stock-events", kind, accountId, (subs || []).map((s) => s.planCode).join(",")],
    enabled: !!subs,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<StockEvent[]> => {
      type H = { timestamp: string; datacenter: string; status: string; changeType: string };
      const out: StockEvent[] = [];
      const queue = subs!.map((s) => s.planCode);
      const CONC = 6;
      let idx = 0;
      async function worker() {
        while (idx < queue.length) {
          const pc = queue[idx++];
          try {
            const hs = (await api.get<H[]>(`${prefix}/subscriptions/${encodeURIComponent(pc)}/history`)).data || [];
            for (const h of hs) out.push({ ts: h.timestamp, datacenter: h.datacenter, status: h.status, changeType: h.changeType, planCode: pc });
          } catch {
            /* 单个订阅失败不拖垮聚合 */
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, queue.length) }, worker));
      out.sort((a, b) => a.ts.localeCompare(b.ts));
      return out;
    },
  });
}

import { useState } from "react";
import { Zap, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { useSplaList, missingSplaTypes, hasActiveSpla, SPLA_ALL_TYPES } from "@/hooks/use-server-control";
import { toast } from "sonner";

/**
 * 登记 SPLA 许可证 + 一键解锁 Windows 安装。
 *
 * OVH 把 Windows 模板锁在「这台机器名下要有一条 type=os 的 SPLA 记录」后面。
 * 没有这条记录时，重装的模板列表里根本不会出现 Windows。
 * `POST /dedicated/server/{sn}/spla` 就是登记那条记录，
 * `serialNumber` 是必填的「License serial number」。
 *
 * 上面那个一键按钮提交的是 WINDOWS_GVLK —— 微软**公开发布**的 Windows 10 Pro
 * KMS 客户端安装密钥(GVLK)，见 learn.microsoft.com 的 KMS client activation keys。
 * 它是公开值，不是谁的授权号：作用只是让 OVH 那道检查通过，
 * 并不代表你真的持有 Windows Server 授权(真激活还需要能连上 KMS 服务器)。
 * 按钮上的说明把这一点写明了，选择权交给用户。
 *
 * 下面的手填表单保留给「我有自己的 SPLA 授权号」的人，
 * `type` 的三个取值来自 schema 的 SplaTypeEnum —— SQL Server 那两种也在里面。
 */

/**
 * 微软公开的 Windows 10 Pro KMS 客户端安装密钥(GVLK)。
 * https://learn.microsoft.com/en-us/windows-server/get-started/kms-client-activation-keys
 * 这是一个公开常量，不是任何人的私有授权号。
 */
const WINDOWS_GVLK = "W269N-WFGWX-YVC9B-4J6C9-T83GX";
const SPLA_TYPES = [
  { value: "os", label: "操作系统 (Windows Server)" },
  { value: "sqlstd", label: "SQL Server 标准版" },
  { value: "sqlweb", label: "SQL Server 网页版" },
];

export function SplaDialog({
  serviceName,
  open,
  onOpenChange,
}: {
  serviceName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [type, setType] = useState("os");
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const qc = useQueryClient();
  const spla = useSplaList(serviceName, open);
  const missing = missingSplaTypes(spla.data);
  const unlocked = missing.length === 0;
  // 详情部分拉失败时不能断言"还没解锁" —— 宁可让按钮可点(重复提交 OVH 会自己拒),
  // 也不要因为一次限流就把已解锁的机器显示成未解锁
  const unknown = spla.isPending || spla.isError || spla.data?.partial === true;

  /**
   * 一键登记三种授权(os / sqlstd / sqlweb),全用同一个 GVLK。
   *
   * 只补缺的那几类:已经有有效记录的再提交一次没有意义,
   * 只会多一条重复记录或换来 OVH 的报错。
   * 逐条发而不是并发:OVH 对同一台机器的写操作有并发限制,
   * 而且失败时要能说清楚是哪一类没成。
   */
  const unlockAll = async () => {
    setUnlocking(true);
    const todo = unknown ? [...SPLA_ALL_TYPES] : missing;
    const done: string[] = [];
    const failed: string[] = [];
    let firstError = "";
    for (const t of todo) {
      try {
        await api.post(`/server-control/${serviceName}/spla`, {
          type: t,
          serialNumber: WINDOWS_GVLK,
        });
        done.push(t);
      } catch (e: any) {
        failed.push(t);
        if (!firstError) firstError = e?.response?.data?.error || e?.message || "提交失败";
      }
    }
    qc.invalidateQueries({ queryKey: qk.serverControl.spla(serviceName) });
    setUnlocking(false);
    if (done.length > 0) {
      toast.success(
        `已登记 ${done.length} 项授权(${done.join(" / ")})。刷新后重装列表里会出现 Windows 模板`,
        { duration: 7000 }
      );
    }
    if (failed.length > 0) {
      // 逐类报,不要笼统说"失败" —— 有的类型这台机器本来就不支持
      toast.error(`${failed.join(" / ")} 没能登记:${firstError}`, { duration: 9000 });
    }
  };

  const submit = async () => {
    const sn = serial.trim();
    if (!sn) {
      toast.error("请填写你的 SPLA 许可证序列号");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/server-control/${serviceName}/spla`, { type, serialNumber: sn });
      toast.success("许可证已提交");
      setSerial("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || e?.message || "提交失败",
        { duration: 8000 }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            登记 SPLA 许可证
          </DialogTitle>
          <DialogDescription>{serviceName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* 一键解锁。已经有 type=os 的有效记录就置灰 —— 再点一次没有任何意义,
              只会多一条重复记录或换来 OVH 的报错。 */}
          <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold">解锁 Windows 安装</p>
              {unlocked && !unknown && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  已解锁
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              OVH 把 Windows 模板锁在「这台机器名下有授权记录」后面。点一下会把
              <b>操作系统 / SQL 标准版 / SQL 网页版</b>三类一次登记上，
              用的是微软<b>公开发布</b>的 Windows KMS 客户端密钥 ——
              它只让 OVH 的检查通过，<b>不代表你持有 Windows Server 授权</b>，
              系统装好后仍需能连上 KMS 服务器才会真正激活。有自己的授权号请用下面的表单填。
            </p>
            {!unknown && !unlocked && missing.length < SPLA_ALL_TYPES.length && (
              <p className="text-[11px] text-muted-foreground">
                已登记：{SPLA_ALL_TYPES.filter((t) => hasActiveSpla(spla.data, t)).join(" / ")}
                ；这次会补上 {missing.join(" / ")}
              </p>
            )}
            <Button
              className="w-full"
              variant={unlocked && !unknown ? "outline" : "default"}
              disabled={unlocking || busy || (unlocked && !unknown)}
              onClick={unlockAll}
            >
              {unlocking && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {spla.isPending
                ? "检查中…"
                : unlocked && !unknown
                  ? "已解锁，无需重复登记"
                  : missing.length < SPLA_ALL_TYPES.length && !unknown
                    ? `补登记 ${missing.length} 项授权`
                    : "一键解锁 Windows 安装"}
            </Button>
            {spla.isError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                没读到这台机器已有的授权记录，无法判断是否已解锁 —— 按钮仍可点，
                如果之前登记过，OVH 会直接拒绝，不会重复计费。
              </p>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <label className="text-[12px] font-semibold block mb-1.5">授权类型</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPLA_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[12px] font-semibold block mb-1.5">许可证序列号</label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              autoFocus
            />
          </div>

          <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-2.5 flex gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              填你自己购买的 SPLA 授权序列号。这一步是把授权登记到 OVH 名下，
              不是申请或生成授权 —— 填别人的或网上找的密钥会被 OVH 拒绝。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "提交中…" : "提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

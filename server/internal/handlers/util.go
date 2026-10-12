package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"sync"

	"github.com/gin-gonic/gin"
	ovhsdk "github.com/ovh/go-ovh/ovh"

	"github.com/ovh-buy/server/internal/app"
	"github.com/ovh-buy/server/internal/ovh"
	"github.com/ovh-buy/server/internal/types"
)

// ovhClientFor 从请求 ?account=xxx 取账户 ID 拿对应 OVH client;
// 空时(没传 ?account)走默认账户;凭据缺失返回 error,调用方按原 Client() 错误流程处理。
// 大部分 handler 都是 `state.OVH.Client()` 模式,这个 helper 是 1:1 替换,
// 把单账户改成多账户路由,语义最小化变化。
func ovhClientFor(state *app.State, c *gin.Context) (*ovhsdk.Client, error) {
	return state.OVH.ClientFor(c.Query("account"))
}

// ovhAccountFor 从请求 ?account=xxx 取账户实体(给需要原始凭据/endpoint 的 raw HTTP 调用用)。
// 空 → 默认账户;不存在 → ok=false。
func ovhAccountFor(state *app.State, c *gin.Context) (types.OVHAccount, bool) {
	return state.FindAccount(c.Query("account"))
}

// knownEndpoints go-ovh 支持的 endpoint 名 → REST API base URL。
// 账户的 endpoint 是用户可填的自由字符串,不在这张表里的值一律视为非法 ——
// 以前的 default 分支会把 US/CA 账户的手写 HTTP 请求悄悄打到 eu.api.ovh.com,
// 拿回来的是"另一个大区的空数据",比直接报错更难排查。
var knownEndpoints = map[string]string{
	"ovh-eu":        "https://eu.api.ovh.com",
	"ovh-us":        "https://api.us.ovhcloud.com",
	"ovh-ca":        "https://ca.api.ovh.com",
	"kimsufi-eu":    "https://eu.api.kimsufi.com",
	"kimsufi-ca":    "https://ca.api.kimsufi.com",
	"soyoustart-eu": "https://eu.api.soyoustart.com",
	"soyoustart-ca": "https://ca.api.soyoustart.com",
}

// IsKnownEndpoint 账户创建/更新时校验 endpoint 合法性用
func IsKnownEndpoint(endpoint string) bool {
	_, ok := knownEndpoints[endpoint]
	return ok
}

// ovhAPIBaseURL 把 endpoint 映射成 OVH REST API base URL。
// 未知 endpoint 返回 ok=false,调用方必须报错而不是猜一个大区。
func ovhAPIBaseURLChecked(endpoint string) (string, bool) {
	u, ok := knownEndpoints[endpoint]
	return u, ok
}

// ovhAPIBaseURL 兼容旧调用点:未知 endpoint 仍回落 EU,但会被 ovhAPIBaseURLChecked
// 的调用方拦在前面。新代码请用 ovhAPIBaseURLChecked。
func ovhAPIBaseURL(endpoint string) string {
	if u, ok := knownEndpoints[endpoint]; ok {
		return u
	}
	return "https://eu.api.ovh.com"
}

// parallelGetDetails 通用并发 GET helper。对 keys[i] 用 pathFn(keys[i]) 拼出路径，
// 并发拉到 detail。最多 concurrency 个并发。结果按索引对齐，失败位 nil。
// 这是 1:1 串行 for 循环的并发替代版本，仅把网络 IO 并发化。
func parallelGetDetails(client *ovhsdk.Client, keys []interface{}, pathFn func(interface{}) string, concurrency int) []map[string]interface{} {
	if concurrency <= 0 {
		concurrency = 10
	}
	results := make([]map[string]interface{}, len(keys))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for i, k := range keys {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, key interface{}) {
			defer wg.Done()
			defer func() { <-sem }()
			var d map[string]interface{}
			if err := client.Get(pathFn(key), &d); err == nil {
				results[idx] = d
			}
		}(i, k)
	}
	wg.Wait()
	return results
}

// parallelGetStrings string 版本简化调用
func parallelGetStringKeys(client *ovhsdk.Client, keys []string, pathFn func(string) string, concurrency int) []map[string]interface{} {
	if concurrency <= 0 {
		concurrency = 10
	}
	results := make([]map[string]interface{}, len(keys))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for i, k := range keys {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, key string) {
			defer wg.Done()
			defer func() { <-sem }()
			var d map[string]interface{}
			if err := client.Get(pathFn(key), &d); err == nil {
				results[idx] = d
			}
		}(i, k)
	}
	wg.Wait()
	return results
}

// parallelGetDetailsWithErrs 与 parallelGetDetails 同构,但把每个 key 的错误一并带回。
// 语义保证:results[i] == nil ⟺ errs[i] != nil —— OVH 返回 200 但 body 是 null 时
// 也记成错误,调用方才能区分"这条没有数据"和"这条没拉到"。
//
// 老的 parallelGetDetails 把失败静默置 nil,调用方只能 continue 丢条目,
// 于是 403/429/5xx 会以"列表变短 + success:true"的形式呈现给用户。新代码一律用这个版本。
func parallelGetDetailsWithErrs(client *ovhsdk.Client, keys []interface{}, pathFn func(interface{}) string, concurrency int) ([]map[string]interface{}, []error) {
	if concurrency <= 0 {
		concurrency = 10
	}
	results := make([]map[string]interface{}, len(keys))
	errs := make([]error, len(keys))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for i, k := range keys {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, key interface{}) {
			defer wg.Done()
			defer func() { <-sem }()
			var d map[string]interface{}
			if err := client.Get(pathFn(key), &d); err != nil {
				errs[idx] = err
				return
			}
			if d == nil {
				errs[idx] = fmt.Errorf("OVH 返回空响应体")
				return
			}
			results[idx] = d
		}(i, k)
	}
	wg.Wait()
	return results, errs
}

// parallelGetStringKeysWithErrs string key 版本,语义同上
func parallelGetStringKeysWithErrs(client *ovhsdk.Client, keys []string, pathFn func(string) string, concurrency int) ([]map[string]interface{}, []error) {
	iface := make([]interface{}, len(keys))
	for i, k := range keys {
		iface[i] = k
	}
	return parallelGetDetailsWithErrs(client, iface, func(v interface{}) string {
		s, _ := v.(string)
		return pathFn(s)
	}, concurrency)
}

// countErrs 统计失败条数并返回第一个错误,给 handler 汇报 partial 用
func countErrs(errs []error) (failed int, first error) {
	for _, e := range errs {
		if e != nil {
			failed++
			if first == nil {
				first = e
			}
		}
	}
	return
}

// ovhAPICode 取 OVH SDK 错误里的 HTTP 状态码;不是 OVH API 错误时返回 0。
// 错误降级必须判状态码而不是匹配错误文案 —— 文案会随 OVH 改版失效,
// 一旦匹配不上就会把 401/500 当成"该功能未开通"骗过用户。
func ovhAPICode(err error) int {
	var apiErr *ovhsdk.APIError
	if errors.As(err, &apiErr) {
		return apiErr.Code
	}
	return 0
}

// ovhIsNotFound OVH 是否明确回了 404
func ovhIsNotFound(err error) bool { return ovhAPICode(err) == http.StatusNotFound }

// ovhIsGone OVH 是否表示端点已不存在(404 或 410)。
// 2026-10 OVH 把 VPS 的一批旧端点标记废弃、删除日期 2026-10-15
// (reinstall/setPassword/status/templates/distribution),到期后调用会得到
// 404/410 —— 这类失败要和"这台机器没有该资源"区分开:前者是功能没了,
// 后者是数据状态。DELETE /vps/{sn}/option/{option} 则已经直接从 schema 消失。
func ovhIsGone(err error) bool {
	code := ovhAPICode(err)
	return code == http.StatusNotFound || code == http.StatusGone
}

// defaultZero 数字字段缺失时返回 0 而不是 null（OVH 偶尔不返回某些字段）
func defaultZero(v interface{}) interface{} {
	if v == nil {
		return 0
	}
	return v
}

// defaultObj 字典字段缺失时返回 {} 而不是 null
func defaultObj(v interface{}) interface{} {
	if v == nil {
		return map[string]interface{}{}
	}
	return v
}

// defaultArr 数组字段缺失时返回 [] 而不是 null
func defaultArr(v interface{}) interface{} {
	if v == nil {
		return []interface{}{}
	}
	return v
}

// isNonEmptyStorage 判断 storageConfig 是否真的给了内容
// 空数组 / 空字典 / nil / false / 0 都视为"未提供自定义 storage"
func isNonEmptyStorage(v interface{}) bool {
	if v == nil {
		return false
	}
	switch x := v.(type) {
	case bool:
		return x
	case []interface{}:
		return len(x) > 0
	case map[string]interface{}:
		return len(x) > 0
	case string:
		return x != ""
	}
	return true
}

func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// idToString 把 OVH 返回的 ID（可能是 string 或数字）转成字符串
// 用于 /me/refund、/me/bill、/me/task/* 等返回数组里既可能是 ["xx","yy"] 也可能是 [1,2] 的端点
func idToString(v interface{}) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatInt(int64(x), 10)
	case int:
		return strconv.Itoa(x)
	case int64:
		return strconv.FormatInt(x, 10)
	case json.Number:
		return x.String()
	default:
		return fmt.Sprintf("%v", x)
	}
}

// RenewLadderAttempt 一次组合尝试的留痕(payload 键名 + 结果),全灭时随响应带回,
// 否则只有最后一级错误可见,中间每级被什么挡住完全丢失(实测排障时就吃了这个亏)。
type RenewLadderAttempt struct {
	Route   string   `json:"route"` // legacy = .../serviceInfos,services = /services/{id}
	Payload []string `json:"payload"`
	Error   string   `json:"error"`
}

// RenewLadderError 全部组合都被拒。Attempts 是逐级留痕。
type RenewLadderError struct {
	Attempts []RenewLadderAttempt
}

func (e *RenewLadderError) Error() string {
	if len(e.Attempts) == 0 {
		return "renew 全部组合被拒"
	}
	last := e.Attempts[len(e.Attempts)-1]
	return fmt.Sprintf("renew 全部 %d 种组合被拒,最后错误: %s", len(e.Attempts), last.Error)
}

// putServiceRenew 发 renew 修改(独服 / VPS 的 PUT .../serviceInfos 共用)。
//
// OVH 对 renew 载荷的校验持续收紧且文档一直滞后,US 实测已出现三族拒绝
// (参数废弃 / 模式键同现即拒 / schema 必填),auto 组合可用而 manual 的
// 已知组合全灭。这里把"能表达目标语义的键组合"按从全到简逐级试:
//   0 原始载荷(老区契约,含 manualPayment)
//   1 去 manualPayment(EU/CA 新契约)
//   2 再去 automatic(试探:automatic 缺席)
//   3 再去 period(试探:manual 状态下 period 冲突)
//   4 最小双键 {automatic, deleteAtExpiration}(去掉 forced 透传)
// 任一级成功即返回;全部被拒返回 RenewLadderError(逐级留痕)。
// 非"400+renew 字段族"的错误(权限/不存在/状态)直接冒泡,不继续试。
// putServiceRenew 单服务续费方式修改的完整路径:
//   1) 老路由 PUT .../{sn}/serviceInfos(一直用的,EU/CA 正常)
//   2) 全灭且 serviceId 已知 → 文档同模型的新路由 PUT /services/{serviceId}
//      (官方文档两条都写;US 的老路由 live 校验已收紧到手动组合全灭,换新路由是
//       文档内的正解,不是试错)。两级留痕合并返回。
func putServiceRenew(client *ovhsdk.Client, legacyPath string, serviceId *int64, next map[string]interface{}) error {
	err := putServiceRenewRoute(client, "legacy", legacyPath, next)
	if err == nil {
		return nil
	}
	lad := &RenewLadderError{}
	if !errors.As(err, &lad) {
		return err // 非 400+renew 字段族(权限/状态),换路由也没意义
	}
	if serviceId != nil {
		err2 := putServiceRenewRoute(client, "services", fmt.Sprintf("/services/%d", *serviceId), next)
		if err2 == nil {
			return nil
		}
		if lad2, ok := err2.(*RenewLadderError); ok {
			lad.Attempts = append(lad.Attempts, lad2.Attempts...)
		} else {
			return err2
		}
	}
	return lad
}

func putServiceRenewRoute(client *ovhsdk.Client, route, path string, next map[string]interface{}) error {
	attempts := []map[string]interface{}{next}
	drop := func(src map[string]interface{}, keys ...string) map[string]interface{} {
		out := make(map[string]interface{}, len(src))
	OUT:
		for k, v := range src {
			for _, d := range keys {
				if k == d {
					continue OUT
				}
			}
			out[k] = v
		}
		return out
	}
	a1 := drop(next, "manualPayment")
	a2 := drop(a1, "automatic")
	a3 := drop(a2, "period")
	a4 := map[string]interface{}{}
	if v, ok := next["automatic"]; ok {
		a4["automatic"] = v
	}
	if v, ok := next["deleteAtExpiration"]; ok {
		a4["deleteAtExpiration"] = v
	}
	attempts = append(attempts, a1, a2, a3, a4)

	lad := &RenewLadderError{}
	for _, a := range attempts {
		keys := make([]string, 0, len(a))
		for k := range a {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		err := client.Put(path, map[string]interface{}{"renew": a}, nil)
		if err == nil {
			return nil
		}
		lad.Attempts = append(lad.Attempts, RenewLadderAttempt{Route: route, Payload: keys, Error: err.Error()})
		if !ovh.IsRenewPayloadRejected(err) {
			return err
		}
	}
	return lad
}


// respondRenewError putServiceRenew 失败的统一出口:梯子全灭时把逐级组合与
// 各级原始错误一并带回(前端提示仍用汇总文案),便于一次定位 OVH 校验的真实要求。
func respondRenewError(c *gin.Context, state *app.State, svc string, err error) {
	var lad *RenewLadderError
	if errors.As(err, &lad) {
		state.Logger.Warn(fmt.Sprintf("renew 组合梯全灭(%s): %+v", svc, lad.Attempts), "server_control")
		c.JSON(http.StatusBadRequest, gin.H{
			"success":  false,
			"error":    ovh.Explain(errors.New(lad.Error())),
			"attempts": lad.Attempts,
		})
		return
	}
	respondOVHError(c, err)
}

// respondOVHError 统一的 OVH 写操作错误响应:
// 4xx 透传(前端能区分"重试没用"和"服务器错了")、5xx 保持 500,文案一律 ovh.Explain。
// 任务冲突类(IsTaskConflict)回 409,提示用户等任务完成。
func respondOVHError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	msg := ovh.Explain(err)
	if ovh.IsTaskConflict(err) {
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": "已有一个任务在进行中,等它完成后再试。" + msg})
		return
	}
	var apiErr *ovhsdk.APIError
	if errors.As(err, &apiErr) && apiErr.Code >= 400 && apiErr.Code < 500 {
		c.JSON(apiErr.Code, gin.H{"success": false, "error": msg})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": msg})
}

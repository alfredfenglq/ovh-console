import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
after(() => server.close());
const { Route } = await server.ssrLoadModule("/src/routes/monitor.tsx");
const { useServers } = await server.ssrLoadModule("/src/hooks/use-servers.ts");

test("an unknown model's diagnostic does not crash the monitor page or hide deletion", () => {
  const client = new QueryClient();
  const planCode = "nonexistent-model";
  const error = "EU 站点没有该型号的任何可用性记录";
  client.setQueryData(["monitor", "list"], [{
    planCode,
    datacenters: [],
    notifyAvailable: true,
    notifyUnavailable: false,
    lastStatus: {},
    createdAt: "2026-10-19T00:00:00Z",
  }]);
  client.setQueryData(["monitor", "status"], {
    running: true,
    subscriptions_count: 1,
    check_interval: 60,
    known_servers_count: 0,
    // The actual object shape returned by monitor.Status(), not a string.
    region_issues: [{
      planCode, serverName: "", accountId: "", region: "EU", subsidiary: "IE",
      checkedAt: "2026-10-19T00:00:00Z", error,
    }],
  });
  try {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(Route.options.component)));
    assert.ok(html.includes(planCode));
    assert.ok(html.includes(error));
    assert.ok(html.includes("@ EU (IE)"));
    assert.match(html, /aria-label="(?:删除|Delete)"/);
  } finally {
    client.clear();
  }
});

for (const region_issues of [[], undefined]) {
  test(`monitor page renders without diagnostics (${JSON.stringify(region_issues)})`, () => {
    const client = new QueryClient();
    client.setQueryData(["monitor", "list"], []);
    client.setQueryData(["monitor", "status"], {
      running: true, subscriptions_count: 0, check_interval: 60,
      known_servers_count: 0, region_issues,
    });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(Route.options.component)));
      assert.ok(!html.includes("border-warning/40 bg-warning/5"));
    } finally {
      client.clear();
    }
  });
}

test("task account override scopes the catalog cache to that account", () => {
  const client = new QueryClient();
  client.setQueryData(["accounts", "list"], [
    { id: "eu-main", endpoint: "ovh-eu", zone: "IE", isDefault: true },
    { id: "eu-second", endpoint: "ovh-eu", zone: "IE" },
    { id: "us", endpoint: "ovh-us", zone: "US" },
  ]);
  function CatalogProbe({ accountId }) {
    useServers(true, accountId);
    return null;
  }
  try {
    for (const accountId of ["eu-second", "us"]) {
      renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(CatalogProbe, { accountId })));
      assert.ok(client.getQueryState(["servers", "list", { showApiServers: true, accountId }]));
    }
    assert.equal(client.getQueryState(["servers", "list", { showApiServers: true, accountId: "" }]), undefined);
  } finally {
    client.clear();
  }
});

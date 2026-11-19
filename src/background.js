"use strict";

// Routing rule: a request goes through the proxy if
//   - the top-level site of the tab it belongs to is on a list, or
//   - its own host is on a list.
// Everything else goes direct.

const DIRECT = { type: "direct" };
const ICONS = { direct: "icons/direct.svg", proxy: "icons/proxy.svg" };

let config = { ...DEFAULTS };
let tempSites = [];          // "until restart" entries; live only in this (persistent) page
const tabHost = new Map();   // tabId -> top-level hostname
let loaded = false;

const ready = (async () => {
  config = await browser.storage.local.get(DEFAULTS);
  for (const tab of await browser.tabs.query({})) tabHost.set(tab.id, hostOf(tab.url));
  loaded = true;
  browser.browserAction.setBadgeBackgroundColor({ color: "#555" });
  refreshAllIcons();
})();

// ---------------------------------------------------------------- routing

function isListed(host) {
  return !!(findEntry(host, config.sites) || findEntry(host, tempSites));
}

function topLevelHost(d) {
  if (d.type === "main_frame") return hostOf(d.url);
  if (d.frameAncestors && d.frameAncestors.length) {
    return hostOf(d.frameAncestors[d.frameAncestors.length - 1].url);
  }
  if (d.frameId === 0 && d.documentUrl) return hostOf(d.documentUrl);
  if (d.tabId >= 0 && tabHost.has(d.tabId)) return tabHost.get(d.tabId);
  // Not tied to a tab (e.g. service worker): use the page that started it.
  return hostOf(d.documentUrl || d.originUrl || "");
}

function decide(d) {
  if (!config.enabled || !config.proxyHost || !config.proxyPort) return DIRECT;
  if (isListed(topLevelHost(d)) || isListed(hostOf(d.url))) {
    return { type: config.proxyType, host: config.proxyHost, port: Number(config.proxyPort) };
  }
  return DIRECT;
}

function onRequest(d) {
  // Remember where each tab is navigating, so its subresources follow it.
  if (d.type === "main_frame" && d.tabId >= 0) tabHost.set(d.tabId, hostOf(d.url));
  return loaded ? decide(d) : ready.then(() => decide(d));
}

browser.proxy.onRequest.addListener(onRequest, { urls: ["<all_urls>"] });
browser.proxy.onError.addListener((e) => console.warn("Site Proxy: proxy error:", e.message));

// ---------------------------------------------------------------- toolbar icon

function stateOf(host) {
  if (!config.enabled) return "off";
  if (findEntry(host, config.sites)) return "always";
  if (findEntry(host, tempSites)) return "temp";
  return "direct";
}

const TITLES = {
  off: "Site Proxy: switched off",
  always: "Site Proxy: proxied",
  temp: "Site Proxy: proxied until restart",
  direct: "Site Proxy: direct",
};
const BADGES = { off: "off", always: "", temp: "T", direct: "" };

function updateIcon(tabId, url) {
  const s = stateOf(hostOf(url || ""));
  const proxied = s === "always" || s === "temp";
  const ignore = () => {};  // tab may have closed in the meantime
  browser.browserAction.setIcon({ tabId, path: proxied ? ICONS.proxy : ICONS.direct }).catch(ignore);
  browser.browserAction.setBadgeText({ tabId, text: BADGES[s] }).catch(ignore);
  browser.browserAction.setTitle({ tabId, title: TITLES[s] }).catch(ignore);
}

async function refreshAllIcons() {
  for (const tab of await browser.tabs.query({})) updateIcon(tab.id, tab.url);
}

browser.tabs.onUpdated.addListener(
  (tabId, info, tab) => {
    if (info.url !== undefined) tabHost.set(tabId, hostOf(info.url));
    updateIcon(tabId, tab.url);
  },
  { properties: ["url", "status"] }
);
browser.tabs.onRemoved.addListener((tabId) => tabHost.delete(tabId));

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key in DEFAULTS) config[key] = newValue === undefined ? DEFAULTS[key] : newValue;
  }
  refreshAllIcons();
});

// ---------------------------------------------------------------- list changes
// The popup and options page go through these, so the temporary list has one owner.

async function saveSites(sites) {
  config.sites = [...new Set(sites)].sort();
  await browser.storage.local.set({ sites: config.sites });
}

async function addSite(domain, temporary) {
  await ready;
  domain = normalizeDomain(domain);
  if (!domain) throw new Error("Invalid domain");
  if (temporary) {
    if (!config.sites.includes(domain) && !tempSites.includes(domain)) {
      tempSites = [...tempSites, domain].sort();
    }
  } else {
    tempSites = tempSites.filter((d) => d !== domain);
    if (!config.sites.includes(domain)) await saveSites([...config.sites, domain]);
  }
  refreshAllIcons();
}

// Remove every entry (permanent or temporary) that covers `host`.
async function removeSitesFor(host) {
  await ready;
  const keep = (d) => !covers(d, host);
  tempSites = tempSites.filter(keep);
  if (!config.sites.every(keep)) await saveSites(config.sites.filter(keep));
  refreshAllIcons();
}

browser.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.cmd) {
    case "getState":
      return ready.then(() => ({ config, tempSites }));
    case "addSite":
      return addSite(msg.domain, !!msg.temporary);
    case "removeSitesFor":
      return removeSitesFor(msg.host);
    case "clearTemp":
      tempSites = [];
      refreshAllIcons();
      return Promise.resolve();
  }
  return undefined;
});

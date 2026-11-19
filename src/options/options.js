"use strict";

const $ = (id) => document.getElementById(id);
let dirty = false;

async function load() {
  const { config, tempSites } = await browser.runtime.sendMessage({ cmd: "getState" });
  $("enabled").checked = config.enabled;
  if (!dirty) {
    $("proxyType").value = config.proxyType;
    $("proxyHost").value = config.proxyHost;
    $("proxyPort").value = config.proxyPort;
    $("sites").value = config.sites.join("\n");
  }
  const ul = $("temp");
  ul.replaceChildren(...tempSites.map((d) => Object.assign(document.createElement("li"), { textContent: d })));
}

function message(text, isError) {
  $("saved").textContent = text;
  $("saved").classList.toggle("error", !!isError);
}

async function save() {
  const proxyHost = $("proxyHost").value.trim();
  const proxyPort = Number($("proxyPort").value);
  if (!proxyHost) return message("Proxy host is required.", true);
  if (!Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    return message("Port must be 1–65535.", true);
  }
  const sites = parseDomainList($("sites").value);
  await browser.storage.local.set({ proxyType: $("proxyType").value, proxyHost, proxyPort, sites });
  dirty = false;
  $("sites").value = sites.join("\n");  // show the normalised list
  message(`Saved (${sites.length} site${sites.length === 1 ? "" : "s"}).`);
}

$("enabled").onchange = () => browser.storage.local.set({ enabled: $("enabled").checked });
$("save").onclick = () => save().catch((e) => message(String(e), true));
$("clearTemp").onclick = async () => {
  await browser.runtime.sendMessage({ cmd: "clearTemp" });
  load();
};
for (const id of ["proxyType", "proxyHost", "proxyPort", "sites"]) {
  $(id).addEventListener("input", () => { dirty = true; message(""); });
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); $("save").click(); }
});
// Pick up changes made from the popup while this tab was in the background.
window.addEventListener("focus", load);

load();

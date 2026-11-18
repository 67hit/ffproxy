"use strict";

const $ = (id) => document.getElementById(id);

async function main() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const host = hostOf((tab && tab.url) || "");
  const { config, tempSites } = await browser.runtime.sendMessage({ cmd: "getState" });

  $("off").hidden = config.enabled;
  $("settings").onclick = (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
    window.close();
  };

  if (!host) {
    $("host").textContent = "Not a web page";
    return;
  }
  $("host").textContent = host;

  const always = findEntry(host, config.sites);
  const temp = findEntry(host, tempSites);

  if (always) {
    setStatus(`Proxied always (entry: ${always})`, true);
    $("remove").hidden = false;
  } else if (temp) {
    setStatus(`Proxied until restart (entry: ${temp})`, true);
    $("addForm").hidden = false;
    $("domain").value = temp;
    $("always").hidden = false;
    $("remove").hidden = false;
  } else {
    setStatus("Direct", false);
    $("addForm").hidden = false;
    $("domain").value = host.replace(/^www\./, "");
    $("always").hidden = false;
    $("temp").hidden = false;
    $("domain").focus();
    $("domain").select();
  }

  const done = async () => {
    await browser.tabs.reload(tab.id, { bypassCache: true });
    window.close();
  };

  const add = async (temporary) => {
    const domain = normalizeDomain($("domain").value);
    if (!domain || !covers(domain, host)) {
      showError(`Entry must be ${host} or a parent domain of it.`);
      return;
    }
    await browser.runtime.sendMessage({ cmd: "addSite", domain, temporary });
    await done();
  };

  $("always").onclick = () => add(false);
  $("temp").onclick = () => add(true);
  $("remove").onclick = async () => {
    await browser.runtime.sendMessage({ cmd: "removeSitesFor", host });
    await done();
  };
  $("domain").onkeydown = (e) => {
    if (e.key === "Enter") add(e.shiftKey);  // Enter = always, Shift+Enter = until restart
  };
}

function setStatus(text, proxied) {
  $("status").textContent = text;
  $("status").classList.toggle("proxied", proxied);
}

function showError(text) {
  $("error").textContent = text;
  $("error").hidden = false;
}

main().catch((e) => showError(String(e)));

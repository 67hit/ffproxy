"use strict";

// Shared helpers, loaded by the background page, popup and options page.

const DEFAULTS = Object.freeze({
  enabled: true,
  proxyType: "http",      // "http" = plain HTTP proxy (HTTPS sites are tunnelled via CONNECT)
  proxyHost: "10.0.1.1",
  proxyPort: 8888,
  sites: [],              // permanent entries, e.g. ["example.com"]
});

// Hostname of a web URL, or "" for anything that isn't http(s)/ws(s).
function hostOf(url) {
  try {
    const u = new URL(url);
    if (!/^(https?|wss?):$/.test(u.protocol)) return "";
    return u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

// Turn user input ("https://www.Example.com/path", "*.example.com", "'example.com',")
// into a bare hostname ("www.example.com", "example.com"). Returns "" if invalid.
// Going through URL also converts internationalised names to punycode.
function normalizeDomain(input) {
  let s = String(input).trim().toLowerCase().replace(/["'`;,]/g, "");
  s = s.replace(/^\*?\./, "");
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = "http://" + s;
  try {
    return new URL(s).hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}

// Parse a textarea / pasted list. Accepts one or more entries per line,
// separated by whitespace or commas; "#" starts a comment.
function parseDomainList(text) {
  const out = new Set();
  for (let line of String(text).split(/\r?\n/)) {
    line = line.replace(/#.*$/, "");
    if (/^\s*\/\//.test(line)) continue;
    for (const tok of line.split(/[\s,()\[\]]+/)) {
      const d = normalizeDomain(tok);
      // Keep only things that look like domain names, so pasted JS ("var list = [") is ignored.
      if (d.includes(".") && /^[a-z0-9_.-]+$/.test(d)) out.add(d);
    }
  }
  return [...out].sort();
}

// Does `entry` cover `host`? ("example.com" covers "example.com" and "a.b.example.com")
function covers(entry, host) {
  return host === entry || host.endsWith("." + entry);
}

// First entry in `list` that covers `host`, or null.
function findEntry(host, list) {
  if (!host) return null;
  for (const entry of list) if (covers(entry, host)) return entry;
  return null;
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULTS, hostOf, normalizeDomain, parseDomainList, covers, findEntry };
}

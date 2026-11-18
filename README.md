# Site Proxy

Firefox add-on that sends selected sites through a local HTTP proxy and everything else direct.

## How routing works

A request goes through the proxy if **the top-level site of its tab** is on a list, or if
**its own host** is on a list. So adding `example.com` also proxies the CDN, API and login
domains that example.com's pages load. An entry covers the domain and all its subdomains.

Two lists:
- **Always**: stored permanently, edited in the popup or on the Settings page.
- **Until restart**: kept in memory and cleared when Firefox restarts (or the add-on is reloaded).

## Using it

Toolbar button:
- **Direct site**: edit the entry if needed (it starts with `www.` removed; trim to a parent domain
  if you like), then click **Proxy always** or **Proxy until restart**.
  In the field, Enter = always and Shift+Enter = until restart.
- **Proxied site**: **Remove** deletes every entry covering the site. A temporary entry can be
  promoted with **Proxy always**.
- The tab reloads (bypassing the cache) after each change.

Icon: grey arrow = direct, orange = proxied, badge `T` = temporary entry, `off` = add-on switched off.

Settings page (popup → Settings…): proxy host/port, the permanent list as a textarea, the
temporary list, and an on/off switch. To import the list from `proxyconf.js`, paste the domains
(or the JS array as-is) into the textarea and click Save. Quotes, commas, `*.` prefixes and URLs
are cleaned up.

## Firefox setup

- Settings → Network Settings → **No proxy**. For non-listed sites the add-on answers "direct"
  anyway, but this retires `proxyconf.js` as a second source of truth.
- Private windows: the add-on only handles them if you allow it
  (about:addons → Site Proxy → "Run in Private Windows").

## Testing during development

    npx web-ext run --source-dir .            # starts a fresh Firefox profile with the add-on

or about:debugging → This Firefox → Load Temporary Add-on → pick `manifest.json`.
Temporary installs disappear when Firefox restarts.

Background-script logs: about:debugging → Site Proxy → Inspect.

## Permanent install on release Firefox (unlisted signing)

Release Firefox only installs signed add-ons. An unlisted submission is signed automatically
and never appears publicly.

1. Log in at addons.mozilla.org and create API credentials:
   https://addons.mozilla.org/developers/addon/api/key/
2. From this folder:

       npx web-ext sign --channel=unlisted \
         --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"

3. The signed `.xpi` lands in `web-ext-artifacts/`. Install it via about:addons → gear icon →
   Install Add-on From File.

For updates, bump `version` in `manifest.json` and sign again. Keep the `gecko.id` unchanged,
since it identifies the add-on on AMO and in your profile.

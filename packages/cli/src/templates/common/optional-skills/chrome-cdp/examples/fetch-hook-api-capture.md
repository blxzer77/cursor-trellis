# Fetch Hook — Intercept SPA API Responses

The CDP skill does not support `Network` domain event listening (`cdp.mjs` uses a request/response architecture and cannot receive push events like `Network.responseReceived`). Injecting a fetch hook via `eval` is the best alternative for capturing API data from SPA pages.

## When to Use

- Page loads data via `fetch` / `XMLHttpRequest` from a backend API (SPA, Next.js, Convex, etc.)
- You need raw JSON responses rather than reverse-parsing from the DOM
- You need request parameters for replay or pagination

## Workflow

### Step 1: Inject Hook

Inject **after the page has finished loading**. The hook is lost on navigation/refresh, so it must be injected after `nav`.

```bash
scripts/cdp.mjs eval <target> "
window.__captured = [];
var _origFetch = window.fetch;
window.fetch = async function() {
  var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url || '');
  var opts = arguments[1] || {};
  var reqBody = '';
  if (opts.body) { try { reqBody = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body); } catch(e) {} }
  var resp = await _origFetch.apply(this, arguments);
  try {
    var clone = resp.clone();
    var text = await clone.text();
    window.__captured.push({ url: url, method: opts.method || 'GET', reqBody: reqBody, resBody: text, len: text.length });
  } catch(e) {}
  return resp;
};
'hook installed'
"
```

**Key points:**
- Must `clone()` the response before reading the body — otherwise the original response stream is consumed and the page breaks
- Data is stored in `window.__captured` array, read later via `eval`
- The hook only captures requests made **after** injection — it cannot retroactively capture requests that already completed during page load

### Step 2: Trigger API Calls

After injecting the hook, interact with the page to trigger new API requests:

```bash
# Option A: scroll to trigger infinite scroll
scripts/cdp.mjs eval <target> "window.scrollTo(0, document.body.scrollHeight); 'scrolled'"

# Option B: click a "Load More" button
scripts/cdp.mjs click <target> "button.load-more"

# Option C: change sort/filter to trigger a new request
scripts/cdp.mjs click <target> "select#sort-by"
```

Wait 1-2 seconds for requests to complete before reading.

### Step 3: Read Captured Data

```bash
# Overview of captured requests
scripts/cdp.mjs eval <target> "
var c = window.__captured || [];
'Captured: ' + c.length + ' requests\n' + c.map(function(r,i) {
  return i + ': ' + r.method + ' ' + r.url.substring(0,80) + ' (' + r.len + ' bytes)';
}).join('\n');
"

# Read a specific response body (truncate to avoid token explosion)
scripts/cdp.mjs eval <target> "window.__captured[0].resBody.substring(0, 2000)"

# Read request parameters (to understand API format, pagination cursor, etc.)
scripts/cdp.mjs eval <target> "window.__captured[0].reqBody"
```

### Step 4: Replay API with Pagination

Once you understand the API format, replay calls directly in the page context to fetch all data automatically:

```bash
scripts/cdp.mjs eval <target> "
(async function() {
  var allItems = [];
  var cursor = null;
  var hasMore = true;
  while (hasMore) {
    var resp = await fetch('https://example.com/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'items:list',
        args: [{ cursor: cursor, numItems: 100 }]
      })
    });
    var data = await resp.json();
    allItems = allItems.concat(data.value.page);
    hasMore = data.value.hasMore;
    cursor = data.value.nextCursor;
  }
  window.__allItems = allItems;
  return 'Total: ' + allItems.length;
})()
"
```

Then read results in batches to avoid oversized output:

```bash
# Read first 50
scripts/cdp.mjs eval <target> "JSON.stringify(window.__allItems.slice(0, 50).map(function(it) { return { name: it.name, author: it.author }; }))"

# Read 50-100
scripts/cdp.mjs eval <target> "JSON.stringify(window.__allItems.slice(50, 100).map(function(it) { return { name: it.name, author: it.author }; }))"
```

## Caveats

| Limitation | Details |
|------------|---------|
| **Lost on navigation** | `nav` / page refresh clears the hook and `window.__captured` — re-inject after each navigation |
| **fetch only** | Does not intercept `XMLHttpRequest` by default; see XHR hook below if needed |
| **Memory growth** | `__captured` array grows indefinitely during long sessions — periodically clear with `window.__captured = []` |
| **CORS** | Step 4 API replay runs in the page's origin context and is subject to same-origin policy; this is fine if the original request was made by the page itself |
| **Large responses** | Returning large data via `eval` is token-expensive — use `.substring()` to truncate or `.map()` to extract only the fields you need |

## XMLHttpRequest Hook (Optional)

If the page uses `XMLHttpRequest` instead of `fetch`:

```bash
scripts/cdp.mjs eval <target> "
var _origOpen = XMLHttpRequest.prototype.open;
var _origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(method, url) {
  this.__method = method;
  this.__url = url;
  return _origOpen.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function(body) {
  this.addEventListener('load', function() {
    window.__captured.push({ url: this.__url, method: this.__method, reqBody: body || '', resBody: this.responseText, len: this.responseText.length });
  });
  return _origSend.apply(this, arguments);
};
'xhr hook installed'
"
```

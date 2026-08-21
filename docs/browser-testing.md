# Browser testing (agent-browser)

Gotchas when driving animovi with the agent-browser CLI. Each one has cost a real debugging
session.

## Clear the service worker before trusting anything

Animovi is a PWA: after editing source, the service worker keeps serving cached old JS chunks, so
a screenshot or console check can show stale behavior — including phantom errors that reference
identifiers no longer present in the source. Restarting the dev server does NOT fix it; the stale
chunks come from the browser's SW cache. Before trusting any agent-browser check:

```sh
agent-browser eval "(async()=>{const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();const ks=await caches.keys();for(const k of ks)await caches.delete(k)})()"
```

then re-open the URL. This does not clear localStorage/IndexedDB (settings and the stored VRM
persist), but a heavy clear plus navigation churn can still reset persisted state — re-import the
VRM if the avatar canvas is empty. Give a human the same clear step when handing off a visual
check.

## The WebGL canvas cannot be screenshotted

agent-browser cannot capture the WebGL avatar canvas: screenshots show only the page's CSS
background, headless and `--headed` alike (a vivid scene background never appears either), and a
2D `drawImage` readback of the canvas returns transparent pixels. Never judge avatar pose from
pixels. Read the applied bone rotations from the live scene instead: temporarily expose e.g.
`vrm.humanoid.getNormalizedBoneNode('spine').rotation` (and `'head'`) on `window` in the
avatar-scene render loop, sample over the motion, then revert — the bone rotation IS the rendered
transform, and more precise than eyeballing pixels.

## Tabs stuck at about:blank

A version-mismatched agent-browser daemon resets every tab to `about:blank`;
`agent-browser doctor --fix` clears it.

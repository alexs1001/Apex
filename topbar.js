// =============================================================
// Persistent dashboard top bar — topbar.js
// Drop on any page with:  <script src="topbar.js" defer></script>
// Self-injects HTML + CSS, reads progress from localStorage,
// syncs to/from Supabase so every device stays in sync.
// =============================================================
(function () {
  'use strict';

  // ─── Supabase config ───────────────────────────────────────
  // Replace these with your actual project values.
  // The anon/publishable key is safe to commit — RLS protects your data.
  const SUPABASE_URL = 'https://yyflaxgppciotxmrnycl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_q3aHvOHjMFX38P04EGd9ng_CDab7fkM';

  // ─── CSS ───────────────────────────────────────────────────
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; gap: 6px;
  padding: max(10px, env(safe-area-inset-top)) 14px 10px;
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.topbar-pill {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 11px;
  text-decoration: none;
  color: #FAFAFA;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, border-color 0.15s;
}
.topbar-pill:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.10); }
.topbar-pill-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #6ee7b7; flex-shrink: 0;
  transition: background 0.3s, box-shadow 0.3s;
}
.topbar-pill.warn .topbar-pill-dot { background: #fbbf24; }
.topbar-pill.miss .topbar-pill-dot {
  background: #ff8a8a;
  animation: topbar-miss-pulse 1.6s ease-in-out infinite;
}
@keyframes topbar-miss-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
}
.topbar-pill-label {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}
.topbar-pill-count {
  margin-left: auto;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; font-weight: 700;
  color: #FAFAFA;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.topbar-water-wrap {
  flex: 1 1 0; min-width: 0;
  display: flex;
}
.topbar-water-pill {
  flex: 1; min-width: 0;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: rgba(125,211,252,0.07);
  border: 1px solid rgba(125,211,252,0.14);
  border-right: none;
  border-radius: 11px 0 0 11px;
  text-decoration: none;
  color: #FAFAFA;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-water-pill:hover { background: rgba(125,211,252,0.12); }
.topbar-water-pill .topbar-pill-dot { background: #7DD3FC; }
.topbar-water-add {
  flex: 0 0 auto; width: 38px;
  border: 1px solid rgba(125,211,252,0.14);
  background: linear-gradient(180deg, rgba(125,211,252,0.22), rgba(110,231,183,0.22));
  color: #FFFFFF;
  font-family: inherit; font-size: 17px; font-weight: 700;
  cursor: pointer;
  border-radius: 0 11px 11px 0;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.10s;
}
.topbar-water-add:hover {
  background: linear-gradient(180deg, rgba(125,211,252,0.34), rgba(110,231,183,0.34));
}
.topbar-water-add:active { transform: scale(0.94); }
.topbar-water-add.flash {
  background: linear-gradient(180deg, rgba(125,211,252,0.65), rgba(110,231,183,0.65));
}
/* Sync indicator dot — sits in top-right corner of topbar */
.topbar-sync-dot {
  position: absolute; top: 6px; right: 6px;
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(107,227,164,0.0);
  transition: background 0.4s, box-shadow 0.4s;
  pointer-events: none;
}
.topbar-sync-dot.syncing {
  background: #F2C063;
  box-shadow: 0 0 6px rgba(242,192,99,0.7);
  animation: topbar-sync-blink 0.8s ease-in-out infinite;
}
.topbar-sync-dot.synced {
  background: #6BE3A4;
  box-shadow: 0 0 6px rgba(107,227,164,0.6);
}
.topbar-sync-dot.error {
  background: #FF8A8A;
  box-shadow: 0 0 6px rgba(255,138,138,0.6);
}
@keyframes topbar-sync-blink {
  0%,100% { opacity: 1; } 50% { opacity: 0.4; }
}
/* GYM + FINANCE: icon-only pills — no label, fixed small width */
.topbar-pill-icon-only {
  flex: 0 0 36px;
  padding: 8px 0;
  justify-content: center;
  gap: 0;
}
.topbar-pill-icon-only .topbar-pill-label { display: none; }

@media (max-width: 600px) {
  .topbar { padding-left: 8px; padding-right: 8px; gap: 4px; }
  /* data pills shrink but keep their count */
  .topbar-pill, .topbar-water-pill { padding: 7px 8px; gap: 5px; flex: 1 1 0; min-width: 0; }
  .topbar-pill-label { font-size: 9px; letter-spacing: 0.08em; }
  .topbar-pill-count { font-size: 11px; }
  /* water +btn */
  .topbar-water-add { width: 30px; font-size: 16px; }
  /* icon-only pills stay compact */
  .topbar-pill-icon-only { flex: 0 0 32px; }
}
@media (max-width: 400px) {
  /* very small screens: also hide labels on data pills, keep counts */
  .topbar-pill-label { display: none; }
  .topbar-pill, .topbar-water-pill { padding: 7px 6px; gap: 0; }
  .topbar-pill-icon-only { flex: 0 0 28px; }
}
html, body { -webkit-text-size-adjust: 100%; }
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .wt-overlay, .wt-viewer {
  overscroll-behavior: contain;
}
body.topbar-modal-open { overflow: hidden; touch-action: none; }
@media (max-width: 480px) {
  .modal-bg, .po-modal-bg {
    padding: 0 !important; align-items: stretch !important; justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important; max-width: 100% !important;
    max-height: 100vh !important; height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    overflow-y: auto !important; overscroll-behavior: contain;
  }
}
`;

  // ─── HTML ───────────────────────────────────────────────────
  const html = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick stats" style="position:relative;">
  <a href="index.html" class="topbar-pill" id="topbarGoals">
    <span class="topbar-pill-dot"></span>
    <span class="topbar-pill-label">GOALS</span>
    <span class="topbar-pill-count" id="topbarGoalsCount">—/—</span>
  </a>
  <a href="health.html" class="topbar-pill" id="topbarStack">
    <span class="topbar-pill-dot"></span>
    <span class="topbar-pill-label">STACK</span>
    <span class="topbar-pill-count" id="topbarStackCount">—/—</span>
  </a>
  <div class="topbar-water-wrap">
    <a href="po-water.html" class="topbar-water-pill" id="topbarWater">
      <span class="topbar-pill-dot"></span>
      <span class="topbar-pill-label">WATER</span>
      <span class="topbar-pill-count" id="topbarWaterCount">—/—</span>
    </a>
    <button class="topbar-water-add" id="topbarWaterAdd" aria-label="Log one drink" type="button">+</button>
  </div>
  <a href="gym.html" class="topbar-pill topbar-pill-icon-only" id="topbarGym" title="Gym">
    <span class="topbar-pill-dot"></span>
    <span class="topbar-pill-label">GYM</span>
  </a>
  <a href="finance.html" class="topbar-pill topbar-pill-icon-only" id="topbarFinance" title="Finance">
    <span class="topbar-pill-dot"></span>
    <span class="topbar-pill-label">FINANCE</span>
  </a>
  <span class="topbar-sync-dot" id="topbarSyncDot" title="Sync status"></span>
</header>
`;

  // ─── Inject ─────────────────────────────────────────────────
  function injectStyleAndHTML() {
    if (document.getElementById('topbar')) return;
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  // ─── Date helpers ────────────────────────────────────────────
  function activeDateKey() {
    const now = new Date(), d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }
  function calendarDateKey() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  // ─── Progress readers ────────────────────────────────────────
  function getGoalsProgress() {
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem('goals:' + activeDateKey())) || []; } catch {}
    const total = Array.isArray(goals) ? goals.length : 0;
    const done  = total ? goals.filter(g => g && g.done).length : 0;
    return { done, total };
  }
  function getStackProgress() {
    let items = [], taken = {};
    try { items = JSON.parse(localStorage.getItem('stack:items'))              || []; } catch {}
    try { taken = JSON.parse(localStorage.getItem('stack:taken:'+activeDateKey())) || {}; } catch {}
    const total = Array.isArray(items) ? items.length : 0;
    const done  = total ? items.filter(i => i && taken[i.id]).length : 0;
    return { done, total };
  }
  function getWaterProgress() {
    let state = null;
    try { state = JSON.parse(localStorage.getItem('po_water_v1')); } catch {}
    if (!state) return { done: 0, total: 0 };
    const done = (state.logs || {})[calendarDateKey()] || 0;
    const p = state.profile || { weightKg: 75 };
    const wKg = state.weightUnit === 'lb' ? (p.weightKg||0)/2.20462 : (p.weightKg||0);
    const base = wKg * 35;
    const exercise = (p.activityHrsPerWeek||0) / 7 * 500;
    const caffeine = Math.max(0, (state.caffeineMgPerDay||0) - 200) * 1.5;
    const subs = (state.substances||[]).reduce((s,x) => {
      const dose = (x && x.dose != null ? x.dose : (x && x.defaultDose)) || 0;
      return s + Math.max(0, dose * ((x && x.mlPerUnit)||0));
    }, 0);
    let adjust = 0;
    if (p.sex === 'm') adjust += 200;
    if ((p.age||0) >= 50) adjust += 100;
    const totalMl = base + exercise + caffeine + subs + adjust;
    let unitVol;
    if      (state.unit === 'glass')  unitVol = state.glassMl  || 250;
    else if (state.unit === 'oz')     unitVol = 30;
    else if (state.unit === 'ml')     unitVol = 1;
    else                              unitVol = state.bottleMl || 500;
    const total = Math.max(1, Math.ceil(totalMl / unitVol));
    return { done, total };
  }

  function classifyStatus(done, total) {
    if (total === 0) return 'idle';
    if (done >= total) return 'good';
    const h = new Date().getHours();
    if (h >= 18 && done < total * 0.5) return 'miss';
    return 'warn';
  }
  function setPillStatus(pillEl, status) {
    pillEl.classList.remove('good','warn','miss');
    if (status === 'warn' || status === 'miss') pillEl.classList.add(status);
  }

  function render() {
    const goalsEl = document.getElementById('topbarGoals');
    if (!goalsEl) return;
    const g = getGoalsProgress();
    const s = getStackProgress();
    const w = getWaterProgress();
    document.getElementById('topbarGoalsCount').textContent = g.total ? g.done+'/'+g.total : '0/0';
    document.getElementById('topbarStackCount').textContent = s.total ? s.done+'/'+s.total : '0/0';
    document.getElementById('topbarWaterCount').textContent = w.total ? w.done+'/'+w.total : '0/0';
    setPillStatus(goalsEl,                    classifyStatus(g.done, g.total));
    setPillStatus(document.getElementById('topbarStack'), classifyStatus(s.done, s.total));
    setPillStatus(document.getElementById('topbarWater'), classifyStatus(w.done, w.total));
  }

  // ─── Sync dot ────────────────────────────────────────────────
  function setSyncDot(state) {
    const dot = document.getElementById('topbarSyncDot');
    if (!dot) return;
    dot.classList.remove('syncing','synced','error');
    if (state) dot.classList.add(state);
    if (state === 'synced') setTimeout(() => dot.classList.remove('synced'), 2500);
  }

  // ─── Supabase helpers ────────────────────────────────────────
  function supaOk() {
    return SUPABASE_URL && !SUPABASE_URL.startsWith('PASTE') &&
           SUPABASE_KEY && !SUPABASE_KEY.startsWith('PASTE');
  }

  async function supaPull() {
    if (!supaOk()) return;
    try {
      const r = await fetch('/api/sync', { headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) return;
      const rows = await r.json();
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        const { key, data } = row;
        if (!key || !data) continue;
        // Merge remote data into localStorage — remote wins for most keys,
        // but we merge water logs so a +1 from another device isn't lost.
        if (key === 'health') {
          const remote = data;
          // po_water_v1 — merge logs by taking the max per day
          if (remote.po_water_v1) {
            let local = null;
            try { local = JSON.parse(localStorage.getItem('po_water_v1')); } catch {}
            if (local) {
              const merged = Object.assign({}, remote.po_water_v1);
              merged.logs = Object.assign({}, merged.logs || {});
              for (const [day, cnt] of Object.entries(local.logs || {})) {
                merged.logs[day] = Math.max(merged.logs[day] || 0, cnt);
              }
              localStorage.setItem('po_water_v1', JSON.stringify(merged));
            } else {
              localStorage.setItem('po_water_v1', JSON.stringify(remote.po_water_v1));
            }
          }
          // stack:items
          if (remote['stack:items'])
            localStorage.setItem('stack:items', JSON.stringify(remote['stack:items']));
          // stack:taken:* keys
          for (const [k,v] of Object.entries(remote)) {
            if (k.startsWith('stack:taken:'))
              localStorage.setItem(k, JSON.stringify(v));
          }
        } else if (key === 'goals') {
          // goals:YYYY-MM-DD keys stored in data object
          for (const [k,v] of Object.entries(data)) {
            if (k.startsWith('goals:'))
              localStorage.setItem(k, JSON.stringify(v));
          }
          // streak
          if (data['goal_streak_v1'])
            localStorage.setItem('goal_streak_v1', JSON.stringify(data['goal_streak_v1']));
        } else if (key === 'gym' || key === 'finance') {
          for (const [k,v] of Object.entries(data))
            localStorage.setItem(k, JSON.stringify(v));
        }
      }
      render();
    } catch { /* offline */ }
  }

  async function supaPush(key, data) {
    if (!supaOk()) return;
    setSyncDot('syncing');
    try {
      const r = await fetch('/api/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, data }),
      });
      setSyncDot(r.ok ? 'synced' : 'error');
    } catch { setSyncDot('error'); }
  }

  // Build a snapshot of all goals-related localStorage keys
  function snapshotGoals() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('goals:') || k === 'goal_streak_v1') {
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
    return out;
  }
  function snapshotHealth() {
    const out = {};
    const keys = ['po_water_v1','stack:items'];
    keys.forEach(k => {
      try { const v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch {}
    });
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('stack:taken:')) {
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
    return out;
  }

  // Debounced push — batch rapid writes into one network call
  let pushTimers = {};
  function debouncedPush(key, getSnapshot, delay) {
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(() => supaPush(key, getSnapshot()), delay || 1500);
  }

  // ─── Water +1 ────────────────────────────────────────────────
  function defaultWaterState() {
    return {
      unit: 'bottle', bottleMl: 500, glassMl: 250, weightUnit: 'kg',
      profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 },
      caffeineMgPerDay: 200, substances: [], logs: {}
    };
  }
  function addWater() {
    let state = null;
    try { state = JSON.parse(localStorage.getItem('po_water_v1')); } catch {}
    if (!state || typeof state !== 'object') state = defaultWaterState();
    state.logs = state.logs || {};
    const k = calendarDateKey();
    state.logs[k] = (state.logs[k] || 0) + 1;
    try { localStorage.setItem('po_water_v1', JSON.stringify(state)); } catch {}
    render();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 220); }
    // Push health snapshot (includes water)
    debouncedPush('health', snapshotHealth, 1000);
  }

  // ─── Storage event watcher ───────────────────────────────────
  // When any page writes to localStorage, push the relevant namespace to Supabase
  let storageDebounce = {};
  window.addEventListener('storage', (e) => {
    render();
    if (!e.key) return;
    if (e.key.startsWith('goals:') || e.key === 'goal_streak_v1') {
      debouncedPush('goals', snapshotGoals, 1500);
    } else if (e.key === 'po_water_v1' || e.key === 'stack:items' || e.key.startsWith('stack:taken:')) {
      debouncedPush('health', snapshotHealth, 1500);
    }
  });

  // Also intercept same-page localStorage writes by patching setItem
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key.startsWith('goals:') || key === 'goal_streak_v1') {
      debouncedPush('goals', snapshotGoals, 1500);
    } else if (key === 'po_water_v1' || key === 'stack:items' || key.startsWith('stack:taken:')) {
      debouncedPush('health', snapshotHealth, 1500);
    }
  };

  // ─── Mobile lockdown ─────────────────────────────────────────
  function blockGesture(e) { e.preventDefault(); }
  function lockGestures() {
    document.addEventListener('gesturestart',  blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend',    blockGesture, { passive: false });
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }
  function startModalLock() {
    const SELECTORS = ['.modal-bg','.po-modal-bg','.wt-overlay','.wt-viewer','.wt-cam'];
    function anyOpen() {
      for (const sel of SELECTORS) {
        for (const el of document.querySelectorAll(sel))
          if (el.classList.contains('show') || el.classList.contains('is-open')) return true;
      }
      return false;
    }
    function sync() { document.body.classList.toggle('topbar-modal-open', anyOpen()); }
    new MutationObserver(sync).observe(document.body, {
      attributes: true, attributeFilter: ['class'], subtree: true
    });
    sync();
  }

  // ─── Boot ────────────────────────────────────────────────────
  function boot() {
    injectStyleAndHTML();
    document.getElementById('topbarWaterAdd')
      .addEventListener('click', (e) => { e.preventDefault(); addWater(); });
    render();
    lockGestures();
    startModalLock();

    // Pull from Supabase on load to get latest state from other devices
    supaPull();

    window.addEventListener('focus', () => { render(); supaPull(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { render(); supaPull(); }
    });
    setInterval(render, 30 * 1000);
    // Background sync every 5 minutes to catch changes from other devices
    setInterval(supaPull, 5 * 60 * 1000);

    // ─── SPA router ──────────────────────────────────────────────
    // Intercepts topbar link clicks and swaps page content in-place so
    // Safari never performs a real navigation — the address bar stays hidden.
    //
    // Strategy: fetch the target HTML, extract everything between <body> and
    // </body> minus the topbar header itself, replace document.body's content
    // except the topbar, then re-execute the new page's inline <script> tags.
    // history.pushState keeps the URL in sync for back/forward and refresh.

    const PAGES = ['index.html','health.html','gym.html','finance.html','po-water.html'];
    let _navigating = false;

    // Mark the active topbar pill based on current pathname
    function markActive(pathname) {
      const file = pathname.split('/').pop() || 'index.html';
      const map = {
        'index.html':    'topbarGoals',
        'health.html':   'topbarStack',
        'po-water.html': 'topbarWater',
        'gym.html':      'topbarGym',
        'finance.html':  'topbarFinance',
      };
      Object.values(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('topbar-pill-active');
      });
      const active = map[file];
      if (active) {
        const el = document.getElementById(active);
        if (el) el.classList.add('topbar-pill-active');
      }
    }

    // Run all inline <script> tags found in the newly-inserted content.
    // We skip scripts that merely load topbar.js (already running).
    function runScripts(container) {
      const scripts = container.querySelectorAll('script');
      scripts.forEach(orig => {
        if (orig.src && orig.src.includes('topbar.js')) return; // already loaded
        const s = document.createElement('script');
        if (orig.src) {
          s.src = orig.src;
          s.async = false;
        } else {
          s.textContent = orig.textContent;
        }
        // Copy any attributes (type, etc.)
        Array.from(orig.attributes).forEach(a => {
          if (a.name !== 'src') s.setAttribute(a.name, a.value);
        });
        orig.parentNode.replaceChild(s, orig);
      });
    }

    async function navigateTo(url, pushState) {
      if (_navigating) return;
      const file = url.split('/').pop().split('?')[0] || 'index.html';
      if (!PAGES.includes(file)) return; // only handle known pages

      _navigating = true;

      // Swap page-level <style> tags: remove old page styles, inject new ones.
      // We tag ours so we can find them again.
      document.querySelectorAll('style[data-page-style]').forEach(s => s.remove());

      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status);
        const html = await res.text();

        // Parse into a throwaway document — avoids executing scripts early
        const parser = new DOMParser();
        const doc    = parser.parseFromString(html, 'text/html');

        // ── Swap <title> ────────────────────────────────────────
        document.title = doc.title;

        // ── Swap page-level <style> blocks from <head> ──────────
        // (Each page has its own <style> in <head>; we pull them in.)
        doc.querySelectorAll('head style').forEach(s => {
          const clone = document.createElement('style');
          clone.setAttribute('data-page-style', '1');
          clone.textContent = s.textContent;
          document.head.appendChild(clone);
        });

        // ── Swap body content, preserving the topbar ─────────────
        // The parsed doc's body contains a fresh topbar (injected by
        // topbar.js on that page). Remove it so we don't double-inject.
        const newTopbar = doc.body.querySelector('#topbar');
        if (newTopbar) newTopbar.remove();

        // Remove everything from current body except the topbar header
        Array.from(document.body.childNodes).forEach(node => {
          if (node.id !== 'topbar') node.remove();
        });

        // Move all remaining body nodes into the live document
        // (DOMParser gives us real DOM nodes we can move across documents)
        const frag = document.createDocumentFragment();
        while (doc.body.firstChild) frag.appendChild(doc.body.firstChild);
        document.body.appendChild(frag);

        // ── Re-run scripts ────────────────────────────────────────
        runScripts(document.body);

        // ── Update URL + topbar active state ─────────────────────
        if (pushState) history.pushState({ page: file }, doc.title, '/' + file);
        markActive(location.pathname);
        render(); // refresh pill counts immediately

        // ── Scroll to top ─────────────────────────────────────────
        window.scrollTo(0, 0);

      } catch (e) {
        // If fetch fails (offline, etc.) fall back to real navigation
        location.href = url;
      } finally {
        _navigating = false;
      }
    }

    // Handle back/forward buttons
    window.addEventListener('popstate', () => {
      navigateTo(location.pathname, false);
    });

    // Intercept topbar link clicks only
    document.getElementById('topbar').addEventListener('click', e => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      const file = href.split('/').pop().split('?')[0] || 'index.html';
      if (!PAGES.includes(file)) return;
      e.preventDefault();
      navigateTo(href, true);
    });

    // Set initial active pill based on current page
    markActive(location.pathname);
  }

  // Add a subtle active-pill indicator (tiny underline dot)
  (function addActivePillStyle() {
    const s = document.createElement('style');
    s.textContent = `.topbar-pill-active { border-color: rgba(255,255,255,0.20) !important; background: rgba(255,255,255,0.07) !important; }`;
    document.head.appendChild(s);
  })();

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else
    boot();
})();

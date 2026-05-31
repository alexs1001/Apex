/**
 * energy-map.js  v3
 * WHOOP-first energy engine.
 *
 * See the inline comment block in index.html for the full architecture doc.
 *
 * Key changes from v2:
 *   - Chart spans wakeH → wakeH+18 (not fixed 8–24)
 *   - Three-component model: CAPACITY × DRIVE(tw) − FATIGUE(tw)
 *   - DRIVE has morning ramp, peak plateau, post-lunch dip, afternoon
 *     rebound, and evening wind-down — genuinely different shapes per day
 *   - FATIGUE accumulates from adenosine buildup + strain drag (time-varying)
 *   - Peak is always after wake (enforced)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.EnergyMap = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STEP         = 10 / 60;
  const DEFAULT_WAKE = 7;
  const CHART_SPAN   = 18;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function sigmoid(x)       { return 1 / (1 + Math.exp(-x)); }
  function bump(tw, c, hw)  { const x = (tw - c) / hw; return Math.exp(-0.5 * x * x); }

  function buildEnergyCurve(params) {
    params = params || {};

    const wakeH      = typeof params.wakeHour   === 'number' ? params.wakeHour   : DEFAULT_WAKE;
    const DAY_START  = wakeH;
    const DAY_END    = wakeH + CHART_SPAN;
    const N_POINTS   = Math.round(CHART_SPAN / STEP) + 1;

    const recovery   = typeof params.recovery   === 'number' ? params.recovery   : null;
    const hrv        = typeof params.hrv        === 'number' ? params.hrv        : null;
    const rhr        = typeof params.rhr        === 'number' ? params.rhr        : null;
    const sleepDurMs = typeof params.sleepDurMs === 'number' ? params.sleepDurMs : null;
    const sleepPerf  = typeof params.sleepPerf  === 'number' ? params.sleepPerf  : null;
    const sleepDebt  = typeof params.sleepDebt  === 'number' ? params.sleepDebt  : 0;
    const strain     = typeof params.strain     === 'number' ? params.strain     : null;

    const hasWhoop   = recovery != null || hrv != null || sleepPerf != null;

    // ── 1. CAPACITY ───────────────────────────────────────────
    const rec_pct  = recovery != null ? clamp(recovery, 0, 100) : 67;
    const rec_cont = (rec_pct / 100) * 0.65;

    let hrv_ms = hrv;
    if (hrv_ms == null && rhr != null) hrv_ms = clamp(130 - rhr * 1.2, 20, 110);
    if (hrv_ms == null) hrv_ms = 55;
    const hrv_norm = clamp(hrv_ms / 85, 0, 1.15);
    const hrv_cont = hrv_norm * 0.20;

    const perfF    = sleepPerf  != null ? clamp(sleepPerf  / 100, 0, 1) : 0.75;
    const durH     = sleepDurMs != null ? sleepDurMs / 3_600_000        : 7.0;
    const durF     = clamp(durH / 7.5, 0, 1);
    const sleepQ   = 0.40 * perfF + 0.60 * durF;
    const slp_cont = sleepQ * 0.15;

    const CAPACITY  = clamp(rec_cont + hrv_cont + slp_cont, 0.12, 1.00);
    const rhr_val   = rhr != null ? rhr : 60;
    const rhr_amp   = 1.0 + clamp((65 - rhr_val) / 65, -0.15, 0.15);

    // ── 2. CIRCADIAN DRIVE ────────────────────────────────────
    const dip_depth      = 0.18 + (1 - sleepQ) * 0.14;
    const rebound_height = 0.12 + (rec_pct / 100) * 0.20;
    const ramp_speed     = 0.4 + sleepQ * 0.5;

    function drive(tw) {
      if (tw < 0) return 0.45;
      const ramp     = 0.50 + 0.50 * sigmoid((tw - 1.2) / ramp_speed);
      const bb_tau   = 8 + hrv_norm * 9;
      const backbone = Math.exp(-Math.max(0, tw - 2) / bb_tau);
      const dip      = dip_depth * bump(tw, 7.0, 1.2);
      const rebound  = rebound_height * bump(tw, 10.0, 1.8);
      const wind     = 1 - 0.55 * sigmoid((tw - 12.5) / 2.5);
      return ramp * backbone * wind - dip + rebound;
    }

    // ── 3. FATIGUE ACCUMULATION ───────────────────────────────
    const debt_base = clamp(sleepDebt / 10, 0, 1) * 0.35;
    const aden_rate = 1 / (14 + sleepQ * 8);
    const strainN   = strain != null ? clamp(strain / 21, 0, 1) : 0.35;

    function fatigue(tw) {
      if (tw < 0) return 0;
      const adenosine   = clamp(tw * aden_rate * CHART_SPAN * 0.35, 0, 0.35);
      const strain_drag = strainN * 0.32 * sigmoid((tw - 5) / 2.5);
      return debt_base + adenosine + strain_drag;
    }

    // ── Build curve ───────────────────────────────────────────
    const points = new Float32Array(N_POINTS);
    for (let i = 0; i < N_POINTS; i++) {
      const t  = DAY_START + i * STEP;
      const tw = t - wakeH;
      points[i] = clamp(CAPACITY * rhr_amp * clamp(drive(tw), 0, 1) - clamp(fatigue(tw), 0, 0.85), 0.05, 1.0);
    }

    const minPeakIdx = Math.round(0.5 / STEP);
    let peakIdx = minPeakIdx;
    for (let i = minPeakIdx + 1; i < N_POINTS; i++) {
      if (points[i] > points[peakIdx]) peakIdx = i;
    }

    const meta = {
      hasWhoop, wakeH, CAPACITY, sleepQuality: sleepQ, hrv_norm, rhr_amp,
      strainNorm: strainN, debtDrag: debt_base, peakIdx, DAY_START, DAY_END,
      get peakHour()  { return DAY_START + this.peakIdx * STEP; },
      get peakValue() { return points[this.peakIdx]; },
      energyAt(h) {
        const idx = Math.round((h - DAY_START) / STEP);
        return points[clamp(idx, 0, N_POINTS - 1)];
      },
    };

    return { points, meta, N_POINTS, STEP, DAY_START, DAY_END };
  }

  return { buildEnergyCurve, STEP };
}));

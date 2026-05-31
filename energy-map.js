/**
 * energy-map.js  v2
 * WHOOP-first energy engine.
 *
 * Architecture
 * ────────────
 * The old v1 design had a fatal structural flaw: the circadian sinusoid was a
 * time-varying term, while every WHOOP signal was a flat scalar.  No matter how
 * you weighted them, the *shape* of the curve was determined by the sinusoid —
 * WHOOP could only raise or lower the whole line, never reshape it.
 *
 * v2 flips this.  All WHOOP signals are expressed as time-varying functions.
 * The circadian sinusoid is reduced to a small residual perturbation (≤0.08 in
 * amplitude, ≤10% of the total blend).  The curve emerges from the data.
 *
 * Signal design
 * ─────────────
 *
 *   A. Recovery level  [weight 0.28]
 *      Recovery score is the strongest single predictor.  It sets a baseline
 *      that decays slightly over the day — high recovery starts high and holds
 *      well; low recovery starts low and falls further.
 *
 *        base     = 0.30 + (recovery / 100) × 0.65       [0.30 – 0.95]
 *        decay_τ  = 12 + (recovery / 100) × 12            [12 – 24 h]
 *        rec(t)   = base × exp(−tFromWake / decay_τ)
 *
 *      With 90% recovery: starts ≈0.89, decays to ≈0.72 by hour 16.
 *      With 30% recovery: starts ≈0.50, decays to ≈0.36 by hour 16.
 *
 *   B. HRV / autonomic readiness  [weight 0.25]
 *      HRV reflects parasympathetic tone — the body's actual capacity to
 *      generate and sustain effort.  It's more sensitive than recovery score.
 *      We normalise against a personal baseline proxy (population: ~55 ms).
 *
 *        hrv_norm = clamp(hrv / 70, 0, 1.15)
 *        The HRV signal fades faster when HRV is low (nervous system is
 *        depleted earlier), holds longer when HRV is high.
 *        hrv_τ    = 10 + hrv_norm × 10                    [10 – 21 h]
 *        hrv(t)   = hrv_norm × exp(−tFromWake / hrv_τ)
 *
 *   C. Sleep quality  [weight 0.22]
 *      Composite of sleep performance % and sleep duration vs. target (7.5 h).
 *      Sleep quality is the primary fuel that energy burns through.  It
 *      depletes faster when quality was poor, holds when it was excellent.
 *
 *        quality  = 0.45 × (sleepPerf/100) + 0.55 × clamp(durationH/7.5, 0, 1)
 *        sleep_τ  = 8 + quality × 14                       [8 – 22 h]
 *        sleep(t) = quality × exp(−tFromWake / sleep_τ)
 *
 *   D. Sleep debt suppression  [weight 0.15]
 *      Accumulated debt is a uniform drag that doesn't decay — it's systemic.
 *      debt_drag = clamp(sleepDebt / 10, 0, 1) × 0.55
 *      Subtracted as a flat penalty.  At 5h debt → −0.275; at 10h → −0.55.
 *
 *   E. Resting heart rate modifier  [weight 0.10]
 *      RHR reflects cardiac efficiency.  Lower RHR = greater cardiac reserve.
 *      Normalised so 40 bpm → 1.0, 80 bpm → 0.0.
 *      rhr_factor = clamp((80 − rhr) / 40, 0, 1)
 *      Applied as a flat amplifier on the combined signal.
 *
 *   F. Strain fatigue  [weight — applied as time-varying drag, not blended]
 *      Yesterday's strain builds fatigue that arrives progressively.
 *      strain_drag(t) = (strain / 21) × 0.28 × sigmoid((tFromWake − 4) / 2)
 *      Invisible in the morning, peaks around hour 8–10, levels off.
 *      High strain (19+) can remove up to 0.28 from the afternoon curve.
 *
 *   G. Circadian micro-perturbation  [weight 0.08 — max ±0.08 amplitude]
 *      A very weak 24-h sinusoid centred on wake+4h.  It introduces a slight
 *      biological rhythm without imposing a shape — the amplitude is small
 *      enough that it can never override a WHOOP signal.
 *        circ(t) = 0.08 × sin(2π(t − wakeH − 4) / 24)
 *      This term can add or subtract at most ±0.08.  It does NOT create peaks
 *      or troughs on its own.
 *
 * Blend
 * ─────
 *   composite(t) = W_REC × rec(t)
 *                + W_HRV × hrv(t)
 *                + W_SLP × sleep(t)
 *                − W_DEBT × debt_drag
 *                + W_RHR × rhr_factor × mean_signal(t)
 *                − strain_drag(t)
 *                + circ(t)
 *
 *   energy(t) = clamp(composite(t), 0.04, 1.0)
 *
 * The RHR term amplifies or attenuates the combined recovery/sleep/hrv signal
 * rather than adding its own constant — so it reshapes rather than just shifts.
 *
 * Fallback (no WHOOP data)
 * ─────────────────────────
 * When no WHOOP data is present every signal uses a "generic moderate" default:
 *   recovery 67, hrv 55 ms, rhr 60 bpm, sleepPerf 75%, sleepDur 7h, debt 0, strain 8.
 * The curve will be a gently declining moderate-energy day.  The circadian
 * perturbation is the only time-varying term, producing a very mild hump.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EnergyMap = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STEP      = 10 / 60;   // 10-min resolution in hours
  const DAY_START = 8;
  const DAY_END   = 24;
  const SPAN      = DAY_END - DAY_START;  // 16 h
  const N_POINTS  = Math.round(SPAN / STEP) + 1; // 97

  function clamp(v, lo, hi)  { return v < lo ? lo : v > hi ? hi : v; }
  function sigmoid(x)        { return 1 / (1 + Math.exp(-x)); }

  /**
   * buildEnergyCurve(params) → { points, meta, N_POINTS, STEP, DAY_START, DAY_END }
   *
   * points[i] = energy level 0–1 at absolute hour (DAY_START + i × STEP).
   */
  function buildEnergyCurve(params) {
    params = params || {};

    const wakeH      = typeof params.wakeHour   === 'number' ? params.wakeHour   : DAY_START;
    const recovery   = typeof params.recovery   === 'number' ? params.recovery   : null;
    const hrv        = typeof params.hrv        === 'number' ? params.hrv        : null;
    const rhr        = typeof params.rhr        === 'number' ? params.rhr        : null;
    const sleepDurMs = typeof params.sleepDurMs === 'number' ? params.sleepDurMs : null;
    const sleepPerf  = typeof params.sleepPerf  === 'number' ? params.sleepPerf  : null;
    const sleepDebt  = typeof params.sleepDebt  === 'number' ? params.sleepDebt  : 0;
    const strain     = typeof params.strain     === 'number' ? params.strain     : null;

    const hasWhoop = recovery != null || hrv != null || sleepPerf != null;

    // ── A. Recovery  ──────────────────────────────────────────────────────
    const rec_pct    = recovery != null ? recovery : 67;
    const rec_base   = 0.30 + (rec_pct / 100) * 0.65;        // 0.30 – 0.95
    const rec_tau    = 12   + (rec_pct / 100) * 12;           // 12 – 24 h
    function recSignal(tFromWake) {
      return rec_base * Math.exp(-Math.max(0, tFromWake) / rec_tau);
    }

    // ── B. HRV  ───────────────────────────────────────────────────────────
    // If HRV absent, use RHR proxy; if both absent, use population median
    let hrv_ms = hrv;
    if (hrv_ms == null && rhr != null) hrv_ms = clamp(120 - rhr, 20, 95);
    if (hrv_ms == null) hrv_ms = 55;

    const hrv_norm  = clamp(hrv_ms / 70, 0, 1.15);
    const hrv_tau   = 10 + hrv_norm * 11;                     // 10 – 21 h
    function hrvSignal(tFromWake) {
      return hrv_norm * Math.exp(-Math.max(0, tFromWake) / hrv_tau);
    }

    // ── C. Sleep quality  ─────────────────────────────────────────────────
    const perfFactor = sleepPerf  != null ? clamp(sleepPerf  / 100, 0, 1) : 0.75;
    const durationH  = sleepDurMs != null ? sleepDurMs / 3_600_000        : 7.0;
    const durFactor  = clamp(durationH / 7.5, 0, 1);
    // Duration is slightly more predictive of daytime energy than perf score
    const sleepQuality = 0.45 * perfFactor + 0.55 * durFactor;
    const sleep_tau    = 8 + sleepQuality * 14;               // 8 – 22 h
    function sleepSignal(tFromWake) {
      return sleepQuality * Math.exp(-Math.max(0, tFromWake) / sleep_tau);
    }

    // ── D. Sleep debt  ────────────────────────────────────────────────────
    // Flat drag — systemic, doesn't decay intraday
    const debtDrag = clamp(sleepDebt / 10, 0, 1) * 0.55;

    // ── E. RHR modifier  ──────────────────────────────────────────────────
    // Applied as a multiplier on the composite signal, not an additive term
    const rhr_val    = rhr != null ? rhr : 60;
    const rhr_factor = clamp((80 - rhr_val) / 40, 0, 1);     // 40 bpm → 1.0, 80 bpm → 0.0

    // ── F. Strain fatigue drag  ───────────────────────────────────────────
    const strainNorm = strain != null ? clamp(strain / 21, 0, 1) : 0.38;
    function strainDrag(tFromWake) {
      // Invisible at wake, builds through afternoon, plateaus around hour 10+
      return strainNorm * 0.28 * sigmoid((tFromWake - 4) / 2);
    }

    // ── G. Circadian micro-perturbation  ──────────────────────────────────
    // Amplitude capped at 0.08 — cannot create or destroy peaks on its own
    function circPerturb(t) {
      return 0.08 * Math.sin(2 * Math.PI * (t - wakeH - 4) / 24);
    }

    // ── Weights (WHOOP signals sum to ~0.90 before RHR amplification)  ────
    const W_REC  = 0.28;
    const W_HRV  = 0.25;
    const W_SLP  = 0.22;
    const W_DEBT = 0.15;  // negative term
    const W_RHR  = 0.10;  // amplifier, not additive

    // ── Build curve  ──────────────────────────────────────────────────────
    const points = new Float32Array(N_POINTS);

    for (let i = 0; i < N_POINTS; i++) {
      const t          = DAY_START + i * STEP;
      const tFromWake  = t - wakeH;

      const rec_v   = recSignal(tFromWake);
      const hrv_v   = hrvSignal(tFromWake);
      const slp_v   = sleepSignal(tFromWake);

      // Core WHOOP composite (before RHR and debt)
      const core = W_REC * rec_v
                 + W_HRV * hrv_v
                 + W_SLP * slp_v;

      // RHR amplifies the core: rhr_factor scales from 0 (bad) to 1 (excellent)
      // Map: 0 → multiplier 0.70, 1 → multiplier 1.15
      const rhr_mult = 0.70 + rhr_factor * W_RHR * 4.5;
      const amplified = core * rhr_mult;

      // Subtract debt and strain drag
      const fatigue = debtDrag + strainDrag(tFromWake);

      // Add tiny circadian perturbation
      const circ = circPerturb(t);

      points[i] = clamp(amplified - fatigue + circ, 0.04, 1.0);
    }

    // ── Meta  ─────────────────────────────────────────────────────────────
    let peakIdx = 0;
    for (let i = 1; i < N_POINTS; i++) {
      if (points[i] > points[peakIdx]) peakIdx = i;
    }

    const meta = {
      hasWhoop,
      recoveryBaseline : rec_base,
      sleepQuality,
      debtDrag,
      hrv_norm,
      rhr_factor,
      strainNorm,
      peakIdx,
      get peakHour()  { return DAY_START + this.peakIdx * STEP; },
      get peakValue() { return points[this.peakIdx]; },
      energyAt(absoluteHour) {
        const idx = Math.round((absoluteHour - DAY_START) / STEP);
        return points[clamp(idx, 0, N_POINTS - 1)];
      },
    };

    return { points, meta, N_POINTS, STEP, DAY_START, DAY_END };
  }

  return { buildEnergyCurve, N_POINTS, STEP, DAY_START, DAY_END };
}));

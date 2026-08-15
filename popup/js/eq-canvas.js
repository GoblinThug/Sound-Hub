/**
 * Canvas-based parametric EQ UI (replacement for Snap.svg #eqSvg / #gainSvg).
 */
(function (global) {
  const EQ_W = 640;
  /** Extra canvas width so the rightmost freq label can stay centered on its tick. */
  const EQ_PAD_R = 14;
  const CANVAS_W = EQ_W + EQ_PAD_R;
  const EQ_H = 300;
  const GAIN_W = 30;
  const GAIN_LABEL_H = 22;
  const GAIN_V_PAD_BOTTOM = 12;
  /** Bottom band for frequency axis labels (Hz). */
  const EQ_FREQ_LABEL_H = 22;
  /** Left band for dB axis labels — numbers, then tick marks to the right. */
  const EQ_DB_LABEL_W = 28;
  /** Fixed display axis max (matches original Ears popup — NOT audio sample rate). */
  const DISPLAY_MAX_HZ = 22050;
  const MIN_FREQ = 5;
  const MAX_FREQ = 20000;
  const MIN_DB = -30;
  const MAX_DB = 30;
  const MAX_MASTER_DB = 10;
  const HIT = 8;
  const RESET_ANIM_MS = 280;
  const SPECTRUM_EXIT_MS = 320;
  const DEFAULT_FILTER_FREQS = [20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480];
  const DEFAULT_FILTER_Q = 0.7071;
  /** Minimum blend toward background at the control point (dimmer curve strokes). */
  const CURVE_FADE_POWER = 2.1;
  const CURVE_ZERO_FADE_PX = 14;
  const CURVE_EDGE_FADE_PX = 72;

  function curveEdgeFade(x) {
    const left = Math.max(0, 1 - x / CURVE_EDGE_FADE_PX);
    const right = Math.max(0, 1 - (EQ_W - x) / CURVE_EDGE_FADE_PX);
    const edgeT = Math.max(left, right);
    return 1 - Math.pow(edgeT, 1.15);
  }

  function readCanvasBg() {
    const root = document.documentElement;
    const fromVar = getComputedStyle(root).getPropertyValue('--canvas-bg').trim();
    if (fromVar) return fromVar;
    const elevated = getComputedStyle(root).getPropertyValue('--bg-elevated').trim();
    return elevated || '#111116';
  }

  function readThemeColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function getEqColors() {
    return {
      grid: readThemeColor('--eq-grid', '#454552'),
      gridFaint: readThemeColor('--eq-grid-faint', 'rgba(69, 69, 82, 0.35)'),
      label: readThemeColor('--eq-label', '#9494a8'),
      peaking: readThemeColor('--eq-peaking', '#22d3ee'),
      shelf: readThemeColor('--eq-shelf', '#8b5cf6'),
      dotActive: readThemeColor('--eq-dot-active', '#000000'),
      gainHandle: readThemeColor('--eq-gain-handle', '#9494a8'),
    };
  }

  function te(x) {
    return Math.pow(x, 0.25);
  }

  function L(x) {
    return Math.pow(x, 4);
  }

  function freqToX(freq) {
    return te(Math.max(MIN_FREQ, freq) / DISPLAY_MAX_HZ) * EQ_W;
  }

  function xToFreq(x) {
    return L(Math.max(0, Math.min(EQ_W, x)) / EQ_W) * DISPLAY_MAX_HZ;
  }

  /** Web Audio AnalyserNode defaults (matches eq-engine analyser). */
  const SPECTRUM_MIN_DB = -100;
  const SPECTRUM_MAX_DB = -30;

  function sanitizeFftDb(db) {
    if (!Number.isFinite(db) || db >= 0) return SPECTRUM_MIN_DB;
    return Math.max(SPECTRUM_MIN_DB, Math.min(0, db));
  }

  function fftDbToNorm(db) {
    const v = sanitizeFftDb(db);
    return Math.max(0, Math.min(1, (v - SPECTRUM_MIN_DB) / (SPECTRUM_MAX_DB - SPECTRUM_MIN_DB)));
  }

  function fftDbAtHz(fft, sampleRate, hz) {
    if (!fft.length) return SPECTRUM_MIN_DB;
    const binF = (Math.max(MIN_FREQ, hz) * fft.length * 2) / sampleRate;
    const i0 = Math.max(0, Math.min(fft.length - 1, Math.floor(binF)));
    const i1 = Math.min(fft.length - 1, i0 + 1);
    const t = binF - i0;
    return sanitizeFftDb(fft[i0] * (1 - t) + fft[i1] * t);
  }

  function clampFreq(hz) {
    return Math.max(MIN_FREQ, Math.min(MAX_FREQ, hz));
  }

  function clampGainDb(db) {
    return Math.max(MIN_DB, Math.min(MAX_DB, db));
  }

  function syncFilterCoords(filter, h) {
    filter.frequency = clampFreq(filter.frequency);
    filter.gain = clampGainDb(filter.gain);
    filter.x = freqToX(filter.frequency);
    filter.y = dbToY(filter.gain, h);
  }

  function dbToY(db, h) {
    return h * (1 - (db - MIN_DB) / (MAX_DB - MIN_DB));
  }

  function yToDb(y, h) {
    return (1 - y / h) * (MAX_DB - MIN_DB) + MIN_DB;
  }

  /** Master volume axis: full slider height maps to MIN_DB..MAX_MASTER_DB. */
  function gainDbToY(db, h) {
    return h * (1 - (db - MIN_DB) / (MAX_MASTER_DB - MIN_DB));
  }

  function gainYToDb(y, h) {
    return (1 - y / h) * (MAX_MASTER_DB - MIN_DB) + MIN_DB;
  }

  function linearToDb(linear) {
    return 10 * Math.log10(linear);
  }

  function dbToLinear(db) {
    return Math.pow(10, db / 10);
  }

  function clampQ(q) {
    return Math.max(0.2, Math.min(11, q));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /** Magnitude response polyline points for one filter (from original Ears math). */
  function filterCurvePoints(filter, sampleRate, h, options) {
    const type = filter.type;
    const r = filter.frequency;
    const a = filter.q;
    const i = filter.gain;
    const o = Math.tan((Math.PI * r) / sampleRate);
    let s = 1 / (1 + (1 / a) * o + o * o);
    const c = Math.pow(10, Math.abs(i) / 20);
    let u = 0,
      l = 0,
      f = 0,
      v = 0,
      d = 0;

    if (type === 'peaking') {
      if (i >= 0) {
        u = (1 + (c / a) * o + o * o) * s;
        l = 2 * (o * o - 1) * s;
        f = (1 - (c / a) * o + o * o) * s;
        v = l;
        d = (1 - (1 / a) * o + o * o) * s;
      } else {
        s = 1 / (1 + (c / a) * o + o * o);
        u = (1 + (1 / a) * o + o * o) * s;
        l = 2 * (o * o - 1) * s;
        f = (1 - (1 / a) * o + o * o) * s;
        v = l;
        d = (1 - (c / a) * o + o * o) * s;
      }
    } else if (type === 'highshelf') {
      if (i >= 0) {
        s = 1 / (1 + Math.SQRT2 * o + o * o);
        u = (c + Math.sqrt(2 * c) * o + o * o) * s;
        l = 2 * (o * o - c) * s;
        f = (c - Math.sqrt(2 * c) * o + o * o) * s;
        v = 2 * (o * o - 1) * s;
        d = (1 - Math.SQRT2 * o + o * o) * s;
      } else {
        s = 1 / (c + Math.sqrt(2 * c) * o + o * o);
        u = (1 + Math.SQRT2 * o + o * o) * s;
        l = 2 * (o * o - 1) * s;
        f = (1 - Math.SQRT2 * o + o * o) * s;
        v = 2 * (o * o - c) * s;
        d = (c - Math.sqrt(2 * c) * o + o * o) * s;
      }
    } else if (type === 'lowshelf') {
      if (i >= 0) {
        s = 1 / (1 + Math.SQRT2 * o + o * o);
        u = (1 + Math.sqrt(2 * c) * o + c * o * o) * s;
        l = 2 * (c * o * o - 1) * s;
        f = (1 - Math.sqrt(2 * c) * o + c * o * o) * s;
        v = 2 * (o * o - 1) * s;
        d = (1 - Math.SQRT2 * o + o * o) * s;
      } else {
        s = 1 / (1 + Math.sqrt(2 * c) * o + c * o * o);
        u = (1 + Math.SQRT2 * o + o * o) * s;
        l = 2 * (o * o - 1) * s;
        f = (1 - Math.SQRT2 * o + o * o) * s;
        v = 2 * (c * o * o - 1) * s;
        d = (1 - Math.sqrt(2 * c) * o + c * o * o) * s;
      }
    }

    const pts = [];
    const midY = dbToY(0, h);
    const continuous = !!(options && options.continuous);
    for (let gx = 0; gx < EQ_W; gx += 2) {
      const p = L(gx / EQ_W) * Math.PI;
      const y = Math.pow(Math.sin(p / 2), 2);
      let M =
        Math.log(
          (Math.pow(u + l + f, 2) -
            4 * (u * l + 4 * u * f + l * f) * y +
            16 * u * f * y * y) /
            (Math.pow(1 + v + d, 2) -
              4 * (v + 4 * d + v * d) * y +
              16 * d * y * y)
        ) *
        (10 / Math.LN10);
      let py = dbToY(M, h);
      if (!Number.isFinite(py)) py = h - 1;
      py = Math.max(0, Math.min(h - 1, py));
      // Keep the full response path; flat parts are hidden by alpha fade when drawing
      // so tips dissolve instead of ending as hard stumps.
      if (!continuous && Math.abs(py - midY) <= 0.35) continue;
      pts.push(gx, py);
    }
    return pts;
  }

  function filterColor(type) {
    const colors = getEqColors();
    return type === 'peaking' ? colors.peaking : colors.shelf;
  }

  /** Ears layout: index 0 = lowshelf, last = highshelf, middle = peaking. */
  function resolveFilterType(filter, index, total) {
    if (index === 0) return 'lowshelf';
    if (total > 1 && index === total - 1) return 'highshelf';
    return 'peaking';
  }

  function drawBottomFreqLabel(ctx, f, x, y) {
    const label = String(f);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    const halfW = ctx.measureText(label).width / 2;
    const drawX = Math.max(EQ_DB_LABEL_W + halfW + 1, x);
    ctx.fillText(label, drawX, y);
  }

  function parseHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function hexToRgba(hex, alpha) {
    const { r, g, b } = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Light spatial smoothing so the analyzer line feels fluid, not jagged. */
  function smoothSpectrumPoints(pts, passes = 1) {
    if (pts.length < 3) return pts;
    let out = pts.map((p) => [p[0], p[1]]);
    for (let pass = 0; pass < passes; pass++) {
      const next = [out[0]];
      for (let i = 1; i < out.length - 1; i++) {
        next.push([out[i][0], (out[i - 1][1] + out[i][1] * 2 + out[i + 1][1]) / 4]);
      }
      next.push(out[out.length - 1]);
      out = next;
    }
    return out;
  }

  function traceSmoothLine(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) {
      ctx.lineTo(pts[1][0], pts[1][1]);
      return;
    }
    for (let i = 1; i < pts.length - 2; i++) {
      const xc = (pts[i][0] + pts[i + 1][0]) / 2;
      const yc = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
    }
    const n = pts.length;
    ctx.quadraticCurveTo(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1]);
  }

  /** Subtle themed analyzer: soft fill + faint glow stroke, clipped to the plot area.
   *  @param {number} [exitT=1] 1 = full height, 0 = collapsed to floor */
  function drawSpectrum(ctx, pts, h, exitT = 1) {
    if (!pts || pts.length < 2 || exitT <= 0) return;
    const colors = getEqColors();
    const visibility = Math.max(0, Math.min(1, exitT));

    const plotLeft = 0;
    const plotRight = EQ_W;
    const floorY = h - EQ_FREQ_LABEL_H;
    const drawn = pts.map(([x, y]) => [x, y + (floorY - y) * (1 - visibility)]);
    const peakY = Math.max(0, Math.min(...drawn.map((p) => p[1])));

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, 0, plotRight, floorY);
    ctx.clip();
    ctx.globalAlpha = 0.35 + 0.65 * visibility;

    ctx.beginPath();
    traceSmoothLine(ctx, drawn);
    ctx.lineTo(drawn[drawn.length - 1][0], floorY);
    ctx.lineTo(drawn[0][0], floorY);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, peakY, 0, floorY);
    fillGrad.addColorStop(0, hexToRgba(colors.peaking, 0.22 * visibility));
    fillGrad.addColorStop(0.45, hexToRgba(colors.shelf, 0.1 * visibility));
    fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.beginPath();
    traceSmoothLine(ctx, drawn);
    ctx.strokeStyle = hexToRgba(colors.peaking, 0.1 * visibility);
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    traceSmoothLine(ctx, drawn);
    ctx.strokeStyle = hexToRgba(colors.peaking, 0.32 * visibility);
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.restore();
  }

  /** Soft fill under the curve toward the 0 dB center line. */
  function fillCurveShadowToZero(ctx, pts, anchorX, anchorY, color, zeroY, fadeDist, options) {
    const keepNearZero = !!(options && options.keepNearZero);
    for (let i = 0; i < pts.length - 2; i += 2) {
      const x1 = pts[i];
      const y1 = pts[i + 1];
      const x2 = pts[i + 2];
      const y2 = pts[i + 3];
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      const dist = Math.hypot(mx - anchorX, my - anchorY);
      const distT = Math.min(1, dist / Math.max(1, fadeDist));
      const distFade = Math.pow(distT, CURVE_FADE_POWER);
      let strength = (1 - distFade) * curveEdgeFade(mx);

      const nearZero = Math.min(Math.abs(y1 - zeroY), Math.abs(y2 - zeroY), Math.abs(my - zeroY));
      if (!keepNearZero) {
        const zeroT = Math.max(0, 1 - nearZero / CURVE_ZERO_FADE_PX);
        strength *= 1 - Math.pow(zeroT, 1.35);
      }
      if (strength < 0.03) continue;

      const avgY = (y1 + y2) * 0.5;
      const grad = ctx.createLinearGradient(mx, avgY, mx, zeroY);
      grad.addColorStop(0, hexToRgba(color, 0.18 * strength));
      grad.addColorStop(0.5, hexToRgba(color, 0.06 * strength));
      grad.addColorStop(1, hexToRgba(color, 0));

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, zeroY);
      ctx.lineTo(x1, zeroY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /** Draw filter curve fading to transparent at the tips (no hard stumps). */
  function strokeCurveWithPointFade(ctx, pts, anchorX, anchorY, color, fadeDist, options) {
    const emphasis = !!(options && options.emphasis);
    const zeroY = options && typeof options.zeroY === 'number' ? options.zeroY : null;
    ctx.lineWidth = emphasis ? 1.45 : 1.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const peakAlpha = emphasis ? 0.95 : 0.78;

    for (let i = 0; i < pts.length - 2; i += 2) {
      const x1 = pts[i];
      const y1 = pts[i + 1];
      const x2 = pts[i + 2];
      const y2 = pts[i + 3];
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      const dist = Math.hypot(mx - anchorX, my - anchorY);
      const distT = Math.min(1, dist / Math.max(1, fadeDist));
      // Ease stays solid near the node, then dissolves fully at the tips.
      const distFade = Math.pow(distT, CURVE_FADE_POWER);

      let alpha = peakAlpha * (1 - distFade) * curveEdgeFade(mx);
      if (zeroY != null) {
        const nearZero = Math.min(Math.abs(y1 - zeroY), Math.abs(y2 - zeroY), Math.abs(my - zeroY));
        const zeroT = Math.max(0, 1 - nearZero / CURVE_ZERO_FADE_PX);
        alpha *= 1 - Math.pow(zeroT, 1.25);
      }
      if (alpha < 0.025) continue;

      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  class EqCanvasView {
    /**
     * @param {object} opts
     * @param {HTMLCanvasElement} opts.eqCanvas
     * @param {HTMLCanvasElement} opts.gainCanvas
     * @param {(msg: object, cb?: Function) => void} opts.sendMessage
     * @param {() => void} opts.requestRefresh
     */
    constructor(opts) {
      this.eqCanvas = opts.eqCanvas;
      this.gainCanvas = opts.gainCanvas;
      this.eqCtx = this.eqCanvas.getContext('2d');
      this.gainCtx = this.gainCanvas.getContext('2d');
      this.sendMessage = opts.sendMessage;
      this.requestRefresh = opts.requestRefresh;

      this.sampleRate = 44100;
      this.filters = [];
      this.master = { gain: 1, y: 0 };
      this.showVisualizer = false;
      this.spectrumPoints = null;
      this._spectrumExitT = 1;
      this._spectrumExitId = null;
      this.drag = null;
      this._resetAnimId = null;
      this._resetAnimFilterIndex = null;
      this._logicalEqH = EQ_H;
      this._logicalGainH = EQ_H - GAIN_LABEL_H - GAIN_V_PAD_BOTTOM;
      this._pixelRatio = 1;

      this._bindEvents(this.eqCanvas);
      this._bindEvents(this.gainCanvas);
      this._syncCanvasSize();
      this.master.y = gainDbToY(linearToDb(1), this._gainH());

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          this._syncCanvasSize();
          this.render();
        });
        this._resizeObserver.observe(this.eqCanvas.parentElement);
      }
    }

    get canvasH() {
      return this._logicalEqH || EQ_H;
    }

    _gainH() {
      return this._logicalGainH || this.canvasH - GAIN_LABEL_H - GAIN_V_PAD_BOTTOM;
    }

    _getPixelRatio() {
      let ratio = window.devicePixelRatio || 1;
      if (document.body.classList.contains('is-fullscreen-tab')) {
        const fs = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--fs-scale')
        );
        if (Number.isFinite(fs) && fs > 1) ratio *= fs;
      }
      return ratio;
    }

    _syncCanvasSize() {
      const stage = this.eqCanvas.parentElement;
      if (!stage) return;
      const logicalEqH = Math.max(1, stage.clientHeight);
      const logicalGainH = Math.max(1, logicalEqH - GAIN_LABEL_H - GAIN_V_PAD_BOTTOM);
      const pr = this._getPixelRatio();
      const eqBW = Math.round(CANVAS_W * pr);
      const eqBH = Math.round(logicalEqH * pr);
      const gainBW = Math.round(GAIN_W * pr);
      const gainBH = Math.round(logicalGainH * pr);

      if (
        this._logicalEqH === logicalEqH &&
        this._pixelRatio === pr &&
        this.eqCanvas.width === eqBW &&
        this.eqCanvas.height === eqBH
      ) {
        return;
      }

      const eqHeightChanged = this._logicalEqH !== logicalEqH;
      this._logicalEqH = logicalEqH;
      this._logicalGainH = logicalGainH;
      this._pixelRatio = pr;

      this.eqCanvas.width = eqBW;
      this.eqCanvas.height = eqBH;
      this.gainCanvas.width = gainBW;
      this.gainCanvas.height = gainBH;
      this.eqCtx.setTransform(pr, 0, 0, pr, 0, 0);
      this.gainCtx.setTransform(pr, 0, 0, pr, 0, 0);

      if (this.master) {
        this.master.y = gainDbToY(linearToDb(this.master.gain), logicalGainH);
      }
      if (eqHeightChanged && this.filters.length) {
        this.filters.forEach((filter) => syncFilterCoords(filter, logicalEqH));
      }
    }

    setSampleRate(fs) {
      if (fs && fs > 0) this.sampleRate = fs;
    }

    setShowVisualizer(on) {
      const want = !!on;
      if (want) {
        this._cancelSpectrumExit();
        this.showVisualizer = true;
        this._spectrumExitT = 1;
        this.render();
        return;
      }

      this.showVisualizer = false;
      if (!this.spectrumPoints || this.spectrumPoints.length < 2) {
        this._cancelSpectrumExit();
        this.spectrumPoints = null;
        this._spectrumExitT = 0;
        this.render();
        return;
      }
      this._startSpectrumExit();
    }

    _cancelSpectrumExit() {
      if (this._spectrumExitId != null) {
        cancelAnimationFrame(this._spectrumExitId);
        this._spectrumExitId = null;
      }
    }

    _startSpectrumExit() {
      this._cancelSpectrumExit();
      const start = performance.now();
      const from = this._spectrumExitT > 0 ? this._spectrumExitT : 1;
      const tick = (now) => {
        const linear = Math.min(1, (now - start) / SPECTRUM_EXIT_MS);
        this._spectrumExitT = from * (1 - easeOutCubic(linear));
        this.render();
        if (linear < 1) {
          this._spectrumExitId = requestAnimationFrame(tick);
          return;
        }
        this._spectrumExitId = null;
        this._spectrumExitT = 0;
        this.spectrumPoints = null;
        this.render();
      };
      this._spectrumExitId = requestAnimationFrame(tick);
    }

    /** Collapse the overlay without changing the visualizer toggle state. */
    collapseSpectrum() {
      if (this._spectrumExitId != null) return;
      if (!this.spectrumPoints || this.spectrumPoints.length < 2) {
        this.spectrumPoints = null;
        this._spectrumExitT = 0;
        this.render();
        return;
      }
      this._startSpectrumExit();
    }

    /** @param {Array<{frequency,gain,type,q}>} eqFilters */
    /** @param {number} masterLinear */
    setWorkspace(eqFilters, masterLinear) {
      if (this._resetAnimId != null) return;

      this.filters = (eqFilters || []).map((f, index, arr) => {
        const filter = {
          frequency: f.frequency,
          gain: f.gain,
          type: resolveFilterType(f, index, arr.length),
          q: f.q,
          x: 0,
          y: 0,
        };
        syncFilterCoords(filter, this.canvasH);
        return filter;
      });
      const linear = masterLinear ?? 1;
      this.master.gain = linear;
      this.master.y = gainDbToY(linearToDb(linear), this._gainH());
      this.render();
    }

    /** @param {number[]} fft */
    setSpectrum(fft) {
      if (this._spectrumExitId != null) return;

      if (!this.showVisualizer || !fft || !fft.length) {
        this.spectrumPoints = null;
        this.render();
        return;
      }

      const h = this.canvasH;
      const plotLeft = 0;
      const plotRight = EQ_W;
      const floorY = h - EQ_FREQ_LABEL_H - 1;
      const step = 2;
      const pts = [];

      for (let x = plotLeft; x <= plotRight; x += step) {
        const hz = clampFreq(xToFreq(x));
        const db = fftDbAtHz(fft, this.sampleRate, hz);
        const norm = fftDbToNorm(db);
        const y = floorY - norm * (floorY - 8);
        pts.push([x, y]);
      }

      if (pts.length) {
        pts[0][0] = plotLeft;
        pts[pts.length - 1][0] = plotRight;
      }

      this.spectrumPoints = smoothSpectrumPoints(pts, 1);
      this._spectrumExitT = 1;
      this.render();
    }

    render() {
      this._syncCanvasSize();
      this._drawEq();
      this._drawGain();
    }

    _drawEq() {
      const ctx = this.eqCtx;
      const h = this.canvasH;
      const bg = readCanvasBg();
      ctx.clearRect(0, 0, CANVAS_W, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, h);

      drawSpectrum(ctx, this.spectrumPoints, h, this._spectrumExitT);
      this._drawEqGrid(ctx, h);

      const curveFadeDist = Math.hypot(EQ_W, h) * 0.42;
      const zeroY = dbToY(0, h);
      const activeIndex =
        this.drag && this.drag.kind === 'filter' ? this.drag.index : -1;

      const drawFilterCurve = (filter, index, active) => {
        if (this._resetAnimFilterIndex !== index) {
          syncFilterCoords(filter, this.canvasH);
        }
        filter.type = resolveFilterType(filter, index, this.filters.length);
        if (!active && Math.abs(filter.gain) < 0.05) return;
        const pts = filterCurvePoints(filter, this.sampleRate, h, {
          continuous: true,
        });
        const color = filterColor(filter.type);
        if (pts.length < 4) return;
        fillCurveShadowToZero(ctx, pts, filter.x, filter.y, color, zeroY, curveFadeDist, {
          keepNearZero: active,
        });
        strokeCurveWithPointFade(ctx, pts, filter.x, filter.y, color, curveFadeDist, {
          emphasis: active,
          zeroY,
        });
      };

      // Inactive threads first, then the dragged one above the 0 dB axis.
      this.filters.forEach((filter, index) => {
        if (index === activeIndex) return;
        drawFilterCurve(filter, index, false);
      });
      if (activeIndex >= 0 && this.filters[activeIndex]) {
        drawFilterCurve(this.filters[activeIndex], activeIndex, true);
      }

      this.filters.forEach((filter, index) => {
        if (index === activeIndex) return;
        if (this._resetAnimFilterIndex !== index) {
          syncFilterCoords(filter, h);
        }
        filter.type = resolveFilterType(filter, index, this.filters.length);
        const color = filterColor(filter.type);
        ctx.beginPath();
        ctx.arc(filter.x, filter.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      if (activeIndex >= 0 && this.filters[activeIndex]) {
        const filter = this.filters[activeIndex];
        if (this._resetAnimFilterIndex !== activeIndex) {
          syncFilterCoords(filter, h);
        }
        filter.type = resolveFilterType(filter, activeIndex, this.filters.length);
        const color = filterColor(filter.type);
        const colors = getEqColors();
        ctx.beginPath();
        ctx.arc(filter.x, filter.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = colors.dotActive;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    _drawEqGrid(ctx, h) {
      const colors = getEqColors();
      ctx.strokeStyle = colors.gridFaint;
      ctx.fillStyle = colors.label;
      ctx.font = '10px Inter, system-ui, sans-serif';

      let lastLabelX = -999;
      let lastTickFreq = 5;
      const minLabelGap = 26;
      const labelY = h - 7;

      for (let f = 5; f <= DISPLAY_MAX_HZ; f *= 2) {
        lastTickFreq = f;
        const x = freqToX(f);
        ctx.beginPath();
        ctx.moveTo(x, h / 2 + 10);
        ctx.lineTo(x, h / 2 - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, h - EQ_FREQ_LABEL_H);
        ctx.lineTo(x, h - EQ_FREQ_LABEL_H - 10);
        ctx.strokeStyle = colors.grid;
        ctx.stroke();
        ctx.strokeStyle = colors.gridFaint;

        if (x - lastLabelX >= minLabelGap) {
          drawBottomFreqLabel(ctx, f, x, labelY);
          lastLabelX = x;
        }

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 15);
        ctx.strokeStyle = colors.grid;
        ctx.stroke();
        ctx.strokeStyle = colors.gridFaint;
      }

      drawBottomFreqLabel(ctx, lastTickFreq, freqToX(lastTickFreq), labelY);

      for (let db = MIN_DB; db <= MAX_DB; db += 5) {
        if (MAX_DB - Math.abs(db) <= 2.5) continue;
        if (db === 0) continue;
        const y = dbToY(db, h);
        if (y > h - EQ_FREQ_LABEL_H - 4) continue;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(db), EQ_DB_LABEL_W - 5, y);

        ctx.beginPath();
        ctx.moveTo(EQ_DB_LABEL_W, y);
        ctx.lineTo(EQ_DB_LABEL_W + 10, y);
        ctx.strokeStyle = colors.grid;
        ctx.stroke();
      }

      const zeroY = dbToY(0, h);
      ctx.beginPath();
      ctx.moveTo(EQ_DB_LABEL_W, zeroY);
      ctx.lineTo(EQ_W, zeroY);
      ctx.strokeStyle = colors.gridFaint;
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('0', EQ_DB_LABEL_W - 5, zeroY);

      ctx.beginPath();
      ctx.moveTo(EQ_DB_LABEL_W, zeroY);
      ctx.lineTo(EQ_DB_LABEL_W + 10, zeroY);
      ctx.strokeStyle = colors.grid;
      ctx.stroke();
    }

    _drawGain() {
      const ctx = this.gainCtx;
      const h = this._gainH();
      const colors = getEqColors();
      const bg = readCanvasBg();
      ctx.clearRect(0, 0, GAIN_W, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, GAIN_W, h);

      ctx.strokeStyle = colors.grid;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(GAIN_W / 2, 0);
      ctx.lineTo(GAIN_W / 2, h);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const zeroY = gainDbToY(0, h);
      ctx.beginPath();
      ctx.moveTo(GAIN_W / 2 - 5, zeroY);
      ctx.lineTo(GAIN_W / 2 + 5, zeroY);
      ctx.strokeStyle = colors.grid;
      ctx.stroke();

      const y = this.master.y;
      ctx.strokeStyle = colors.gainHandle;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(GAIN_W - 2, y);
      ctx.stroke();
    }

    _bindEvents(canvas) {
      canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
      canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
      canvas.addEventListener('pointercancel', (e) => this._onPointerUp(e));
      canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
    }

    _canvasPos(canvas, e) {
      const r = canvas.getBoundingClientRect();
      const logicalW = canvas === this.eqCanvas ? CANVAS_W : GAIN_W;
      const logicalH = canvas === this.eqCanvas ? this.canvasH : this._gainH();
      return {
        x: ((e.clientX - r.left) / r.width) * logicalW,
        y: ((e.clientY - r.top) / r.height) * logicalH,
      };
    }

    _hitFilter(x, y) {
      for (let i = this.filters.length - 1; i >= 0; i--) {
        const f = this.filters[i];
        const dx = x - f.x;
        const dy = y - f.y;
        if (dx * dx + dy * dy <= (HIT + 4) * (HIT + 4)) return i;
      }
      return -1;
    }

    _onPointerDown(e) {
      e.preventDefault();
      this._cancelResetAnim();
      e.target.setPointerCapture(e.pointerId);

      if (e.target === this.gainCanvas) {
        const { y } = this._canvasPos(this.gainCanvas, e);
        if (Math.abs(y - this.master.y) <= HIT + 4 || true) {
          this.drag = { kind: 'gain', startY: y };
          this._setGainY(y);
        }
        return;
      }

      const { x, y } = this._canvasPos(this.eqCanvas, e);
      const idx = this._hitFilter(x, y);
      if (idx >= 0) {
        this.drag = { kind: 'filter', index: idx, shift: e.shiftKey };
        return;
      }
    }

    _onPointerMove(e) {
      if (!this.drag) return;
      e.preventDefault();

      if (this.drag.kind === 'gain') {
        const { y } = this._canvasPos(this.gainCanvas, e);
        this._setGainY(y);
        return;
      }

      if (this.drag.kind === 'filter') {
        const f = this.filters[this.drag.index];
        const h = this.canvasH;
        if (e.shiftKey) {
          f.q = clampQ(f.q - e.movementY / 10);
        } else {
          const { x, y } = this._canvasPos(this.eqCanvas, e);
          f.frequency = clampFreq(xToFreq(x));
          f.gain = clampGainDb(yToDb(y, h));
          syncFilterCoords(f, h);
        }
        this.sendMessage({
          type: 'modifyFilter',
          index: this.drag.index,
          frequency: f.frequency,
          gain: f.gain,
          q: f.q,
        });
        this.render();
      }
    }

    _onPointerUp(e) {
      if (!this.drag) return;
      e.preventDefault();

      if (this.drag.kind === 'gain') {
        this.sendMessage({ type: 'gainUpdated', gain: this.master.gain });
        this.requestRefresh();
      } else if (this.drag.kind === 'filter') {
        const f = this.filters[this.drag.index];
        this.sendMessage({
          type: 'filterUpdated',
          filterType: f.type,
          frequency: f.frequency,
          gain: f.gain,
          q: f.q,
        });
        this.requestRefresh();
      }
      this.drag = null;
      this.render();
    }

    _onDblClick(e) {
      e.preventDefault();

      if (e.target === this.gainCanvas) {
        this._resetMasterGainAnimated();
        return;
      }

      if (e.target !== this.eqCanvas) return;
      const { x, y } = this._canvasPos(this.eqCanvas, e);
      const idx = this._hitFilter(x, y);
      if (idx < 0) return;
      this._resetFilterAnimated(idx);
    }

    _cancelResetAnim() {
      if (this._resetAnimId != null) {
        cancelAnimationFrame(this._resetAnimId);
        this._resetAnimId = null;
      }
      this._resetAnimFilterIndex = null;
    }

    _runResetAnim(onFrame, onDone) {
      this._cancelResetAnim();
      const start = performance.now();
      const tick = (now) => {
        const t = easeOutCubic(Math.min(1, (now - start) / RESET_ANIM_MS));
        onFrame(t);
        this.render();
        if (t < 1) {
          this._resetAnimId = requestAnimationFrame(tick);
        } else {
          this._resetAnimId = null;
          onDone();
        }
      };
      this._resetAnimId = requestAnimationFrame(tick);
    }

    _applyMasterY(y) {
      const h = this._gainH();
      const clampedY = Math.max(0, Math.min(h - 1, y));
      this.master.y = clampedY;
      const db = Math.max(MIN_DB, Math.min(MAX_MASTER_DB, gainYToDb(clampedY, h)));
      this.master.gain = dbToLinear(db);
    }

    _resetMasterGainAnimated() {
      const h = this._gainH();
      const fromY = this.master.y;
      const toY = gainDbToY(0, h);
      const targetGain = dbToLinear(0);
      if (Math.abs(fromY - toY) < 0.5) {
        this._applyMasterY(toY);
        this.render();
        this.sendMessage({ type: 'modifyGain', gain: targetGain, smooth: true });
        this.sendMessage({ type: 'gainUpdated', gain: targetGain });
        this.requestRefresh();
        return;
      }

      this.sendMessage({ type: 'modifyGain', gain: targetGain, smooth: true });
      this._runResetAnim(
        (t) => {
          this._applyMasterY(fromY + (toY - fromY) * t);
        },
        () => {
          this._applyMasterY(toY);
          this.sendMessage({ type: 'gainUpdated', gain: this.master.gain });
          this.requestRefresh();
        }
      );
    }

    _resetFilterAnimated(index) {
      const filter = this.filters[index];
      if (!filter) return;

      const h = this.canvasH;
      const targetFreq = DEFAULT_FILTER_FREQS[index] ?? filter.frequency;
      const fromFreq = filter.frequency;
      const fromGain = filter.gain;
      const fromQ = filter.q;
      const fromX = filter.x;
      const fromY = filter.y;
      const targetGain = 0;
      const targetQ = DEFAULT_FILTER_Q;
      const targetX = freqToX(targetFreq);
      const targetY = dbToY(targetGain, h);

      if (
        Math.abs(fromGain - targetGain) < 0.01 &&
        Math.abs(fromFreq - targetFreq) < 0.5 &&
        Math.abs(fromQ - targetQ) < 0.01
      ) {
        this.sendMessage({ type: 'resetFilter', index, smooth: true });
        return;
      }

      this._resetAnimFilterIndex = index;
      this.sendMessage({
        type: 'modifyFilter',
        index,
        frequency: targetFreq,
        gain: targetGain,
        q: targetQ,
        smooth: true,
      });

      this._runResetAnim(
        (t) => {
          filter.frequency = fromFreq + (targetFreq - fromFreq) * t;
          filter.gain = fromGain + (targetGain - fromGain) * t;
          filter.q = fromQ + (targetQ - fromQ) * t;
          filter.x = fromX + (targetX - fromX) * t;
          filter.y = fromY + (targetY - fromY) * t;
        },
        () => {
          filter.frequency = targetFreq;
          filter.gain = targetGain;
          filter.q = targetQ;
          syncFilterCoords(filter, h);
          this._resetAnimFilterIndex = null;
          this.render();
        }
      );
    }

    _setGainY(y) {
      this._applyMasterY(y);
      this.sendMessage({ type: 'modifyGain', gain: this.master.gain });
      this.render();
    }
  }

  global.EqCanvasView = EqCanvasView;
})(typeof window !== 'undefined' ? window : self);

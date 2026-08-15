/**
 * Normalize preset JSON from SoundHub/Ears and third-party apps (e.g. Airs).
 * Output: { [name]: { frequencies: number[11], gains: number[11], qs: number[11] } }
 */
(function (global) {
  const BAND_COUNT = 11;
  const DEFAULT_FREQS = [20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480];
  const DEFAULT_QS = [0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071, 0.7071];

  function toNumberMap(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value === 'object') {
      return Object.keys(value)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => Number(value[key]));
    }
    return [];
  }

  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function fitBands(frequencies, gains, qs) {
    let f = frequencies.slice();
    let g = gains.slice();
    let q = qs.slice();

    // Airs uses 13 nodes; first two are ultra-low (≈5/10 Hz) and map to Ears' 11 bands via indices 2..12.
    if (f.length === 13 && f[0] <= 20 && f[1] <= 40) {
      f = f.slice(2);
      g = g.slice(2);
      q = q.slice(2);
    }

    if (f.length > BAND_COUNT) {
      f = f.slice(0, BAND_COUNT);
      g = g.slice(0, BAND_COUNT);
      q = q.slice(0, BAND_COUNT);
    }

    while (f.length < BAND_COUNT) {
      const i = f.length;
      f.push(DEFAULT_FREQS[i]);
      g.push(0);
      q.push(DEFAULT_QS[i]);
    }

    return {
      frequencies: f.map((v, i) => clamp(Number(v) || DEFAULT_FREQS[i], 5, 20000)),
      gains: g.map((v) => clamp(Number(v) || 0, -30, 30)),
      qs: q.map((v, i) => clamp(Number(v) || DEFAULT_QS[i], 0.2, 11)),
    };
  }

  function isNativePreset(value) {
    return (
      value &&
      typeof value === 'object' &&
      (Array.isArray(value.frequencies) || typeof value.frequencies === 'object') &&
      (Array.isArray(value.gains) || typeof value.gains === 'object')
    );
  }

  function isAirsPreset(value) {
    return (
      value &&
      typeof value === 'object' &&
      (value.nodeGainValues || value.nodeFrequencyValues || value.nodeBaseQValues)
    );
  }

  function fromNativePreset(raw) {
    const frequencies = toNumberMap(raw.frequencies);
    const gains = toNumberMap(raw.gains);
    const qs = toNumberMap(raw.qs && (Array.isArray(raw.qs) || typeof raw.qs === 'object') ? raw.qs : DEFAULT_QS);
    return fitBands(frequencies, gains, qs.length ? qs : DEFAULT_QS.slice());
  }

  function fromAirsPreset(raw) {
    const frequencies = toNumberMap(raw.nodeFrequencyValues);
    const gains = toNumberMap(raw.nodeGainValues);
    const qs = toNumberMap(raw.nodeBaseQValues);
    return fitBands(frequencies, gains, qs);
  }

  function uniqueName(base, used) {
    let name = String(base || 'Imported').trim() || 'Imported';
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    let i = 2;
    while (used.has(`${name} (${i})`)) i += 1;
    const next = `${name} (${i})`;
    used.add(next);
    return next;
  }

  function addPreset(out, used, name, bands) {
    if (!bands || !bands.frequencies || !bands.gains) return;
    out[uniqueName(name, used)] = bands;
  }

  /**
   * @param {unknown} raw
   * @param {{ fileName?: string }} [options]
   * @returns {{ presets: Record<string, {frequencies:number[], gains:number[], qs:number[]}>, count: number, format: string }}
   */
  function normalizePresets(raw, options) {
    const out = {};
    const used = new Set();
    let format = 'unknown';
    const fileBase = (options && options.fileName ? String(options.fileName) : '')
      .replace(/\.[^.]+$/, '')
      .trim();

    if (Array.isArray(raw)) {
      format = 'airs-array';
      raw.forEach((item, index) => {
        if (isAirsPreset(item)) {
          addPreset(out, used, item.name || `Preset ${index + 1}`, fromAirsPreset(item));
        } else if (isNativePreset(item)) {
          addPreset(out, used, item.name || `Preset ${index + 1}`, fromNativePreset(item));
        }
      });
    } else if (raw && typeof raw === 'object') {
      if (isAirsPreset(raw)) {
        format = 'airs-single';
        addPreset(out, used, raw.name || fileBase || 'Imported', fromAirsPreset(raw));
      } else if (isNativePreset(raw)) {
        format = 'ears-single';
        addPreset(out, used, raw.name || fileBase || 'Imported', fromNativePreset(raw));
      } else {
        // Native Ears / SoundHub map: { "Name": { frequencies, gains, qs }, ... }
        format = 'ears-map';
        Object.keys(raw).forEach((key) => {
          const value = raw[key];
          if (isAirsPreset(value)) {
            addPreset(out, used, value.name || key, fromAirsPreset(value));
          } else if (isNativePreset(value)) {
            addPreset(out, used, key, fromNativePreset(value));
          }
        });
      }
    }

    return {
      presets: out,
      count: Object.keys(out).length,
      format,
    };
  }

  global.SoundHubPresetImport = {
    BAND_COUNT,
    normalizePresets,
    fitBands,
    fromAirsPreset,
    fromNativePreset,
  };
})(typeof window !== 'undefined' ? window : self);

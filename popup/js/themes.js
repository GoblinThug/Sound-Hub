/**
 * App color themes — applied via CSS custom properties on :root.
 */
(function (global) {
  const THEME_KEY = 'COLOR_THEME';
  const DEFAULT_THEME_ID = 'soundhub';

  function hexAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const THEMES = [
    {
      id: 'soundhub',
      name: 'SoundHub',
      swatch: ['#46b5ff', '#8b5cf6'],
      vars: {
        '--bg': '#09090b',
        '--bg-elevated': '#111116',
        '--surface': '#18181f',
        '--surface-2': '#1f1f28',
        '--surface-hover': '#282832',
        '--primary': '#6366f1',
        '--primary-hover': '#818cf8',
        '--primary-soft': 'rgba(99, 102, 241, 0.14)',
        '--primary-gradient-start': '#7074ff',
        '--primary-gradient-end': '#6366f1',
        '--accent': '#46b5ff',
        '--accent-soft': hexAlpha('#46b5ff', 0.16),
        '--accent-border': hexAlpha('#46b5ff', 0.28),
        '--accent-border-strong': hexAlpha('#46b5ff', 0.45),
        '--accent-on-bg': hexAlpha('#46b5ff', 0.22),
        '--ring': 'rgba(99, 102, 241, 0.45)',
        '--focus-border': 'rgba(99, 102, 241, 0.55)',
        '--glow-primary': 'rgba(99, 102, 241, 0.14)',
        '--glow-accent': hexAlpha('#46b5ff', 0.12),
        '--eq-peaking': '#46b5ff',
        '--eq-shelf': '#8b5cf6',
      },
    },
    {
      id: 'violet',
      name: 'Violet',
      swatch: ['#c4b5fd', '#8b5cf6'],
      vars: {
        '--bg': '#0a0812',
        '--bg-elevated': '#12101c',
        '--surface': '#1a1628',
        '--surface-2': '#221e32',
        '--surface-hover': '#2c2740',
        '--primary': '#8b5cf6',
        '--primary-hover': '#a78bfa',
        '--primary-soft': 'rgba(139, 92, 246, 0.16)',
        '--primary-gradient-start': '#a78bfa',
        '--primary-gradient-end': '#7c3aed',
        '--accent': '#c4b5fd',
        '--accent-soft': 'rgba(196, 181, 253, 0.12)',
        '--accent-border': 'rgba(196, 181, 253, 0.2)',
        '--accent-border-strong': 'rgba(196, 181, 253, 0.38)',
        '--accent-on-bg': 'rgba(196, 181, 253, 0.16)',
        '--ring': 'rgba(139, 92, 246, 0.45)',
        '--focus-border': 'rgba(139, 92, 246, 0.55)',
        '--glow-primary': 'rgba(139, 92, 246, 0.16)',
        '--glow-accent': 'rgba(196, 181, 253, 0.08)',
        '--eq-peaking': '#c4b5fd',
        '--eq-shelf': '#8b5cf6',
      },
    },
    {
      id: 'emerald',
      name: 'Emerald',
      swatch: ['#5eead4', '#10b981'],
      vars: {
        '--bg': '#060c0a',
        '--bg-elevated': '#0c1411',
        '--surface': '#132019',
        '--surface-2': '#1a2a22',
        '--surface-hover': '#22352c',
        '--primary': '#10b981',
        '--primary-hover': '#34d399',
        '--primary-soft': 'rgba(16, 185, 129, 0.14)',
        '--primary-gradient-start': '#34d399',
        '--primary-gradient-end': '#059669',
        '--accent': '#5eead4',
        '--accent-soft': 'rgba(94, 234, 212, 0.12)',
        '--accent-border': 'rgba(94, 234, 212, 0.18)',
        '--accent-border-strong': 'rgba(94, 234, 212, 0.35)',
        '--accent-on-bg': 'rgba(94, 234, 212, 0.16)',
        '--ring': 'rgba(16, 185, 129, 0.45)',
        '--focus-border': 'rgba(16, 185, 129, 0.55)',
        '--glow-primary': 'rgba(16, 185, 129, 0.14)',
        '--glow-accent': 'rgba(94, 234, 212, 0.07)',
        '--eq-peaking': '#5eead4',
        '--eq-shelf': '#10b981',
      },
    },
    {
      id: 'rose',
      name: 'Rose',
      swatch: ['#fda4af', '#f43f5e'],
      vars: {
        '--bg': '#0c0809',
        '--bg-elevated': '#141012',
        '--surface': '#1f181b',
        '--surface-2': '#291f24',
        '--surface-hover': '#352830',
        '--primary': '#f43f5e',
        '--primary-hover': '#fb7185',
        '--primary-soft': 'rgba(244, 63, 94, 0.14)',
        '--primary-gradient-start': '#fb7185',
        '--primary-gradient-end': '#e11d48',
        '--accent': '#fda4af',
        '--accent-soft': 'rgba(253, 164, 175, 0.12)',
        '--accent-border': 'rgba(253, 164, 175, 0.2)',
        '--accent-border-strong': 'rgba(253, 164, 175, 0.38)',
        '--accent-on-bg': 'rgba(253, 164, 175, 0.16)',
        '--ring': 'rgba(244, 63, 94, 0.45)',
        '--focus-border': 'rgba(244, 63, 94, 0.55)',
        '--glow-primary': 'rgba(244, 63, 94, 0.14)',
        '--glow-accent': 'rgba(253, 164, 175, 0.08)',
        '--eq-peaking': '#fda4af',
        '--eq-shelf': '#f43f5e',
      },
    },
    {
      id: 'amber',
      name: 'Amber',
      swatch: ['#fcd34d', '#f59e0b'],
      vars: {
        '--bg': '#0c0a06',
        '--bg-elevated': '#141008',
        '--surface': '#1f1a12',
        '--surface-2': '#2a2318',
        '--surface-hover': '#362d1f',
        '--primary': '#f59e0b',
        '--primary-hover': '#fbbf24',
        '--primary-soft': 'rgba(245, 158, 11, 0.14)',
        '--primary-gradient-start': '#fbbf24',
        '--primary-gradient-end': '#d97706',
        '--accent': '#fcd34d',
        '--accent-soft': 'rgba(252, 211, 77, 0.12)',
        '--accent-border': 'rgba(252, 211, 77, 0.2)',
        '--accent-border-strong': 'rgba(252, 211, 77, 0.38)',
        '--accent-on-bg': 'rgba(252, 211, 77, 0.14)',
        '--ring': 'rgba(245, 158, 11, 0.45)',
        '--focus-border': 'rgba(245, 158, 11, 0.55)',
        '--glow-primary': 'rgba(245, 158, 11, 0.14)',
        '--glow-accent': 'rgba(252, 211, 77, 0.08)',
        '--eq-peaking': '#fcd34d',
        '--eq-shelf': '#f59e0b',
      },
    },
    {
      id: 'ocean',
      name: 'Ocean',
      swatch: ['#7dd3fc', '#0ea5e9'],
      vars: {
        '--bg': '#060a10',
        '--bg-elevated': '#0c1219',
        '--surface': '#121b24',
        '--surface-2': '#182430',
        '--surface-hover': '#1f2f3d',
        '--primary': '#0ea5e9',
        '--primary-hover': '#38bdf8',
        '--primary-soft': 'rgba(14, 165, 233, 0.14)',
        '--primary-gradient-start': '#38bdf8',
        '--primary-gradient-end': '#0284c7',
        '--accent': '#7dd3fc',
        '--accent-soft': 'rgba(125, 211, 252, 0.12)',
        '--accent-border': 'rgba(125, 211, 252, 0.2)',
        '--accent-border-strong': 'rgba(125, 211, 252, 0.38)',
        '--accent-on-bg': 'rgba(125, 211, 252, 0.16)',
        '--ring': 'rgba(14, 165, 233, 0.45)',
        '--focus-border': 'rgba(14, 165, 233, 0.55)',
        '--glow-primary': 'rgba(14, 165, 233, 0.14)',
        '--glow-accent': 'rgba(125, 211, 252, 0.08)',
        '--eq-peaking': '#7dd3fc',
        '--eq-shelf': '#0ea5e9',
      },
    },
  ];

  const SHARED_VARS = {
    '--border': 'rgba(255, 255, 255, 0.08)',
    '--border-strong': 'rgba(255, 255, 255, 0.14)',
    '--text': '#f4f4f5',
    '--text-muted': '#a1a1aa',
    '--text-subtle': '#71717a',
    '--success': '#4ade80',
    '--success-soft': 'rgba(74, 222, 128, 0.12)',
    '--success-gradient-start': '#34d399',
    '--success-gradient-end': '#059669',
    '--danger': '#f87171',
    '--danger-soft': 'rgba(248, 113, 113, 0.12)',
    '--eq-grid': '#454552',
    '--eq-grid-faint': 'rgba(69, 69, 82, 0.35)',
    '--eq-label': '#9494a8',
    '--eq-dot-active': '#000000',
    '--eq-gain-handle': '#9494a8',
  };

  function getThemeById(id) {
    return THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME_ID);
  }

  function getStoredThemeId() {
    try {
      let id = localStorage[THEME_KEY];
      if (id === 'goblin') id = 'soundhub';
      const theme = id && THEMES.find((t) => t.id === id);
      if (theme) return theme.id;
    } catch (_) {}
    return DEFAULT_THEME_ID;
  }

  function applyTheme(id) {
    const theme = getThemeById(id);
    if (!theme) return DEFAULT_THEME_ID;

    const root = document.documentElement;
    const vars = { ...SHARED_VARS, ...theme.vars, '--canvas-bg': theme.vars['--bg-elevated'] };
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.dataset.theme = theme.id;

    try {
      localStorage[THEME_KEY] = theme.id;
    } catch (_) {}

    document.dispatchEvent(new CustomEvent('soundhub-theme-change', { detail: { id: theme.id } }));
    return theme.id;
  }

  global.SoundHubThemes = {
    list: THEMES,
    defaultId: DEFAULT_THEME_ID,
    getStoredThemeId,
    applyTheme,
    getThemeById,
  };

  applyTheme(getStoredThemeId());
})(typeof window !== 'undefined' ? window : self);

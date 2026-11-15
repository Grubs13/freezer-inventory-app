'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'frostbox:theme';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {}
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <div className="fb-segment" role="group" aria-label="Theme">
      {(['system', 'light', 'dark'] as const).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => choose(t)}>
          {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}

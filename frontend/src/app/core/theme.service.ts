import { Injectable, signal } from '@angular/core';
import { CUSTOM_DEFAULT, THEMES, type ThemeState } from './models';

const THEME_KEY = 'inventario.tema';

function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    const t = raw ? (JSON.parse(raw) as Partial<ThemeState>) : null;
    if (t && typeof t.nome === 'string' && THEMES.some((th) => th.id === t.nome)) {
      return { nome: t.nome, custom: { ...CUSTOM_DEFAULT, ...(t.custom ?? {}) } };
    }
  } catch {
    /* tema padrão */
  }
  return { nome: 'claro', custom: { ...CUSTOM_DEFAULT } };
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly tema = signal<ThemeState>(loadTheme());

  constructor() {
    this.applyTheme(this.tema(), false);
  }

  applyTheme(t: ThemeState, salvar = true): void {
    this.tema.set(t);
    const root = document.documentElement;
    root.setAttribute('data-theme', t.nome);
    const style = root.style;
    (['brand', 'bg', 'surface', 'sidebar'] as const).forEach((k) =>
      style.removeProperty(`--${k}`),
    );
    if (t.nome === 'custom') {
      style.setProperty('--brand', t.custom.brand);
      style.setProperty('--bg', t.custom.bg);
      style.setProperty('--surface', t.custom.surface);
      style.setProperty('--sidebar', t.custom.sidebar);
    }
    if (salvar) {
      try {
        localStorage.setItem(THEME_KEY, JSON.stringify(t));
      } catch {
        /* storage indisponível */
      }
    }
  }
}

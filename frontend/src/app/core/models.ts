export interface Section {
  id: string;
  /** Caminho SVG minimalista (stroke) renderizado em viewBox 0 0 24 24. */
  icon: string;
}

export const SECTIONS: Section[] = [
  { id: 'Notebooks', icon: 'M4 6h16v10H4z M2.5 19h19' },
  { id: 'Desktops', icon: 'M4 5h16v10H4z M9 21h6 M12 15v6' },
  { id: 'Celulares', icon: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 18.5h2' },
  { id: 'Periféricos', icon: 'M3 7h18v10H3z M7 11h.01 M11 11h.01 M15 11h.01 M17.5 11H17 M7 14.5h10' },
  { id: 'Outros', icon: 'M6 8.5 12 5.5l6 3v7l-6 3-6-3v-7Z M6 8.5 12 11.5l6-3 M12 11.5v7' },
  { id: 'Descarte', icon: 'M5 7h14 M10 7V5h4v2 M7 7l1 13h8l1-13 M10 11v6 M14 11v6' },
];

export interface Item {
  id: number;
  categoria: string;
  nome: string;
  quantidade: number;
  localizacao: string;
  serial: string;
  patrimonio: string;
  danificado: boolean;
  atribuicao: string;
  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemPayload {
  nome: string;
  quantidade: number;
  categoria: string;
  localizacao: string;
  serial: string;
  patrimonio: string;
  danificado: boolean;
  atribuicao: string;
  observacao: string;
}

export interface Usuario {
  id: number;
  username: string;
  criadoEm: string;
}

export interface AuditLog {
  id: number;
  criadoEm: string;
  usuario: string;
  acao: string;
  detalhes: string;
}

export interface ResumoSecao {
  itens: number;
  unidades: number;
}

export interface Resumo {
  porSecao: Record<string, ResumoSecao>;
  total: number;
  unidades: number;
}

export interface Sugestao {
  valor: string;
  categoria: string;
  repeticoes: number;
}

export interface ThemeDef {
  id: string;
  nome: string;
  desc: string;
  emoji: string;
  cores: string[] | null;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'claro',
    nome: 'Claro',
    desc: 'Padrão, fundo cinza-azulado',
    emoji: '🌤️',
    cores: ['#2563eb', '#f1f4f9', '#ffffff', '#0f172a'],
  },
  {
    id: 'escuro',
    nome: 'Escuro',
    desc: 'Confortável à noite',
    emoji: '🌙',
    cores: ['#4f8cff', '#0b1220', '#141d31', '#080d18'],
  },
  {
    id: 'oceano',
    nome: 'Oceano',
    desc: 'Tons de azul-petróleo',
    emoji: '🌊',
    cores: ['#0e7490', '#e6f2f5', '#ffffff', '#083344'],
  },
  { id: 'custom', nome: 'Personalizado', desc: 'Escolha as suas cores', emoji: '🎨', cores: null },
];

export const CUSTOM_DEFAULT = {
  brand: '#2563eb',
  bg: '#f1f4f9',
  surface: '#ffffff',
  sidebar: '#0f172a',
};

export interface ThemeCustomColors {
  brand: string;
  bg: string;
  surface: string;
  sidebar: string;
}

export interface ThemeState {
  nome: string;
  custom: ThemeCustomColors;
}

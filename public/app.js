"use strict";

/* ------------------------------------------------------------------ *
 * Inventário · frontend (HTML/CSS/JS puro)
 * Login + seções + configurações (temas, usuários, logs).
 * A busca de itens só acontece ao entrar na seção (lazy), nunca todas
 * de uma vez. O carregamento tem timeout e tela de erro com retry —
 * o spinner nunca fica rodando infinito.
 * ------------------------------------------------------------------ */

const SECTIONS = [
  { id: "Notebooks", emoji: "💻" },
  { id: "Desktops", emoji: "🖥️" },
  { id: "Celulares", emoji: "📱" },
  { id: "Periféricos", emoji: "⌨️" },
  { id: "Outros", emoji: "📦" },
  { id: "Descarte", emoji: "🗑️" },
];

const SETTINGS_ID = "__config";
const TOKEN_KEY = "inventario.token";
const USER_KEY = "inventario.usuario";
const THEME_KEY = "inventario.tema";
const LOAD_TIMEOUT_MS = 15000;

const THEMES = [
  { id: "claro", nome: "Claro", desc: "Padrão, fundo cinza-azulado", emoji: "🌤️", cores: ["#2563eb", "#f1f4f9", "#ffffff", "#0f172a"] },
  { id: "escuro", nome: "Escuro", desc: "Confortável à noite", emoji: "🌙", cores: ["#4f8cff", "#0b1220", "#141d31", "#080d18"] },
  { id: "oceano", nome: "Oceano", desc: "Tons de azul-petróleo", emoji: "🌊", cores: ["#0e7490", "#e6f2f5", "#ffffff", "#083344"] },
  { id: "custom", nome: "Personalizado", desc: "Escolha as suas cores", emoji: "🎨", cores: null },
];

const CUSTOM_DEFAULT = { brand: "#2563eb", bg: "#f1f4f9", surface: "#ffffff", sidebar: "#0f172a" };

const state = {
  atual: SECTIONS[0].id,
  buscas: Object.fromEntries(SECTIONS.map((s) => [s.id, ""])),
  itens: [],
  resumo: null,
  editandoId: null,
  status: "idle", // idle | loading | ready | empty | error
  erro: "",
  abort: null,
  logado: false,
  tema: loadTheme(),
  usuarios: [],
  logs: [],
  logBusca: "",
};

const $ = (sel) => document.querySelector(sel);

const dom = {
  loginScreen: $("#loginScreen"),
  loginForm: $("#loginForm"),
  loginUser: $("#loginUser"),
  loginPass: $("#loginPass"),
  loginError: $("#loginError"),
  btnLogin: $("#btnLogin"),
  appLayout: $("#appLayout"),
  nav: $("#nav"),
  statItens: $("#statItens"),
  statUnidades: $("#statUnidades"),
  userAvatar: $("#userAvatar"),
  userName: $("#userName"),
  btnLogout: $("#btnLogout"),
  sectionTitle: $("#sectionTitle"),
  sectionEmoji: $("#sectionEmoji"),
  sectionSub: $("#sectionSub"),
  topbarTools: $("#topbarTools"),
  search: $("#searchInput"),
  btnAdd: $("#btnAdd"),
  inventoryCard: $("#inventoryCard"),
  tableWrap: $("#tableWrap"),
  tbody: $("#tbody"),
  empty: $("#emptyState"),
  emptyTitle: $("#emptyTitle"),
  emptyText: $("#emptyText"),
  btnAddEmpty: $("#btnAddEmpty"),
  loading: $("#loadingState"),
  errorState: $("#errorState"),
  errorText: $("#errorText"),
  btnRetry: $("#btnRetry"),
  settingsView: $("#settingsView"),
  themeGrid: $("#themeGrid"),
  customColors: $("#customColors"),
  colorBrand: $("#colorBrand"),
  colorBg: $("#colorBg"),
  colorSurface: $("#colorSurface"),
  colorSidebar: $("#colorSidebar"),
  btnCustomApply: $("#btnCustomApply"),
  btnCustomReset: $("#btnCustomReset"),
  userForm: $("#userForm"),
  newUsername: $("#newUsername"),
  newPassword: $("#newPassword"),
  userFormError: $("#userFormError"),
  userList: $("#userList"),
  logSearch: $("#logSearch"),
  logLimit: $("#logLimit"),
  btnLogsRefresh: $("#btnLogsRefresh"),
  logsTbody: $("#logsTbody"),
  logsEmpty: $("#logsEmpty"),
  itemOverlay: $("#itemOverlay"),
  modalTitle: $("#modalTitle"),
  form: $("#itemForm"),
  formError: $("#formError"),
  nameSuggest: $("#nameSuggest"),
  locSuggest: $("#locSuggest"),
  btnSave: $("#btnSave"),
  confirmOverlay: $("#confirmOverlay"),
  confirmTitle: $("#confirmTitle"),
  confirmText: $("#confirmText"),
  confirmYes: $("#confirmYes"),
  confirmNo: $("#confirmNo"),
  toasts: $("#toasts"),
};

const ICONS = {
  edit:
    '<svg viewBox="0 0 24 24"><path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m14.5 7.5 2 2" stroke="currentColor" stroke-width="1.8"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.2h9.2L17.5 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10.5v6M14 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/* ------------------------------ util ------------------------------ */

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

function dash(value) {
  const v = String(value ?? "").trim();
  return v ? escapeHtml(v) : '<span class="cell-muted">—</span>';
}

function plural(n, singular, pluralForm) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    logout(true); // sessão inválida: volta ao login, sem loop
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status} na requisição.`);
  return data;
}

/* ------------------------------ toasts ------------------------------ */

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  dom.toasts.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s ease, transform .25s ease";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

/* ------------------------------ auth ------------------------------ */

function showLogin() {
  state.logado = false;
  dom.appLayout.hidden = true;
  dom.loginScreen.hidden = false;
  hideLoginError();
  setTimeout(() => dom.loginUser.focus(), 60);
}

function hideLoginError() {
  dom.loginError.hidden = true;
  dom.loginError.textContent = "";
}

function showLoginError(message) {
  dom.loginError.textContent = message;
  dom.loginError.hidden = false;
}

function enterApp(usuario) {
  state.logado = true;
  dom.loginScreen.hidden = true;
  dom.appLayout.hidden = false;
  dom.loginPass.value = "";

  const nome = usuario?.username || "?";
  dom.userName.textContent = nome;
  dom.userName.title = nome;
  dom.userAvatar.textContent = nome.charAt(0).toUpperCase();

  renderNav();
  applyTheme(state.tema, false);
  enterSection(state.atual, true);
  loadResumo();
}

function logout(expirada = false) {
  const token = getToken();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (state.abort) {
    state.abort.abort();
    state.abort = null;
  }
  state.itens = [];
  state.resumo = null;
  state.status = "idle";
  if (token && !expirada) api("/api/auth/logout", { method: "POST" }).catch(() => {});
  if (expirada && state.logado) toast("Sessão expirada. Faça login novamente.", "error");
  showLogin();
}

dom.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideLoginError();

  const username = dom.loginUser.value.trim();
  const senha = dom.loginPass.value;
  if (!username || !senha) {
    showLoginError("Informe usuário e senha.");
    return;
  }

  dom.btnLogin.disabled = true;
  try {
    const data = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, senha }),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro || `Erro ${res.status} no login.`);
      return body;
    });

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
    toast(`Bem-vindo(a), ${data.usuario.username}!`, "success");
    enterApp(data.usuario);
  } catch (err) {
    showLoginError(err.message);
  } finally {
    dom.btnLogin.disabled = false;
  }
});

dom.btnLogout.addEventListener("click", () => logout(false));

/* ------------------------------ carregamento (lazy) ------------------------------ */

async function loadResumo() {
  if (!state.logado) return;
  try {
    const resumo = await api("/api/resumo");
    state.resumo = resumo;
    dom.statItens.textContent = resumo.total;
    dom.statUnidades.textContent = resumo.unidades;
    renderNav();
  } catch (err) {
    if (state.logado) toast(err.message, "error");
  }
}

/**
 * Busca os itens SOMENTE da seção atual (lazy: ao entrar na seção,
 * ao buscar, ao tentar de novo ou após salvar/excluir).
 * Cancela a requisição anterior, tem timeout e mostra erro com retry
 * em vez de deixar o spinner rodando para sempre.
 */
async function loadItens() {
  if (!state.logado || state.atual === SETTINGS_ID) return;

  if (state.abort) state.abort.abort();
  const controller = new AbortController();
  state.abort = controller;
  const secao = state.atual;

  setStatus("loading");

  const timeout = setTimeout(() => controller.abort(new Error("timeout")), LOAD_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({ categoria: secao });
    const termo = (state.buscas[secao] || "").trim();
    if (termo) params.set("q", termo);

    const res = await fetch(`/api/itens?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    });
    if (res.status === 401) {
      logout(true);
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.erro || `Erro ${res.status} na requisição.`);
    }
    const itens = await res.json();

    if (controller.signal.aborted || state.atual !== secao) return; // obsoleta
    state.itens = itens;
    setStatus(itens.length === 0 ? "empty" : "ready");
    renderHeader();
    if (itens.length > 0) renderTable();
    else renderEmpty();
  } catch (err) {
    if (controller.signal.aborted && state.atual !== secao) return; // troca de seção, ignora
    const msg =
      err && err.name === "AbortError"
        ? "A busca demorou demais e foi interrompida. Verifique a conexão e tente de novo."
        : err.message || "Erro ao buscar os dados.";
    state.erro = msg;
    setStatus("error");
    if (state.logado && !controller.signal.aborted) toast(msg, "error");
  } finally {
    clearTimeout(timeout);
    if (state.abort === controller) state.abort = null;
  }
}

function setStatus(status) {
  state.status = status;
  const loading = status === "loading";
  const empty = status === "empty";
  const error = status === "error";
  const ready = status === "ready";

  dom.loading.hidden = !loading;
  dom.errorState.hidden = !error;
  dom.empty.hidden = !empty;
  dom.tableWrap.hidden = !ready;

  if (error) dom.errorText.textContent = state.erro || "Erro ao buscar os dados.";
  if (loading) {
    dom.sectionSub.textContent = "Buscando itens da seção…";
  }
}

dom.btnRetry.addEventListener("click", loadItens);

/* ------------------------------ render ------------------------------ */

function renderNav() {
  const resumo = state.resumo;
  const botoes = SECTIONS.map((sec) => {
    const count = resumo ? resumo.porSecao[sec.id].itens : 0;
    const active = sec.id === state.atual ? " active" : "";
    return `
      <button class="nav-item${active}" type="button" data-secao="${escapeHtml(sec.id)}" title="${escapeHtml(sec.id)}">
        <span class="nav-emoji">${sec.emoji}</span>
        <span class="nav-label">${escapeHtml(sec.id)}</span>
        <span class="nav-count">${count}</span>
      </button>`;
  }).join("");

  const configActive = state.atual === SETTINGS_ID ? " active" : "";
  dom.nav.innerHTML =
    botoes +
    `<div class="nav-separator">Sistema</div>
     <button class="nav-item${configActive}" type="button" data-secao="${SETTINGS_ID}" title="Configurações">
       <span class="nav-emoji">⚙️</span>
       <span class="nav-label">Configurações</span>
     </button>`;
}

function renderHeader() {
  const sec = SECTIONS.find((s) => s.id === state.atual);
  const unidades = state.itens.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  const buscando = (state.buscas[state.atual] || "").trim() ? " · resultado da busca" : "";

  dom.sectionTitle.textContent = state.atual;
  dom.sectionEmoji.textContent = sec ? sec.emoji : "📦";
  dom.sectionSub.textContent = `${plural(state.itens.length, "item", "itens")} · ${plural(
    unidades,
    "unidade",
    "unidades",
  )}${buscando}`;
  dom.search.placeholder = `Buscar em ${state.atual}…`;
}

function renderEmpty() {
  const termo = (state.buscas[state.atual] || "").trim();
  if (termo) {
    dom.emptyTitle.textContent = "Nenhum resultado";
    dom.emptyText.textContent = `Nada encontrado para “${termo}” em ${state.atual}.`;
    dom.btnAddEmpty.hidden = true;
  } else {
    dom.emptyTitle.textContent = `Nenhum item em ${state.atual}`;
    dom.emptyText.textContent = "Cadastre o primeiro item desta seção.";
    dom.btnAddEmpty.hidden = false;
  }
  renderHeader();
}

function renderTable() {
  dom.tbody.innerHTML = state.itens
    .map((item) => {
      const obs = String(item.observacao || "").trim();
      const danificado = item.danificado
        ? '<span class="chip bad">Sim</span>'
        : '<span class="chip ok">Não</span>';
      const criado = item.criadoEm ? `<div class="cell-muted" style="font-size:12px">cadastrado em ${formatDate(item.criadoEm)}</div>` : "";

      return `
        <tr data-id="${item.id}">
          <td>
            <span class="cell-name" title="${escapeHtml(item.nome)}">${escapeHtml(item.nome)}</span>
            ${criado}
          </td>
          <td class="num"><span class="qty-badge">${item.quantidade ?? 0}</span></td>
          <td>${dash(item.localizacao)}</td>
          <td class="cell-mono">${dash(item.serial)}</td>
          <td class="cell-mono">${dash(item.patrimonio)}</td>
          <td>${danificado}</td>
          <td>${dash(item.atribuicao)}</td>
          <td class="col-obs">
            <div class="cell-obs" title="${escapeHtml(obs)}">${obs ? escapeHtml(obs) : '<span class="cell-muted">—</span>'}</div>
          </td>
          <td class="actions">
            <span class="row-actions">
              <button class="icon-btn" type="button" data-acao="editar" title="Editar item" aria-label="Editar item">${ICONS.edit}</button>
              <button class="icon-btn danger" type="button" data-acao="excluir" title="Excluir item" aria-label="Excluir item">${ICONS.trash}</button>
            </span>
          </td>
        </tr>`;
    })
    .join("");
}

/* ------------------------------ seções / busca ------------------------------ */

/** Entra numa seção e busca os dados dela (ou abre as configurações). */
function enterSection(secao, forcar = false) {
  if (secao === SETTINGS_ID) {
    state.atual = SETTINGS_ID;
    if (state.abort) {
      state.abort.abort();
      state.abort = null;
    }
    renderNav();
    dom.sectionTitle.textContent = "Configurações";
    dom.sectionEmoji.textContent = "⚙️";
    dom.sectionSub.textContent = "Temas, usuários e logs do sistema";
    dom.topbarTools.hidden = true;
    dom.inventoryCard.hidden = true;
    dom.settingsView.hidden = false;
    renderThemeCards();
    loadUsers();
    loadLogs();
    return;
  }

  if (!SECTIONS.some((s) => s.id === secao)) return;
  const trocou = state.atual !== secao;
  state.atual = secao;
  dom.topbarTools.hidden = false;
  dom.inventoryCard.hidden = false;
  dom.settingsView.hidden = true;
  dom.search.value = state.buscas[secao] || "";
  renderNav();
  if (trocou || forcar) loadItens(); // lazy: só busca ao entrar
}

let searchTimer = null;
dom.search.addEventListener("input", () => {
  if (state.atual === SETTINGS_ID) return;
  state.buscas[state.atual] = dom.search.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadItens, 250);
});

dom.nav.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-secao]");
  if (btn) enterSection(btn.dataset.secao);
});

/* ------------------------------ temas ------------------------------ */

function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY) || "null");
    if (t && THEMES.some((th) => th.id === t.nome)) {
      return { nome: t.nome, custom: { ...CUSTOM_DEFAULT, ...(t.custom || {}) } };
    }
  } catch {
    /* padrão */
  }
  return { nome: "claro", custom: { ...CUSTOM_DEFAULT } };
}

function applyTheme(tema, salvar = true) {
  state.tema = tema;
  document.documentElement.setAttribute("data-theme", tema.nome);
  const root = document.documentElement.style;
  ["brand", "bg", "surface", "sidebar"].forEach((k) => root.removeProperty(`--${k}`));
  if (tema.nome === "custom") {
    root.setProperty("--brand", tema.custom.brand);
    root.setProperty("--bg", tema.custom.bg);
    root.setProperty("--surface", tema.custom.surface);
    root.setProperty("--sidebar", tema.custom.sidebar);
    dom.customColors.hidden = false;
    dom.colorBrand.value = tema.custom.brand;
    dom.colorBg.value = tema.custom.bg;
    dom.colorSurface.value = tema.custom.surface;
    dom.colorSidebar.value = tema.custom.sidebar;
  } else {
    dom.customColors.hidden = true;
  }
  if (salvar) localStorage.setItem(THEME_KEY, JSON.stringify(tema));
  renderThemeCards();
}

function renderThemeCards() {
  if (!dom.themeGrid) return;
  dom.themeGrid.innerHTML = THEMES.map((t) => {
    const active = state.tema.nome === t.id ? " active" : "";
    const cores = t.cores || [
      state.tema.custom.brand,
      state.tema.custom.bg,
      state.tema.custom.surface,
      state.tema.custom.sidebar,
    ];
    const faixas = cores.map((c) => `<i style="background:${escapeHtml(c)}"></i>`).join("");
    return `
      <button class="theme-card${active}" type="button" data-tema="${t.id}">
        <span class="theme-preview">${faixas}</span>
        <span><span class="theme-name">${t.emoji} ${escapeHtml(t.nome)}</span>
        <span class="theme-desc">${escapeHtml(t.desc)}</span></span>
      </button>`;
  }).join("");
}

dom.themeGrid.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-tema]");
  if (!btn) return;
  const id = btn.dataset.tema;
  if (id === "custom") applyTheme({ nome: "custom", custom: { ...state.tema.custom } });
  else applyTheme({ nome: id, custom: { ...state.tema.custom } });
  toast(`Tema "${id === "custom" ? "Personalizado" : id}" aplicado.`, "success");
});

dom.btnCustomApply.addEventListener("click", () => {
  applyTheme({
    nome: "custom",
    custom: {
      brand: dom.colorBrand.value,
      bg: dom.colorBg.value,
      surface: dom.colorSurface.value,
      sidebar: dom.colorSidebar.value,
    },
  });
  toast("Cores personalizadas aplicadas.", "success");
});

dom.btnCustomReset.addEventListener("click", () => {
  applyTheme({ nome: "custom", custom: { ...CUSTOM_DEFAULT } });
  toast("Cores redefinidas para o padrão.", "success");
});

/* ------------------------------ usuários ------------------------------ */

async function loadUsers() {
  if (!state.logado) return;
  try {
    state.usuarios = await api(`/api/usuarios`);
    renderUsers();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderUsers() {
  const eu = getUsuario();
  dom.userList.innerHTML = state.usuarios
    .map((u) => {
      const inicial = String(u.username || "?").charAt(0).toUpperCase();
      const tag = eu && u.id === eu.id ? '<span class="user-tag">você</span>' : "";
      const btn =
        eu && u.id === eu.id
          ? ""
          : `<button class="icon-btn danger" type="button" data-excluir-usuario="${u.id}" title="Excluir ${escapeHtml(u.username)}" aria-label="Excluir usuário">🗑️</button>`;
      return `
        <li class="user-row">
          <span class="user-avatar">${escapeHtml(inicial)}</span>
          <strong title="${escapeHtml(u.username)}">${escapeHtml(u.username)}</strong>
          ${tag}
          <small>${formatDate(u.criadoEm)}</small>
          ${btn}
        </li>`;
    })
    .join("");
}

function showUserFormError(message) {
  dom.userFormError.textContent = message;
  dom.userFormError.hidden = false;
}

dom.userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  dom.userFormError.hidden = true;

  const username = dom.newUsername.value.trim();
  const senha = dom.newPassword.value;
  if (!username || !senha) {
    showUserFormError("Informe usuário e senha.");
    return;
  }

  try {
    await api("/api/usuarios", { method: "POST", body: JSON.stringify({ username, senha }) });
    dom.newUsername.value = "";
    dom.newPassword.value = "";
    toast(`Usuário "${username}" criado.`, "success");
    await loadUsers();
  } catch (err) {
    showUserFormError(err.message);
  }
});

dom.userList.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-excluir-usuario]");
  if (!btn) return;
  const id = Number(btn.dataset.excluirUsuario);
  const alvo = state.usuarios.find((u) => u.id === id);
  const ok = await confirmDialog(
    `O usuário “${alvo ? alvo.username : id}” perderá o acesso. Essa ação não pode ser desfeita.`,
    "Excluir usuário",
  );
  if (!ok) return;
  try {
    await api(`/api/usuarios/${id}`, { method: "DELETE" });
    toast("Usuário excluído.", "success");
    await loadUsers();
  } catch (err) {
    toast(err.message, "error");
  }
});

/* ------------------------------ logs ------------------------------ */

let logTimer = null;
dom.logSearch.addEventListener("input", () => {
  clearTimeout(logTimer);
  logTimer = setTimeout(loadLogs, 300);
});
dom.logLimit.addEventListener("change", loadLogs);
dom.btnLogsRefresh.addEventListener("click", loadLogs);

async function loadLogs() {
  if (!state.logado || state.atual !== SETTINGS_ID) return;
  try {
    const params = new URLSearchParams({ limite: dom.logLimit.value || "200" });
    const termo = dom.logSearch.value.trim();
    if (termo) params.set("q", termo);
    state.logs = await api(`/api/logs?${params.toString()}`);
    renderLogs();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderLogs() {
  dom.logsEmpty.hidden = state.logs.length > 0;
  dom.logsTbody.innerHTML = state.logs
    .map(
      (l) => `
      <tr>
        <td class="cell-mono">${escapeHtml(formatDateTime(l.criadoEm))}</td>
        <td>${dash(l.usuario)}</td>
        <td><span class="log-acao">${escapeHtml(l.acao)}</span></td>
        <td>${dash(l.detalhes)}</td>
      </tr>`,
    )
    .join("");
}

/* ------------------------------ modal de item ------------------------------ */

const form = dom.form;
const categorySelect = form.categoria;

categorySelect.innerHTML = SECTIONS.map(
  (s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.id)}</option>`,
).join("");

function openModal(item = null) {
  state.editandoId = item ? item.id : null;
  form.reset();
  hideFormError();
  nomeAC.hide();
  locAC.hide();

  dom.modalTitle.textContent = item ? "Editar item" : "Adicionar item";
  dom.btnSave.textContent = item ? "Salvar alterações" : "Salvar item";

  form.nome.value = item ? item.nome : "";
  form.quantidade.value = item ? item.quantidade : 1;
  form.localizacao.value = item ? item.localizacao || "" : "";
  form.serial.value = item ? item.serial || "" : "";
  form.patrimonio.value = item ? item.patrimonio || "" : "";
  form.atribuicao.value = item ? item.atribuicao || "" : "";
  form.observacao.value = item ? item.observacao || "" : "";
  form.categoria.value = item ? item.categoria : state.atual;
  setDanificado(item ? !!item.danificado : false);

  dom.itemOverlay.hidden = false;
  setTimeout(() => form.nome.focus(), 40);
}

function closeModal() {
  dom.itemOverlay.hidden = true;
  state.editandoId = null;
  hideFormError();
  nomeAC.hide();
  locAC.hide();
}

function setDanificado(sim) {
  const alvo = form.querySelector(`input[name="danificado"][value="${sim ? "sim" : "nao"}"]`);
  if (alvo) alvo.checked = true;
}

function isDanificado() {
  const checked = form.querySelector('input[name="danificado"]:checked');
  return checked ? checked.value === "sim" : false;
}

function showFormError(message) {
  dom.formError.textContent = message;
  dom.formError.hidden = false;
}

function hideFormError() {
  dom.formError.hidden = true;
  dom.formError.textContent = "";
}

function readForm() {
  return {
    nome: form.nome.value.trim(),
    quantidade: form.quantidade.value,
    localizacao: form.localizacao.value.trim(),
    serial: form.serial.value.trim(),
    patrimonio: form.patrimonio.value.trim(),
    danificado: isDanificado(),
    atribuicao: form.atribuicao.value.trim(),
    observacao: form.observacao.value.trim(),
    categoria: form.categoria.value,
  };
}

/* ------------------------------ autocomplete (nome e localização) ------------------------------ */

function highlightMatch(texto, termo) {
  const pos = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (pos < 0 || !termo) return escapeHtml(texto);
  return (
    escapeHtml(texto.slice(0, pos)) +
    "<mark>" +
    escapeHtml(texto.slice(pos, pos + termo.length)) +
    "</mark>" +
    escapeHtml(texto.slice(pos + termo.length))
  );
}

/**
 * Autocomplete genérico: sugere valores já cadastrados e, ao escolher,
 * preenche SOMENTE o próprio campo. Retorna { hide, refresh }.
 */
function criarAutocomplete({ campo, input, listaEl, meta, aoEscolher }) {
  const st = { lista: [], indice: -1, timer: null, seq: 0 };

  function hide() {
    st.lista = [];
    st.indice = -1;
    listaEl.innerHTML = "";
    listaEl.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  function render(termo) {
    if (st.lista.length === 0) {
      hide();
      return;
    }
    listaEl.innerHTML = st.lista
      .map((item, i) => {
        return `
          <li role="option" data-i="${i}" class="${i === st.indice ? "active" : ""}" aria-selected="${i === st.indice}">
            <span class="suggest-name">${highlightMatch(item.valor, termo)}</span>
            <span class="suggest-meta">${meta(item)}</span>
          </li>`;
      })
      .join("");
    listaEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  async function fetch() {
    const termo = input.value.trim();
    if (termo.length < 2 || dom.itemOverlay.hidden) {
      hide();
      return;
    }
    const mySeq = ++st.seq;
    try {
      const params = new URLSearchParams({ q: termo, campo, categoria: form.categoria.value });
      const lista = await api(`/api/itens/sugestoes?${params.toString()}`);
      if (mySeq !== st.seq || dom.itemOverlay.hidden) return;
      st.lista = lista;
      st.indice = -1;
      render(termo);
    } catch {
      if (mySeq === st.seq) hide(); // falha silenciosa: não atrapalha a digitação
    }
  }

  function schedule() {
    clearTimeout(st.timer);
    st.timer = setTimeout(fetch, 200);
  }

  function pick(i) {
    const item = st.lista[i];
    if (!item) return;
    aoEscolher(item.valor);
    hide();
  }

  input.addEventListener("input", schedule);
  input.addEventListener("keydown", (event) => {
    if (listaEl.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const dir = event.key === "ArrowDown" ? 1 : -1;
      st.indice = (st.indice + dir + st.lista.length) % st.lista.length;
      render(input.value.trim());
      listaEl.children[st.indice]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && st.indice >= 0) {
      event.preventDefault();
      pick(st.indice);
    } else if (event.key === "Escape") {
      event.stopPropagation(); // fecha só a lista, sem fechar o modal
      hide();
    }
  });

  listaEl.addEventListener("mousedown", (event) => {
    const li = event.target.closest("li[data-i]");
    if (li) {
      event.preventDefault(); // antes do blur fechar a lista
      pick(Number(li.dataset.i));
    }
  });

  return { hide, refresh: fetch };
}

const nomeAC = criarAutocomplete({
  campo: "nome",
  input: form.nome,
  listaEl: dom.nameSuggest,
  meta: (s) =>
    `${escapeHtml(s.categoria)}${s.repeticoes > 1 ? ` · ${s.repeticoes} cadastrados` : ""}`,
  aoEscolher: (valor) => {
    form.nome.value = valor; // somente o nome, o resto continua como está
    form.quantidade.focus();
    form.quantidade.select();
  },
});

const locAC = criarAutocomplete({
  campo: "localizacao",
  input: form.localizacao,
  listaEl: dom.locSuggest,
  meta: (s) =>
    `${escapeHtml(s.categoria)} · em ${s.repeticoes} ${s.repeticoes === 1 ? "item" : "itens"}`,
  aoEscolher: (valor) => {
    form.localizacao.value = valor; // somente a localização
    form.serial.focus();
  },
});

form.categoria.addEventListener("change", () => {
  if (!dom.nameSuggest.hidden) nomeAC.refresh();
  if (!dom.locSuggest.hidden) locAC.refresh();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".autocomplete")) {
    nomeAC.hide();
    locAC.hide();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = readForm();

  if (!payload.nome) {
    showFormError("Informe o Nome do Item.");
    form.nome.focus();
    return;
  }

  dom.btnSave.disabled = true;
  try {
    const editando = state.editandoId !== null;
    if (editando) {
      await api(`/api/itens/${state.editandoId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/itens", { method: "POST", body: JSON.stringify(payload) });
    }

    closeModal();
    toast(editando ? "Item atualizado com sucesso." : "Item adicionado com sucesso.", "success");

    if (payload.categoria !== state.atual) enterSection(payload.categoria);
    else await loadItens();

    await loadResumo();
  } catch (err) {
    showFormError(err.message);
  } finally {
    dom.btnSave.disabled = false;
  }
});

dom.btnAdd.addEventListener("click", () => openModal());
dom.btnAddEmpty.addEventListener("click", () => openModal());

dom.itemOverlay.addEventListener("click", (event) => {
  if (event.target === dom.itemOverlay || event.target.closest("[data-close]")) closeModal();
});

/* ------------------------------ ações da tabela ------------------------------ */

dom.tbody.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-acao]");
  if (!btn) return;

  const row = btn.closest("tr");
  const id = Number(row.dataset.id);
  const item = state.itens.find((i) => i.id === id);
  if (!item) return;

  if (btn.dataset.acao === "editar") {
    openModal(item);
    return;
  }

  const ok = await confirmDialog(
    `“${item.nome}” será removido de ${state.atual}. Essa ação não pode ser desfeita.`,
  );
  if (!ok) return;

  try {
    await api(`/api/itens/${id}`, { method: "DELETE" });
    toast("Item excluído.", "success");
    await Promise.all([loadItens(), loadResumo()]);
  } catch (err) {
    toast(err.message, "error");
  }
});

/* ------------------------------ confirmação ------------------------------ */

let confirmResolver = null;

function confirmDialog(message, title = "Excluir item") {
  dom.confirmTitle.textContent = title;
  dom.confirmText.textContent = message;
  dom.confirmOverlay.hidden = false;
  setTimeout(() => dom.confirmYes.focus(), 40);

  return new Promise((resolve) => {
    confirmResolver = (value) => {
      confirmResolver = null;
      dom.confirmOverlay.hidden = true;
      resolve(value);
    };
  });
}

dom.confirmYes.addEventListener("click", () => confirmResolver && confirmResolver(true));
dom.confirmNo.addEventListener("click", () => confirmResolver && confirmResolver(false));
dom.confirmOverlay.addEventListener("click", (event) => {
  if (event.target === dom.confirmOverlay && confirmResolver) confirmResolver(false);
});

/* ------------------------------ teclado ------------------------------ */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (confirmResolver) confirmResolver(false);
    else if (!dom.itemOverlay.hidden) closeModal();
    return;
  }

  const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (
    event.key === "/" &&
    !digitando &&
    dom.itemOverlay.hidden &&
    dom.loginScreen.hidden &&
    state.atual !== SETTINGS_ID
  ) {
    event.preventDefault();
    dom.search.focus();
    dom.search.select();
  }
});

/* ------------------------------ início ------------------------------ */

applyTheme(state.tema, false);

(async function boot() {
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }
  try {
    const me = await api("/api/auth/me");
    enterApp(me.usuario);
  } catch {
    showLogin(); // api() já fez logout + toast quando 401
  }
})();

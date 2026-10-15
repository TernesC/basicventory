import { Component, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { AuthData } from '../core/auth-data';
import { ConfirmService } from '../core/confirm.service';
import { InventoryApi } from '../core/inventory-api';
import { CUSTOM_DEFAULT, THEMES, type AuditLog, type Usuario } from '../core/models';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';

const USERNAME_MSG =
  'Usuário deve ter de 3 a 60 caracteres (letras, números, ponto, _ ou -).';
const SENHA_MSG = 'Senha deve ter de 4 a 100 caracteres.';
const USERNAME_RE = /^[A-Za-z0-9._-]{3,60}$/;

@Component({
  selector: 'app-settings',
  imports: [FormField],
  templateUrl: './settings.html',
})
export class SettingsComponent {
  protected readonly theme = inject(ThemeService);
  private readonly api = inject(InventoryApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthData);

  protected readonly THEMES = THEMES;

  /* ---------------- aparência ---------------- */

  protected readonly colorBrand = signal(this.theme.tema().custom.brand);
  protected readonly colorBg = signal(this.theme.tema().custom.bg);
  protected readonly colorSurface = signal(this.theme.tema().custom.surface);
  protected readonly colorSidebar = signal(this.theme.tema().custom.sidebar);

  protected previewCores(t: (typeof THEMES)[number]): string[] {
    if (t.cores) return t.cores;
    const c = this.theme.tema().custom;
    return [c.brand, c.bg, c.surface, c.sidebar];
  }

  protected aplicarTema(id: string): void {
    const atual = this.theme.tema();
    this.theme.applyTheme({ nome: id, custom: { ...atual.custom } });
    if (id === 'custom') {
      this.colorBrand.set(atual.custom.brand);
      this.colorBg.set(atual.custom.bg);
      this.colorSurface.set(atual.custom.surface);
      this.colorSidebar.set(atual.custom.sidebar);
    }
    this.toast.show('Tema aplicado.', 'success');
  }

  protected aplicarCores(): void {
    this.theme.applyTheme({
      nome: 'custom',
      custom: {
        brand: this.colorBrand(),
        bg: this.colorBg(),
        surface: this.colorSurface(),
        sidebar: this.colorSidebar(),
      },
    });
    this.toast.show('Cores personalizadas aplicadas.', 'success');
  }

  protected redefinirCores(): void {
    this.colorBrand.set(CUSTOM_DEFAULT.brand);
    this.colorBg.set(CUSTOM_DEFAULT.bg);
    this.colorSurface.set(CUSTOM_DEFAULT.surface);
    this.colorSidebar.set(CUSTOM_DEFAULT.sidebar);
    this.theme.applyTheme({ nome: 'custom', custom: { ...CUSTOM_DEFAULT } });
    this.toast.show('Cores redefinidas para o padrão.', 'success');
  }

  /* ---------------- usuários ---------------- */

  protected readonly usuarios = httpResource<Usuario[]>(() => '/api/usuarios');

  protected readonly model = signal({ username: '', senha: '' });

  protected readonly userForm = form(this.model, (s) => {
    required(s.username, { message: 'Informe o usuário.' });
    minLength(s.username, 3, { message: USERNAME_MSG });
    validate(s.username, ({ value }) => {
      const v = value();
      if (!v) return undefined;
      return USERNAME_RE.test(v) ? undefined : { kind: 'username', message: USERNAME_MSG };
    });
    required(s.senha, { message: 'Informe a senha.' });
    minLength(s.senha, 4, { message: SENHA_MSG });
    maxLength(s.senha, 100, { message: SENHA_MSG });
  });

  protected readonly erroForm = signal('');

  protected readonly eu = computed(() => this.auth.currentUser());

  protected inicial(nome: string): string {
    return (nome || '?').charAt(0).toUpperCase();
  }

  protected onCriar(): void {
    this.erroForm.set('');
    submit(this.userForm, async () => {
      try {
        const username = this.model().username.trim();
        await this.api.criarUsuario(username, this.model().senha);
        this.model.set({ username: '', senha: '' });
        this.userForm().reset();
        this.toast.show(`Usuário "${username}" criado.`, 'success');
        this.usuarios.reload();
      } catch (err) {
        this.erroForm.set(err instanceof Error ? err.message : 'Erro ao criar usuário.');
      }
    });
  }

  protected async excluirUsuario(u: Usuario): Promise<void> {
    const ok = await this.confirm.ask(
      `O usuário "${u.username}" perderá o acesso. Essa ação não pode ser desfeita.`,
      'Excluir usuário',
    );
    if (!ok) return;
    try {
      await this.api.excluirUsuario(u.id);
      this.toast.show('Usuário excluído.', 'success');
      this.usuarios.reload();
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : 'Erro ao excluir usuário.', 'error');
    }
  }

  /* ---------------- logs ---------------- */

  protected readonly limite = signal('200');
  protected readonly filtro = signal('');
  protected readonly filtroDebounced = signal('');
  private filtroTimer: ReturnType<typeof setTimeout> | undefined;

  protected onFiltroInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.filtro.set(v);
    clearTimeout(this.filtroTimer);
    this.filtroTimer = setTimeout(() => this.filtroDebounced.set(v), 300);
  }

  protected onLimiteChange(event: Event): void {
    this.limite.set((event.target as HTMLSelectElement).value);
  }

  protected readonly logs = httpResource<AuditLog[]>(() => {
    const p = new URLSearchParams({ limite: this.limite() });
    const q = this.filtroDebounced().trim();
    if (q) p.set('q', q);
    return `/api/logs?${p.toString()}`;
  });

  /* ---------------- auxiliares ---------------- */

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected formatDateTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}

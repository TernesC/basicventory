import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { Usuario } from './models';

function readToken(): string | null {
  try {
    return localStorage.getItem('inventario.token');
  } catch {
    return null;
  }
}

function readUser(): Usuario | null {
  try {
    const raw = localStorage.getItem('inventario.usuario');
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

function backendMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const erro = (err as { error?: { erro?: unknown } }).error?.erro;
    if (typeof erro === 'string' && erro) return erro;
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class AuthData {
  private readonly TOKEN_KEY = 'inventario.token';
  private readonly USER_KEY = 'inventario.usuario';

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenSig = signal<string | null>(readToken());
  private readonly userSig = signal<Usuario | null>(readUser());

  readonly token = this.tokenSig.asReadonly();
  readonly currentUser = this.userSig.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenSig() !== null);

  async login(username: string, senha: string): Promise<Usuario> {
    try {
      const data = await firstValueFrom(
        this.http.post<{ token: string; usuario: Usuario }>('/api/auth/login', { username, senha }),
      );
      localStorage.setItem(this.TOKEN_KEY, data.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(data.usuario));
      this.tokenSig.set(data.token);
      this.userSig.set(data.usuario);
      return data.usuario;
    } catch (err) {
      throw new Error(backendMessage(err, 'Não foi possível entrar. Tente novamente.'));
    }
  }

  async logout(silencioso = false): Promise<void> {
    const token = this.tokenSig();
    if (token && !silencioso) {
      try {
        await firstValueFrom(this.http.post('/api/auth/logout', {}));
      } catch {
        /* best-effort: sair mesmo se o backend falhar */
      }
    }
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch {
      /* storage indisponível */
    }
    this.tokenSig.set(null);
    this.userSig.set(null);
    await this.router.navigate(['/login']);
  }
}

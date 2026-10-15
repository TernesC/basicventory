import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthData } from '../core/auth-data';
import { SECTIONS } from '../core/models';
import { ResumoStore } from '../core/resumo-store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthData);
  protected readonly resumoStore = inject(ResumoStore);

  protected readonly sections = SECTIONS;
  protected readonly resumo = this.resumoStore.resumo;

  protected readonly nomeUsuario = computed(() => this.auth.currentUser()?.username ?? '—');
  protected readonly inicial = computed(() =>
    (this.auth.currentUser()?.username ?? '?').charAt(0).toUpperCase(),
  );

  protected contaSecao(id: string): number {
    return this.resumo.value()?.porSecao[id]?.itens ?? 0;
  }

  protected logout(): void {
    void this.auth.logout();
  }
}

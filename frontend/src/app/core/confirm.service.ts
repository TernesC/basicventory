import { Injectable, signal } from '@angular/core';

export interface ConfirmState {
  aberto: boolean;
  titulo: string;
  mensagem: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly stateSig = signal<ConfirmState | null>(null);
  private resolver: ((valor: boolean) => void) | null = null;

  readonly state = this.stateSig.asReadonly();

  ask(mensagem: string, titulo = 'Excluir item'): Promise<boolean> {
    this.stateSig.set({ aberto: true, titulo, mensagem });
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  confirm(valor: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.stateSig.set(null);
    resolver?.(valor);
  }
}

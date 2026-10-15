import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  mensagem: string;
  tipo: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  show(mensagem: string, tipo = 'info'): void {
    const id = this.nextId++;
    this.items.update((lista) => [...lista, { id, mensagem, tipo }]);
    setTimeout(() => {
      this.items.update((lista) => lista.filter((t) => t.id !== id));
    }, 3200);
  }
}

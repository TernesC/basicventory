import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Item,
  ItemPayload,
  Sugestao,
  Usuario,
} from './models';

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);

  criarItem(payload: ItemPayload): Promise<Item> {
    return firstValueFrom(this.http.post<Item>('/api/itens', payload));
  }

  atualizarItem(id: number, payload: ItemPayload): Promise<Item> {
    return firstValueFrom(this.http.put<Item>(`/api/itens/${id}`, payload));
  }

  async excluirItem(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/itens/${id}`, { responseType: 'text' as const }),
    );
  }

  sugestoes(termo: string, campo: string, categoria: string): Promise<Sugestao[]> {
    const params = new HttpParams()
      .set('q', termo)
      .set('campo', campo)
      .set('categoria', categoria);
    return firstValueFrom(this.http.get<Sugestao[]>('/api/itens/sugestoes', { params }));
  }

  criarUsuario(username: string, senha: string): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>('/api/usuarios', { username, senha }));
  }

  async excluirUsuario(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`/api/usuarios/${id}`, { responseType: 'text' as const }),
    );
  }
}

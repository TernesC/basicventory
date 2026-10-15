import { inject, Injectable } from '@angular/core';
import { httpResource } from '@angular/common/http';
import type { Resumo } from './models';
import { AuthData } from './auth-data';

@Injectable({ providedIn: 'root' })
export class ResumoStore {
  private readonly auth = inject(AuthData);

  readonly resumo = httpResource<Resumo>(() =>
    this.auth.isLoggedIn() ? '/api/resumo' : undefined,
  );

  reload(): void {
    this.resumo.reload();
  }
}

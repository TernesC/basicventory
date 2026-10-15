import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthData } from './auth-data';
import { ToastService } from './toast.service';

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const auth = inject(AuthData);
  const toast = inject(ToastService);

  const token = auth.token();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !authReq.url.includes('/api/auth/login')
      ) {
        void auth.logout(true);
        toast.show('Sessão expirada. Faça login novamente.', 'error');
      }
      return throwError(() => err);
    }),
  );
}

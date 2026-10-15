import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthData } from './auth-data';

export const authGuard: CanActivateFn = () => {
  if (inject(AuthData).isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login']);
};

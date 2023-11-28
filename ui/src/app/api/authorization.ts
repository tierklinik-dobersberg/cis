import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { createPromiseClient } from '@bufbuild/connect';
import { AuthService } from '@tkd/apis';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { transportFactory } from './connect_clients';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationInterceptor implements HttpInterceptor {
  private _resolve: any;
  private _reject: any;
  private pendingRefresh: Promise<never> | null = null

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req)
      .pipe(
        catchError(err => {
          if (req.url.startsWith('/api')) {
            if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
              // first try to refresh the access token now
              //debugger;

              if (this.pendingRefresh === null) {
                this.pendingRefresh = new Promise((resolve, reject) => {
                  this._reject = reject;
                  this._resolve = resolve;
                })

                const transport = transportFactory(this.route, this.router, environment, "accountService")
                const authClient = createPromiseClient(AuthService, transport);

                return from(authClient.refreshToken({}))
                  .pipe(
                    switchMap(() => {
                      this._resolve();
                      this.pendingRefresh = null;

                      return next.handle(req)
                    }),
                    catchError(refreshErr => {
                      this._reject();
                      this.pendingRefresh = null;

                      console.error(refreshErr);
                      // failed to get a new access token, redirect the browser to the location
                      // returned by the error
                      if (!!err.error && typeof err.error === 'object' && 'location' in err.error) {
                        //window.location.href = err.error.location;
                      }

                      return throwError(() => err)
                    })
                  )
              }

              return from(this.pendingRefresh)
                .pipe(
                  switchMap(() => next.handle(req))
                )
            }
          }
          return throwError(() => err);
        })
      );
  }
}

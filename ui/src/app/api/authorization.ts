import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthorizationInterceptor implements HttpInterceptor {
    constructor(private router: Router) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(req)
            .pipe(
                catchError(err => {
                    if (req.url.startsWith('/api')) {
                        if (err instanceof HttpErrorResponse && err.status === 401) {
                            if (!req.url.includes('identity/v1/login') && !req.url.includes('identity/v1/refresh')) {

                                if (!this.router.url.startsWith('/login')) {
                                    this.router.navigate(['/', 'login'], {
                                        queryParams: {
                                            rd: this.router.url
                                        }
                                    });
                                }
                            }
                        }
                    }
                    return throwError(() => err);
                })
            );
    }
}

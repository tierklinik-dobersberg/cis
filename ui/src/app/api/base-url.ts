import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

@Injectable({providedIn: 'root'})
export class BaseURLInjector implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (!req.url.startsWith("http") && !!environment.baseURL) {
            req = req.clone({
                url: `${environment.baseURL}${req.url}`,
                withCredentials: true
            })
        }
        return next.handle(req)
    }
}
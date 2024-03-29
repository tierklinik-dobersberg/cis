import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

function joinPaths(base: string, path: string): string {
  let result = base;

  if (result.endsWith("/")) {
    result = result.slice(0, -1)
  }

  if (path.startsWith("/")) {
    path = path.slice(1)
  }

  return result + "/" + path
}

@Injectable({providedIn: 'root'})
export class BaseURLInjector implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (!req.url.startsWith("http") && !!environment.baseURL) {
            req = req.clone({
                url: joinPaths(environment.baseURL, req.url),
                withCredentials: true
            })
        }
        return next.handle(req)
    }
}

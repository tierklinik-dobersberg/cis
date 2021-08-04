import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl, SafeUrl } from "@angular/platform-browser";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface Vars {
  [key: string]: string | number | boolean | string[];
}

export interface Layout {
  name: string;
  file?: string;
  content?: string;
  description?: string;
  variables: Variable[];
  choices?: string[];
}

export interface Variable {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  format?: string;
  multiline?: boolean;
  displayName?: string;
  choices?: string[];
}

export interface Slide {
  layout: string;
  duration?: number;
  vars?: Vars;
  autoAnimate?: boolean;
  background?: string;
}

export interface Show {
  name: string;
  slides: Slide[];
  description?: string;
}

export interface ListShowEntry {
  name: string;
  description?: string;
  numberOfSlides: number;
}

interface ListShowResponse {
  shows: ListShowEntry[];
}

export interface RenderOptions {
  embedded?: boolean;
  theme?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InfoScreenAPI {
  constructor(
    private http: HttpClient,
    private san: DomSanitizer,
  ) { }

  /** Lists all available layout names */
  listLayouts(): Observable<string[]> {
    return this.http.get<string[]>(`/api/infoscreen/v1/layouts`)
  }

  /** Returns the definition of a given layout */
  getLayout(layout: string): Observable<Layout> {
    return this.http.get<Layout>(`/api/infoscreen/v1/layout/${layout}`)
  }

  /** List all available shows */
  listShows(): Observable<ListShowEntry[]> {
    return this.http.get<ListShowResponse>(`/api/infoscreen/v1/shows`)
      .pipe(
        map(res => res.shows)
      );
  }

  /** Get the configuration of a given show */
  getShow(show: string): Observable<Show> {
    return this.http.get<Show>(`/api/infoscreen/v1/shows/${show}`);
  }

  /** Create or update a new show */
  saveShow(show: Show): Observable<Show> {
    return this.http.post<Show>(`/api/infoscreen/v1/shows/${show.name}`, show);
  }

  /** Delete an existing show */
  deleteShow(show: string): Observable<Show> {
    return this.http.delete<Show>(`/api/infoscreen/v1/shows/${show}`);
  }

  /** Get a slide-preview URL */
  previewSlideUrl(show: string, sidx: number, renderOpts: RenderOptions = {}): SafeResourceUrl {
    let urlVars = new HttpParams()
      .set('preview', `${sidx}`)
      .set('no-cache', `${(new Date()).valueOf()}`);

    if (renderOpts?.embedded) {
      urlVars = urlVars.set('embedded', 'true')
    }

    if (renderOpts?.theme) {
      urlVars = urlVars.set('theme', renderOpts!.theme)
    }

    return this.san.bypassSecurityTrustResourceUrl(`/api/infoscreen/v1/shows/${show}/play?${urlVars.toString()}`)
  }

  playUrl(show: string, renderOpts: RenderOptions = {}): SafeResourceUrl {
    let urlVars = new HttpParams();
    if (renderOpts?.embedded) {
      urlVars = urlVars.set('embedded', 'true')
    }
    if (renderOpts?.theme) {
      urlVars = urlVars.set('theme', renderOpts!.theme)
    }
    return this.san.bypassSecurityTrustResourceUrl(
      `/api/infoscreen/v1/shows/${show}/play?${urlVars.toString()}`
    )
  }

  /** Get a preview-URL for a layout using the given vars. */
  // TODO(ppacher): add support for theme and background.
  previewLayoutUrl(layout: string, vars: Vars): SafeResourceUrl {
    let urlVars = new HttpParams()
      .set('no-cache', `${(new Date()).valueOf()}`);

    for (let key in vars) {
      let value = vars[key];
      if (Array.isArray(value)) {
        urlVars = urlVars.appendAll({
          [key]: value,
        })
        continue
      }
      urlVars = urlVars.set(key, `${value}`)
    }

    return this.san.bypassSecurityTrustResourceUrl(`/api/infoscreen/v1/layout/${layout}/preview?${urlVars.toString()}`);
  }
}

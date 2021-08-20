import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { DomSanitizer, SafeResourceUrl, SafeUrl } from "@angular/platform-browser";
import { Observable } from "rxjs";
import { catchError, map } from "rxjs/operators";

export interface Vars {
  [key: string]: string | number | boolean | string[];
}

export interface Layout {
  name: string;
  displayName?: string;
  file?: string;
  content?: string;
  description?: string;
  variables: Variable[];
}

export interface Variable {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  format?: '' | 'plain' | 'html';
  multiline?: boolean;
  multi?: boolean;
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
  theme?: string;
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

  emptyValue(variable: Variable) {
    let def: any;
    switch (variable.type) {
      case "string": def = ''; break;
      case "number": def = 0; break;
      case 'boolean': def = false; break;
    }
    if (variable.multi) {
      def = [];
    }
    // if there's only a limited set of allowed values we
    // use the first one as the default since "" might not be
    // allowed.
    if (!!variable.choices) {
      def = variable.choices[0];
    }
    return def;
  }

  isEnabled(): Observable<boolean> {
    return this.http.get<{ enabled: boolean }>('/api/infoscreen/v1')
      .pipe(map(res => res.enabled));
  }

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
    return this.http.post<Show>(`/api/infoscreen/v1/show/${show.name}`, show);
  }

  /** Delete an existing show */
  deleteShow(show: string): Observable<Show> {
    return this.http.delete<Show>(`/api/infoscreen/v1/shows/${show}`);
  }

  /** Upload an asset */
  uploadAsset(layout: string, varName: string, file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file)
    interface response {
      filename: string;
    }
    return this.http.post<response>(`/api/infoscreen/v1/upload/${layout}/${varName}`, formData)
      .pipe(map(r => r.filename));
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

  playUrlString(show: string, renderOpts: RenderOptions = {}): string {
    let urlVars = this.renderOptsToVars(renderOpts);
    return `/api/infoscreen/v1/shows/${show}/play?${urlVars.toString()}`
  }

  playUrl(show: string, renderOpts: RenderOptions = {}): SafeResourceUrl {
    return this.san.bypassSecurityTrustResourceUrl(
      this.playUrlString(show, renderOpts)
    )
  }

  /** Generates a preview for the given slide */
  previewLayoutUrl(slide: Slide, renderOpts?: RenderOptions): Observable<SafeResourceUrl> {
    let urlVars = this.renderOptsToVars(renderOpts);
    return this.http.post<{ key: string }>(`/api/infoscreen/v1/preview?${urlVars.toString()}`, slide)
      .pipe(
        map(key => this.san.bypassSecurityTrustResourceUrl(`/api/infoscreen/v1/preview/${key.key}/`)),
      );
  }

  private renderOptsToVars(renderOpts?: RenderOptions): HttpParams {
    let urlVars = new HttpParams();
    if (renderOpts?.embedded) {
      urlVars = urlVars.set('embedded', 'true')
    }
    if (renderOpts?.theme) {
      urlVars = urlVars.set('theme', renderOpts!.theme)
    }
    return urlVars
  }
}

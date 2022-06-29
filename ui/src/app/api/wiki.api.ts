import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";

export interface Collection {
  name: string;
  imageUrl: string;
  description: string;
}

export interface Document {
  path: string;
  collection: string;
  title: string;
  description: string;
  metadata: Metadata;
  content: string;
}

export interface Metadata {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  tags: string[];
  owner: string;
  content: ContentMetadata;
}

export interface Reference {
  collection: string;
  path: string;
}

export interface Backlink extends Reference {
  title: string;
}

export interface ContentMetadata {
  references: Reference[];
}

export interface ListCollectionResponse {
  collections: Collection[];
}

export interface GetCollectionResponse {
  collection: Collection;
}

export interface CreateDocumentRequest {
  content: string;
  title: string;
  description: string;
  tags: string[];
  owner: string;
}

export interface UpdateDocumentRequest {
  content?: string;
  title?: string;
  description?: string;
  tags?: string[];
  owner?: string;
  path?: string;
  collection?: string;
}

export interface DocumentResponse {
  document?: Document;
  children?: Document[];
  backlinks?: Backlink[];
}

export interface SearchDocumentResponse {
  results: Document[] | null;
}

export interface RecentlyUpdatedDocumentResponse {
  results: Document[] | null;
}

type OptionalProps<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>

@Injectable({providedIn: 'root'})
export class WikiAPI {
  constructor(private http: HttpClient) {}

  /** Access to wiki collections */
  readonly collections = new class {
    constructor(private http: HttpClient) {}

    get(name: string) {
      return this.http.get<GetCollectionResponse>(`/api/wiki/v1/collections/${name}`)
    }

    list() {
      return this.http.get<ListCollectionResponse>(`/api/wiki/v1/collections/`)
    }

    create(col: OptionalProps<Collection, 'imageUrl'>) {
      return this.http.post<void>(`/api/wiki/v1/collections/`, col)
    }

    update(col: OptionalProps<Collection, 'imageUrl'>) {
      return this.http.put<void>(`/api/wiki/v1/collections/${col.name}`, col)
    }

    delete(nameOrCol: string | Pick<Collection, 'name'>) {
      return this.http.delete<void>(`/api/wiki/v1/collections/${typeof nameOrCol === 'string' ? nameOrCol : nameOrCol.name}`)
    }
  }(this.http)


  readonly documents = new class {
    constructor (private http: HttpClient) {}

    search(term: string) {
      return this.http.post<SearchDocumentResponse>(`/api/wiki/v1/search`, {
        search: term,
      })
    }

    recentlyUpdated() {
      return this.http.get<RecentlyUpdatedDocumentResponse>(`/api/wiki/v1/recently-updated`)
    }

    load(col: string, path: string, {exclude, recursive}: {exclude?: ('document'|'children'|'backlinks')[], recursive?: boolean} = {}) {
      if (path.startsWith('/')) {
        path = path.substring(1)
      }

      let params = new HttpParams();
      if (!!exclude) {
        exclude.forEach(e => params = params.append('exclude', e))
      }

      if (recursive) {
        params = params.set("recursive", "true")
      }

      return this.http.get<DocumentResponse>(`/api/wiki/v1/collections/${col}/${path}`, {params})
    }

    create(collection: string, path: string, doc: CreateDocumentRequest) {
      if (path.startsWith('/')) {
        path = path.substring(1)
      }

      return this.http.post<void>(`/api/wiki/v1/collections/${collection}/${path}`, doc)
    }

    update(collection: string, path: string, upd: UpdateDocumentRequest) {
      if (path.startsWith('/')) {
        path = path.substring(1)
      }

      return this.http.put<void>(`/api/wiki/v1/collections/${collection}/${path}`, upd)
    }

    delete(collection: string, path: string) {
      if (path.startsWith('/')) {
        path = path.substring(1)
      }

      return this.http.delete<void>(`/api/wiki/v1/collections/${collection}/${path}`)
    }
  }(this.http)
}

import { Injectable, TemplateRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PageHeader {
  title: string;
  description: string;
  iconTemplate?: TemplateRef<any>;
  breadcrumps?: Breadcrump[];
}

export interface Breadcrump {
  name: string;
  route: string | string[];
}

@Injectable({
  providedIn: 'root',
})
export class HeaderTitleService {
  private headerSubj = new BehaviorSubject<PageHeader | TemplateRef<any>>({
    title: '',
    description: '',
  });

  set(tmpl: TemplateRef<any>): void;
  set(s: string, description?: string, icon?: TemplateRef<any>, breadcrumps?: Breadcrump[]);

  set(
    s: string | TemplateRef<any>,
    description = '',
    icon: TemplateRef<any> | null = null,
    breadcrumps: Breadcrump[] = []
  ): void {

    if (typeof s === "string") {
      this.headerSubj.next({
        title: s,
        description: description,
        iconTemplate: icon || undefined,
        breadcrumps: breadcrumps || [],
      });
    } else {
      this.headerSubj.next(s);
    }

  }

  get change(): Observable<PageHeader | TemplateRef<any>> {
    return this.headerSubj.asObservable();
  }
}

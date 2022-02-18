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
  providedIn: 'root'
})
export class HeaderTitleService {
  private headerSubj = new BehaviorSubject<PageHeader>({title: '', description: ''});

  set(s: string, description = '', icon: TemplateRef<any> | null = null, breadcrumps: Breadcrump[] = []): void {
    this.headerSubj.next({
      title: s,
      description: description,
      iconTemplate: icon || undefined,
      breadcrumps: breadcrumps || [],
    });
  }

  get change(): Observable<PageHeader> {
    return this.headerSubj.asObservable();
  }
}


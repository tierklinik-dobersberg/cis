import { Injectable, TemplateRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PageHeader {
  title: string;
  description: string;
  iconTemplate?: TemplateRef<any>;
}

@Injectable({
  providedIn: 'root'
})
export class HeaderTitleService {
  private headerSubj = new BehaviorSubject<PageHeader>({title: '', description: ''});

  set(s: string, description = '', icon: TemplateRef<any> | null = null): void {
    this.headerSubj.next({
      title: s,
      description: description,
      iconTemplate: icon || undefined,
    });
  }

  get change(): Observable<PageHeader> {
    return this.headerSubj.asObservable();
  }
}


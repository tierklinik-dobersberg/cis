import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HeaderTitleService {
  private headerSubj = new BehaviorSubject<string>('');

  set(s: string): void {
    this.headerSubj.next(s);
  }

  get change(): Observable<string> {
    return this.headerSubj.asObservable();
  }
}

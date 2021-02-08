import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class HeaderTitleService {
    private headerSubj = new BehaviorSubject<string>('');

    set(s: string) {
        this.headerSubj.next(s);
    }

    get change() {
        return this.headerSubj.asObservable();
    }
}
import { Injectable } from "@angular/core";
import { CanDeactivate } from "@angular/router";
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable } from 'rxjs';

export interface HasChangesDetector {
  hasChanges(): boolean | Promise<boolean> | Observable<boolean>;
}

@Injectable({providedIn: 'root'})
export class HasChangesGuard<T extends HasChangesDetector> implements CanDeactivate<T> {
    constructor(
      private nzMessage: NzMessageService,
    ) {}

    canDeactivate(component: T) {
      if (component.hasChanges()) {
        this.nzMessage.warning("Du hast nicht gespeicherte Änderungen")
        return false;
      }

      return true;
    }
}

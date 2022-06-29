import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable()
export class WikiHelper {
  private reloadCollections$ = new BehaviorSubject<void>(undefined);


  collectionChange() {
    return this.reloadCollections$.asObservable();
  }

  notifyCollectionChange() {
    this.reloadCollections$.next();
  }
}

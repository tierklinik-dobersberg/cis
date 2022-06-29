import { HeroIconName } from "ng-heroicon";
import { Collection } from "src/app/api/wiki.api";

export interface CollectionModel extends Collection {
  heroIcon?: HeroIconName;
}

export function extendCollection(col: Collection): CollectionModel {
  return {
    ...col,
    heroIcon: ((col.imageUrl || '').startsWith('hi:') ? col.imageUrl.substring(3) : undefined) as any
  }
}

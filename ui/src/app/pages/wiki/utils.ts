import { Collection } from "src/app/api/wiki.api";

export interface CollectionModel extends Collection {
}

export function extendCollection(col: Collection): CollectionModel {
  return {
    ...col,
  }
}

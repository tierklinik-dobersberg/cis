import { IterableChanges, IterableDifferFactory } from "@angular/core";
import { Permission } from "@tkd/api";

export function getOperations(factory: IterableDifferFactory, oldSet: Permission[], newSet: Permission[]): IterableChanges<Permission> {
  const differ = factory.create<Permission>((_: number, perm: Permission) => perm.id);
  // add the current set
  differ.diff(oldSet)

  return differ.diff(newSet);
}

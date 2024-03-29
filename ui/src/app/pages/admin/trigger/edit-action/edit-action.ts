import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from "@angular/core";
import { NZ_MODAL_DATA, NzModalRef } from "ng-zorro-antd/modal";
import { ActionType, TriggerAPI } from "src/app/api";

@Component({
  templateUrl: './edit-action.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditActionComponent {
  /** All available action types as returned by the backend */
  availableTypes: ActionType[] = [];

  /** The currently selected action type. Changing this should reset config={} */
  selectedActionType: ActionType | null = null;

  /** The current configuration for the selectedActionType */
  config: {[key: string]: any} = {};

  constructor(
    private nzModalRef: NzModalRef,
    private cdr: ChangeDetectorRef,
    private triggerAPI: TriggerAPI,
  ) {
    const data = inject(NZ_MODAL_DATA);

    Object.assign(this, data);
  }

  onActionTypeChanged() {
    this.config = {};
  }
}

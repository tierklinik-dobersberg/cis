import { EventEmitter, ChangeDetectionStrategy, Component, Output, Input } from "@angular/core";

@Component({
  selector: 'tkd-list-action-buttons',
  templateUrl: './list-btn-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListActionButtonGroupComponent<T> {
  @Input()
  value: T | undefined;

  @Output()
  onEdit = new EventEmitter<T | undefined>();

  @Output()
  onDelete = new EventEmitter<T | undefined>();
}

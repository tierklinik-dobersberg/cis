import { EventEmitter, ChangeDetectionStrategy, Component, Output, Input } from "@angular/core";

@Component({
  selector: 'tkd-list-action-buttons', // eslint-disable-line
  templateUrl: './list-btn-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListActionButtonGroupComponent<T> {
  @Input()
  value: T | undefined;

  @Output()
  edit = new EventEmitter<T | undefined>();

  @Output()
  delete = new EventEmitter<T | undefined>();
}

import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, TrackByFunction } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { Permission } from "src/app/api";

@Component({
  selector: 'app-permissions-view',
  templateUrl: './permissions-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => PermissionsViewComponent)},
  ]
})
export class PermissionsViewComponent implements ControlValueAccessor {
  showNewDialog = false;

  @Input()
  permissions: Permission[] = [];

  newPermission: Permission = {
    id: '',
    description: '',
    actions: [],
    resources: [],
    domain: [],
    effect: 'allow',
  }

  addNew() {
    this.newPermission= {
      id: '' + new Date().valueOf(), // just temporary, will be created on the backend
      actions: [],
      resources: [],
      description: '',
      domain: [],
      effect: 'allow',
    }
    this.showNewDialog = true;
  }

  handleCancel() {
    this.showNewDialog = false;
  }

  handleSave() {
    this.permissions = [
      ...this.permissions,
      this.newPermission,
    ]

    this.showNewDialog = false;

    this._onChange(this.permissions);
    this.cdr.detectChanges();
  }

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() { return this._disabled; }
  private _disabled = false;

  /** Implements the ControlValueAccessor interface. */
  setDisabledState(isDisabled: boolean) {
    this._disabled = isDisabled;
  }

  /** Implements the ControlValueAccessor interface. */
  writeValue(perms: Permission[]): void {
    this.permissions = perms;
    this.cdr.markForCheck();
  }

  /** Removes an existing permission by index */
  remove(index :number) {
    this.permissions = [...this.permissions];
    this.permissions.splice(index, 1);
    this._onChange(this.permissions);
  }

  /** Implements the ControlValueAccessor interface. */
  _onBlur: () => void = () => {}
  registerOnTouched(fn: any): void {
      this._onBlur = fn;
  }

  /** Implements the ControlValueAccessor interface. */
  _onChange: (v: Permission[]) => void = () => {}
  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  trackPermission: TrackByFunction<Permission> = (_: number, perm: Permission) => perm.id;

  constructor(
    private cdr: ChangeDetectorRef
  ) { }
}

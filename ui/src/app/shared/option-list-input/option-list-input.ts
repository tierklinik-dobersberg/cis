import { coerceBooleanProperty, coerceNumberProperty } from "@angular/cdk/coercion";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, TrackByFunction } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { OptionSpec } from "src/app/api";

@Component({
  selector: 'tkd-option-list-input',
  templateUrl: './option-list-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => TkdOptionListInput)}
  ]
})
export class TkdOptionListInput implements ControlValueAccessor {
  @Input()
  specs: OptionSpec[] = []

  config: {
    [key: string]: any,
  } = {}

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v))
  }
  get disabled() { return this._disabled; }
  private _disabled = false;

  @Input()
  set showIndex(v: any) {
    this._showIndex = coerceBooleanProperty(v);
  }
  get showIndex() { return this._showIndex; }
  private _showIndex = false;

  @Input()
  set indexOffset(v: any) {
    this._indexOffset = coerceNumberProperty(v);
  }
  get indexOffset() { return this._indexOffset}
  private _indexOffset = 1;

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  trackSpec: TrackByFunction<OptionSpec> = (_: number, spec: OptionSpec) => spec.name;

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }

  writeValue(obj: any): void {
    this.config = obj || {};
    this.cdr.markForCheck();
  }

  _onChanged: (_: any) => void = () => {}
  registerOnChange(fn: any): void {
      this._onChanged = fn;
  }

  _onBlur: () => void = () => {}
  registerOnTouched(fn: any): void {
      this._onBlur = fn;
  }
}

import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, Input, Output } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { OptionSpec } from "src/app/api";


@Component({
  selector: 'tkd-option-spec-input',
  templateUrl: './option-spec-input.html',
  styleUrls: ['./option-spec-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => TkdOptionSpecInputComponent)}
  ]
})
export class TkdOptionSpecInputComponent implements ControlValueAccessor {
  private _disabled = false;

  @Input()
  index: string | number | null = null;

  @Input()
  spec: OptionSpec | null = null;

  @Input()
  value: any;

  @Output()
  valueChange = new EventEmitter<any>();

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v))
  }
  get disabled() { return this._disabled };

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  writeValue(obj: any): void {
    this.value = obj;
    this.valueChange.next(obj);
    this.cdr.markForCheck();
  }

  _onChanged: (v: any) => void = () => {}
  registerOnChange(fn: any): void {
      this._onChanged = fn;
  }

  _onBlur: () => void = () => {}
  registerOnTouched(fn: any): void {
      this._onBlur = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
    this.cdr.markForCheck();
  }
}

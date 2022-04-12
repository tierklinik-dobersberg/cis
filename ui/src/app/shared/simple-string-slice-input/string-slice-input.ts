import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  EventEmitter,
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  Input,
  Output,
  TrackByFunction,
  ChangeDetectorRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  /* eslint '@angular-eslint/component-selector': 'off' */
  selector: 'tkd-string-slice-input',
  templateUrl: './string-slice-input.html',
  styleUrls: ['./string-slice-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => TkdStringSliceInputComponent),
    },
  ],
})
export class TkdStringSliceInputComponent implements ControlValueAccessor {
  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() {
    return this._disabled;
  }
  private _disabled = false;

  @Input()
  tooltip: string | null = null;

  @Input()
  placeholder: string | null = null;

  @Input()
  set value(v: string[]) {
    if (!v || v.length === 0) {
      v = [''];
    }
    this._value = v;
  }
  get value() {
    return this._value;
  }
  private _value: string[] = [];

  @Output()
  valueChange = new EventEmitter<string[]>();

  constructor(private cdr: ChangeDetectorRef) {}

  /** simple track by function that is based on the item index */
  trackByIndex: TrackByFunction<string> = (idx: number, _: string) => idx;

  /** Marks the control as disabled. Required by the ControlValueAccessor interface */
  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }

  /** Updates the current value of the input. Required by the ControlValueAccessor interface */
  writeValue(obj: string[] | null): void {
    this.value = obj || [];
    // we emit on valueChange here because the update likely originated
    // from a NgModel binding
    this.valueChange.next(this.value);
    this.cdr.markForCheck();
  }

  /** On-Touch handling for the ControlValueAccessor */
  _onBlur: () => void = () => {};
  registerOnTouched(fn: any): void {
    this._onBlur = fn;
  }

  /** On-Change handling for the ControlValueAccessor */
  _onChanged: (v: string[]) => void = () => {};
  registerOnChange(fn: (_: string[]) => void): void {
    this._onChanged = fn;
  }

  /** Adds a new empty entry */
  addEntry() {
    this.value = [...this.value, ''];
    this.emitChanged();
  }

  removeEntry(idx: number) {
    this.value.splice(idx, 1);
    this.value = [...this.value];
    this.emitChanged();
  }

  private emitChanged() {
    this._onChanged(this.value);
    this.valueChange.next(this.value);
  }
}

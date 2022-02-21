import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  ConfigAPI,
  OptionSpec,
  PossibleValue,
  WellKnownAnnotations,
} from 'src/app/api';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

export type NamedOptionSpec = OptionSpec & { displayName?: string };

@Component({
  /* eslint '@angular-eslint/component-selector': 'off' */
  selector: 'tkd-option-spec-input',
  templateUrl: './option-spec-input.html',
  styleUrls: ['./option-spec-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => TkdOptionSpecInputComponent),
    },
  ],
})
export class TkdOptionSpecInputComponent
  implements ControlValueAccessor, OnChanges
{
  private _disabled = false;

  @Input()
  index: string | number | null = null;

  @Input()
  spec: NamedOptionSpec | null = null;

  @Input()
  value: any;

  @Output()
  valueChange = new EventEmitter<any>();

  isSecret = false;
  isSliceType = false;
  possibleValues: PossibleValue[] | null = null;

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() {
    return this._disabled;
  }

  constructor(private configapi: ConfigAPI, private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if ('spec' in changes) {
      this.isSecret = this.configapi.hasAnnotation(
        changes.spec.currentValue,
        WellKnownAnnotations.Secret
      );
      this.isSliceType =
        (changes.spec.currentValue as OptionSpec).type?.includes('[]') || false;
      this.configapi
        .resolvePossibleValues(changes.spec.currentValue)
        .then((values) => {
          this.possibleValues = values;
          this.cdr.markForCheck();
        });
    }
  }

  writeValue(obj: any): void {
    this.value = obj;
    this.valueChange.next(obj);
    this.cdr.markForCheck();
  }

  _onChanged: (v: any) => void = () => {};
  registerOnChange(fn: any): void {
    this._onChanged = fn;
  }

  _onBlur: () => void = () => {};
  registerOnTouched(fn: any): void {
    this._onBlur = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
    this.cdr.markForCheck();
  }
}

import { EventEmitter, ChangeDetectionStrategy, Component, Directive, Host, Optional, Input, Output, booleanAttribute, inject, ChangeDetectorRef, forwardRef, TemplateRef, OnInit, OnChanges, SimpleChanges } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { CandyDate } from "ng-zorro-antd/core/time";
import { LayoutService } from "src/app/services";

export type DateInput = Date | string | number;

function coerceDate(v: DateInput | DateInput[]): Date | Date[] {
  if (Array.isArray(v)) {
    return v.map(d => new CandyDate(d).nativeDate)
  }

  return new CandyDate(v).nativeDate;
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tkd-date-input, tkd-date-range-input',
  templateUrl: './date-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true }
  ]
})
export class DateInputComponent implements OnChanges, OnInit, ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);
  public readonly layout = inject(LayoutService).withAutoUpdate();

  isRangeInput = false;

  @Input()
  set value(input: DateInput | DateInput[]) {
    this.updateValue(input, false)
  }
  get value(): Date | Date[] {
    return this._value;
  }
  private _value: Date | Date[] = [null, null];


  @Output()
  valueChange = new EventEmitter<Date | Date[] | null>();

  @Input({ transform: coerceDate })
  min: Date | null = null;

  @Input({ transform: coerceDate })
  max: Date | null = null;

  @Input({ transform: booleanAttribute })
  showTime = false;

  @Input({transform: booleanAttribute})
  disabled = false;

  @Input()
  nzDateRender: TemplateRef<Date> | null = null;

  ngOnInit(): void {
    this.updateValue(null, false)
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('showTime' in changes) {
      this.updateValue(this._value, true)
    }
  }

  writeValue(v: any) {
    this.updateValue(v, false)
  }

  private _onChange: any = () => {}
  registerOnChange(fn: any): void {
    this._onChange = fn
  }

  _onBlur: any = () => {}
  registerOnTouched(fn: any): void {
    this._onBlur = fn
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled
  }

  nzIsDateDisabled = (v: Date) => {
    if (this.min) {
      if (v.getTime() < this.min.getTime()) {
        return true
      }
    }

    if (this.max) {
      if (v.getTime() > this.max.getTime()) {
        return true
      }
    }

    return false
  }

  updateValue(value: DateInput | DateInput[], emit = true) {
    if (!value) {
      if (this.isRangeInput) {
        this._value = [null, null]
      } else {
        this._value = null;
      }

      if (emit) {
        this._onChange(null);
        this.valueChange.next(null)
      }

      return
    }

    if (this.isRangeInput) {
      if (!Array.isArray(value)) {
        throw new Error("invalid value for range-input: expected an array")
      }

      if (value.length !== 2) {
        throw new Error("invalid value for range-input: expected array with two entries")
      }

      let from = new CandyDate(value[0])
      let to = new CandyDate(value[1])

      if (!this.showTime) {
        if (from.isValid()) {
          from = from.setHms(0, 0, 0)
        }

        if (to.isValid()) {
          to = to.setHms(23, 59, 59)
        }
      } else {
        if (from.isValid()) {
          from = from.setHms(from.getHours(), from.getMinutes(), 0)
        }

        if (to.isValid()) {
          to = to.setHms(to.getHours(), to.getMinutes(), 0)
        }
      }

      if (from.isValid() && to.isValid() && from.getTime() > to.getTime()) {
        [from, to] = [to, from]
      }

      if (!from.isValid()) {
        from = null
      }

      if (!to.isValid()) {
        to = null
      }

      const updated = [
        from?.nativeDate || null,
        to?.nativeDate || null
      ]

      this._value = updated;

    } else {
      if (Array.isArray(value)) {
        throw new Error("invalid value for date-input")
      }

      let updated = new CandyDate(value)

      if (!this.showTime) {
        updated = updated.setHms(0, 0, 0)
      }

      this._value = updated.nativeDate;
    }

    if (emit) {
      this.valueChange.next(this.value);
      this._onChange(this.value);
    }

    this.cdr.markForCheck();
  }
}

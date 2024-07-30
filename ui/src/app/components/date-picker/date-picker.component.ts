import { coerceArray } from '@angular/cdk/coercion';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ContentChild,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  QueryList,
  signal,
  untracked,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendar,
  lucideClock,
} from '@ng-icons/lucide';
import { BrnPopoverModule } from '@spartan-ng/ui-popover-brain';
import { BrnSeparatorComponent } from '@spartan-ng/ui-separator-brain';
import { BrnSheetModule } from '@spartan-ng/ui-sheet-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmInputModule } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  IsSameDayPipe,
  ToDatePipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmPopoverModule } from '@tierklinik-dobersberg/angular/popover';
import { HlmSeparatorModule } from '@tierklinik-dobersberg/angular/separator';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { coerceDate } from '@tierklinik-dobersberg/angular/utils/date';
import {
  addMonths,
  endOfDay,
  getDate,
  getHours,
  getMinutes,
  getMonth,
  getYear,
  isAfter,
  isBefore,
  setDate,
  setHours,
  setMinutes,
  setMonth,
  setYear,
  startOfDay
} from 'date-fns';
import { combineLatest, debounceTime, startWith } from 'rxjs';
import { AppDateTableModule, CalendarRange } from '../date-table';
import { RangeClasses } from '../date-table/highlight-range.directive';
import {
  AppPopoverTriggerDirective,
  AppSheetTriggerDirective,
} from '../triggers';
import { TkdDatePickerInputDirective } from './picker-input.directive';

export type DatePickerVariant = 'default' | 'inline';
export type DatePickerMode = 'single' | 'range';

@Component({
  selector: 'tkd-date-picker',
  standalone: true,
  templateUrl: './date-picker.component.html',
  imports: [
    AppDateTableModule,
    BrnPopoverModule,
    HlmPopoverModule,
    HlmInputModule,
    DatePipe,
    NgClass,
    IsSameDayPipe,
    ToDatePipe,
    DatePipe,
    FormsModule,
    HlmIconModule,
    HlmButtonDirective,
    AppPopoverTriggerDirective,
    BrnSeparatorComponent,
    HlmSeparatorModule,
    HlmLabelDirective,
    NgTemplateOutlet,
    BrnSheetModule,
    HlmSheetModule,
    AppSheetTriggerDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ...provideIcons({
      lucideCalendar,
      lucideArrowLeft,
      lucideArrowRight,
      lucideClock,
    }),
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: TkdDatePickerComponent,
      multi: true,
    },
  ],
})
export class TkdDatePickerComponent
  implements ControlValueAccessor, AfterViewInit
{
  private readonly destroyRef = inject(DestroyRef);
  protected readonly layout = inject(LayoutService);

  @ContentChild(TkdDatePickerInputDirective)
  inputDirective?: TkdDatePickerInputDirective;

  /** The display mode to render */
  public readonly variant = input<DatePickerVariant>('default');

  /** The date picker mode */
  public readonly mode = input<DatePickerMode>('single');

  /** Whether or not the user should be able to set the time as well */
  public readonly withTime = input(false, { transform: booleanAttribute });

  /** The current value */
  public readonly value = model<[Date | null, Date | null] | null>([
    null,
    null,
  ]);

  /** Whether or not the input can be null */
  public readonly allowClear = input(false, { transform: booleanAttribute });

  /** Whether or not the input is disabled */
  public readonly disabled = model(false);

  /** The list of hours to render */
  public readonly hours = input(Array.from(Array(24).keys()));

  /** The list of minutes to render */
  public readonly minutes = input(Array.from(Array(60).keys()));

  /** A list of calendar ranges to display */
  public readonly ranges = input<CalendarRange[], CalendarRange>([], {
    transform: coerceArray,
  });

  /** The classes to apply to individual calendar ranges. */
  public readonly rangeClasses = input<RangeClasses>({});

  /** The current date displayed in the date-table */
  protected readonly calendarDate = signal<Date>(new Date());

  /** The currently hovered date, if any. Used to create a "highlighting" calendar range */
  protected readonly hoveredDate = signal<Date | null>(null);

  /** Notification callback for NG_VALUE_ACCESSOR */
  protected _onChange = (_: any) => {};

  protected readonly _computedRangeClasses = computed(() => {
    let userClasses = this.rangeClasses();
    if (!userClasses) {
      userClasses = {};
    }

    return {
      ...userClasses,
      __selected: {
        start: '!bg-primary !rounded-l text-primary-foreground font-medium',
        between: 'bg-primary/10 rounded-none',
        end: '!bg-primary !rounded-r text-primary-foreground font-medium',
      },
      __hovered: {
        between: 'bg-primary/10 rounded-none',
        end: '!rounded-r font-medium',
      },
    };
  });

  protected readonly _computedRanges = computed(() => {
    const userRanges = [...this.ranges()];
    const value = this.value();

    let range: Partial<CalendarRange> = {
      id: '__selected',
    };

    if (this.isRangeSelect()) {
      range.from = value[0];
      range.to = value[1] || value[0];
    } else {
      range.from = value[0];
      range.to = value[0];
    }

    if (range.from && range.to) {
      userRanges.splice(0, 0, range as CalendarRange);
    }

    if (this.isRangeSelect() && range.from && !value[1]) {
      if (this.hoveredDate() && isAfter(this.hoveredDate(), range.from)) {
        userRanges.splice(1, 0, {
          id: '__hovered',
          from: range.from,
          to: this.hoveredDate(),
        });
      }
    }

    return userRanges;
  });

  protected readonly _computedStartDate = computed(() => {
    const value = this.value();
    return value[0];
  });

  protected readonly _computedEndDate = computed(() => {
    const value = this.value();
    return value[1];
  });

  /** The currently selected hour */
  protected readonly _computedCurrentStartHour = computed(() => {
    const value = this._computedStartDate();
    if (value) {
      const date = coerceDate(value);
      return getHours(date);
    }

    return 0;
  });

  /** THe currently selected minute */
  protected readonly _computedCurrentStartMinute = computed(() => {
    const value = this._computedStartDate();
    if (value) {
      const date = coerceDate(value);
      return getMinutes(date);
    }

    return 0;
  });

  /** The currently selected hour */
  protected readonly _computedCurrentEndHour = computed(() => {
    const value = this._computedEndDate();
    if (value) {
      const date = coerceDate(value);
      return getHours(date);
    }

    return 0;
  });

  /** THe currently selected minute */
  protected readonly _computedCurrentEndMinute = computed(() => {
    const value = this._computedEndDate();
    if (value) {
      const date = coerceDate(value);
      return getMinutes(date);
    }

    return 0;
  });

  @ViewChildren('hourBtn', { read: ElementRef })
  protected hourBtns: QueryList<ElementRef<HTMLButtonElement>>;

  @ViewChildren('minBtn', { read: ElementRef })
  protected minuteBtns: QueryList<ElementRef<HTMLButtonElement>>;

  @HostListener('blur')
  protected _onTouched = () => {};

  ngAfterViewInit(): void {
    combineLatest([this.hourBtns.changes, this.minuteBtns.changes])
      .pipe(startWith(1), debounceTime(10), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        //this.scrollTimeIntoView();
      });
  }
  
  constructor() {
    effect(() => {
      this.value(); 

      if (this.variant() === 'inline') {
        untracked(() => this.apply())
      }
    }, { allowSignalWrites: true })
    
    
    effect(() => {
      const withTime = this.withTime();

      if (!withTime) {
        untracked(() => {
          const value = this.value();
          this.value.set([
            value[0] ? startOfDay(value[0]) : null,
            value[1] ? endOfDay(value[1]) :null,
          ]);
        })
      }
    }, { allowSignalWrites: true })
  }

  private scrollTimeIntoView() {
    const value = this._computedStartDate();
    if (!value) {
      return;
    }
    const date = coerceDate(value);
    this.hourBtns
      .find(el => +el.nativeElement.getAttribute('hour') === getHours(date))
      ?.nativeElement?.scrollIntoView();

    this.minuteBtns
      .find(el => +el.nativeElement.getAttribute('minute') === getMinutes(date))
      ?.nativeElement?.scrollIntoView();
  }

  writeValue(obj: Date | [Date, Date]): void {
    let value: [Date | null, Date | null];
    if (this.isRangeSelect()) {
      if (obj === null) {
        value = [null, null];
      } else if (!Array.isArray(obj)) {
        throw new Error(
          'InvalidValueError: invalid value for TkdDatePicker in range mode'
        );
      } else {
        if (!obj[0]) {
          value = [null, null]
        } else {
          value = [coerceDate(obj[0]), obj[1] ? coerceDate(obj[1]) : null];
        }
      }
    } else {
      if (obj === null) {
        value = [null, null];
      } else if (Array.isArray(obj)) {
        throw new Error(
          'InvalidValueError: invalid value for TkdDatePicker in signle mode'
        );
      } else {
        value = [coerceDate(obj), null];
      }
    }

    this.value.set(value);
    this.calendarDate.set(coerceDate(value[0] || new Date()));

    // this.scrollTimeIntoView();
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  protected updateDate(val: Date | string) {

    if (typeof val === 'string') {
      val = new Date(val);
    }

    let what: 'start' | 'end' = 'start';
    if (this.mode() === 'range' && this._computedStartDate()) {
      if (!this._computedEndDate()) {
        what = 'end';
      }

      if (what === 'end' && isBefore(val, this._computedStartDate())) {
        what = 'start';
      }
    }
    

    let current = this.value();

    let date =
      !this.isRangeSelect() || what === 'start' ? current[0] : current[1];
    if (!date) {
      date = new Date();
    }

    date = setDate(date, getDate(val));
    date = setMonth(date, getMonth(val));
    date = setYear(date, getYear(date));
    
    if (!this.withTime()) {
      switch (what) {
        case 'start':
          date = startOfDay(date)
          break;
          
        case 'end':
          date = endOfDay(date);
          break
      }
    }

    if (this.isRangeSelect()) {
      switch (what) {
        case 'start':
          this.value.set([date, null]);
          break;

        case 'end':
          this.value.set([current[0], date]);
          break;
      }
    } else {
      this.value.set([date, null]);
    }
  }

  protected nextMonth() {
    const date = coerceDate(this.calendarDate());
    const newDate = addMonths(date, 1);
    this.calendarDate.set(newDate);
  }

  protected prevMonth() {
    const date = coerceDate(this.calendarDate());
    const newDate = addMonths(date, -1);
    this.calendarDate.set(newDate);
  }

  protected today() {
    this.value.set([new Date(), null]);
  }

  protected setHour(h: number, what: 'start' | 'end' = 'start') {
    const current = this.value();
    if (this.isRangeSelect()) {
      if (what === 'start') {
        this.value.set([setHours(current[0], h), current[1]]);
      } else {
        this.value.set([current[0], setHours(current[1], h)]);
      }
    } else {
      this.value.set([setHours(current[0], h), null]);
    }
  }

  protected setMinute(m: number, what: 'start' | 'end' = 'start') {
    const current = this.value();
    if (this.isRangeSelect()) {
      if (what === 'start') {
        this.value.set([setMinutes(current[0], m), current[1]]);
      } else {
        this.value.set([current[0], setMinutes(current[1], m)]);
      }
    } else {
      this.value.set([setMinutes(current[0], m), null]);
    }
  }

  private isRangeSelect(): boolean {
    return this.mode() === 'range';
  }

  public apply() {
    const value = [...this.value()];

    if (this.isRangeSelect()) {
      if (!value[1]) {
        value[1] = endOfDay(value[0])
      }
      
      this._onChange(value);
    } else {
      this._onChange(value[0]);
    }

    this._onTouched();

    if (this.variant() !== 'inline') {
      this.calendarDate.set(coerceDate(this._computedStartDate()));
    }
  }
}

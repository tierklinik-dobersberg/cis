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
  ToDatePipe
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
  startOfDay,
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

  /** The currently selected start date */
  public readonly startDate = model<Date | null>(null);

  /** The currently selected end date */
  public readonly endDate = model<Date | null>(null);

  protected readonly startHour = model(0);
  protected readonly startMinute = model(0);
  protected readonly endHour = model(0);
  protected readonly endMinute = model(0);

  /** Whether or not the input can be null */
  public readonly allowClear = input(false, { transform: booleanAttribute });

  /** Whether or not an open range is allowed. That is, only a start date is set in range mode. */
  public readonly allowOpenRange = input(true, { transform: booleanAttribute });

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

    const start = this.startDate();
    const end = this.endDate();

    let range: Partial<CalendarRange> = {
      id: '__selected',
    };

    if (this.isRangeSelect()) {
      range.from = start;
      range.to = end || start;
    } else {
      range.from = start;
      range.to = start;
    }

    if (range.from && range.to) {
      userRanges.splice(0, 0, range as CalendarRange);
    }

    if (this.isRangeSelect() && range.from && !end) {
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

  protected readonly _computedEndDate = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    const allowOpenRange = this.allowOpenRange();

    if (!this.isRangeSelect()) {
      return null;
    }

    if (end) {
      return end;
    }

    if (!allowOpenRange) {
      return start
    }

    return null
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
        const start = this.startDate()
        const end = this.endDate();

        this.scrollTimeIntoView('start', start);
        if (end) {
          this.scrollTimeIntoView('end', end)
        }
      });
  }

  constructor() {
    effect(
      () => {
        // We immediately apply the value in "inline" mode
        // every time one of the following signal changes
        const start = this.startDate();
        const end = this.endDate();

        if (this.variant() === 'inline') {
          untracked(() => this.apply());

          this.scrollTimeIntoView('start', start);
          if (end) {
            this.scrollTimeIntoView('end', end);
          }
        }
      },
      { allowSignalWrites: true }
    );
  }

  protected clear() {
    if (!this.allowClear()) {
      return;
    }

    this.startDate.set(null);
    this.endDate.set(null);
  }

  protected handleSwipe(evt: any) {
    const x =
      Math.abs(evt.deltaX) > 40 ? (evt.deltaX > 0 ? 'right' : 'left') : '';

    switch (x) {
      case 'left':
        this.nextMonth()
        break;
      case 'right':
        this.prevMonth();
        break;
    }
  }

  private scrollTimeIntoView(what: 'start' | 'end', value: Date) {
    if (!value) {
      console.log("no value, not scrolling into view")
      return;
    }

    const date = coerceDate(value);

    const hourKey = what + '-hour-' + getHours(date);
    const minuteKey = what + '-minute-' + getMinutes(date);

    const hourBtn = this.hourBtns
      .find(el => el.nativeElement.id === hourKey);

    hourBtn?.nativeElement?.scrollIntoView({
      behavior: 'smooth'
    });

    const minBtn = this.minuteBtns
      .find(el => el.nativeElement.id === minuteKey);

    minBtn?.nativeElement?.scrollIntoView({
      behavior: 'smooth'
    });

    console.log("scrolling", what, hourKey, hourBtn, minuteKey, minBtn)
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
          value = [null, null];
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

    if (value[0]) {
      this.applyDate(value[0], 'start');
    } else {
      this.startDate.set(null);
    }

    if (value[1]) {
      this.applyDate(value[1], 'end');
    } else {
      this.endDate.set(null);
    }

    this.calendarDate.set(value[0] || new Date());

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

    const start = this.startDate();
    const end = this.endDate();

    let what: 'start' | 'end' = 'start';
    if (this.mode() === 'range' && start) {
      if (!end) {
        what = 'end';
      }

      if (what === 'end' && isBefore(val, start)) {
        what = 'start';
      }
    }

    let date = what === 'start' ? start : end;
    if (!date) {
      const withTime = this.withTime();

      date = new Date();

      if (what === 'start') {
        if (withTime) {
          date = setHours(date, this.startHour())
          date = setMinutes(date, this.startMinute())
        } else {
          date = startOfDay(date);
        }
      } else {
        if (withTime) {
          date = setHours(date, this.endHour())
          date = setMinutes(date, this.endMinute());
        } else {
          date = endOfDay(date);
        }
      }
    }

    date = setDate(date, getDate(val));
    date = setMonth(date, getMonth(val));
    date = setYear(date, getYear(val));

    this.applyDate(date, what);
    if (what === 'start') {
      this.endDate.set(null);
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
    const now = new Date();
    this.applyDate(startOfDay(now), 'start');
    this.applyDate(endOfDay(now), 'end');
  }

  private applyDate(date: Date, what: 'start' | 'end') {
    const hours = getHours(date);
    const minutes = getMinutes(date);

    if (what === 'start') {
      this.startDate.set(date);
      this.startHour.set(hours);
      this.startMinute.set(minutes);
    } else {
      this.endDate.set(date);
      this.endHour.set(hours);
      this.endMinute.set(minutes);
    }
  }

  protected setHour(h: number, what: 'start' | 'end') {
    let date = what === 'start' ? this.startDate() : this.endDate();

    if (!date) {
      date = new Date();
    }

    date = setHours(date, h);
    this.applyDate(date, what);
  }

  protected setMinute(m: number, what: 'start' | 'end') {
    let date = what === 'start' ? this.startDate() : this.endDate();

    if (!date) {
      date = new Date();
    }

    date = setMinutes(date, m);
    this.applyDate(date, what);
  }

  private isRangeSelect(): boolean {
    return this.mode() === 'range';
  }

  public apply() {
    const start = this.startDate();
    let end = this.endDate();

    if (!this.allowClear() && !start) {
      return;
    }

    this._onTouched();
    if (this.variant() !== 'inline') {
      this.calendarDate.set(start);
    }

    if (this.isRangeSelect()) {
      if (!end && !this.allowOpenRange()) {
        end = endOfDay(start);
      }

      this._onChange([start, end]);

      return;
    }

    this._onChange(start);
  }
}

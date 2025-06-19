import { NgTemplateOutlet } from "@angular/common";
import { booleanAttribute, Component, computed, ContentChild, input, Input, model, output } from "@angular/core";
import { hlm } from "@spartan-ng/ui-core";
import { HlmBadgeModule } from '@tierklinik-dobersberg/angular/badge';
import { coerceDate, DateInput } from "@tierklinik-dobersberg/angular/utils/date";
import { cva, VariantProps } from "class-variance-authority";
import { ClassValue } from "clsx";
import { addDays, endOfMonth, endOfWeek, isAfter, isBefore, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { AppDateTableCellDirective } from "./date-table-cell.directive";
import { AppDateTableHighlightRange } from "./highlight-range.directive";

export interface CalendarDate {
    date: Date;
    currentMonth: boolean;
    disabled: boolean;
    ranges?: RangeMatch[]
}

export interface RangeMatch {
    id: string;
    isStart: boolean;
    isEnd: boolean;
}

export interface CalendarRange {
    id: string;
    from: DateInput;
    to: DateInput;
}

export const dateNamesShort = [
    'Mo',
    'Di',
    'Mi',
    'Do',
    'Fr',
    'Sa',
    'So'
];

export const dateNamesLong = [
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
    'Sonntag',
];

export type DateTableVariants = VariantProps<typeof headerVariants>;
export type DateNames = Record<DateTableVariants['variant'], string[]>;

export const headerVariants = cva(
    'grid py-2 w-full grid-cols-7 items-center justify-items-center z-10',
    {
        variants: {
            variant: {
                default: 'shadow-md',
                small: 'border-b border-border'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
)

export function isInRange(date: Date, range: [Date, Date]): boolean {
    return (isAfter(date, range[0]) || isSameDay(date, range[0])) && (isBefore(date, range[1]) || isSameDay(date, range[1]))
}

@Component({
    selector: 'app-date-table',
    standalone: true,
    templateUrl: './date-table.component.html',
    imports: [
        HlmBadgeModule,
        NgTemplateOutlet,
        AppDateTableHighlightRange,
    ],
})
export class AppDateTableComponent {
    /** The calendar date used to decide which month to show. */
    protected readonly _calendarDate = model<Date>(new Date());
    
    @Input({transform: (value: any) => {
        if (!value) {
            return new Date()
        }

        return coerceDate(value)
    }})
    set calendarDate(date: Date) {
        this._calendarDate.set(date);
    }
    
    /** Emits when the calendar date changes. */
    public readonly calendarDateChange = output<Date>();

    /** The variant of the to display */
    public readonly variant = input<DateTableVariants['variant']>('default');
    
    /** Custom user classes for the header */
    public readonly headerClass = input<ClassValue>('')

    /** The names for the week-day header */
    public readonly dateNames = input<DateNames>({
        'default': dateNamesLong,
        'small': dateNamesShort
    })

    /** A list of calendar ranges */
    public readonly ranges = model<CalendarRange[]>([]);

    /** A callback function to check whether a date is disabled or not */
    public readonly dateDisabled = input<(d: Date) => boolean>(() => false);
    
    /** Emits when the user clicks a calendar date */
    public readonly dateClick = output<CalendarDate>();
    
    /** Emits when the user hovers a calendar date */
    public readonly dateHover = output<CalendarDate | null>();
    
    /** Whether or not the calendar should automatically switch months. */
    public readonly changable = input(false, {transform: booleanAttribute})
    
    /** The cell template to render. */
    @ContentChild(AppDateTableCellDirective)
    protected cellTemplate: AppDateTableCellDirective;

    protected _computedHeaderClass = computed(() => {
        return hlm(headerVariants({
            variant: this.variant(),
        }), this.headerClass())
    })

    protected _computedWeekNames = computed(() => {
        const variant = this.variant();
        const names = this.dateNames();

        return names[variant];
    })

    /** The start date of the calendar to render */
    protected readonly _computedCalendarStart = computed(() => {
        const date = this._calendarDate();

        return startOfWeek(
            startOfMonth(date), {
                weekStartsOn: 1
            }
        )
    })
    
    /** The end date of the calendar to render */
    protected readonly _computedCalendarEnd = computed(() => {
        const date = this._calendarDate();
        
        return endOfWeek(
            endOfMonth(date), {
                weekStartsOn: 1,
            }
        )
    })
    
    /** The end date of the calendar to render */
    protected readonly _computedCalendarDates = computed(() => {
        const date = this._calendarDate();
        const start = this._computedCalendarStart();
        const end = this._computedCalendarEnd();
        const ranges = this.ranges();

        let iter = start;
        const result: CalendarDate[] = [];

        const getRanges = (iter) => ranges
                .filter(range => isInRange(iter, [coerceDate(range.from), coerceDate(range.to)]))
                .map(range => ({
                    id: range.id,
                    isStart: isSameDay(iter, coerceDate(range.from)),
                    isEnd: isSameDay(iter, coerceDate(range.to)),
                }))
    
        for (iter = start; !isSameDay(iter, end); iter = addDays(iter, 1)) {
          result.push({
            date: iter,
            currentMonth: isSameMonth(iter, date),
            ranges: getRanges(iter),
            disabled: this.dateDisabled()(iter),
          });
        }
    
        result.push({
            date: iter,
            currentMonth: isSameMonth(iter, date),
            ranges: getRanges(iter),
            disabled: this.dateDisabled()(iter),
        })
    
        return result;
    })
    
    protected onDateClick(date: CalendarDate) {
        this.dateClick.emit(date);
        
        if (this.changable()) {
            this._calendarDate.set(date.date);
            this.calendarDateChange.emit(date.date);
        }
    }
}

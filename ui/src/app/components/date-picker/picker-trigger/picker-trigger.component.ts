import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { lucideArrowLeft, lucideArrowRight, lucideCalendarDays } from "@ng-icons/lucide";
import { hlm } from "@spartan-ng/ui-core";
import { ButtonVariants, HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmIconModule, IconSize, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { ClassValue } from "clsx";
import { addDays } from "date-fns";
import { TkdDatePickerComponent } from "../date-picker.component";

const defaultClasses = 'flex flex-row items-center focus:ring-1 focus:ring-primary focus:ring-offset-4 outline-none focus:outline-none'

export type DatePickerTriggerVariants = 'date' | 'icon';
export type DatePickerTriggerSize = 'small' | 'default';

@Component({
    selector: 'tkd-picker-trigger',
    templateUrl: './picker-trigger.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        HlmButtonDirective,
        HlmIconModule,
        DatePipe,
    ],
    providers: [
        ...provideIcons({
            lucideArrowLeft,
            lucideArrowRight,
            lucideCalendarDays
        })
    ],
    host: {
        '[class]': '_computedClass()',
        'tabindex': '0'
    }
})
export class TkdDatePickerTriggerComponent {
    protected readonly picker = inject(TkdDatePickerComponent)

    public readonly userClasses = input<ClassValue>('', { alias: 'class'});

    public readonly variant = input<DatePickerTriggerVariants>('date');
    public readonly size = input<DatePickerTriggerSize>('default');
    public readonly dateFormat = input<string | null>(null);
    public readonly buttonClass = input<string | null>(null);

    protected readonly _computedIconSize = computed<IconSize>(() => {
        const size = this.size();

        if (size === 'default') {
            return 'sm'
        }

        return 'xs';
    })

    protected readonly _computedButtonClasses = computed(() => {
        let defaultCls = "rounded-none border-b border-t text-center";
        if (this.variant() === "date") {
            defaultCls += "min-w-32"
        }

        return hlm(defaultCls + " " + this._computedBorderClasses(), this.buttonClass())
    })

    protected readonly _computedDateFormat = computed(() => {
        const userFormat = this.dateFormat();

        if (userFormat) {
            return userFormat
        }

        if (this.picker.withTime()) {
            return 'short'
        }
        return 'mediumDate'
    })

    protected readonly _computedButtonSize = computed<ButtonVariants['size']>(() => {
        const size = this.size();

        if (size === 'default') {
            return 'icon'
        }

        return 'sm';
    })

    protected readonly _computedBorderClasses = computed(() => {
        const size = this.size();

        if (size === 'default') {
            return 'border-border'
        }

        return 'border-secondary';
    })

    protected readonly _computedClass = computed(() => {
        return hlm(defaultClasses, this.userClasses())
    })

    protected readonly calendarDate = computed(() => {
        return this.picker.startDate();
    })

    protected addDays(days: number, event: MouseEvent) {
        event.stopPropagation();

        if (this.picker.mode() !== 'single') {
            throw new Error('Unsupported tkd-date-picker mode')
        }

        const value = this.picker.startDate();
        if (!value) {
            return;
        }

        const newDate = addDays(value, days)
        this.picker.writeValue(newDate)
        this.picker.apply();
    }
}
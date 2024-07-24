import { computed, Directive, inject, input } from "@angular/core";
import { hlm } from "@spartan-ng/ui-core";
import clsx, { type ClassValue } from "clsx";
import { type CalendarDate } from "./date-table.component";
import { AppDateTableRangeSelectDirective } from "./range-select.directive";

export type RangeClasses = Record<string, {start?: ClassValue, end?: ClassValue, between?: ClassValue} | string>;

@Directive({
    selector: '[highlightRange]',
    standalone: true,
    host: {
        '[class]': '_computedClass()'
    }
})
export class AppDateTableHighlightRange {
    public readonly date = input.required<CalendarDate>({alias: 'highlightRange'})
    public readonly classes = input<RangeClasses>({}, {
        alias: 'highlightRangeClasses'
    })

    protected readonly rangeSelect = inject(AppDateTableRangeSelectDirective, { optional: true })
    
    protected readonly _computedClass = computed(() => {
        const date = this.date();
        const classes = this.classes();

        const classValues: ClassValue[] = [];
        
        date.ranges?.forEach(range => {
            const style = classes[range.id];
            if (style) {
                let start: ClassValue;
                let end: ClassValue;
                let between: ClassValue;
                
                if (typeof style === 'string') {
                    start = style;
                    end = style;
                    between = style;
                } else {
                    start = style.start || '';
                    between = style.between || '';
                    end = style.end || style.start || '';
                }
                
                if (range.isStart) {
                    classValues.push(start)
                }

                if (range.isEnd) {
                    classValues.push(end)
                }
                
                classValues.push(between)
            }
        })
        
        if (this.rangeSelect) {
            let rangeId = this.rangeSelect.rangeId();
            let start = this.rangeSelect.startClass();
            let end = this.rangeSelect.endClass();
            let between = this.rangeSelect.rangeClass();
            
            const range = date.ranges.find(r => r.id === rangeId);
            if (range) {
                if (range.isStart) {
                    classValues.push(start);
                }

                if (range.isEnd) {
                    classValues.push(end);
                }
                
                classValues.push(between);
            }
        }
        
        return hlm(clsx(classValues));
    })
}
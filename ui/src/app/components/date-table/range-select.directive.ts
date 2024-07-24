import { computed, Directive, effect, inject, input, OnInit, signal, untracked } from "@angular/core";
import { ClassValue } from "clsx";
import { isAfter, isBefore } from "date-fns";
import { AppDateTableComponent, CalendarRange } from "./date-table.component";

@Directive({
    selector: 'app-date-table[rangeSelect]',
    standalone: true,
})
export class AppDateTableRangeSelectDirective implements OnInit {
    protected readonly dateTable = inject(AppDateTableComponent, {host: true})

    protected readonly startDate = signal<Date | null>(null);
    protected readonly endDate = signal<Date | null>(null);

    public readonly rangeId = input('range-select');

    public readonly rangeClass = input<ClassValue>('bg-green-300 bg-opacity-25');
    public readonly startClass = input<ClassValue>('!bg-opacity-100 rounded-l');
    public readonly endClass = input<ClassValue>('!bg-opacity-100 rounded-r');
    
    protected readonly _computedDateRange = computed<CalendarRange | null>(() => {
        const start = this.startDate();
        const end = this.endDate();
        const id = this.rangeId();
        
        if (!start && !end) {
            return null;
        }
        
        if (start && !end) {
            return {
                id,
                from: start, 
                to: start,
            }
        }
        
        return {
            id,
            from: start,
            to: end,
        }
    })

    constructor() {
        effect(() => {
            const range = this._computedDateRange();
            const id = this.rangeId();
            
            const ranges = untracked(() => this.dateTable.ranges())
                .filter(range => range.id !== id);
                
            if (range) {
                ranges.push(range)
            }
            
            this.dateTable.ranges.set(ranges);
        }, {
            allowSignalWrites: true,
        })
    }

    ngOnInit(): void {
        this.dateTable
            .dateClick
            .subscribe(date => {
               const start = this.startDate();
               if (!start || isBefore(date.date, start)) {
                this.startDate.set(date.date);
                return;
               } 
               
               const end = this.endDate();
               if (!end || isAfter(date.date, end)) {
                   this.endDate.set(date.date);
                   return;
               }
               
                this.startDate.set(date.date); 
                this.endDate.set(null);
            })
    }
}
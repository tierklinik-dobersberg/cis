import { Directive, inject, TemplateRef } from "@angular/core";
import type { CalendarDate } from './date-table.component';

export type TableCellCtx = {
    $implicit: CalendarDate;
}

@Directive({
    selector: '[dateTableCell]',
    standalone: true,
})
export class AppDateTableCellDirective {
    public readonly template: TemplateRef<TableCellCtx> = inject(TemplateRef);
    
    static ngTemplateContextGuard(dir: AppDateTableCellDirective, ctx: unknown): ctx is TableCellCtx {
        return true;
    }
}
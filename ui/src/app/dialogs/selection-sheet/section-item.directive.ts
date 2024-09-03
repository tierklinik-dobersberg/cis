import { Directive, inject, TemplateRef } from "@angular/core";

@Directive({
    selector: '[sheetItem]',
    standalone: true,
    exportAs: 'appSheetItem',
})
export class SelectionSheetItemDirective<T> {
    public readonly templateRef = inject(TemplateRef<{
        $implicit: T
    }>);

    static ngTemplateGuard<T>(dir: SelectionSheetItemDirective<T>, ctx: unknown): ctx is {
        $implicit: T,
    } {
        return true
    }
}
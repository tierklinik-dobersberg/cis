import { Directive, inject, input, TemplateRef } from "@angular/core";

@Directive({
    selector: '[sheetGroup]',
    standalone: true,
})
export class SheetItemGroupDirective<T> {
    public readonly templateRef = inject(TemplateRef<T>);

    /** A callback function to decide when to render the group */
    public readonly when = input.required<(t: T, prev?: T) => boolean>({
        alias: 'sheetGroup'
    });
}

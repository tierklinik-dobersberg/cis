import { Directive, inject, TemplateRef } from "@angular/core";

@Directive({
    standalone: true,
    selector: '[datePickerInput], [tdkDatePickerTrigger]'
})
export class TkdDatePickerInputDirective {
    public readonly template = inject(TemplateRef);
}
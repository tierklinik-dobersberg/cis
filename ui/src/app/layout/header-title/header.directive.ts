import { Directive, inject, TemplateRef } from "@angular/core";
import { HeaderTitleService } from "./header.service";

@Directive({
    selector: '[appHeader]',
    standalone: true,
})
export class HeaderDirective {
    public readonly template = inject(TemplateRef);

    constructor() {
        inject(HeaderTitleService)
            .set(this.template)
    }
}
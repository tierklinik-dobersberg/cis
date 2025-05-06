import { Directive, inject, TemplateRef } from "@angular/core";

export interface DateSwiperContext {
    $implicit: {
        date: Date;
        virtual: boolean;
    }
}

@Directive({
    standalone: true,
    selector: '[dateSwiperContent]',
})
export class DateSwiperContentDirective {
    public readonly template = inject(TemplateRef);

    static ngTemplateContextGuard(dir: DateSwiperContentDirective, ctx: unknown): ctx is DateSwiperContext {
        return true;
    }
}
import { Directive, inject, TemplateRef } from "@angular/core";

export interface SwiperContext<T> {
    value: T;
    virtual: boolean;
}

export interface SwiperTemplateContext<T> {
    $implicit: SwiperContext<T>
}

@Directive({
    standalone: true,
    selector: '[swiperContent]',
})
export class SwiperContentDirective {
    public readonly template = inject(TemplateRef);

    static ngTemplateContextGuard(dir: SwiperContentDirective, ctx: unknown): ctx is SwiperTemplateContext<number> {
        return true;
    }
}
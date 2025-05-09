import { Directive, inject, input, TemplateRef } from "@angular/core";

export interface SwiperContext<T> {
    value: T;
    virtual: boolean;

    [key: string]: any,
}

export interface SwiperTemplateContext<T> {
    $implicit: SwiperContext<T>;
}

@Directive({
    standalone: true,
    selector: '[swiperContent]',
})
export class SwiperContentDirective<T> {
    public readonly contextType = input<T>(null, {
        alias: 'swiperContentContextType'
    });

    public readonly template = inject(TemplateRef);

    static ngTemplateContextGuard<T>(dir: SwiperContentDirective<T>, ctx: unknown): ctx is SwiperTemplateContext<T> {
        return true;
    }
}
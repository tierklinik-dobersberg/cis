import { Directive, inject, TemplateRef } from "@angular/core";
import { SwiperContext } from "../swiper/swiper-content.directive";

export interface DateSwiperContext {
    $implicit: SwiperContext<Date>
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
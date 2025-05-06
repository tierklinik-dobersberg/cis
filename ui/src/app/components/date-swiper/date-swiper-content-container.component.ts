import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { Component, computed, signal, TemplateRef } from "@angular/core";

@Component({
    standalone: true,
    template: `<ng-container *ngTemplateOutlet="content(); context: ctx()" />`,
    imports: [
        NgTemplateOutlet,
        DatePipe,
    ],
    host: {
        '[class]': '_computedClasses()',
        '[style.transform]': 'translateX()'
    }
})
export class DateSwiperContentContainerComponent {
    public readonly content = signal<TemplateRef<any>>(null);
    public readonly ctx = signal<any>({});
    public classes = signal<string>('')
    public translateX = signal<string>('');

    protected readonly _computedClasses = computed(() => {
        return 'w-full h-full flex-shrink-0 block ' + this.classes()
    })
}
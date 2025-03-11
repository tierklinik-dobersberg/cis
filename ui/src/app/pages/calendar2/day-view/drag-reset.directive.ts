import { CdkDrag } from "@angular/cdk/drag-drop";
import { Directive, effect, ElementRef, inject, input, Renderer2 } from "@angular/core";

@Directive({
    selector: '[tkdDragReset]',
    standalone: true,
})
export class TkdDragResetDirective {
    public readonly tkdDragReset = input<{[key: string]: any}>();
    public readonly drag = inject(CdkDrag, {host: true})

    protected readonly renderer = inject(Renderer2)
    protected readonly host = inject(ElementRef);

    constructor() {
        effect(() => {
            const style = this.tkdDragReset();

            this.drag?.reset();
            this.renderer.removeStyle(this.host.nativeElement, 'transform')
        })
    }
}
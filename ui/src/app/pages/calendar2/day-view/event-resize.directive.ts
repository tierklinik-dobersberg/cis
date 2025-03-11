import { Directive, ElementRef, HostListener, inject, input, output, Renderer2 } from "@angular/core";
import { TkdDayViewComponent } from "./day-view.component";
import { StyledTimed } from "./event-style.pipe";

@Directive({
    selector: '[tkdEventResize]',
    standalone: true
})
export class TkdEventResizeDirective {
    public readonly tkdEventResize = input.required<StyledTimed>();

    public readonly onResizeStart = output<{event: MouseEvent, data: StyledTimed}>();
    public readonly onResizeStop = output<{event: MouseEvent, data: StyledTimed}>();
    private readonly dayView = inject(TkdDayViewComponent);

    private readonly host = inject(ElementRef);
    private readonly renderer = inject(Renderer2);

    @HostListener('mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        const bounds = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
        const upper = bounds.y + bounds.height;
        const lower = upper - 10;

        if (event.clientY >= lower && event.clientY <= upper) {
            this.renderer.addClass(this.host.nativeElement, 'cursor-ns-resize')
        } else {
            this.renderer.removeClass(this.host.nativeElement, 'cursor-ns-resize')
        }

    }

    @HostListener('mousedown', ['$event'])
    onClick(event: MouseEvent) {
        const bounds = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
        const upper = bounds.y + bounds.height;
        const lower = upper - 10;

        if (event.clientY >= lower && event.clientY <= upper) {
            event.stopPropagation();
            this.dayView.onResizeStart({
                event: event,
                data: this.tkdEventResize()
            })

        }
    }

    @HostListener('mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        this.dayView.onResizeStop()
    }
}
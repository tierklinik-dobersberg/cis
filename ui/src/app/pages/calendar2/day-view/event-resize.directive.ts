import { CdkDrag } from "@angular/cdk/drag-drop";
import { booleanAttribute, Directive, ElementRef, HostListener, inject, input, output, Renderer2 } from "@angular/core";
import { TkdDayViewComponent } from "./day-view.component";
import { StyledTimed } from "./event-style.pipe";

@Directive({
    selector: '[tkdEventResize]',
    standalone: true
})
export class TkdEventResizeDirective {
    public readonly tkdEventResize = input.required<StyledTimed>();
    public readonly tkdEventResizeDisabled = input(false, {transform: booleanAttribute})

    public readonly onResizeStart = output<{event: MouseEvent, data: StyledTimed}>();
    public readonly onResizeStop = output<{event: MouseEvent, data: StyledTimed}>();

    private readonly dayView = inject(TkdDayViewComponent);
    private readonly host = inject(ElementRef);
    private readonly renderer = inject(Renderer2);
    private readonly cdkDrag = inject(CdkDrag)

    private isActive = false;

    @HostListener('mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (this.tkdEventResizeDisabled()) {
            return
        }

        const bounds = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
        const upper = bounds.y + bounds.height;
        const lower = upper - 10;

        if (event.clientY >= lower && event.clientY <= upper) {
            this.renderer.addClass(this.host.nativeElement, 'cursor-ns-resize')
            this.cdkDrag.disabled = true
        } else {
            this.renderer.removeClass(this.host.nativeElement, 'cursor-ns-resize')
            this.cdkDrag.disabled = false
        }
    }

    @HostListener('mousedown', ['$event'])
    onMouseDown(event: MouseEvent) {
        if (this.tkdEventResizeDisabled()) {
            return
        }

        if ('button' in event && event.button != 3) {
            return
        }

        const bounds = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
        const upper = bounds.y + bounds.height;
        const lower = upper - 10;

        if (event.clientY >= lower && event.clientY <= upper) {
            event.stopPropagation();
            event.stopImmediatePropagation();

            this.dayView.onResizeStart({
                event: event,
                data: this.tkdEventResize()
            })

            this.isActive = true;
        }
    }

    @HostListener('mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {

        if (this.tkdEventResizeDisabled() || !this.isActive) {
            return
        }

        this.isActive = false;

        this.dayView.onResizeStop(event)

        event.preventDefault();
        event.stopImmediatePropagation();
    }
}
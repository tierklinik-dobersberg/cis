import { coerceNumberProperty } from "@angular/cdk/coercion";
import { Directive, ElementRef, EventEmitter, Input, OnChanges, Output, Renderer2, SimpleChanges } from "@angular/core";

@Directive({
    selector: '[tkdDebounceEvent]',
    exportAs: 'tkdDebounceEvent',
    standalone: true,
})
export class TkdDebounceEventDirective implements OnChanges {
    private sub: () => void = () => {};

    @Input()
    tkdDebounceEvent: string = 'click';

    @Input()
    tkdDebounceStopEvent: string = '';

    @Output()
    tkdOnEvent: EventEmitter<Event> = new EventEmitter();

    @Input()
    set tkdDebounceEventTime(v: any) {
        this._debounceTime = coerceNumberProperty(v);
    }
    private _debounceTime = 500;

    constructor(
        private renderer2: Renderer2,
        private elementRef: ElementRef,
    ) {}

    ngOnChanges(changes: SimpleChanges): void {
        this.sub();

        let timeout: any = undefined;

        const unlisten = this.renderer2.listen(this.elementRef.nativeElement, this.tkdDebounceEvent, (event) => {
            if (timeout !== undefined) {
                clearTimeout(timeout)
            }

            timeout = setTimeout(() => {
                this.tkdOnEvent.next(event);
                timeout = undefined;
            }, this._debounceTime)
        })

        let unlistenStop = () => {}
        if (!!this.tkdDebounceStopEvent) {
            unlistenStop = this.renderer2.listen(this.elementRef.nativeElement, this.tkdDebounceStopEvent, () => {
                if (timeout !== undefined) {
                    clearTimeout(timeout)
                }
            })
        }

        this.sub = () => {
            unlisten()
            unlistenStop()
        }
    }
}
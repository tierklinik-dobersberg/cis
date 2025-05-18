import { coerceNumberProperty } from "@angular/cdk/coercion";
import { Directive, ElementRef, EventEmitter, HostListener, input, Input, numberAttribute, OnChanges, output, Output, Renderer2, SimpleChanges } from "@angular/core";

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

@Directive({
    standalone: true,
    selector: '[tkdDblclick]'
})
export class TkdDblclickDirective {
    private timeout: any | null = null;
    private lastClick: number = 0;

    public readonly tkdClick = output<MouseEvent>();
    public readonly tkdDblclick = output<MouseEvent>();
    public readonly tkdDblclickThreshold = input(600, {
        transform: numberAttribute
    })

    @HostListener('click', ['$event'])
    protected onClick(event: MouseEvent) {
        const t = this.tkdDblclickThreshold();

        const now = new Date().getTime();
        if (this.timeout !== null) {
            clearTimeout(this.timeout)
        }

        if (this.lastClick > 0 && (now - this.lastClick) < t) {
            this.tkdDblclick.emit(event)
            this.lastClick = 0;
            return
        }

        this.timeout = setTimeout(() => {
            this.tkdClick.emit(event)
            this.timeout = null
            this.lastClick = 0
        }, t)

        this.lastClick = now
    }
}
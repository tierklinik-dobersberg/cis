import { CdkDrag } from '@angular/cdk/drag-drop';
import {
  booleanAttribute,
  Directive,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  Renderer2,
  signal,
} from '@angular/core';

export interface ResizeStopEvent {
    srcEvent: MouseEvent;
    change: number;
    height: number;
}

@Directive({
  selector: '[tkdResizeContainer]',
  standalone: true,
})
export class TkdEventResizeContainerDirective {
  public readonly activeResize = signal<TkdEventResizeDirective | null>(null);

  @HostListener('mousemove', ['$event'])
  handleMouseMove(event: MouseEvent) {
    if (!this.activeResize()) {
      return;
    }

    this.activeResize().handleMouseMove(event)
  }
}

@Directive({
  selector: '[tkdEventResize]',
  standalone: true,
})
export class TkdEventResizeDirective {
  public readonly style = input.required<{ [klass: string]: any }>({
    alias: 'tkdEventResize',
  });

  public readonly disabled = input(false, {
    transform: booleanAttribute,
    alias: 'tkdEventResizeDisabled',
  });

  public readonly step = input.required<number>({
    alias: 'tkdEventResizeStep',
  });

  public readonly min = input.required<number>({
    alias: 'tkdEventResizeMin',
  });

  public readonly onResizeStart = output<MouseEvent>();
  public readonly onResizeStop = output<ResizeStopEvent>();

  private readonly host = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly cdkDrag = inject(CdkDrag);
  private readonly container = inject(TkdEventResizeContainerDirective)
  private readonly height = signal<number | null>(null);

  private resizeStartPosition = 0;
  private resizeStartHeight = 0;

  private oldDragDisabledValue: boolean | null = null;
  private resizeActive = false;

  constructor() {
    let lastAppliedStyle: {
      [klass: string]: any;
    } = {};

    let frame: any = null;
    effect(() => {
      const style = {...this.style()};
      const height = this.height();

      if (frame) {
        cancelAnimationFrame(frame);
      }

      if (height !== null) {
        style['height'] = height + 'px'
      }

      frame = requestAnimationFrame(() => {
        Object.keys(style).forEach(klass => {
          this.renderer.setStyle(this.host.nativeElement, klass, style[klass]);
          delete lastAppliedStyle[klass];
        });

        Object.keys(lastAppliedStyle).forEach(klass => {
          this.renderer.removeStyle(this.host.nativeElement, klass);
        });

        lastAppliedStyle = style;
      });
    });
  }

  handleMouseMove(event: MouseEvent) {
    if (this.resizeStartPosition !== null && this.resizeActive) {
      // update the event style
      let offset = event.clientY - this.resizeStartPosition;

      let h = this.resizeStartHeight + offset;
      h = Math.ceil(h / this.step()) * this.step();

      if (h < this.min()) {
        h = this.min();
      }

      this.height.set(h)
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const bounds = (
      this.host.nativeElement as HTMLElement
    ).getBoundingClientRect();
    const upper = bounds.y + bounds.height;
    const lower = upper - 5;

    if (event.clientY >= lower && event.clientY <= upper) {
      if (!this.disabled()) {

        if (this.oldDragDisabledValue === null) {
          console.log("capturing drag-disabled", this.cdkDrag.disabled || false)

          this.oldDragDisabledValue= this.cdkDrag.disabled || false;
          this.cdkDrag.disabled = true;
        }

        this.renderer.addClass(this.host.nativeElement, '!cursor-ns-resize');
      }
    } else {
      if (!this.resizeActive) {
        if (this.oldDragDisabledValue !== null) {
          console.log("resoting drag-disabled", this.oldDragDisabledValue)

          this.cdkDrag.disabled = this.oldDragDisabledValue;
          this.oldDragDisabledValue = null
        }
        this.renderer.removeClass(this.host.nativeElement, '!cursor-ns-resize');
      }
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (this.disabled()) {
      return;
    }

    if ('button' in event && event.button != 0) {
      return;
    }

    //this.oldDragDisabledValue = this.cdkDrag.disabled || false;
    //this.cdkDrag.disabled = true;

    const bounds = (
      this.host.nativeElement as HTMLElement
    ).getBoundingClientRect();
    const upper = bounds.y + bounds.height;
    const lower = upper - 5;

    if (event.clientY >= lower && event.clientY <= upper) {
      event.stopPropagation();
      event.stopImmediatePropagation();

      this.onResizeStart.emit(event);
      this.resizeStartPosition = event.clientY;
      this.resizeStartHeight = (this.host.nativeElement as HTMLElement).getBoundingClientRect().height;

      this.container.activeResize.set(this)

      this.resizeActive = true;
    }
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    console.log('resize: mouseup', this.oldDragDisabledValue);

    this.cdkDrag.disabled = this.oldDragDisabledValue;

    if (this.disabled() || !this.resizeActive) {
      console.log('disabled or not-active');
      return;
    }
    this.onResizeStop.emit({
        srcEvent: event,
        change: event.clientY - this.resizeStartPosition,
        height: this.height(),
    });

    this.resizeActive = false;
    this.resizeStartPosition = 0;
    this.height.set(null);
    this.container.activeResize.set(null)


    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

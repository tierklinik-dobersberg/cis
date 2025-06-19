import {
  Directive,
  ElementRef,
  HostListener,
  booleanAttribute,
  effect,
  inject,
  input as model,
  numberAttribute,
  output,
  signal,
  untracked
} from '@angular/core';

export class PanEvent {
  constructor(
    public readonly delta: number,
    public readonly index: number
  ) {}
}

export class PanStartEvent extends PanEvent {
  constructor(
    delta: number,
    index: number,
    public readonly direction: 'left' | 'right'
  ) {
    super(delta, index);
  }
}

export class PanEndEvent extends PanEvent {
  constructor(
    delta: number,
    index: number,
    public readonly direction: 'left' | 'right' | 'abort'
  ) {
    super(delta, index);
  }
}

export type SwipeEvent = PanEvent | PanStartEvent | PanEndEvent;

@Directive({
  standalone: true,
  selector: '[swipeArrowControl]',
  exportAs: 'swipeArrowControl',
  host: {
    '[attr.tabindex]': 'tabindex()',
    class: '!touch-pan-y focus:outline-none',
  },
})
export class SwipeArrowControlDirective {
  private readonly _panActive = signal(false);
  private _lastDelta = 0;
  private readonly _host = inject(ElementRef);

  public readonly tabindex = model(0, {
    transform: numberAttribute,
  });

  public readonly panActive = this._panActive.asReadonly();

  public readonly panThreshold = model(40, {
    transform: numberAttribute,
    alias: 'swipeArrowControlThreshold'
  });

  public readonly events = output<PanEvent | PanStartEvent | PanEndEvent>({
    alias: 'swipeArrowControl',
  });

  public readonly disabled = model(false, {
    transform: booleanAttribute,
    alias: 'swipeArrowControlDisabled',
  });

  private index = 0;
  constructor() {
    /**
     * Effect to cancel an active pan if [disabled] is set to
     * true
     */
    effect(
      () => {
        const disabled = this.disabled();
        const active = untracked(() => this.panActive());

        if (disabled && active) {
          this._panActive.set(false);
          this._lastDelta = 0;
        }
      },
      { allowSignalWrites: true }
    );

    /**
     * Effect to clear our _lastAbsDelta if panActive is set to false
     */
    effect(() => {
      if (!this.panActive()) {
        this._lastDelta = 0;
      }
    });
  }

  @HostListener('keydown', ['$event'])
  protected keyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        event.stopPropagation();
        this.previous();
        break;

      case 'ArrowRight':
        event.stopPropagation();
        this.next();
        break;
    }

  }

  public next() {
    this.events.emit(new PanEndEvent(0, ++this.index, 'left'));
  }

  public previous() {
    this.events.emit(new PanEndEvent(0, ++this.index, 'right'));
  }

  @HostListener('panstart', ['$event'])
  protected panStart(event: HammerInput) {}

  @HostListener('panmove', ['$event'])
  protected panMove(event: HammerInput) {
    if (this.disabled()) {
      return;
    }

    event.srcEvent.stopPropagation();

    // we need the host element's bounds to calculate whether or not the
    // cursor is in the "start" region
    const bounds = (
      this._host.nativeElement as HTMLElement
    ).getBoundingClientRect();

    // get the current cursor position from the input event
    const clientX = this.getClientPosition(event);
    if (clientX === null) {
      throw new Error(
        'failed to determine cursor position, unsupported event type'
      );
    }

    // get the absolute amount of movement on the x-axis and y-axis
    const absDeltaX = Math.abs(event.deltaX);
    const absDeltaY = Math.abs(event.deltaY);

    // if panning is not yet active, check if we need to switch
    if (!this.panActive()) {
      // decide whether or not the user also has a movement on the vertical axis
      const y: 'top' | 'bottom' | '' =
        absDeltaY > this.panThreshold()
          ? event.deltaY > 0
            ? 'bottom'
            : 'top'
          : '';

      // if there's enough movement on the y-axis, don't start panning
      if (y !== '') {
        return;
      }

      // also, if the movement on the y-axis is higher than on the x-axis, don't start panning
      if (absDeltaY > absDeltaX) {
        return;
      }

      // if the movement on the x-axis is lower than the configured threshold, don't start panning as well
      if (
        !this.inStartRegion(clientX, bounds) &&
        absDeltaX < this.panThreshold()
      ) {
        return;
      }

      const direction: 'right' | 'left' | '' =
        absDeltaX > 40 ? (event.deltaX > 0 ? 'right' : 'left') : '';

      if (direction === '') {
        return
      }

      // start panning
      this._lastDelta = event.deltaX;
      this._panActive.set(true);

      this.events.emit(
        new PanStartEvent(event.deltaX, ++this.index, direction as any)
      );

      return;
    }

    // emit a PanEvent with the new delta and store it in _lastAbsDelta
    // if it's higher.
    this.events.emit(new PanEvent(event.deltaX, this.index));
    if (
      (this._lastDelta < 0 && event.deltaX < this._lastDelta) ||
      (this._lastDelta > 0 && event.deltaX > this._lastDelta)
    ) {
      this._lastDelta = event.deltaX;
    }
  }

  @HostListener('panend', ['$event'])
  protected panEnd(event: HammerInput) {
    // nothing to do if we're disabled
    if (!this.panActive()) {
      return;
    }

    event.srcEvent.stopPropagation();

    // check which direction the user decided to move
    let x: 'right' | 'left' | 'abort' =
      Math.abs(event.deltaX) > 40
        ? event.deltaX > 0
          ? 'right'
          : 'left'
        : 'abort';

    if (
      (this._lastDelta < 0 && event.deltaX > this._lastDelta*0.9) ||
      (this._lastDelta > 0 && event.deltaX < this._lastDelta*0.9)
    ) {
      x = 'abort';
    }

    this._panActive.set(false);
    this.events.emit(new PanEndEvent(event.deltaX, this.index, x));
  }

  private inStartRegion(clientX: number, bounds: DOMRect): boolean {
    const [lower, upper] = [
      bounds.left + 0.3 * bounds.width,
      bounds.left + 0.7 * bounds.width,
    ];

    return clientX <= lower || clientX >= upper;
  }

  private getClientPosition(event: HammerInput): number | null {
    var clientX: number | null = null;

    if (event.srcEvent instanceof MouseEvent) {
      clientX = event.srcEvent.clientX;
    } else if (
      event.srcEvent instanceof TouchEvent &&
      event.srcEvent.touches.length === 1
    ) {
      clientX = event.srcEvent.touches[0].clientX;
    } else if (event.srcEvent instanceof PointerEvent) {
      clientX = event.srcEvent.clientX;
    }

    return clientX;
  }
}

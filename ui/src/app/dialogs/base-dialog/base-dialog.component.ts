import { DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  effect,
  HostListener,
  inject,
  Renderer2,
  signal,
} from '@angular/core';
import { injectBrnDialogContext } from '@spartan-ng/ui-dialog-brain';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  PanEndEvent,
  PanStartEvent,
  SwipeArrowControlDirective,
} from 'src/app/components/swipe-arrow-ctrl/swipe-arrow-ctrl.directive';

@Component({
  selector: 'abstract-base-dialog',
  template: '',
  standalone: true,
  hostDirectives: [SwipeArrowControlDirective],
  host: {
    '[class]': '"block"',
  },
})
export abstract class AbstractBaseDialog {
  public readonly ctrl = inject(SwipeArrowControlDirective);

  protected readonly translateX = signal('translateX(0%)');
  protected readonly setClass = signal(false);

  private readonly ref = injectBrnDialogContext();
  protected readonly layout = inject(LayoutService);

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.translateX.set('translateX(0%)');

      this.setClass.set(true);

      this.translateX.set('translateX(100%)');

      setTimeout(() => {
        this.ref.close();
      }, 150);
    }
  }

  constructor() {
    const dialogRef = inject(DialogRef);
    const renderer = inject(Renderer2);

    effect(() => {
      const t = this.translateX();
      const c = this.setClass();

      renderer.setStyle(dialogRef.overlayRef.hostElement, 'transform', t);

      if (c) {
        renderer.addClass(
          dialogRef.overlayRef.hostElement,
          'transition-transform'
        );
      } else {
        renderer.removeClass(
          dialogRef.overlayRef.hostElement,
          'transition-transform'
        );
      }
    });

    let panning = false;

    this.ctrl.events.subscribe(evt => {
      if (this.layout.md()) {
        return;
      }

      if (evt instanceof PanStartEvent) {
        this.setClass.set(false);
        if (evt.direction !== 'right') {
          return;
        }

        panning = true;
      }

      if (!panning) {
        return;
      }

      this.translateX.set('translateX(calc(0% + ' + evt.delta + 'px))');

      if (evt instanceof PanEndEvent) {
        this.setClass.set(true);

        if (evt.direction === 'abort') {
          this.translateX.set('translateX(0%)');
        } else {
          this.translateX.set('translateX(100%)');

          setTimeout(() => {
            this.ref.close();
          }, 150);
        }

        panning = false;
        return;
      }
    });
  }
}

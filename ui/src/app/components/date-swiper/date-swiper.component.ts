import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ContentChild,
    effect,
    EmbeddedViewRef,
    model,
    signal,
    TemplateRef,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { addDays, isSameDay } from 'date-fns';
import {
    PanEndEvent,
    PanStartEvent,
    SwipeArrowControlDirective,
    SwipeEvent,
} from '../swipe-arrow-ctrl/swipe-arrow-ctrl.directive';
import {
    DateSwiperContentDirective,
    DateSwiperContext,
} from './date-swiper-content.directive';

@Component({
  standalone: true,
  selector: 'date-swiper',
  templateUrl: './date-swiper.component.html',
  imports: [SwipeArrowControlDirective, NgTemplateOutlet, DatePipe],
})
export class DateSwiperComponent implements AfterViewInit {
  @ContentChild(DateSwiperContentDirective)
  content?: DateSwiperContentDirective;

  public readonly date = model<Date>(new Date());
  protected readonly translateX = signal('translateX(0%)');
  protected readonly classes = signal('');

  @ViewChild('viewRef', { static: true, read: ViewContainerRef })
  public readonly viewContainerRef: ViewContainerRef;

  @ViewChild('viewTemplate', { static: true, read: TemplateRef })
  viewTemplate: TemplateRef<DateSwiperContext>;

  @ViewChild(SwipeArrowControlDirective, { static: true })
  swipeArrowController: SwipeArrowControlDirective;

  private mainViewRef?: EmbeddedViewRef<DateSwiperContext>;
  private prevViewRef?: EmbeddedViewRef<DateSwiperContext>;
  private nextViewRef?: EmbeddedViewRef<DateSwiperContext>;

  public setDate(date: Date) {
    this.date.set(date);
  }

  constructor() {
    effect(() => {
      const date = this.date();

      if (
        this.mainViewRef &&
        !isSameDay(this.mainViewRef.context.$implicit.date, date)
      ) {
        this.mainViewRef.context.$implicit = {
          date: date,
          virtual: false,
        };
      }
    });
  }

  ngAfterViewInit(): void {
    this.mainViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      {
        $implicit: {
          date: this.date(),
          virtual: false,
        },
      }
    );
  }

  private createViews() {
    this.prevViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      {
        $implicit: {
          date: addDays(this.date(), -1),
          virtual: true,
        },
      },
      { index: 0 }
    );

    this.nextViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      {
        $implicit: {
          date: addDays(this.date(), 1),
          virtual: true,
        },
      }
    );
  }

  private destroyViews() {
  }

  private index: number | null = null;

  protected handleSwipe(event: SwipeEvent) {
    if (this.index !== null && event.index !== this.index) {
        return
    }

    if (event instanceof PanStartEvent) {
      this.createViews();
      this.startPanning();
      this.index = event.index;
    } else if (event instanceof PanEndEvent) {
      if (event.direction !== 'abort' && event.delta === 0) {
        this.createViews();
        this.startPanning();
        this.index = event.index;

        event = new PanEndEvent(1, event.index, event.direction);
        setTimeout(() => {
          this.handleSwipe(event);
        }, 0);

        return;
      }

      switch (event.direction) {
        case 'abort':
          break;

        case 'left':
          this.date.set(addDays(this.date(), 1));
          [this.nextViewRef, this.mainViewRef] = [
            this.mainViewRef,
            this.nextViewRef,
          ];
          break;

        case 'right':
          this.date.set(addDays(this.date(), -1));
          [this.prevViewRef, this.mainViewRef] = [
            this.mainViewRef,
            this.prevViewRef,
          ];
          break;
      }

      this.mainViewRef.context.$implicit = {
        date: this.date(),
        virtual: false,
      };

      this.stopPanning(event.direction);
    } else {
      this.translateX.set('translateX(calc(-100% + ' + event.delta + 'px))');
    }
  }

  private startPanning() {
    this.translateX.set('translateX(-100%)');
  }

  private stopPanning(direction: 'left' | 'right' | 'abort') {
    this.classes.set('transition-transform duration-500');

    switch (direction) {
      case 'left':
        this.translateX.set('translateX(-200%)');
        break;

      case 'right':
        this.translateX.set('translateX(0%)');
        break;

      case 'abort':
        this.translateX.set('translateX(-100%)');
        break;
    }

    const prev = this.prevViewRef;
    const next = this.nextViewRef;

    setTimeout(() => {

      this.classes.set('');
      this.translateX.set('translateX(0%)');

      prev?.destroy();
      next?.destroy();
      this.index = null;
    }, 500);
  }
}

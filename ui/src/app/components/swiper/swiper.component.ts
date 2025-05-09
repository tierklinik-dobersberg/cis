import { NgTemplateOutlet } from '@angular/common';
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
  ViewContainerRef
} from '@angular/core';
import {
  PanEndEvent,
  PanStartEvent,
  SwipeArrowControlDirective,
  SwipeEvent,
} from '../swipe-arrow-ctrl/swipe-arrow-ctrl.directive';
import {
  SwiperContentDirective,
  SwiperTemplateContext
} from './swiper-content.directive';

@Component({
  standalone: true,
  selector: 'abstract-swiper',
  templateUrl: './swiper.component.html',
  imports: [SwipeArrowControlDirective, NgTemplateOutlet],
})
export abstract class AbstractSwiperComponent<T = any> implements AfterViewInit {
  @ContentChild(SwiperContentDirective)
  content?: SwiperContentDirective;

  public readonly value = model<T | null>(null)
  protected readonly translateX = signal('translateX(0%)');
  protected readonly classes = signal('');

  @ViewChild('viewRef', { static: true, read: ViewContainerRef })
  public readonly viewContainerRef: ViewContainerRef;

  @ViewChild('viewTemplate', { static: true, read: TemplateRef })
  viewTemplate: TemplateRef<ReturnType<typeof this.createContext>>;

  @ViewChild(SwipeArrowControlDirective, { static: true })
  swipeArrowController: SwipeArrowControlDirective;

  private mainViewRef?: EmbeddedViewRef<SwiperTemplateContext<T>>;
  private prevViewRef?: EmbeddedViewRef<SwiperTemplateContext<T>>;
  private nextViewRef?: EmbeddedViewRef<SwiperTemplateContext<T>>;

  public setValue(newValue: T) {
    this.value.set(newValue);
  }

  protected abstract updateValue(offset: number);
  protected abstract createContext(newValue: T): SwiperTemplateContext<T>;
  protected abstract createContext(current: T, offset: number): SwiperTemplateContext<T>;
  protected abstract compareContext(current: T, other: T): boolean;

  constructor() {
    effect(() => {
      const value = this.value();
      if (
        this.mainViewRef &&
        !this.compareContext(this.mainViewRef.context.$implicit.value, value)
      ) {
        this.mainViewRef.context.$implicit = this.createContext(value).$implicit
      }
    });
  }


  ngAfterViewInit(): void {
    this.mainViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      this.createContext(null, 0)
    );
  }

  private createViews() {
    this.prevViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      this.createContext(this.mainViewRef.context.$implicit.value, -1),
      { index: 0 }
    );

    this.nextViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      this.createContext(this.mainViewRef.context.$implicit.value, 1)
    );
  }

  private swipeIndex: number | null = null;

  protected handleSwipe(event: SwipeEvent) {
    if (this.swipeIndex !== null && event.index !== this.swipeIndex) {
        return
    }

    if (event instanceof PanStartEvent) {
      this.createViews();
      this.startPanning();
      this.swipeIndex = event.index;
    } else if (event instanceof PanEndEvent) {
      if (event.direction !== 'abort' && event.delta === 0) {
        this.createViews();
        this.startPanning();
        this.swipeIndex = event.index;

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
          this.updateValue(1)
          {
            const old = this.mainViewRef;
            this.mainViewRef = this.nextViewRef;
            this.nextViewRef = old;
          }
          break;

        case 'right':
          this.updateValue(-1)
          {
            const old = this.mainViewRef;
            this.mainViewRef = this.prevViewRef;
            this.prevViewRef = old;
          }
          break;
      }

      this.mainViewRef.context.$implicit = this.createContext(this.value()).$implicit

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
      this.swipeIndex = null;
    }, 500);
  }
}

@Component({
  standalone: true,
  selector: 'swiper',
  templateUrl: './swiper.component.html',
  imports: [SwipeArrowControlDirective, NgTemplateOutlet],
})
export class IndexSwiperComponent extends AbstractSwiperComponent<number> {
  protected override updateValue(offset: number) {
    this.value.set(this.value() + offset)  
  }

  protected override createContext(newValue: number): SwiperTemplateContext<number>;
  protected override createContext(current: number, offset: number): SwiperTemplateContext<number>;
  protected override createContext(current: number, offset?: number): SwiperTemplateContext<number> {
    return {
      $implicit: {
        value: offset === undefined ? current : current + offset,
        virtual: offset !== undefined ? true : false,
      }
    }
  }

  protected override compareContext(current: number, other: number): boolean {
    return current === other;
  }
}
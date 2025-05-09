import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  ContentChild,
  effect,
  EmbeddedViewRef,
  input,
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
  content?: SwiperContentDirective<T>;

  public readonly value = model<T | null>(null)

  public readonly disabled = model(false);

  protected readonly translateX = signal('translateX(0%)');
  protected readonly classes = signal('');

  @ViewChild('viewRef', { static: true, read: ViewContainerRef })
  public readonly viewContainerRef: ViewContainerRef;

  @ViewChild('viewTemplate', { static: true, read: TemplateRef })
  viewTemplate: TemplateRef<ReturnType<typeof this.createContext>>;

  @ViewChild(SwipeArrowControlDirective, { static: true })
  swipeArrowController: SwipeArrowControlDirective;

  public next() {
    this.swipeArrowController?.next();
  }

  public previous() {
    this.swipeArrowController?.previous();
  }

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

      console.log("value changed", value)

      if (
        this.mainViewRef &&
        !this.compareContext(this.mainViewRef.context.$implicit.value, value)
      ) {
        Object.assign(this.mainViewRef.context, this.createContext(value))
      }
    });
  }


  ngAfterViewInit(): void {
    this.mainViewRef = this.viewContainerRef.createEmbeddedView(
      this.viewTemplate,
      this.createContext(this.value())
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

      Object.assign(this.mainViewRef.context, this.createContext(this.value()))

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
export class SwiperComponent extends AbstractSwiperComponent<any> implements AfterViewInit {
  public readonly updateValueFn = input.required<typeof this.updateValue>()
  public readonly createContextFn = input.required<typeof this.createContext>();
  public readonly compareContextFn = input.required<typeof this.compareContext>();

  protected override updateValue(offset: number) {
    this.updateValueFn()(offset)
  }

  protected override createContext(current: number, offset?: number): SwiperTemplateContext<number> {
    return this.createContextFn()(current, offset)
  }

  protected override compareContext(current: number, other: number): boolean {
    return this.compareContextFn()(current, other)
  }
}

@Component({
  standalone: true,
  selector: 'list-swiper',
  templateUrl: './swiper.component.html',
  imports: [SwipeArrowControlDirective, NgTemplateOutlet],
})
export class ListSwiperComponent<T> extends AbstractSwiperComponent<number> implements AfterViewInit {
  public readonly list = input.required<T[]>();

  public override value = model<number>(0);

  public readonly currentElement = computed(() => {
    const list = this.list();
    const index = this.value();

    return list[index];
  })


  constructor() {
    super()

    effect(() => {
      const list = this.list();
      this.disabled.set(list.length <= 1);
    })
  }

  protected override updateValue(offset: number) {
    let newIndex = this.clampIndex(this.value() + offset);
    this.setValue(newIndex)
  }

  private clampIndex(newIndex: number): number {
    let n = newIndex;
    if (n < 0) {
      console.log("newIndex is lower than zero")
      n = this.list().length - 1
    }
    if (n >= this.list().length) {
      console.log("newIndex is higher than list-length", n, this.list().length)
      n = 0
    }

    return n;
  }

  protected override createContext(current: number, offset?: number): SwiperTemplateContext<number> {
    const index = this.clampIndex(offset === undefined ? current : current + offset);

    console.log("current", current, "offset", offset, "newIndex", index)

    return {
      $implicit: {
        value: index,
        virtual: offset !== undefined,
        element: this.list()[index]
      },
    }
  }

  protected override compareContext(current: number, other: number): boolean {
    return current === other;
  }
}
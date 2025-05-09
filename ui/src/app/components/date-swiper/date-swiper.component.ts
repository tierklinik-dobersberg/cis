import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  Component,
  model
} from '@angular/core';
import { addDays, isSameDay } from 'date-fns';
import {
  SwipeArrowControlDirective
} from '../swipe-arrow-ctrl/swipe-arrow-ctrl.directive';
import { SwiperTemplateContext } from '../swiper/swiper-content.directive';
import { AbstractSwiperComponent } from '../swiper/swiper.component';

@Component({
  standalone: true,
  selector: 'date-swiper',
  templateUrl: '../swiper/swiper.component.html',
  imports: [SwipeArrowControlDirective, NgTemplateOutlet],
})
export class DateSwiperComponent extends AbstractSwiperComponent<Date> implements AfterViewInit {
  public override value = model<Date>(new Date())

  protected override compareContext(current: Date, other: Date): boolean {
    return isSameDay(current, other)
  }

  protected override updateValue(offset: number) {
    this.value.set(addDays(this.value(), offset))
  }

  protected override createContext(current: Date, offset?: number): SwiperTemplateContext<Date> {
    return {
      $implicit: {
        value: offset === undefined ? current : addDays(current, offset),
        virtual: offset !== undefined
      }
    }
  }
}

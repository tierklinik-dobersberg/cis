import { ChangeDetectionStrategy, Component, Input, TrackByFunction } from '@angular/core';
import { ColorService } from 'src/app/shared/charts/color.service';

export interface Counter {
  title?: string;
  color: string;
  count: number;
  class?: string;
}

@Component({
  selector: 'tkd-counter', // eslint-disable-line
  templateUrl: './counter.html',
  styleUrls: ['./counter.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterStatComponent {
  constructor(private colorService: ColorService) { }

  @Input()
  title: string = '';

  @Input()
  description: string = '';

  @Input()
  set count(v: Counter[] | Counter | number) {
    if (Array.isArray(v)) {
      this._count = v;
    } else if (typeof v === 'number') {
      this._count = [{
        title: '',
        color: this.colorService.get('primary'),
        count: v,
      }]
    } else {
      this._count = [v];
    }

    this._count = this._count.map((counter, idx) => {
      counter = { ...counter };
      if (!counter.color) {
        counter.color = this.colorService.byIndex(idx)
      } else {
        counter.color = this.colorService.get(counter.color);
      }
      return counter;
    })
  }
  _count: Counter[] = []

  @Input()
  gridClass: string = '';

  trackCounter: TrackByFunction<Counter> = (_: number, counter: Counter) => counter.title;
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-clock-card',
  templateUrl: './clock-card.html',
  styleUrls: ['./clock-card.scss'],
})
export class ClockCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  clock = '';


  ngOnInit(): void {
    this.subscriptions = new Subscription();

    const sub =
      interval(1000)
        .pipe(
          startWith(() => -1),
          map(() => new Date().toLocaleTimeString()),
        )
        .subscribe(val => this.clock = val);

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

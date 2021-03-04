import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { HeaderTitleService } from './header.service';

@Component({
  selector: 'app-header-title-outlet',
  template: '{{ header }}',
  styles: [
    `
        :host {
            display: inline;
            align-self: center;
            white-space: nowrap;
        }
        `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderTitleOutletComponent implements OnInit, OnDestroy {
  header = '';

  private subscription = Subscription.EMPTY;

  constructor(
    private headerService: HeaderTitleService,
    private changeDetectorRef: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.subscription = this.headerService.change.subscribe(header => {
      this.header = header;
      this.changeDetectorRef.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}

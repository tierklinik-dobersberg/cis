import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { HeaderTitleService, PageHeader } from './header.service';

@Component({
  selector: 'app-header-title-outlet',
  template: `
    <div class="" *ngIf="!!header.iconTemplate">
      <ng-container *ngTemplateOutlet="header.iconTemplate"></ng-container>
    </div>
    <div class="flex flex-col">
      <span class="text-base font-semibold text-color-primary-dark font-lato">{{ header.title }}</span>
      <span *ngIf="header.description" class="hidden text-sm text-secondary font-iter sm:block">{{ header.description }}</span>
    </div>
  `,
  styles: [
    `
        :host {
            display: inline-flex;
            flex-direction: row;
            align-self: center;
            white-space: nowrap;
        }
        `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderTitleOutletComponent implements OnInit, OnDestroy {
  header: PageHeader = {title: '', description: ''};

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

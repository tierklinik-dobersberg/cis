import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { HeaderTitleService, PageHeader } from './header.service';

@Component({
  selector: 'app-header-title-outlet',
  template: `
    @if (!!header.iconTemplate) {
      <div class="">
        <ng-container *ngTemplateOutlet="header.iconTemplate"></ng-container>
      </div>
    }
    <div class="flex flex-col">
      @if (!!header.breadcrumps) {
        <div class="text-sky-800 text-opacity-75 flex flex-row items-center leading-3 text-xs ">
          @for (br of header.breadcrumps; track br; let last = $last) {
            <a class=" hover:underline cursor-pointer  hover:text-sky-800" [routerLink]="br.route">{{ br.name }}</a>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 " viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          }
        </div>
      }
      <span class=" font-semibold text-sky-800 text-base">{{ header.title }}</span>
      @if (header.description) {
        <span class="hidden text-sm break-normal text-gray-500 font-iter sm:block">{{ header.description }}</span>
      }
    </div>
    `,
  styles: [
    `
            :host {
                display: inline-flex;
                flex-direction: row;
                align-self: center;
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

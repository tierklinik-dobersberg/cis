import { CdkTableModule } from '@angular/cdk/table';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TrackByFunction
} from '@angular/core';
import { lucideCircleCheck, lucideCircleX, lucideMessageCircle } from '@ng-icons/lucide';
import { BrnTableModule } from '@spartan-ng/ui-table-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import {
  Filter,
  TkdEmptyTableComponent,
} from '@tierklinik-dobersberg/angular/empty-table';
import { HlmIconComponent, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { OffTimeEntry } from '@tierklinik-dobersberg/apis/roster/v1';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { TkdPaginationComponent } from 'src/app/components/pagination';
import { injectStoredProfile } from 'src/app/utils/inject-helpers';
import { usePaginationManager } from 'src/app/utils/pagination-manager';

export type Column = 'from' | 'to' | 'user' | 'description' | 'actions' | 'approval';

@Component({
  selector: 'offtime-table',
  standalone: true,
  templateUrl: './offtime-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BrnTableModule,
    TkdEmptyTableComponent,
    TkdPaginationComponent,
    HlmTableModule,
    CdkTableModule,
    ToDatePipe,
    DatePipe,
    AppAvatarComponent,
    HlmIconComponent,
    HlmButtonDirective,
  ],
  providers: [...provideIcons({
      lucideMessageCircle,
      lucideCircleX,
      lucideCircleCheck,
  })],
})
export class OfftimeTableComponent {
  public readonly entries = input.required<OffTimeEntry[]>();
  public readonly columns = input<Column[]>([]);
  public readonly filter = input<Filter | null>(null);
  public readonly totalCount = input<number | null>(null);

  protected readonly trackEntry: TrackByFunction<OffTimeEntry> = (_, e) => e.id;
  protected readonly paginator = usePaginationManager(this.entries);
  protected readonly currentUser = injectStoredProfile();
  protected readonly entryToDelete = signal<OffTimeEntry | null>(null)
  protected readonly layout = inject(LayoutService)

  public readonly onDelete = output<OffTimeEntry>()
  public readonly onShowComments = output<OffTimeEntry>();
  public readonly onHovered = output<OffTimeEntry>();

  protected readonly _computedFilteredCount = computed(
    () => this.entries().length
  );
}

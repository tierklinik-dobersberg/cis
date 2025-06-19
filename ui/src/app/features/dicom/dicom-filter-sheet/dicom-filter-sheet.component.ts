import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lucideSearch } from '@ng-icons/lucide';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import {
  BrnSheetContentDirective,
  BrnSheetTriggerDirective,
} from '@spartan-ng/ui-sheet-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import {
  HlmIconComponent,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { TkdDatePickerComponent } from 'src/app/components/date-picker';

export interface DICOMFilter {
  patientName: string;
  ownerName: string;
  dateRange: [Date, Date] | null;
  modalities: string[];
}

@Component({
  selector: 'dicom-filter-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dicom-filter-sheet.component.html',
  imports: [
    HlmSheetModule,
    BrnSheetTriggerDirective,
    BrnSheetContentDirective,
    HlmButtonDirective,
    HlmIconComponent,
    HlmLabelDirective,
    TkdDatePickerComponent,
    HlmInputDirective,
    FormsModule,
    HlmSelectModule,
    BrnSelectModule,
  ],
  providers: [
    ...provideIcons({
      lucideSearch,
    }),
  ],
})
export class DicomFilterSheetComponent {
  protected readonly layout = inject(LayoutService);

  public readonly filter = model<DICOMFilter | null>(null);

  protected readonly patientName = model('');
  protected readonly ownerName = model('');
  protected readonly dateRange = model<[Date, Date] | null>(null);
  protected readonly modalities = model<string[]>([])

  constructor() {
    effect(
      () => {
        const filter = this.filter() || {
          patientName: '',
          ownerName: '',
          dateRange: null,
          modalities: []
        };

        this.patientName.set(filter.patientName);
        this.ownerName.set(filter.ownerName);
        this.dateRange.set(filter.dateRange);
        this.modalities.set(filter.modalities)
      },
      { allowSignalWrites: true }
    );
  }

  protected onSheetClosed() {
    const filter: DICOMFilter = {
      patientName: this.patientName(),
      ownerName: this.ownerName(),
      dateRange: this.dateRange(),
      modalities: this.modalities(),
    };

    if (filter.patientName || filter.ownerName || (filter.dateRange && filter.dateRange[0]) || filter.modalities?.length) {
      this.filter.set(filter);
    } else {
      this.filter.set(null);
    }
  }
}

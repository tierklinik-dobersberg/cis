import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { HeaderTitleService } from "src/app/layout/header-title";
import { DICOMFilter, DicomFilterSheetComponent } from "../dicom-filter-sheet";
import { DicomListComponent } from "../dicom-list";

@Component({
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dicom-overview.component.html',
    imports: [
        DicomListComponent,
        HlmCardModule,
        DicomFilterSheetComponent
    ]
})
export class DicomOverviewComponent implements OnInit {
    private readonly headerTitleService = inject(HeaderTitleService)

    protected readonly filter = signal<DICOMFilter | null>(null)

    ngOnInit() {
        this.headerTitleService
            .set('DICOM Studien', 'Durchsuchen und Betrachten von Röntgen und Ultraschall Aufnahmen')
    }
}
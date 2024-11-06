import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { HlmCardDirective, HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { addDays } from "date-fns";
import { DicomListComponent } from "src/app/components/dicom-list";

@Component({
    selector: 'app-study-card',
    standalone: true,
    templateUrl: './study-card.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: '@container flex flex-col',
    },
    hostDirectives: [HlmCardDirective],
    imports: [
        HlmCardModule,
        DicomListComponent,
    ]
})
export class StudyCardComponent {
    protected readonly range = signal<[Date, Date]>([addDays(new Date, -7), new Date])
}
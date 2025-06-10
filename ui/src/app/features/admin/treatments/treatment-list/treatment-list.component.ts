import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ConnectError } from "@connectrpc/connect";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardDirective, HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectTreatmentService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Treatment } from "@tierklinik-dobersberg/apis/treatment/v1";
import { toast } from "ngx-sonner";
import { take } from "rxjs";
import { TreatmentDialogComponent } from "../treatment-dialog/treatment-dialog.component";

@Component({
    selector: 'app-species-list',
    standalone: true,
    templateUrl: './treatment-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmTableModule,
        HlmCardModule,
        HlmButtonDirective,
    ],
    hostDirectives: [ HlmCardDirective ],
    providers: [],
    host: {
        class: 'm-2 md:m-4 lg:m-8 xl:m-12'
    }
})
export class TreatmentListComponent implements OnInit {
    private readonly treatmentService = injectTreatmentService();
    private readonly dialog = inject(HlmDialogService)

    protected readonly species = signal<Treatment[]>([]);

    protected openOrCreate(s?: Treatment) {
        TreatmentDialogComponent.open(this.dialog, s)
            .closed$
            .pipe(take(1))
            .subscribe(result => {
                if (!result) {
                    return
                }

                this.load()
            })
    }
    
    ngOnInit(): void {
        this.load()
    }

    private load() {
        this.treatmentService
            .listTreatments({})
            .then(response => {
                this.species.set(response.treatments || [])
            })
            .catch(err => {
                toast.error('Behandlungen konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })
            })
    }
}
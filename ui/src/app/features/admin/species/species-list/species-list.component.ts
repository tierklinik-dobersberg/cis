import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ConnectError } from "@connectrpc/connect";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardDirective, HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectSpeciesService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Species } from "@tierklinik-dobersberg/apis/treatment/v1";
import { toast } from "ngx-sonner";
import { take } from "rxjs";
import { AppIconComponent } from "src/app/components/app-icon/app-icon.component";
import { SpeciesDialogComponent } from "../species-dialog/species-dialog.component";

@Component({
    selector: 'app-species-list',
    standalone: true,
    templateUrl: './species-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AppIconComponent,
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
export class SpeciesListComponent implements OnInit {
    private readonly speciesService = injectSpeciesService();
    private readonly dialog = inject(HlmDialogService)

    protected readonly species = signal<Species[]>([]);

    protected openOrCreate(s?: Species) {
        SpeciesDialogComponent.open(this.dialog, s)
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
        this.speciesService
            .listSpecies({})
            .then(response => {
                this.species.set(response.species || [])
            })
            .catch(err => {
                toast.error('Rassedaten konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })
            })
    }
}
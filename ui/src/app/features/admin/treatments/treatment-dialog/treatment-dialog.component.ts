import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { provideIcons } from "@ng-icons/core";
import { lucideX } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCheckboxComponent } from "@tierklinik-dobersberg/angular/checkbox";
import { injectCalendarService, injectSpeciesService, injectTreatmentService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { DisplayNamePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from "@tierklinik-dobersberg/angular/table";
import { Duration } from "@tierklinik-dobersberg/angular/utils/date";
import { ResourceCalendar } from "@tierklinik-dobersberg/apis/calendar/v1";
import { Species, Treatment } from "@tierklinik-dobersberg/apis/treatment/v1";
import { toast } from "ngx-sonner";
import { MyEditor } from "src/app/ckeditor";
import { AppIconComponent } from "src/app/components/app-icon/app-icon.component";
import { DIALOG_CONTENT_CLASS } from "src/app/dialogs/constants";

export type DialogResult = 'updated' | 'created' | 'deleted' | undefined;

@Component({
    standalone: true,
    templateUrl: './treatment-dialog.component.html',
  imports: [
    HlmDialogHeaderComponent,
    HlmDialogDescriptionDirective,
    HlmDialogTitleDirective,
    HlmDialogFooterComponent,
    HlmButtonDirective,
    HlmTableComponent,
    HlmThComponent,
    HlmTrowComponent,
    HlmTdComponent,
    HlmIconModule,
    BrnSelectModule,
    HlmSelectModule,
    HlmCheckboxComponent,
    FormsModule,
    HlmInputDirective,
    BrnAlertDialogModule,
    HlmAlertDialogModule,
    CKEditorModule,
    BrnSelectModule,
    HlmSelectModule,
    NgClass,
    CKEditorModule,
    AppIconComponent,
    DisplayNamePipe
  ],
  providers: [...provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        @apply flex h-full w-full flex-col overflow-hidden max-h-[80vh] !max-h-[80dvh];
      }
    `,
  ],
})
export class TreatmentDialogComponent implements OnInit {
    private readonly treatmentService = injectTreatmentService();
    private readonly speciesService = injectSpeciesService();
    private readonly calendarService = injectCalendarService();
    private readonly dialogRef = inject(BrnDialogRef);
    private readonly ctx: Treatment | undefined = injectBrnDialogContext()

    protected readonly availableSpecies = signal<Species[]>([]);
    protected readonly availableResources = signal<ResourceCalendar[]>([])
    protected readonly profiles = injectUserProfiles();
    protected readonly editor = MyEditor;

    protected readonly name = signal(this.ctx?.name || '')
    protected readonly displayName = signal(this.ctx?.displayName)
    protected readonly resources = signal(this.ctx?.resources || []);
    protected readonly species = signal(this.ctx?.species || []);
    protected readonly allowedEmployees = signal(this.ctx?.allowedEmployees || [])
    protected readonly preferredEmployees = signal(this.ctx?.preferredEmployees || [])
    protected readonly allowOnlineBooking = signal(this.ctx?.allowSelfBooking || false)
    protected readonly initialTime = signal( Duration.seconds( Number(this.ctx?.initialTimeRequirement?.seconds || 15*60) ).format('default'))
    protected readonly additionalTime = signal( Duration.seconds( Number(this.ctx?.additionalTimeRequirement?.seconds || 15*60) ).format('default'))
    protected readonly helpText = signal(this.ctx?.helpText || '')

    protected readonly matchWords = signal(this.ctx?.matchEventText || [])
    protected readonly newWord = model('');

    protected readonly mode = signal<'create' | 'edit' >(this.ctx?.name !== undefined ? 'edit' : 'create')

    ngOnInit() {
      this.calendarService
        .listResourceCalendars({})
        .then(response => this.availableResources.set(response.resourceCalendars || []))
        .catch(err => {
          toast.error('Resource-Kalender konnten nicht geladen werden', {
            description: ConnectError.from(err).message
          })
        })

      this.speciesService
        .listSpecies({})
        .then(res => this.availableSpecies.set(res.species || []))
        .catch(err => {
          toast.error('Tiararten konnten nicht geladen werden', {
            description: ConnectError.from(err).message
          })
        })
    }

    protected delete() {
      this.treatmentService
        .deleteTreatment({
          name: this.name(),
        })
        .then(s => {
          this.close('deleted')
        })
        .catch(err => {
          toast.error('Behandlung konnten nicht gelöscht werden', {
            description: ConnectError.from(err).message,
          })
        })
    }

    protected save() {
      if (this.mode() === 'edit') {
        this.treatmentService
          .updateTreatment({
            name: this.name(),
            additionalTimeRequirement: Duration.parseString(this.additionalTime()).toProto(),
            initialTimeRequirement: Duration.parseString(this.initialTime()).toProto(),
            allowedEmployees: this.allowedEmployees(),
            preferredEmployees: this.preferredEmployees(),
            allowSelfBooking: this.allowOnlineBooking(),
            displayName: this.displayName(),
            helpText: this.helpText(),
            matchEventText: this.matchWords(),
            species: this.species(),
            resources: this.resources(),
          })
        .then(s => {
          this.close('updated')
        })
        .catch(err => {
          toast.error('Behandlung konnten nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          })
        })

        return
      }

      this.treatmentService
        .createTreatment({
            name: this.name(),
            additionalTimeRequirement: Duration.parseString(this.additionalTime()).toProto(),
            initialTimeRequirement: Duration.parseString(this.initialTime()).toProto(),
            allowedEmployees: this.allowedEmployees(),
            preferredEmployees: this.preferredEmployees(),
            allowSelfBooking: this.allowOnlineBooking(),
            displayName: this.displayName(),
            helpText: this.helpText(),
            matchEventText: this.matchWords(),
            species: this.species(),
            resources: this.resources(),
        })
        .then(s => {
          this.close('created')
        })
        .catch(err => {
          toast.error('Behandlung konnten nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          })
        })
    }

    protected close(res: DialogResult) {
        this.dialogRef.close(res)
    }

    protected deleteWord(idx: number) {
      const words = [...this.matchWords()]
      words.splice(idx, 1)

      this.matchWords.set(words)
    }

    protected addWord(event: Event) {
      this.matchWords.set(
        [
          this.newWord(),
          ...this.matchWords(),
        ]
      )

      this.newWord.set('')
    }

    static open(service: HlmDialogService, treatment?: Treatment): BrnDialogRef<DialogResult> {
      return service.open(TreatmentDialogComponent, {
        contentClass: DIALOG_CONTENT_CLASS,
        context: treatment,
      })
    }
}
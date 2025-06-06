import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { provideIcons } from "@ng-icons/core";
import { lucideX } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectSpeciesService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from "@tierklinik-dobersberg/angular/table";
import { Icon, IconType, Species } from "@tierklinik-dobersberg/apis/treatment/v1";
import { toast } from "ngx-sonner";
import { DIALOG_CONTENT_CLASS } from "src/app/dialogs/constants";

export type DialogResult = 'updated' | 'created' | 'deleted' | undefined;

@Component({
    standalone: true,
    templateUrl: './species-dialog.component.html',
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
    FormsModule,
    HlmInputDirective,
    BrnAlertDialogModule,
    HlmAlertDialogModule,
    CKEditorModule,
    BrnSelectModule,
    HlmSelectModule,
    NgClass
  ],
  providers: [...provideIcons({ lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        @apply flex h-full w-full flex-col overflow-hidden;
      }
    `,
  ],
})
export class SpeciesDialogComponent {
    private readonly speciesService = injectSpeciesService();
    private readonly dialogRef = inject(BrnDialogRef);
    private readonly ctx: Species | undefined = injectBrnDialogContext()

    protected readonly types = IconType;

    protected readonly name = signal(this.ctx?.name || '')
    protected readonly displayName = signal(this.ctx?.displayName)
    protected readonly matchWords = signal(this.ctx?.matchWords || [])
    protected readonly iconType = signal(this.ctx?.icon?.type || IconType.UNICODE)
    protected readonly iconData = signal(this.ctx?.icon?.data || new TextEncoder().encode("\uD83D\uDC3E"))
    protected readonly newWord = model('');

    protected readonly computedIcon = computed(() => {
      return new Icon({
        data: this.iconData(),
        type: this.iconType(),
      })
    })

    protected readonly iconDataValue = computed(() => {
      return new TextDecoder().decode(this.iconData() || new Uint8Array())
    })

    protected updateIconData(value: string) {
      this.iconData.set(new TextEncoder().encode(value))
    }

    protected readonly mode = signal<'create' | 'edit' >(this.ctx ? 'edit' : 'create')

    protected delete() {
      this.speciesService
        .deleteSpecies({
          name: this.name(),
        })
        .then(s => {
          this.close('deleted')
        })
        .catch(err => {
          toast.error('Rassedaten konnten nicht gelöscht werden', {
            description: ConnectError.from(err).message,
          })
        })
    }

    protected save() {
      if (this.ctx) {
        this.speciesService
          .updateSpecies({
            name: this.name(),
            species: {
              displayName: this.displayName(),
              icon: this.computedIcon(),
              matchWords: this.matchWords(),
            }
          })
        .then(s => {
          this.close('updated')
        })
        .catch(err => {
          toast.error('Rassedaten konnten nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          })
        })

        return
      }

      this.speciesService
        .createSpecies({
          displayName: this.displayName(),
          icon: this.computedIcon(),
          matchWords: this.matchWords(),
          name: this.name(),
        })
        .then(s => {
          this.close('created')
        })
        .catch(err => {
          toast.error('Rassedaten konnten nicht gespeichert werden', {
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

    static open(service: HlmDialogService, species?: Species): BrnDialogRef<DialogResult> {
      return service.open(SpeciesDialogComponent, {
        contentClass: DIALOG_CONTENT_CLASS,
        context: species,
      })
    }
}
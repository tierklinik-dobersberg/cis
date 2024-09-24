import { ChangeDetectionStrategy, Component, effect, input, model, signal, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from "@angular/material/autocomplete";
import { ConnectError } from "@connectrpc/connect";
import { BrnDialogModule } from "@spartan-ng/ui-dialog-brain";
import { BrnMenuModule } from "@spartan-ng/ui-menu-brain";
import { injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogModule } from "@tierklinik-dobersberg/angular/dialog";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { Board, ParseFilterResponse } from "@tierklinik-dobersberg/apis/tasks/v1";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdCalendarEventCellTemplateDirective } from "../../calendar2/day-view/event-cell.directive";

@Component({
    selector: 'app-task-query-filter',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './task-query-filter.html',
    imports: [
    FormsModule,
    HlmInputDirective,
    HlmMenuModule,
    BrnMenuModule,
    AppAvatarComponent,
    HlmDialogModule,
    BrnDialogModule,
    TkdCalendarEventCellTemplateDirective,
    MatAutocompleteModule,
]
})
export class TaskQueryFilterComponent {
    public readonly board = input.required<Board>();
    public readonly filter = model<string>();

    private readonly taskService = injectTaskService();
    protected readonly query = model('');

    @ViewChild(MatAutocompleteTrigger)
    trigger: MatAutocompleteTrigger

    protected readonly data = signal<ParseFilterResponse>(new ParseFilterResponse)

    handleOption(v: MatAutocompleteSelectedEvent) {
        let query = this.data().normalizedQuery;

        if (this.data().expectedToken === 'value' || this.data().expectedToken === 'sep') {
            query += ` ${this.data().lastFieldName}:${JSON.stringify(v.option.value)}`
        } else {
            query += ` ${v.option.value}`
        }

        this.query.set(query);
    }

    constructor() {
        let first = true
        effect(() => {
            const filter = this.filter();

            this.query.set(filter)
        }, { allowSignalWrites: true })

        effect(() => {
            const query = (this.query() || '').trim();
            const board = this.board();

            if (!board || !board.id) {
                return
            }

            this.taskService
                .parseFilter({
                    boardId: board.id,
                    query,
                })
                .catch(err => {
                    toast.error('Failed to parse task query', {
                        description: ConnectError.from(err).message
                    })

                    return new ParseFilterResponse
                })
                .then(response => {
                    this.data.set(response);

                    if (['sep', 'value'].includes(response.expectedToken)) {
                        this.trigger.openPanel();
                    }
                })
        }, { allowSignalWrites: true })
    }
}
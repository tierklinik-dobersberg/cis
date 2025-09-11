import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { hlm } from "@spartan-ng/ui-core";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { DateInput } from "@tierklinik-dobersberg/angular/utils/date";
import { AbstractBaseDialog } from "src/app/dialogs/base-dialog/base-dialog.component";
import { DIALOG_CONTENT_CLASS } from "src/app/dialogs/constants";
import { RosterCalendarComponent } from "../roster-calendar";

export interface RosterDialogContext {
    date: DateInput;
}

@Component({
    standalone: true,
    templateUrl: './roster-dialog.component.html',
    imports: [
        RosterCalendarComponent,
        HlmDialogHeaderComponent,
        HlmDialogTitleDirective,
        ToDatePipe,
        DatePipe
    ]
})
export class RosterDialogComponent extends AbstractBaseDialog {
    protected readonly rosterDate = injectBrnDialogContext<RosterDialogContext>()?.date || new Date();

    public static open(service: HlmDialogService, ctx: RosterDialogContext): BrnDialogRef<unknown> {
        return service.open(RosterDialogComponent, {
            contentClass: hlm(DIALOG_CONTENT_CLASS, '!w-screen !h-screen !w-[100dvw] !h-[100-dvh] overflow-auto !max-h-screen !max-h-[100dvh')
        })
    }
}
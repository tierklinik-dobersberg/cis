import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
    selector: 'create-event-sheet',
    standalone: true,
    templateUrl: './create-event-sheet.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEventSheetComponent {

}
import { Directive, Input, TemplateRef, inject } from "@angular/core";
import { Calendar, Timed } from "./models";

export interface EventContext<E extends Timed, C extends Calendar> {
  $implicit: E;
  calendar: C;
}

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'ng-template[eventCell]',
  standalone: true,
  exportAs: "tkdCalendarEventCell"
})
export class TkdCalendarEventCellTemplateDirective<E extends Timed, C extends Calendar> {
  public readonly template: TemplateRef<EventContext<E, C>> = inject(TemplateRef);

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('eventCell')
  eventCell: C[] | C;

  static ngTemplateContextGuard<E extends Timed, C extends Calendar>(dir: TkdCalendarEventCellTemplateDirective<E, C>, ctx: unknown): ctx is EventContext<E, C> {
    return true;
  }
}

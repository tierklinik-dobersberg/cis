import { Directive, Input, TemplateRef, inject } from "@angular/core";
import { Calendar, Timed } from "./models";

export interface CalendarContext<E extends Timed, C extends Calendar> {
  $implicit: C;
}

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'ng-template[headerCell]',
  standalone: true,
  exportAs: "tkdCalendarHeaderCell"
})
export class TkdCalendarHeaderCellTemplateDirective<E extends Timed, C extends Calendar> {
  public readonly template: TemplateRef<CalendarContext<E, C>> = inject(TemplateRef);

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('headerCell')
  headerCell: C[] | C;

  static ngTemplateContextGuard<E extends Timed, C extends Calendar>(dir: TkdCalendarHeaderCellTemplateDirective<E, C>, ctx: unknown): ctx is CalendarContext<E, C> {
    return true;
  }
}

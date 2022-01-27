import { Directive, HostListener } from "@angular/core";

@Directive({
  selector: 'a[no-bubble]'  // eslint-disable-line
})
export class LinkNoBubbleDirective {
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    event.stopPropagation();
  }
}

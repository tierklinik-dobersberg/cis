import { Directive } from "@angular/core";
import { BrnPopoverTriggerDirective } from "@spartan-ng/ui-popover-brain";

@Directive({
    selector: '[appPopoverTrigger]',
    standalone: true,
    exportAs: 'appPopoverTrigger'
})
export class AppPopoverTriggerDirective extends BrnPopoverTriggerDirective {}
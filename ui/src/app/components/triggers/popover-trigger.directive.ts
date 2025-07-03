import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  model
} from '@angular/core';
import { BrnPopoverTriggerDirective } from '@spartan-ng/ui-popover-brain';

@Directive({
  selector: '[appPopoverTrigger]',
  standalone: true,
  exportAs: 'appPopoverTrigger',
  inputs: [
    {
      name: 'brnPopoverTriggerFor',
      alias: 'appPopoverTriggerFor'
    }
  ]
})
export class AppPopoverTriggerDirective extends BrnPopoverTriggerDirective {
  public readonly mode = input<'default' | 'shared-side'>('default', {
    alias: 'appPopoverTriggerMode',
  });

  public readonly disabled = input(false, { alias: 'appPopoverTriggerDisabled'})

  private readonly host = inject(ElementRef);
  public readonly ctx = model<any>({}, { alias: 'appPopoverTrigger' });
  
  private isOpen = false;

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.mode() === 'default' || this.disabled()) {
      return;
    }

    if (this.isOpen) {
        return
    }
    this.isOpen = true;

    this._brnDialog.setContext({ data: this.ctx() });
    this._brnDialog.autoFocus = ".test"
    this._brnDialog.scrollStrategy = "reposition";
    this._brnDialog.attachTo = this.host;
    this._brnDialog.attachPositions = [
      {
        originX: 'end',
        originY: 'top',
        overlayX: 'start',
        overlayY: 'top',
      },
      {
        originX: 'start',
        originY: 'top',
        overlayX: 'end',
        overlayY: 'top',
      },
    ];

    this._brnDialog.open()
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    if (this.mode() === 'default' || this.disabled()) {
      return;
    }
    this.isOpen = false;

    this._brnDialog?.close(null);
  }
}

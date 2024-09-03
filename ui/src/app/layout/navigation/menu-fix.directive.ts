import { CdkMenu } from '@angular/cdk/menu';
import { Directive, inject } from '@angular/core';

@Directive({
  selector: 'hlm-menu, hlm-sub-menu',
  standalone: true,
})
export class MenuFixDirective {
  public readonly menu = inject(CdkMenu, { host: true });

  constructor() {
    const m = this.menu as any;

    if (!m._parentTrigger) {
      // Fix for hlm-menu not expected to be rendered inline.
      (this.menu as any)._parentTrigger = {
        _spartanLastPosition: {
          originX: 'start',
        },
      };
    }
  }
}

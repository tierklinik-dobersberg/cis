import { Directive, input, model } from '@angular/core';
import { BrnDialogTriggerDirective } from '@spartan-ng/ui-dialog-brain';
import { BrnSheetComponent } from '@spartan-ng/ui-sheet-brain';

@Directive({
	selector: '[appSheetTriggerFor]',
	standalone: true,
	exportAs: "appSheetTrigger"
})
export class AppSheetTriggerDirective extends BrnDialogTriggerDirective {
    public readonly sheet = model<BrnSheetComponent | undefined>(undefined, {alias: 'appSheetTriggerFor'})
	public readonly side = input<'top' | 'bottom' | 'left' | 'right' | undefined>('bottom');

	override open() {
        if (!this.sheet()) {
            return
        }
        
		if (this.side()) {
			this.sheet().setSide = this.side();
		}
        
        super.brnDialogTriggerFor = this.sheet();
		super.open();
	}
}
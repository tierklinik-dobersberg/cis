import { CdkMenu } from '@angular/cdk/menu';
import { booleanAttribute, Component, computed, inject, Input, input, signal } from '@angular/core';
import { hlm } from '@spartan-ng/ui-core';
import { BrnMenuDirective } from '@spartan-ng/ui-menu-brain';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { cva, VariantProps } from 'class-variance-authority';
import { ClassValue } from 'clsx';

export const menuVariants = cva(
	'block [&_.cdk-menu-item]:sm:px-4 [&_.cdk-menu-item]:sm:py-2 [&_.cdk-menu-item]:py-4 [&_.cdk-menu-item]:px-4 border-border min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
	{
		variants: {
			variant: {
				default: 'my-0.5',
				menubar: 'my-2',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);
type MenuVariants = VariantProps<typeof menuVariants>;

export const sheetClasses = 'border-none shadow-none w-full rounded-none';

@Component({
	selector: 'app-menu',
	standalone: true,
	host: {
		'[class]': '_customClass()',
	},
    hostDirectives: [BrnMenuDirective],
	template: `
		<ng-content />
	`,
})
export class AppMenuComponent {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });
    protected readonly layout = inject(LayoutService);
    
    protected _computedClass = computed(() => hlm(menuVariants({ variant: this._variant() }), this.userClass()));

	private readonly _variant = signal<MenuVariants['variant']>('default');
    private readonly menu = inject(CdkMenu, {host: true})

    public readonly sheet = input(false, {transform: booleanAttribute});

	@Input()
	set variant(value: MenuVariants['variant']) {
		this._variant.set(value);
	}
    
    protected _customClass = computed(() => {
        let cls = '';
        
        if (this.sheet()) {
            cls = sheetClasses
        }
        
        return hlm(this._computedClass(), cls)
    })
    
    constructor() {
        // Fix for hlm-menu not expected to be rendered inline.
        (this.menu as any)._parentTrigger = {
          _spartanLastPosition: {
            originX: "start"
          }
        }
    }
}
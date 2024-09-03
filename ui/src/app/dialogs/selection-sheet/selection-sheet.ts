import { NgTemplateOutlet } from "@angular/common";
import { Component, ContentChild, ContentChildren, input, model, QueryList, TrackByFunction } from "@angular/core";
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { ButtonVariants, HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { AppSheetTriggerDirective } from "src/app/components/triggers";
import { SelectionSheetItemDirective } from "./section-item.directive";
import { SheetItemGroupDirective } from "./selection-group.directive";

@Component({
    selector: 'app-sheet-selection',
    standalone: true,
    imports: [
        HlmSheetModule,
        BrnSheetModule,
        AppSheetTriggerDirective,
        HlmButtonDirective,
        NgTemplateOutlet,
    ],
    templateUrl: './selection-sheet.html',
})
export class SelectionSheet<T> {
    /** The button variant for the trigger button */
    public readonly variant = input<ButtonVariants['variant']>('default');

    /** The button size for the trigger button */
    public readonly size = input<ButtonVariants['size']>('default');

    /** The items to render */
    public readonly items = input.required<T[]>();

    public readonly trackItem = input<TrackByFunction<T>>((_, v) => v)

    /** The selected user profile */
    public readonly selected = model<T | null>(null);

    /** The template to render */
    @ContentChild(SelectionSheetItemDirective)
    protected readonly itemTemplate!: SelectionSheetItemDirective<T>;

    @ContentChildren(SheetItemGroupDirective)
    protected readonly groups: QueryList<SheetItemGroupDirective<T>>;
}

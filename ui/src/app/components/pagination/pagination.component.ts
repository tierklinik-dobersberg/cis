import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { lucideArrowLeft, lucideArrowRight } from "@ng-icons/lucide";
import { hlm } from "@spartan-ng/ui-core";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { BrnPaginatorDirective } from "@spartan-ng/ui-table-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmIconComponent, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { ClassValue } from "clsx";
import { PaginationManager } from "src/app/utils/pagination-manager";

const defaultClass = "flex flex-row items-center w-full justify-between";

@Component({
    standalone: true,
    selector: 'tkd-pagination',
    templateUrl: './pagination.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        HlmIconComponent,
        BrnPaginatorDirective,
        HlmSelectModule,
        BrnSelectModule,
        FormsModule,
    ],
    providers: [
        ...provideIcons({lucideArrowLeft, lucideArrowRight})
    ]
})
export class TkdPaginationComponent {
    public readonly paginator = input.required<PaginationManager>();

    public readonly userClass = input<ClassValue>('', { alias: 'class' })

    protected readonly _computedClasses = computed(() => {
        const userClass = this.userClass();

        return hlm(defaultClass, userClass);
    })
}
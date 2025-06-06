import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { Icon, IconType } from "@tierklinik-dobersberg/apis/treatment/v1";

@Component({
    standalone: true,
    selector: 'app-icon',
    templateUrl: './app-icon.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'flex flex-row items-center justify-center'
    }
})
export class AppIconComponent {
    public readonly icon = input.required<Icon>()

    protected readonly types = IconType;

    private lastUrl: string | null = null;
    protected readonly image = computed(() => {
        const icon = this.icon();

        if (this.lastUrl) {
            URL.revokeObjectURL(this.lastUrl)
        }

        if (icon.type === this.types.IMAGE_WEBP) {
            this.lastUrl = URL.createObjectURL(new Blob([icon.data], {
                type: "image/webp"
            })) 

            return this.lastUrl
        }

        return new TextDecoder().decode(icon.data || new Uint8Array())
    })
}
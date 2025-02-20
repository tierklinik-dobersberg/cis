import { computed, inject, Injectable, signal } from "@angular/core";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";

@Injectable({providedIn: 'root'})
export class NavigationService {
    private readonly layout = inject(LayoutService);

    public readonly forceHide = signal(false);

    public readonly showNav = computed(() => {
        const force = this.forceHide();
        const lg = this.layout.lg();

        if (force) {
            return false
        }

        return lg;
    })
}
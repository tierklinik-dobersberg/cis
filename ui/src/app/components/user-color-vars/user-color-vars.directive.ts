import { computed, Directive, effect, ElementRef, inject, input, Renderer2, RendererStyleFlags2 } from "@angular/core";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { UserColorPipe, UserContrastColorPipe } from "@tierklinik-dobersberg/angular/pipes";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { ToRGBAPipe } from "src/app/pipes/to-rgba.pipe";

@Directive({
    selector: '[userColorVars]',
    standalone: true,
})
export class UserColorVarsDirective {
    private readonly profiles = injectUserProfiles();
    private readonly renderer = inject(Renderer2);
    private readonly host = inject(ElementRef);

    public readonly user = input<Profile | string | null>(null, {
        alias: 'userColorVars'
    });
    
    private userColor = new UserColorPipe;
    private contrastColor = new UserContrastColorPipe;
    private toRGBA = new ToRGBAPipe();
    
    protected readonly _computedStyle = computed(() => {
        let user = this.user();
        let profiles = this.profiles();
        
        if (typeof user === 'string')  {
            user = profiles.find(p => p.user!.id === user);
        }

        if (!user) {
            return {}
        }
        
        return {
            '--user-color': this.toRGBA.transform(this.userColor.transform(user), 'var(--user-color-opacity,1)'),
            '--user-contrast': this.toRGBA.transform(this.contrastColor.transform(user), 'var(--user-contrast-opacity,1)'),
        }
    })
    
    constructor() {
        effect(() => {
            const style = this._computedStyle();
            
            if (!this.host) {
                return;
            }
            
            Object.keys(style)
                .forEach(key => {
                    this.renderer.setStyle(this.host.nativeElement, key, style[key], RendererStyleFlags2.DashCase);
                })
        })
    }
}


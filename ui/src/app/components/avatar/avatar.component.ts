import { NgStyle } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { hlm } from '@spartan-ng/ui-core';
import { avatarVariants, HlmAvatarModule } from '@tierklinik-dobersberg/angular/avatar';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { DisplayNamePipe, ToUserPipe, UserAvatarPipe, UserLetterPipe } from "@tierklinik-dobersberg/angular/pipes";
import { Profile } from "@tierklinik-dobersberg/apis";
import type { VariantProps } from 'class-variance-authority';
import { type ClassArray, type ClassValue, clsx } from 'clsx';
import { UserColorVarsDirective } from "../user-color-vars";

type AvatarVariants = VariantProps<typeof avatarVariants>;

export const defaultClasses = "border border-[var(--user-color,var(--border))] [--user-color-opacity:0.4]";

@Component({
    selector: 'app-avatar',
    standalone: true,
    templateUrl: './avatar.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgStyle,
        HlmAvatarModule,
        ToUserPipe,
        UserAvatarPipe,
        DisplayNamePipe,
        UserLetterPipe,
        UserColorVarsDirective
    ],
    styles: [
        `
        :host {
            @apply inline-flex items-center gap-1 flex-nowrap overflow-hidden text-ellipsis whitespace-nowrap;
        }
        `,
    ]
})
export class AppAvatarComponent {
    public readonly profileOrId = input.required<Profile | string>({alias: 'user'});
    public readonly variant = input<AvatarVariants['variant']>('medium');
    public readonly userClasses = input<ClassValue | ClassArray>([], {alias: "class"});
    public readonly showName = input(false, {transform: booleanAttribute});
    
    protected readonly profiles = injectUserProfiles();
    
    protected readonly _computedClasses = computed(() => {
        return hlm(clsx(defaultClasses, this.userClasses()));
    })
}
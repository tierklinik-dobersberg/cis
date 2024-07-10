import { NgStyle } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { hlm } from '@spartan-ng/ui-core';
import { avatarVariants, HlmAvatarModule } from '@tierklinik-dobersberg/angular/avatar';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { DisplayNamePipe, ToUserPipe, UserAvatarPipe, UserColorPipe, UserContrastColorPipe, UserLetterPipe } from "@tierklinik-dobersberg/angular/pipes";
import { Profile } from "@tierklinik-dobersberg/apis";
import type { VariantProps } from 'class-variance-authority';
import { type ClassArray, type ClassValue, clsx } from 'clsx';

type AvatarVariants = VariantProps<typeof avatarVariants>;

export const defaultClasses = "";

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
        UserColorPipe,
        UserContrastColorPipe,
        UserLetterPipe,
    ],
})
export class AppAvatarComponent {
    public readonly profileOrId = input.required<Profile | string>({alias: 'user'});
    public readonly variant = input<AvatarVariants['variant']>('medium');
    public readonly userClasses = input<ClassValue | ClassArray>([], {alias: "class"});
    
    protected readonly profiles = injectUserProfiles();
    
    protected readonly _computedClasses = computed(() => {
        return hlm(clsx(defaultClasses, this.userClasses()));
    })
}
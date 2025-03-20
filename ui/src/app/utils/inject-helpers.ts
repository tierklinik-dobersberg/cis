import { effect, untracked } from "@angular/core";
import { injectCurrentProfile } from "@tierklinik-dobersberg/angular/behaviors";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { injectCurrentConfig, UIConfig } from "../api";
import { storedSignal } from "./stored-signal";

/** 
 * Injects the current user profile and keeps it stored in the localStorage
 * for faster page views.
 */
export function injectStoredProfile() {
    const signal = storedSignal<Profile | null>("cis:profile", null, (val: string) => new Profile(JSON.parse(val)))
    const profile = injectCurrentProfile();

    effect(() => {
        const p = profile();
        const last = untracked(() => signal())

        if (p == last) {
            return
        }

        if (!p && !!last) {
            signal.set(null)
            return
        }

        if (p && !last) {
            signal.set(p)
            return
        }

        // only set the profile signal if the response
        // actually changed in order to avoid triggering to
        // many signals.
        if (!p.equals(last)) {
            signal.set(p)
        }
    }, { allowSignalWrites: true })

    return signal;
}

/** 
 * Injects the current CIS config and keeps it stored in the localStorage
 * for faster page views.
 */
export function injectStoredConfig() {
    const signal = storedSignal<UIConfig | null>("cis:config", null);
    const config = injectCurrentConfig();

    effect(() => {
        const c = config();
        signal.set(c)
    }, { allowSignalWrites: true })

    return signal
}
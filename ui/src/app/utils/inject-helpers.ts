import { effect } from "@angular/core";
import { injectCurrentProfile } from "@tierklinik-dobersberg/angular/behaviors";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { injectCurrentConfig, UIConfig } from "../api";
import { storedSignal } from "./stored-signal";


export function injectStoredProfile() {
    const signal = storedSignal<Profile | null>("cis:profile", null)
    const profile = injectCurrentProfile();

    effect(() => {
        const p = profile();

        signal.set(p)
    }, { allowSignalWrites: true })

    return signal;
}

export function injectStoredConfig() {
    const signal = storedSignal<UIConfig | null>("cis:config", null);
    const config = injectCurrentConfig();

    effect(() => {
        const c = config();
        signal.set(c)
    }, { allowSignalWrites: true })

    return signal
}
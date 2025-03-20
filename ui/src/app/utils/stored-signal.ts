import { effect, model, ModelSignal, signal, WritableSignal } from "@angular/core";


export function storedSignal<T>(key: string, initialValue: T, unmarshal?: (s: string) => T): WritableSignal<T>;
export function storedSignal<T>(key: string, initialValue: T, unmarshal: (s: string) => T, constructor: typeof model): ModelSignal<T>;

export function storedSignal<T>(key: string, initialValue: T, unmarshal = JSON.parse, constructor = signal): WritableSignal<T> | ModelSignal<T> {
    const s = constructor<T>(initialValue)

    try {
        if (window.localStorage) {
            const str = window.localStorage.getItem(key);
            if (str) {
                const value: T = unmarshal(str)
                s.set(value);
            }

            effect(() => {
                const newValue = s();
                window.localStorage.setItem(key, JSON.stringify(newValue))
            })
        }
    } catch(err) {
        console.error("failed to parse value", err)
    }

    return s
}
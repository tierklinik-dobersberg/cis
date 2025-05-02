import { effect, signal, Signal } from "@angular/core";

export function asyncResource<T, R>(trigger: Signal<T>, loader: (T) => Promise<T[]>): Signal<T[]> {
    const result = signal<T[]>([])

    effect(() => {
       const ref = trigger();
       
       loader(ref)
        .then(response => {
            result.set(response);
        })
    })

    return result;
}
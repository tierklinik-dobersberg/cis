import {
    effect,
    model,
    ModelSignal,
    signal,
    WritableSignal,
} from '@angular/core';

export type UnmarshalFunc<T> = (obj: object) => T

export function storedSignal<T>(
  key: string,
  initialValue: T,
  unmarshal?: UnmarshalFunc<T>,
): WritableSignal<T>;

export function storedSignal<T>(
  key: string,
  initialValue: T,
  unmarshal: UnmarshalFunc<T>,
  constructor: typeof model
): ModelSignal<T>;

export function storedSignal<T>(
  key: string,
  initialValue: T,
  unmarshal: UnmarshalFunc<T> = obj => obj as T,
  constructor = signal
): WritableSignal<T> | ModelSignal<T> {
  const s = constructor<T>(initialValue);

  if (window.localStorage) {
    try {
      const str = window.localStorage.getItem(key);
      if (!!str) {
        const value: object = JSON.parse(str);

        if (value !== null) {
            s.set(unmarshal(value));
        } else {
            s.set(null)
        }
      }
    } catch (err) {
      console.error('failed to parse value', err);
    }

    effect(() => {
      const newValue = s();
      window.localStorage.setItem(key, JSON.stringify(newValue));
    });
  }

  return s;
}

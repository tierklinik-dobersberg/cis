import { padLeft } from "./strings";

const nanosecond = 1;
const microsecond = 1000 * nanosecond;
const millisecond = 1000 * microsecond;
const second = 1000 * millisecond;
const minute = 60 * second;
const hour = 60 * minute;

export type DurationLayout = "default" | "hh:mm" | "hh:mm:ss";

export class Duration {
    private _nanoseconds: number;
    constructor(ns: number) {
        this._nanoseconds = ns;
    }

    static nanosecond = new Duration(nanosecond);
    static microsecond = new Duration(microsecond);
    static millisecond = new Duration(millisecond);
    static second = new Duration(second);
    static minute = new Duration(minute);
    static hour = new Duration(hour);

    static nanoseconds(s: number): Duration {
        return new Duration(s * nanosecond);
    }
    static microseconds(s: number): Duration {
        return new Duration(s * microsecond);
    }
    static milliseconds(s: number): Duration {
        return new Duration(s * millisecond);
    }
    static seconds(s: number): Duration {
        return new Duration(s * second);
    }
    static minutes(s: number): Duration {
        return new Duration(s * minute);
    }
    static hours(s: number): Duration {
        return new Duration(s * hour);
    }

    get nanoseconds() {
        return this._nanoseconds;
    }

    get microseconds() {
        return Math.floor(this._nanoseconds / microsecond);
    }

    get milliseconds() {
        return Math.floor(this._nanoseconds / millisecond);
    }

    get seconds() {
        return Math.floor(this._nanoseconds / second);
    }

    get minutes() {
        return Math.floor(this._nanoseconds / minute);
    }

    get hours() {
        return Math.floor(this._nanoseconds / hour);
    }

    format(layout: DurationLayout = "default"): string {
        if (layout === "default") {
            return this.toString();
        }

        const sign = this._nanoseconds < 0 ? "-" : "";
        let ns = Math.abs(this._nanoseconds);
        const hours = Math.floor(ns / hour);
        ns -= hours * hour;
        const minutes = Math.floor(ns / minute);
        ns -= minutes * minute;
        const seconds = Math.floor(ns / second);
        ns -= seconds * second;

        let str = padLeft(hours.toString(), 2, "0") + ":" + padLeft(minutes.toString(), 2, "0");
        if (layout === "hh:mm:ss") {
            str += ":" + padLeft(seconds.toString(), 2, "0");
        }
        return str;
    }

    toString(): string {
        const sign = this._nanoseconds < 0 ? "-" : "";
        let ns = Math.abs(this._nanoseconds);
        let str = "";

        if (this._nanoseconds === 0) {
            return "0";
        }

        let hours = Math.floor(ns / hour);
        if (hours > 0) {
            str += hours.toString() + "h ";
            ns -= hours * hour;
        }

        let minutes = Math.floor(ns / minute);
        if (minutes > 0) {
            str += minutes.toString() + "m ";
            ns -= minutes * minute;
        }

        let seconds = Math.floor(ns / second);
        if (seconds > 0) {
            str += seconds.toString() + "s "
            ns -= seconds * second;
        }

        let milliseconds = Math.floor(ns / millisecond);
        if (milliseconds > 0) {
            str += milliseconds.toString() + "ms ";
            ns -= milliseconds * millisecond;
        }

        let microseconds = Math.floor(ns / microsecond);
        if (microseconds > 0) {
            str += microseconds.toString() + "µs "
            ns -= microseconds * microsecond;
        }

        if (ns > 0) {
            str += ns.toString() + "ns"
            ns -= ns * nanosecond;
        }

        return sign + str;
    }

    isLessThan(d: Duration) {
        return this.nanoseconds < d.nanoseconds;
    }

    isGreatherThan(d: Duration) {
        return this.nanoseconds > d.nanoseconds;
    }

    isEqual(d: Duration) {
        return this.nanoseconds === d.nanoseconds;
    }

    valueOf(): number {
        return this._nanoseconds;
    }
}
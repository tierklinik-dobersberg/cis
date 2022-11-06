
export function padLeft(str: string, length: number, pad = ' '): string {
    while (str.length < length) {
        str = pad + str;
    }
    return str;
}

export function padRight(str: string, length: number, pad = ' '): string {
    while (str.length < length) {
        str += pad;
    }
    return str;
}

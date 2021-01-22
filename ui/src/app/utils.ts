
export function extractErrorMessage(err: any, prefix: string = ''): string {
    let msg = "";

    if (typeof err == 'string') {
        msg = err
    } else if ('error' in err && typeof err.error === 'string') {
        msg = err.error
    } else if ('statusText' in err && typeof err.statusText === 'string') {
        msg = err.statusText;
    } else if ('message' in err && typeof err.message === 'string') {
        msg = err.message;
    }

    if (msg !== "" && prefix !== "") {
        msg = prefix + ': ' + msg
    }

    return msg
}
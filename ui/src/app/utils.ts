import { SearchParserResult } from 'search-query-parser';

export function parseColor(input: string): number[] {
    if (input.substr(0, 1) == "#") {
        let collen = (input.length - 1) / 3;
        let fact = [17, 1, 0.062272][collen - 1];
        return [
            Math.round(parseInt(input.substr(1, collen), 16) * fact),
            Math.round(parseInt(input.substr(1 + collen, collen), 16) * fact),
            Math.round(parseInt(input.substr(1 + 2 * collen, collen), 16) * fact)
        ];
    }

    return input.split("(")[1].split(")")[0].split(",").map(x => +x);
}

export function getContrastFontColor(bgColor: string): string {
    // if (red*0.299 + green*0.587 + blue*0.114) > 186 use #000000 else use #ffffff
    // based on https://stackoverflow.com/a/3943023

    let col = bgColor;
    if (bgColor.startsWith("#") && bgColor.length > 7) {
        col = bgColor.slice(0, 7)
    }
    const [r, g, b] = parseColor(col);

    if ((r * 0.299 + g * 0.587 + b * 0.114) > 186) {
        return '#000000';
    }

    return '#ffffff';
}

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

export function splitCombinedCustomerAnimalIDs(str: string): [string, string] {
    if (!/^[0-9]*$/.test(str)) {
        throw new Error(`Not a valid customer-animal-id`)
    }
    if (str.length <= 6) {
        throw new Error(`Invalid combined Customer-Animal-ID`);
    }

    let animalID = str.slice(-6);
    let customerID = str.slice(- str.length, -6)

    return [customerID, animalID];
}

export function toMongoDBFilter(res: SearchParserResult): object {
    let filter = {};

    Object.keys(res).forEach(key => {
        if (['exclude', 'text', 'offsets'].includes(key)) {
            return;
        }

        if (Array.isArray(res[key])) {
            filter[key] = {
                $in: res[key],
            }
        } else if (typeof res[key] === 'object') {
            if ('from' in res[key] && 'to' in res[key]) {
                filter[key] = {
                    $gte: res[key]['from'],
                    $lte: res[key]['to'],
                }
            }
        } else {
            filter[key] = res[key];
        }
    })

    return filter;
}
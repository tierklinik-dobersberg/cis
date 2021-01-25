import { SearchParserResult } from 'search-query-parser';

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
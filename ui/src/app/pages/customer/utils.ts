import { Customer } from "src/app/api/customer.api";

let tagColors = [
    'magenta',
    'red',
    'volcano',
    'orange',
    'gold',
    'lime',
    'green',
    'cyan',
    'blue',
    'geekblue',
    'purple',
]

export interface ExtendedCustomer extends Customer {
    tagColor: string;
}

export function customerTagColor(val: Customer): string {
    let hash = 0;
    let i = 0;
    let chr: number = 0;

    for (i = 0; i < val.source.length; i++) {
        chr = val.source.charCodeAt(i);
        hash = ((hash << 2) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }

    return tagColors[hash & tagColors.length]
}

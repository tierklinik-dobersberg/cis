import { Customer } from 'src/app/api/customer.api';

const tagColors = [
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
];

export interface ExtendedCustomer extends Customer {
  tagColor: string;
}

export function customerTagColor(val?: Customer): string {
  if (!val) {
    return '';
  }

  let hash = 0;
  let i = 0;
  let chr = 0;

  for (i = 0; i < val.source.length; i++) {
    chr = val.source.charCodeAt(i);
    // tslint:disable-next-line:no-bitwise
    hash = ((hash << 2) - hash) + chr;
    // tslint:disable-next-line:no-bitwise
    hash |= 0; // Convert to 32bit integer
  }

  // tslint:disable-next-line:no-bitwise
  return tagColors[hash & tagColors.length];
}

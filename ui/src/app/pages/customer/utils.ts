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
  mapsUrl: string;
}

export function getMapsRouteUrl(val?: Customer): string {
  let addr = '';
  if (!!val.street) {
    addr = val.street;
  }
  if (val.cityCode || val.city) {
    if (addr !== '') {
      addr += ', '
    }
    if (val.cityCode) {
      addr += val.cityCode
      if (val.city) {
        addr += ' '
      }
    }
    if (val.city) {
      addr += val.city
    }
  }
  if (addr === '') {
    return '';
  }
  addr = encodeURIComponent(addr);
  return `https://www.google.com/maps/dir/Current+Location/${addr}/`;
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
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 2) - hash) + chr;
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }

  // eslint-disable-next-line no-bitwise
  return tagColors[hash & tagColors.length];
}

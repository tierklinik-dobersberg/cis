import { PartialMessage } from "@bufbuild/protobuf";
import { Address, Customer, CustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";

export type CustomerInput = PartialMessage<Customer> | PartialMessage<CustomerResponse>

export function coerceCustomer(input: CustomerInput): PartialMessage<Customer> {
    if ('customer' in input || 'states' in input) {
        return input.customer;
    }

    return input as PartialMessage<Customer>;
}

export function getMapsRouteUrl(val?: PartialMessage<Address>): string {
  let addr = '';
  if (!!val.street) {
    addr = val.street;
  }
  if (val.postalCode || val.city) {
    if (addr !== '') {
      addr += ', '
    }
    if (val.postalCode) {
      addr += val.postalCode
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
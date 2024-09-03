import { Pipe, PipeTransform } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { Address } from "@tierklinik-dobersberg/apis/customer/v1";
import { coerceCustomer, CustomerInput, getMapsRouteUrl } from "../utils/customer";

@Pipe({
    standalone: true,
    pure: true,
    name: 'customerRoute',
})
export class CustomerRoutePipe implements PipeTransform {
    transform(value: CustomerInput | PartialMessage<Address>, ...args: any[]) {
        if ('street' in value || 'postalCode' in value) {
            return getMapsRouteUrl(value);
        }

        const customer = coerceCustomer(value as CustomerInput);
        if (!customer) {
            return null
        } 

        if (customer.addresses?.length) {
            for (let idx = 0; idx < customer.addresses.length; idx++) {
                const url = getMapsRouteUrl(customer.addresses[idx])
                if (url) {
                    return url
                }
            }
        }

        return null
    }
}
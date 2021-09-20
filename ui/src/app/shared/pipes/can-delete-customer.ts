import { Pipe, PipeTransform } from "@angular/core";
import { Customer, CustomerAPI } from "src/app/api/customer.api";

@Pipe({
  name: 'canDeleteCustomer',
  pure: true
})
export class CanDeleteCustomerPipe implements PipeTransform {
  constructor(private customerapi: CustomerAPI) { }

  transform(value: Customer): boolean {
    if (!value) {
      return false;
    }
    const source = this.customerapi.getSource(value);
    if (!source) {
      return false;
    }
    return source.supportsDelete;
  }
}

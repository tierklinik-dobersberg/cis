import { Pipe, PipeTransform } from "@angular/core";
import { Message } from "@bufbuild/protobuf";

@Pipe({
    name: 'toJson',
    pure: true,
    standalone: true,
})
export class ToJsonPipe implements PipeTransform {
    transform(value: Message, ...args: any[]) {
        if (!value) {
            return null
        }

        return value.toJson()
    }
}
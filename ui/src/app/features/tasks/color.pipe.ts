import { Pipe, PipeTransform } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { Board } from "@tierklinik-dobersberg/apis/tasks/v1";

@Pipe({
    standalone: true,
    pure: true,
    name: 'tagColor'
})
export class TagColorPipe implements PipeTransform {
    transform(tag: string, board: PartialMessage<Board>) {
        return board.allowedTaskTags?.find(t => t.tag === tag)?.color || 'inherit' 
    }
}

@Pipe({
    standalone: true,
    pure: true,
    name: 'statusColor'
})
export class StatusColorPipe implements PipeTransform {
    transform(status: string, board: PartialMessage<Board>) {
        return board.allowedTaskStatus?.find(s => s.status === status)?.color || 'inherit' 
    }
}

@Pipe({
    standalone: true,
    pure: true,
    name: 'taskPriotiy'
})
export class TaskPriorityPipe implements PipeTransform {
    transform(priority: number, board: PartialMessage<Board>) {
        return board?.allowedTaskPriorities?.find(p => p.priority === priority) || null;
    }
}
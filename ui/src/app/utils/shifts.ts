import { computed, signal, Signal } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { injectWorkShiftService } from "@tierklinik-dobersberg/angular/connect";
import { PlannedShift, WorkShift } from "@tierklinik-dobersberg/apis/roster/v1";

export class LocalPlannedShift extends PlannedShift {
    public readonly definition: WorkShift;

    constructor(shift: PartialMessage<PlannedShift>, definition: PartialMessage<WorkShift>) {
        super(shift);

        this.definition = new WorkShift(definition);
    }
}

export function injectLocalPlannedShifts(shifts: Signal<PartialMessage<PlannedShift>[]>) {
    const workShiftService = injectWorkShiftService();
    const definitions = signal<WorkShift[]>([]);

    workShiftService.listWorkShifts({})
        .then(response => definitions.set(response.workShifts) )

    return computed(() => {
        const s = shifts();
        const d = definitions();

        return s.map(shift => new LocalPlannedShift(shift, d.find(def => def.id === shift.workShiftId)));
    })
}

export enum Weekday {
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export enum Month {
    January = 1,
    February = 2,
    March = 3,
    April = 4,
    May = 5,
    June = 6,
    July = 7,
    August = 8,
    September = 9,
    October = 10,
    November = 11,
    December = 12,
}

export interface WorkShift {
    from: string
    duration: JSDuration;
    id: string;
    days: Weekday[];
    name: string;
    shortName: string;
    onHoliday: boolean;
    eligibleRoles: string[];
    minutesWorth?: number;
    requiredStaffCount: number;
    color: string;
    order: number;
    description: string;
    tags: string[];
}

export interface RosterShift {
    staff: string[];
    shiftID: string;
    isHoliday: boolean;
    isWeekend: boolean;
    from: string;
    to: string;
    minutesWorth: number;
    requiredStaffCount: number;
    definition: WorkShift;
}

export interface OnDutyResponse {
  staff: string[];
  shifts: RosterShift[];
}

export interface Constraint {
	id?: string;
	description?: string;
	expression: string;
	appliesToUser: string[];
	appliesToRole: string[];
	hard: boolean;
	penalty: number;
	deny: boolean;
	rosterOnly: boolean;
}

export interface ConstraintViolation {
    type: 'off-time' | 'constraint';
    hard: boolean;
    id: string;
    name: string;
    penalty: number;
}

export interface RosterShiftWithStaffList extends RosterShift {
    eligibleStaff: string[];
    constraintViolations: {
        [username: string]: ConstraintViolation[]
    }
}

export interface RosterMeta {
    id?: string;
    month: Month;
    year: number;
    approved?: boolean | null;
    approvedAt?: string;
    approvedBy?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string
}

export interface Roster extends RosterMeta {
    shifts: RosterShift[];
}

export type JSDuration = number; // duration in ms

export namespace OffTime {
    export interface Costs {
        vacationDays: number;
        duration: JSDuration;
    }

    export interface Approval {
        approved: boolean;
        approvedAt: string;
        comment: string;
        actualCosts: Costs;
    }

    export enum RequestType {
        Auto = "auto",
        Vacation = "vacation",
        TimeOff = "time-off",
        Credits = "credits",
    }

    export interface Entry {
        id?: string;
        from: string;
        to: string;
        description: string;
        staffID: string;
        requestType: RequestType;
        createdAt: string;
        createdBy: string;
        costs: Costs;
        approval: Approval | null;
    }

    export interface CreateRequest {
        from: string;
        to: string;
        staff: string;
        description: string;
        requestType: RequestType;
    }

    export interface CreateCreditsRequest {
        staff: string;
        from?: string;
        description: string;
        days: number;
    }

    export interface CreditsLeft {
      days: number;
      credits: JSDuration;
    }
}

export interface DayKinds {
    workingDays: number;
    weekendDays: number;
    publicHolidays: number;
}

export interface WorkTime {
    id: string;
    staff: string;
    timePerWeek: number;
    applicableFrom: string;
    overtimePenaltyRatio: number;
    undertimePenaltyRatio: number;
}

export interface WorkTimeStatus {
    timePerWeek: JSDuration;
    expectedWorkTime: JSDuration;
    plannedWorkTime: JSDuration;
    penality: number;
    overtimePenaltyRatio: number;
    undertimePenaltyRatio: number;
}

export interface Diagnostic {
    date?: string;
    description?: string;
    penalty: number;
}

export interface ConstraintViolationDiagnostics extends Diagnostic {
  type: 'constraint-violation'
  details: {
    user: string;
    violations: ConstraintViolation[];
  }
}

export interface MissingShiftDiagnostics extends Diagnostic {
  type: 'missing-shift',
  details: any
}

export type RosterDiagnostics = ConstraintViolationDiagnostics
  | MissingShiftDiagnostics;


export interface RosterAnalysis {
    diagnostics: RosterDiagnostics[];
    workTime: {
        [username: string]: WorkTimeStatus
    };
    penalty: number;
}


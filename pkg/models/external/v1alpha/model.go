package v1alpha

import "time"

type DoctorOnDuty struct {
	Username   string                 `json:"username"`
	FullName   string                 `json:"fullname"`
	Phone      string                 `json:"phone"`
	Properties map[string]interface{} `json:"properties"`
}

type DoctorOnDutyResponse struct {
	Doctors       []DoctorOnDuty `json:"doctors"`
	Until         time.Time      `json:"until"`
	RosterDate    string         `json:"rosterDate"` // YYYY-MM-DD in the local timezone
	IsOverwrite   bool           `json:"isOverwrite"`
	IsDayShift    bool           `json:"isDayShift"`
	IsNightShift  bool           `json:"isNightShift"`
	EndTimeSource string         `json:"endTimeSource"`
}

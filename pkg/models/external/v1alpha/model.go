package v1alpha

import "time"

type DoctorOnDuty struct {
	Username   string                 `json:"username"`
	FullName   string                 `json:"fullname"`
	Phone      string                 `json:"phone"`
	Properties map[string]interface{} `json:"properties"`
}

type DoctorOnDutyResponse struct {
	Doctors      []DoctorOnDuty `json:"doctors"`
	Until        time.Time      `json:"until"`
	IsOverwrite  bool           `json:"isOverwrite"`
	IsDayShift   bool           `json:"isDayShift"`
	IsNightShift bool           `json:"isNightShift"`
}

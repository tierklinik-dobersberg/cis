package v1alpha

type DoctorOnDuty struct {
	Username   string                 `json:"username"`
	FullName   string                 `json:"fullname"`
	Phone      string                 `json:"phone"`
	Properties map[string]interface{} `json:"properties"`
}

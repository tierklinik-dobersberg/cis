package calendar

type ByStartTime []Event

func (sort ByStartTime) Len() int           { return len(sort) }
func (sort ByStartTime) Less(i, j int) bool { return sort[i].StartTime.Before(sort[j].StartTime) }
func (sort ByStartTime) Swap(i, j int)      { sort[i], sort[j] = sort[j], sort[i] }

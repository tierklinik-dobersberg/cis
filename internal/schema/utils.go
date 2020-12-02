package schema

import "github.com/ppacher/system-conf/conf"

func getOptionalString(s conf.Section, key string) (string, error) {
	val, err := s.GetString(key)
	if err == nil {
		return val, nil
	}

	if conf.IsNotSet(err) {
		return "", nil
	}

	return "", err
}

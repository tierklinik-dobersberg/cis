package eval

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/maja42/goval"
)

func Evaluate(ctx context.Context, expr string, vars map[string]interface{}) (interface{}, error) {
	return goval.NewEvaluator().Evaluate(
		expr,
		vars,
		getFuncMap(),
	)
}

func getFuncMap() map[string]func(args ...interface{}) (interface{}, error) {
	fn := make(map[string]func(args ...interface{}) (interface{}, error))

	fn["len"] = lenFunc
	fn["rand"] = randFunc
	fn["parseDate"] = parseDateFunc
	fn["now"] = now

	return fn
}

func parseDateFunc(args ...interface{}) (interface{}, error) {
	if len(args) < 1 || len(args) > 2 {
		return nil, fmt.Errorf("expected 1 or 2 arguments")
	}

	value, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("expected value to be a string, got %T", args[0])
	}

	format := time.RFC3339
	if len(args) == 2 {
		format, ok = args[1].(string)
		if !ok {
			return nil, fmt.Errorf("expected time format as string, got %T", args[1])
		}
	}

	d, err := time.Parse(format, value)
	if err != nil {
		return nil, fmt.Errorf("failed to parse date: %w", err)
	}

	return d.Unix(), nil
}

func now(args ...interface{}) (interface{}, error) {
	if len(args) != 0 {
		return nil, fmt.Errorf("unexpected arguments")
	}

	return time.Now().Unix(), nil
}

func randFunc(...interface{}) (interface{}, error) {
	return rand.Float64(), nil
}

func lenFunc(args ...interface{}) (interface{}, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("expected exactly 1 argument")
	}
	str, ok := args[0].(string)
	if ok {
		return len(str), nil
	}
	arr, ok := args[0].([]interface{})
	if ok {
		return len(arr), nil
	}
	obj, ok := args[0].(map[string]interface{})
	if ok {
		return len(obj), nil
	}
	return nil, fmt.Errorf("expected string, array or object")
}

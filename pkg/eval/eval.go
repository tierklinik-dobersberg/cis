package eval

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/PaesslerAG/gval"
)

func Evaluate(ctx context.Context, expr string, vars interface{}) (interface{}, error) {
	return gval.EvaluateWithContext(
		ctx,
		expr,
		vars,
		getFuncMap()...,
	)
}

func getFuncMap() []gval.Language {
	funcs := []gval.Language{}

	funcs = append(funcs, gval.Function(
		"now",
		now,
	))
	funcs = append(funcs, gval.Function(
		"len",
		lenFunc,
	))
	funcs = append(funcs, gval.Function(
		"rand",
		randFunc,
	))

	return funcs
}

func now(args ...interface{}) (interface{}, error) {
	if len(args) != 0 {
		return nil, fmt.Errorf("unexpected arguments")
	}

	return time.Now().Unix(), nil
}

func randFunc(...interface{}) (interface{}, error) {
	// trunk-ignore(golangci-lint/gosec)
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

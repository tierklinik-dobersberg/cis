package door

import "context"

type NoOp struct{}

func (NoOp) Lock(context.Context) error   { return nil }
func (NoOp) Unlock(context.Context) error { return nil }
func (NoOp) Open(context.Context) error   { return nil }
func (NoOp) Release()                     {}

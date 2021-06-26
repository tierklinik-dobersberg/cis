// Package execer provides a trigger type that executes an external program.
package execer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"text/template"
	"time"

	"github.com/ghodss/yaml"
	"github.com/google/shlex"
	"github.com/ppacher/system-conf/conf"
)

type Execer struct {
	Command          []string
	Stdin            string
	CommandTemplates bool
	MaxProcTime      time.Duration
}

var ExecerSpec = conf.SectionSpec{
	{
		Name:        "Command",
		Type:        conf.StringSliceType,
		Description: "The command to execute.",
		Aliases:     []string{"Run"},
		Required:    true,
	},
	{
		Name:        "Stdin",
		Type:        conf.StringType,
		Description: "The format to pass the event on stdin. Possible values are 'json', 'yaml', 'no' (default) or 'close'.",
		Default:     "no",
	},
	{
		Name:        "CommandTemplates",
		Type:        conf.BoolType,
		Default:     "true",
		Description: "Whether or not the commands are interpolated using text/template.",
	},
	{
		Name:        "MaxProcTime",
		Type:        conf.DurationType,
		Default:     "1m",
		Description: "Maximum time a Command= is allowed to run before it will be killed.",
	},
}

func (e *Execer) Run(ctx context.Context, payload interface{}) error {
	var (
		stdin []byte
		err   error
	)

	format := strings.ToLower(e.Stdin)
	switch format {
	case "json", "yaml":
		stdin, err = json.Marshal(payload)
		if format == "yaml" {
			stdin, err = yaml.JSONToYAML(stdin)
		}
	case "no":
		stdin = nil
	case "close":
		stdin = []byte{}
	}
	if err != nil {
		return fmt.Errorf("stdin: %w", err)
	}

	for idx, cmd := range e.Command {
		if err := e.runCommand(ctx, cmd, stdin, payload); err != nil {
			return fmt.Errorf("command #%d: %w", idx, err)
		}
	}
	return nil
}

func (e *Execer) runCommand(ctx context.Context, cmd string, stdin []byte, payload interface{}) error {
	cmd, err := e.mayCompileTemplate(cmd, payload)
	if err != nil {
		return err
	}

	parts, err := shlex.Split(cmd)
	if err != nil {
		return fmt.Errorf("invalid command: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, e.MaxProcTime)
	defer cancel()

	c := exec.CommandContext(ctx, parts[0], parts[1:]...)

	var stdinWriter io.WriteCloser
	if stdin != nil {
		stdinWriter, err = c.StdinPipe()
		if err != nil {
			return fmt.Errorf("stdin pipe: %w", err)
		}
	}

	if err := c.Start(); err != nil {
		return fmt.Errorf("start: %w", err)
	}

	if stdinWriter != nil {
		n, err := stdinWriter.Write(stdin)
		if err != nil && n != len(stdin) {
			return fmt.Errorf("short write on stdin: %w", err)
		}
		stdinWriter.Close()
	}
	if err := c.Wait(); err != nil {
		return fmt.Errorf("command failed: %w", err)
	}

	return nil
}

func (e *Execer) mayCompileTemplate(cmd string, payload interface{}) (string, error) {
	if !e.CommandTemplates {
		return cmd, nil
	}
	t, err := template.New("").Parse(cmd)
	if err != nil {
		return "", fmt.Errorf("command template: %w", err)
	}
	var buf = new(bytes.Buffer)
	if err := t.Execute(buf, payload); err != nil {
		return "", fmt.Errorf("command template: %w", err)
	}
	return buf.String(), nil
}

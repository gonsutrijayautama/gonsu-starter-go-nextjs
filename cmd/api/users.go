package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
)

// usersCommand adalah `produk-contoh users …`: jalan operator memberi akses login
// tanpa layar — misalnya admin pertama bila pemilik pemasangan belum
// diserahkan GONSU. Dijalankan di dalam container pemasangan
// (docker/kubectl exec).
type usersCommand struct {
	action string
	input  authn.GrantInput
}

const usersUsage = `pemakaian:
  produk-contoh users list
  produk-contoh users grant   --subject <sub> --role <role> [--email <email>] [--name <nama>]
  produk-contoh users suspend --subject <sub>

--subject adalah klaim ` + "`sub`" + ` akun GONSU orang itu, bukan email.`

func parseUsers(args []string) (usersCommand, error) {
	if len(args) == 0 {
		return usersCommand{}, errors.New(usersUsage)
	}
	cmd := usersCommand{action: args[0]}
	fs := flag.NewFlagSet("users "+cmd.action, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.StringVar(&cmd.input.Subject, "subject", "", "")
	fs.StringVar(&cmd.input.Role, "role", "", "")
	fs.StringVar(&cmd.input.Email, "email", "", "")
	fs.StringVar(&cmd.input.Name, "name", "", "")
	if err := fs.Parse(args[1:]); err != nil {
		return usersCommand{}, fmt.Errorf("%w\n%s", err, usersUsage)
	}
	if fs.NArg() > 0 {
		return usersCommand{}, fmt.Errorf("argumen tidak dikenal %q\n%s", strings.Join(fs.Args(), " "), usersUsage)
	}
	switch cmd.action {
	case "list":
	case "grant":
		if cmd.input.Subject == "" || cmd.input.Role == "" {
			return usersCommand{}, fmt.Errorf("grant membutuhkan --subject dan --role\n%s", usersUsage)
		}
	case "suspend":
		if cmd.input.Subject == "" {
			return usersCommand{}, fmt.Errorf("suspend membutuhkan --subject\n%s", usersUsage)
		}
	default:
		return usersCommand{}, fmt.Errorf("perintah users tidak dikenal %q\n%s", cmd.action, usersUsage)
	}
	return cmd, nil
}

func (c usersCommand) run(ctx context.Context, a app, out io.Writer) error {
	switch c.action {
	case "grant":
		in := c.input
		in.Actor = operator
		if _, err := authn.Grant(ctx, a.pool, a.license, a.org, in); err != nil {
			return err
		}
		_, err := fmt.Fprintf(out, "akses diberikan: %s sebagai %s\n", c.input.Subject, c.input.Role)
		return err
	case "suspend":
		if err := authn.Suspend(ctx, a.pool, a.org, c.input.Subject, operator); err != nil {
			return err
		}
		_, err := fmt.Fprintf(out, "akses dicabut: %s (sesinya diakhiri)\n", c.input.Subject)
		return err
	default:
		users, err := authn.Users(ctx, a.pool, a.org)
		if err != nil {
			return err
		}
		w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
		_, _ = fmt.Fprintln(w, "SUBJECT\tROLE\tSTATUS\tNAMA\tEMAIL\tLOGIN TERAKHIR")
		for _, u := range users {
			last := "—"
			if u.LastLoginAt != nil {
				last = u.LastLoginAt.Local().Format(time.DateTime)
			}
			_, _ = fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n", u.Subject, u.Role,
				u.Status, dash(u.Name), dash(u.Email), last)
		}
		return w.Flush()
	}
}

// operator adalah pelaku perubahan dari perintah ini: orang di shell
// pemasangan, tanpa pengguna produk di baliknya.
var operator = authn.Actor{Name: "operator (users)", Source: authn.SourceCLI}

func dash(s string) string {
	if s == "" {
		return "—"
	}
	return s
}

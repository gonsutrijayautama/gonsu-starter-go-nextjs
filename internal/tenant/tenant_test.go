package tenant

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestOrganizationIDFromContext(t *testing.T) {
	id := uuid.New()
	got, err := OrganizationID(WithOrganizationID(context.Background(), id))
	if err != nil || got != id {
		t.Fatalf("OrganizationID = %v, %v; want %v", got, err, id)
	}
}

func TestOrganizationIDMissingIsAnError(t *testing.T) {
	for _, ctx := range []context.Context{
		context.Background(),
		WithOrganizationID(context.Background(), uuid.Nil),
	} {
		if _, err := OrganizationID(ctx); !errors.Is(err, ErrMissing) {
			t.Errorf("err = %v, want ErrMissing", err)
		}
	}
}

package db

import (
	"github.com/ovh-buy/server/internal/types"
	"testing"
)

func TestQueuePreorderSurvivesRestart(t *testing.T) {
	dir := t.TempDir()
	database, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	items := []types.QueueItem{
		{ID: "preorder", AccountID: "eu", PlanCode: "27skle03-v1", Datacenter: "gra", Status: "running", Preorder: true,
			Options: []string{"ram-64g-ddr4-ecc-2666", "softraid-2x480ssd"}},
		{ID: "normal", AccountID: "eu", PlanCode: "24sk202", Datacenter: "rbx", Status: "running"},
	}
	if err := database.ReplaceQueue(items); err != nil {
		t.Fatal(err)
	}
	database.Close()
	database, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	got, err := database.ListQueue()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("queue length: %d", len(got))
	}
	for _, q := range got {
		if q.ID == "preorder" && (len(q.Options) != 2 || q.Options[0] != items[0].Options[0] || q.Options[1] != items[0].Options[1]) {
			t.Fatalf("selected hardware was lost on restart: %+v", q)
		}
		if q.Preorder != (q.ID == "preorder") {
			t.Fatalf("preorder flag lost or applied to normal task: %+v", q)
		}
	}
}

func TestPreorderMigrationPreservesExistingQueue(t *testing.T) {
	dir := t.TempDir()
	database, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.ReplaceQueue([]types.QueueItem{{ID: "existing", PlanCode: "24sk202", Status: "running"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := database.Exec("ALTER TABLE queue DROP COLUMN preorder"); err != nil {
		t.Fatal(err)
	}
	database.Close()
	database, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	items, err := database.ListQueue()
	if err != nil || len(items) != 1 || items[0].ID != "existing" || items[0].Preorder {
		t.Fatalf("legacy queue changed during migration: %+v %v", items, err)
	}
}

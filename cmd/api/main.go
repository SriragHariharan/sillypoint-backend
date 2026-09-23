package main

import (
	"context"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/sriraghariharan/sillypoint-backend/internal/db"
)

func main() {
	ctx := context.Background()

	// Connect to Postgres on startup; fail fast if the DB isn't reachable.
	pool, err := db.NewPool(ctx)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("welcome to golang"))
	})
	http.ListenAndServe(":3000", r)
}

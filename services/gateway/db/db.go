package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// InitDB initializes the database connection pool
func InitDB() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Println("Warning: DATABASE_URL is not set. Skipping Supabase DB connection.")
		return nil
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("failed to parse db config: %w", err)
	}

	// Recommended settings for Supabase (especially if using connection pooling)
	config.MaxConns = 20
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = time.Minute * 30

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	Pool = pool
	log.Println("Successfully connected to Supabase PostgreSQL")
	return nil
}

// CloseDB closes the connection pool
func CloseDB() {
	if Pool != nil {
		Pool.Close()
		log.Println("Database connection pool closed.")
	}
}

# Database Schema & Migration Guide

This directory contains the database structure, security definitions, and migrations for the Capstone Municipal Assistance & Capacity Building Platform.

---

## 1. Structure Overview

- **`supabase_schema.sql`**: The canonical cumulative baseline schema. It is a generated/consolidated snapshot containing all table definitions, columns, primary/foreign keys, indexes, triggers, and Row Level Security (RLS) policies needed to initialize a fresh database from scratch.
- **`migrations/`**: Chronological, additive SQL migration scripts (e.g. `YYYYMMDD_<description>.sql`). Each migration applies a specific delta to live databases.

---

## 2. Best Practices & Rules

1. **Treat `supabase_schema.sql` as Canonical**:
   - `supabase_schema.sql` should be kept in sync with the live production database and `prisma/schema.prisma`.
2. **Always Use Additive Migrations**:
   - When introducing schema modifications or new constraints, never edit past migrations. Always create a new migration under `database/migrations/` prefixed with the current date `YYYYMMDD_`.
3. **Fail-Closed Budget & Security Constraints**:
   - Financial releases must strictly enforce database constraints (`funds_released_ceiling_check`).
   - Batch status must validate against allowed operational states (`batches_status_check`).
   - Batch capacities must enforce capacity ceiling constraints (`batches_capacity_ceiling_check`).

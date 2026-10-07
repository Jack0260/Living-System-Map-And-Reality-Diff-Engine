/*
# Create SystemXray schema — services, dependencies, incidents, deployments, metrics

1. New Tables
- `services`: System components (services, databases, caches, queues, external systems).
  - id (text PK), name, kind, tier, region, owner, runtime, health, description, tags, slo (jsonb),
    error_budget_remaining, config (jsonb), metadata (jsonb), exposed_endpoints, replicas, scale_target
- `dependencies`: Edges between services representing runtime/declared dependencies.
  - id (text PK), from_id (FK services), to_id (FK services), type, criticality, declared, observed,
    label, avg_latency_ms, error_rate, rps
- `incidents`: Past incident records with full timeline.
  - id (text PK), title, severity, start_time, end_time, duration_min, root_cause, affected_nodes,
    timeline (jsonb), customer_impact, resolved
- `deployments`: Deployment history.
  - id (text PK), node_id (FK services), version, timestamp, environment, changelog, status, impact_radius
- `runtime_metrics`: Latest runtime metrics per service.
  - id (uuid PK), node_id (FK services), timestamp, latency_ms, error_rate, rps, cpu_pct, mem_pct

2. Indexes
- dependencies.from_id, dependencies.to_id (graph traversal)
- deployments.node_id (service deployment history)
- runtime_metrics.node_id (latest metrics per service)
- incidents.severity (filtering)

3. Security
- RLS enabled on all tables.
- Single-tenant no-auth app: all policies TO anon, authenticated with USING(true)/WITH CHECK(true).
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE).

4. Notes
- Services use text primary keys for stable readable identifiers (e.g. "payment-service").
- This is a local simulation tool — no sign-in — all data is intentionally public/shared.
*/

CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  tier text NOT NULL,
  region text NOT NULL,
  owner text NOT NULL,
  runtime text NOT NULL,
  health text NOT NULL DEFAULT 'healthy',
  description text NOT NULL,
  tags text[] DEFAULT '{}',
  slo jsonb NOT NULL,
  error_budget_remaining numeric DEFAULT 100,
  config jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  exposed_endpoints text[] DEFAULT '{}',
  replicas int DEFAULT 1,
  scale_target int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS dependencies (
  id text PRIMARY KEY,
  from_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  to_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  type text NOT NULL,
  criticality text NOT NULL,
  declared boolean DEFAULT false,
  observed boolean DEFAULT false,
  label text NOT NULL,
  avg_latency_ms int DEFAULT 0,
  error_rate numeric DEFAULT 0,
  rps int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependencies_from_id ON dependencies(from_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_to_id ON dependencies(to_id);

ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dependencies" ON dependencies;
CREATE POLICY "anon_select_dependencies" ON dependencies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dependencies" ON dependencies;
CREATE POLICY "anon_insert_dependencies" ON dependencies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dependencies" ON dependencies;
CREATE POLICY "anon_update_dependencies" ON dependencies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dependencies" ON dependencies;
CREATE POLICY "anon_delete_dependencies" ON dependencies FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS incidents (
  id text PRIMARY KEY,
  title text NOT NULL,
  severity text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_min int NOT NULL,
  root_cause text NOT NULL,
  affected_nodes text[] DEFAULT '{}',
  timeline jsonb DEFAULT '[]',
  customer_impact text NOT NULL,
  resolved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS deployments (
  id text PRIMARY KEY,
  node_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  version text NOT NULL,
  timestamp timestamptz NOT NULL,
  environment text NOT NULL,
  changelog text NOT NULL,
  status text NOT NULL,
  impact_radius text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_node_id ON deployments(node_id);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_deployments" ON deployments;
CREATE POLICY "anon_select_deployments" ON deployments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_deployments" ON deployments;
CREATE POLICY "anon_insert_deployments" ON deployments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_deployments" ON deployments;
CREATE POLICY "anon_update_deployments" ON deployments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_deployments" ON deployments;
CREATE POLICY "anon_delete_deployments" ON deployments FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS runtime_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  latency_ms int NOT NULL,
  error_rate numeric NOT NULL,
  rps int NOT NULL,
  cpu_pct int NOT NULL,
  mem_pct int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_metrics_node_id ON runtime_metrics(node_id);

ALTER TABLE runtime_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_runtime_metrics" ON runtime_metrics;
CREATE POLICY "anon_select_runtime_metrics" ON runtime_metrics FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_runtime_metrics" ON runtime_metrics;
CREATE POLICY "anon_insert_runtime_metrics" ON runtime_metrics FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_runtime_metrics" ON runtime_metrics;
CREATE POLICY "anon_update_runtime_metrics" ON runtime_metrics FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_runtime_metrics" ON runtime_metrics;
CREATE POLICY "anon_delete_runtime_metrics" ON runtime_metrics FOR DELETE TO anon, authenticated USING (true);

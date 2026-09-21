CREATE TABLE IF NOT EXISTS roles (
  role_key text PRIMARY KEY,
  description text NOT NULL
);

INSERT INTO roles (role_key, description) VALUES
  ('player', 'Standard player access'),
  ('admin', 'Administrator access to management functions')
ON CONFLICT (role_key) DO UPDATE SET description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS player_roles (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES roles(role_key),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, role_key)
);

ALTER TABLE player_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE skins
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS secondary_color text NOT NULL DEFAULT '#4f46e5',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#c4b5fd',
  ADD COLUMN IF NOT EXISTS head_color text NOT NULL DEFAULT '#f5d0fe',
  ADD COLUMN IF NOT EXISTS glow_color text NOT NULL DEFAULT '#a78bfa',
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'Common'
    CHECK (rarity IN ('Starter', 'Common', 'Rare', 'Epic', 'Legendary'));

UPDATE skins SET
  name = CASE id
    WHEN 'default' THEN 'Rush' WHEN 'ocean' THEN 'Tidal'
    WHEN 'forest' THEN 'Ranger' WHEN 'flame' THEN 'Inferno'
    WHEN 'night' THEN 'Phantom' WHEN 'gold' THEN 'Champion'
    ELSE name END,
  primary_color = color,
  secondary_color = CASE id
    WHEN 'default' THEN '#4f46e5' WHEN 'ocean' THEN '#0369a1'
    WHEN 'forest' THEN '#166534' WHEN 'flame' THEN '#9a3412'
    WHEN 'night' THEN '#111827' WHEN 'gold' THEN '#92400e'
    WHEN 'cyber' THEN '#d946ef' WHEN 'frost' THEN '#e0f2fe'
    WHEN 'toxic' THEN '#18181b' WHEN 'royal' THEN '#7c3aed'
    ELSE secondary_color END,
  accent_color = CASE id
    WHEN 'default' THEN '#c4b5fd' WHEN 'ocean' THEN '#67e8f9'
    WHEN 'forest' THEN '#bbf7d0' WHEN 'flame' THEN '#fbbf24'
    WHEN 'night' THEN '#a78bfa' WHEN 'gold' THEN '#fef3c7'
    WHEN 'cyber' THEN '#f8fafc' WHEN 'frost' THEN '#ffffff'
    WHEN 'toxic' THEN '#d9f99d' WHEN 'royal' THEN '#fff7d6'
    ELSE accent_color END,
  head_color = CASE id
    WHEN 'default' THEN '#f5d0fe' WHEN 'ocean' THEN '#bae6fd'
    WHEN 'forest' THEN '#fde68a' WHEN 'flame' THEN '#fed7aa'
    WHEN 'night' THEN '#c4b5fd' WHEN 'gold' THEN '#fde68a'
    WHEN 'cyber' THEN '#c4b5fd' WHEN 'frost' THEN '#dbeafe'
    WHEN 'toxic' THEN '#a3e635' WHEN 'royal' THEN '#fde68a'
    ELSE head_color END,
  glow_color = CASE id
    WHEN 'default' THEN '#a78bfa' WHEN 'ocean' THEN '#22d3ee'
    WHEN 'forest' THEN '#4ade80' WHEN 'flame' THEN '#f97316'
    WHEN 'night' THEN '#7c3aed' WHEN 'gold' THEN '#fbbf24'
    WHEN 'cyber' THEN '#06b6d4' WHEN 'frost' THEN '#7dd3fc'
    WHEN 'toxic' THEN '#bef264' WHEN 'royal' THEN '#fbbf24'
    ELSE glow_color END,
  rarity = CASE id
    WHEN 'default' THEN 'Starter' WHEN 'ocean' THEN 'Common'
    WHEN 'forest' THEN 'Common' WHEN 'flame' THEN 'Rare'
    WHEN 'night' THEN 'Rare' WHEN 'gold' THEN 'Epic'
    WHEN 'cyber' THEN 'Epic' WHEN 'frost' THEN 'Epic'
    WHEN 'toxic' THEN 'Legendary' WHEN 'royal' THEN 'Legendary'
    ELSE rarity END;

ALTER TABLE skins
  ADD CONSTRAINT skins_primary_color_format CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT skins_secondary_color_format CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT skins_accent_color_format CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT skins_head_color_format CHECK (head_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT skins_glow_color_format CHECK (glow_color ~ '^#[0-9A-Fa-f]{6}$');

CREATE TABLE IF NOT EXISTS player_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('bug', 'idea', 'other')),
  message varchar(2000) NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'accepted', 'declined', 'resolved')),
  admin_note varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_roles_role ON player_roles(role_key, player_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON player_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

DROP TRIGGER IF EXISTS feedback_set_updated_at ON player_feedback;
CREATE TRIGGER feedback_set_updated_at BEFORE UPDATE ON player_feedback
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

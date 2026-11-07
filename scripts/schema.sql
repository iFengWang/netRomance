CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 name text NOT NULL, age integer NOT NULL CHECK(age BETWEEN 18 AND 100), gender text NOT NULL CHECK(gender IN ('male','female')),
 city text NOT NULL DEFAULT '', occupation text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '',
 interests jsonb NOT NULL DEFAULT '[]', photos jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id uuid REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (
 id uuid PRIMARY KEY,title text NOT NULL,description text NOT NULL,city text NOT NULL,category text NOT NULL,
 mode text NOT NULL,cover text NOT NULL,host_id uuid REFERENCES users(id),capacity integer NOT NULL DEFAULT 6 CHECK(capacity IN (4,6)),
 stage integer NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 4),round integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS participants (
 room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,user_id uuid REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('host','guest')),muted boolean NOT NULL DEFAULT false,lamp boolean NOT NULL DEFAULT true,
 audio_enabled boolean NOT NULL DEFAULT false,video_enabled boolean NOT NULL DEFAULT false,
 joined_at timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(room_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages (id bigserial PRIMARY KEY,room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,user_id uuid REFERENCES users(id),body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS signals (id bigserial PRIMARY KEY,room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,sender_id uuid REFERENCES users(id),receiver_id uuid REFERENCES users(id),payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS signals_receiver_idx ON signals(room_id,receiver_id,id);
CREATE INDEX IF NOT EXISTS messages_room_idx ON messages(room_id,id);
CREATE TABLE IF NOT EXISTS choices (room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,round integer NOT NULL,user_id uuid REFERENCES users(id),target_id uuid REFERENCES users(id),PRIMARY KEY(room_id,round,user_id),CHECK(user_id<>target_id));
CREATE TABLE IF NOT EXISTS matches (id uuid PRIMARY KEY,room_id uuid REFERENCES rooms(id),round integer NOT NULL,user_a uuid REFERENCES users(id),user_b uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(room_id,round,user_a,user_b),CHECK(user_a<user_b));
CREATE TABLE IF NOT EXISTS bans (room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,user_id uuid REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(room_id,user_id));
CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY,room_id uuid REFERENCES rooms(id),user_id uuid REFERENCES users(id),target_id uuid REFERENCES users(id),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY,hits integer NOT NULL,reset_at timestamptz NOT NULL);

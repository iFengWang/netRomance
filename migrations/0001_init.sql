PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 name TEXT NOT NULL,
 age INTEGER NOT NULL CHECK(age BETWEEN 18 AND 100),
 gender TEXT NOT NULL CHECK(gender IN ('male','female')),
 city TEXT NOT NULL DEFAULT '',
 occupation TEXT NOT NULL DEFAULT '',
 bio TEXT NOT NULL DEFAULT '',
 interests TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(interests)),
 photos TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(photos)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 city TEXT NOT NULL,
 category TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('男生专场','女生专场')),
 cover TEXT NOT NULL,
 host_id TEXT REFERENCES users(id),
 capacity INTEGER NOT NULL DEFAULT 6 CHECK(capacity IN (4,6)),
 stage INTEGER NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 4),
 round INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('host','guest')),
 muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)),
 lamp INTEGER NOT NULL DEFAULT 1 CHECK(lamp IN (0,1)),
 audio_enabled INTEGER NOT NULL DEFAULT 0 CHECK(audio_enabled IN (0,1)),
 video_enabled INTEGER NOT NULL DEFAULT 0 CHECK(video_enabled IN (0,1)),
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(room_id,user_id)
);

CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id),
 receiver_id TEXT NOT NULL REFERENCES users(id),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS signals_receiver_idx ON signals(room_id,receiver_id,id);
CREATE INDEX IF NOT EXISTS signals_created_idx ON signals(created_at);
CREATE INDEX IF NOT EXISTS messages_room_idx ON messages(room_id,id);
CREATE INDEX IF NOT EXISTS participants_active_idx ON participants(room_id,last_seen);

CREATE TABLE IF NOT EXISTS choices (
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 round INTEGER NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 target_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(room_id,round,user_id),
 CHECK(user_id<>target_id)
);

CREATE TABLE IF NOT EXISTS matches (
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES rooms(id),
 round INTEGER NOT NULL,
 user_a TEXT NOT NULL REFERENCES users(id),
 user_b TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(room_id,round,user_a,user_b),
 CHECK(user_a<user_b)
);

CREATE INDEX IF NOT EXISTS matches_user_a_idx ON matches(user_a,created_at);
CREATE INDEX IF NOT EXISTS matches_user_b_idx ON matches(user_b,created_at);

CREATE TABLE IF NOT EXISTS bans (
 room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(room_id,user_id)
);

CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES rooms(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 target_id TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY,
 hits INTEGER NOT NULL,
 reset_at TEXT NOT NULL
);

INSERT INTO rooms(id,title,description,city,category,mode,cover,capacity) VALUES
 ('10000000-0000-4000-8000-000000000001','午后咖啡，刚好遇见你','带着一杯喜欢的咖啡，聊聊平凡生活里的小确幸。','杭州','同城相遇','男生专场','cafe',6),
 ('10000000-0000-4000-8000-000000000002','海风来信，听见心动','从最近的一次旅行开始，让故事随海风慢慢展开。','厦门','兴趣同频','女生专场','sea',6),
 ('10000000-0000-4000-8000-000000000003','把生活，聊成喜欢','分享一本书、一首歌，或是你认真生活的模样。','上海','轻熟之约','男生专场','library',4),
 ('10000000-0000-4000-8000-000000000004','晚一点，也会遇见你','结束忙碌的一天，给新的相遇留一点时间。','北京','轻熟之约','女生专场','cafe',4),
 ('10000000-0000-4000-8000-000000000005','山海之间，与你同频','喜欢旅行和户外的你，来交换下一站的心愿。','成都','兴趣同频','男生专场','sea',6),
 ('10000000-0000-4000-8000-000000000006','周末的第一句你好','从一句你好开始，认识同一座城里的新朋友。','深圳','同城相遇','女生专场','library',4)
ON CONFLICT(id) DO UPDATE SET
 mode=excluded.mode,
 capacity=excluded.capacity;

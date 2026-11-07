import pg from 'pg';
import {readFile} from 'node:fs/promises';
const db = new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
 await db.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 const rooms=[
 ['10000000-0000-4000-8000-000000000001','午后咖啡，刚好遇见你','带着一杯喜欢的咖啡，聊聊平凡生活里的小确幸。','杭州','同城相遇','男生专场','cafe',6],
 ['10000000-0000-4000-8000-000000000002','海风来信，听见心动','从最近的一次旅行开始，让故事随海风慢慢展开。','厦门','兴趣同频','女生专场','sea',6],
 ['10000000-0000-4000-8000-000000000003','把生活，聊成喜欢','分享一本书、一首歌，或是你认真生活的模样。','上海','轻熟之约','男生专场','library',4],
 ['10000000-0000-4000-8000-000000000004','晚一点，也会遇见你','结束忙碌的一天，给新的相遇留一点时间。','北京','轻熟之约','女生专场','cafe',4],
 ['10000000-0000-4000-8000-000000000005','山海之间，与你同频','喜欢旅行和户外的你，来交换下一站的心愿。','成都','兴趣同频','男生专场','sea',6],
 ['10000000-0000-4000-8000-000000000006','周末的第一句你好','从一句你好开始，认识同一座城里的新朋友。','深圳','同城相遇','女生专场','library',4]];
 await db.query("UPDATE rooms SET mode=CASE WHEN mode='N男1女' THEN '女生专场' ELSE '男生专场' END WHERE mode NOT IN ('男生专场','女生专场')");
 await db.query('ALTER TABLE participants ADD COLUMN IF NOT EXISTS audio_enabled boolean NOT NULL DEFAULT false');
 await db.query('ALTER TABLE participants ADD COLUMN IF NOT EXISTS video_enabled boolean NOT NULL DEFAULT false');
 await db.query('UPDATE rooms SET capacity=CASE WHEN capacity<=4 THEN 4 ELSE 6 END WHERE capacity NOT IN (4,6)');
 await db.query('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_capacity_check');
 await db.query('ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_check CHECK(capacity IN (4,6))');
 for(const row of rooms) await db.query('INSERT INTO rooms (id,title,description,city,category,mode,cover,capacity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET mode=EXCLUDED.mode,capacity=EXCLUDED.capacity',row);
 console.log('Database ready; six starter rooms available.');
} finally {await db.end();}

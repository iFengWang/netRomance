import { Pool } from 'pg';
const g = globalThis as unknown as { pool?: Pool };
export const db = g.pool ?? new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
if(process.env.NODE_ENV !== 'production') g.pool=db;

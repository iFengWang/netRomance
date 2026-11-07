import { Pool } from 'pg';
import type {DbClient,DbResult} from './db-types';
const g = globalThis as unknown as { pool?: Pool };
const pool = g.pool ?? new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
if(process.env.NODE_ENV !== 'production') g.pool=pool;

export const db:DbClient={
 async query<Row=any>(sql:string,params:unknown[]=[]){return pool.query(sql,params) as unknown as Promise<DbResult<Row>>;},
 async connect(){return pool.connect() as unknown as Promise<DbClient>;}
};

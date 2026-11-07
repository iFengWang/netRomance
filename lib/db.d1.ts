import {env} from 'cloudflare:workers';
import type {DbClient,DbResult} from './db-types';

const jsonColumns=new Set(['interests','photos','payload','partner']);
const booleanColumns=new Set(['muted','lamp','audio_enabled','video_enabled']);

function d1Sql(sql:string){
 return sql
  .replace(/now\(\)-interval '(\d+) seconds?'/gi,"datetime('now','-$1 seconds')")
  .replace(/now\(\)-interval '(\d+) minutes?'/gi,"datetime('now','-$1 minutes')")
  .replace(/now\(\)-interval '(\d+) days?'/gi,"datetime('now','-$1 days')")
  .replace(/count\(\*\)::int/gi,'CAST(count(*) AS INTEGER)')
  .replace(/\s+FOR UPDATE\b/gi,'')
  .replace(/now\(\)/gi,'CURRENT_TIMESTAMP')
  .replace(/\$(\d+)/g,'?$1');
}

function input(value:unknown){
 if(typeof value==='boolean')return value?1:0;
 if(value===undefined)return null;
 return value as string|number|null|ArrayBuffer;
}

function output<Row>(row:Record<string,unknown>):Row{
 const result:Record<string,unknown>={};
 for(const [key,value] of Object.entries(row)){
  if(jsonColumns.has(key)&&typeof value==='string'){
   try{result[key]=JSON.parse(value);}catch{result[key]=value;}
  }else if(booleanColumns.has(key))result[key]=value===1||value===true;
  else result[key]=value;
 }
 return result as Row;
}

async function query<Row=any>(sql:string,params:unknown[]=[]):Promise<DbResult<Row>>{
 const normalized=d1Sql(sql).trim();
 if(/^(BEGIN|COMMIT|ROLLBACK)$/i.test(normalized))return {rows:[],rowCount:0};
 try{
  const statement=env.DB.prepare(normalized).bind(...params.map(input));
  const returnsRows=/^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(normalized)||/\bRETURNING\b/i.test(normalized);
  if(returnsRows){
   const response=await statement.all<Record<string,unknown>>();
   const rows=(response.results??[]).map(output<Row>);
   return {rows,rowCount:rows.length};
  }
  const response=await statement.run();
  return {rows:[],rowCount:Number(response.meta.changes??0)};
 }catch(error){
  if(error instanceof Error&&/UNIQUE constraint failed/i.test(error.message))Object.assign(error,{code:'23505'});
  throw error;
 }
}

export const db:DbClient={
 query,
 async connect(){return db;},
 release(){}
};

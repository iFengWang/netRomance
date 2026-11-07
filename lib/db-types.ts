export interface DbResult<Row=any>{
 rows:Row[];
 rowCount:number;
}

export interface DbClient{
 query<Row=any>(sql:string,params?:unknown[]):Promise<DbResult<Row>>;
 connect():Promise<DbClient>;
 release?():void;
}

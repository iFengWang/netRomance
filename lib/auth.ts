import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db } from './db';
import type {User} from './types';
const scrypt=promisify(scryptCb);
export const publicFields='id,name,age,gender,city,occupation,bio,interests,photos';
export function hashToken(token:string){return createHash('sha256').update(token).digest('hex');}
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,hash:string){const [salt,key]=hash.split(':');const derived=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(derived,Buffer.from(key,'hex'));}
export async function currentUser():Promise<User|null>{const token=(await cookies()).get('xinyu_session')?.value;if(!token)return null;const {rows}=await db.query(`SELECT u.${publicFields.split(',').join(',u.')},u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()`,[hashToken(token)]);return rows[0]??null;}
export async function createSession(id:string){const token=randomBytes(32).toString('hex');await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",[hashToken(token),id]);(await cookies()).set('xinyu_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:604800});}

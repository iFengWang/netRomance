import {RoomPage} from '@/components/room';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RoomPage id={id}/>;}

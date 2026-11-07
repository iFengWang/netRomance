import net from 'node:net';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {networkInterfaces} from 'node:os';
const available=port=>new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'0.0.0.0',()=>s.close(()=>resolve(true)));});
let env='';try{env=await readFile('.env','utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
if(!/^POSTGRES_PASSWORD=.+$/m.test(env))env+='\nPOSTGRES_PASSWORD='+randomBytes(24).toString('hex')+'\n';
const configured=/^APP_PORT=(\d+)$/m.exec(env)?.[1];
const running=spawnSync('docker',['compose','ps','--status','running','--services'],{encoding:'utf8'});
let port=Number(configured||3210);
if(!(configured&&running.stdout?.split('\n').includes('web'))){while(!(await available(port))){port++;if(port>65535)throw new Error('No available port');}}
env=env.replace(/^APP_PORT=.*\n?/m,'');env+='\nAPP_PORT='+port+'\n';
const addresses=Object.values(networkInterfaces()).flat().filter(item=>item&&item.family==='IPv4'&&!item.internal).map(item=>item.address);
const inviteAddress=addresses[0]||'localhost';
env=env.replace(/^INVITE_BASE_URL=.*\n?/m,'');env+='INVITE_BASE_URL=http://'+inviteAddress+':'+port+'\n';
await writeFile('.env',env,{mode:0o600});
console.log('Deploying 心遇 on port '+port+'; database is internal to Docker.');
const result=spawnSync('docker',['compose','up','-d','--build','--wait','--wait-timeout','120'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
console.log('\n心遇 is ready: http://localhost:'+port);
for(const address of [...new Set(addresses)])console.log('局域网访问: http://'+address+':'+port);

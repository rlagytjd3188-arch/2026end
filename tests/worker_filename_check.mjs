// Local-only Worker tests. Dropbox is mocked; no production request is made.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker from '../docs/worker/recovery44-upload.mjs';
const NativeDate=Date, originalFetch=fetch, cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
let instant='2026-11-24T09:35:12Z', calls=[], stored=new Set(), sequence=null;
const env={DROPBOX_ACCESS_TOKEN:'unit-test-placeholder'};
class TestDate extends NativeDate { constructor(...args){super(...(args.length?args:[instant]));} }
globalThis.Date=TestDate;
Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(array){
  if(sequence){for(let i=0;i<array.length;i++)array[i]=sequence.shift()??0;return array;}
  return webcrypto.getRandomValues(array);
}}});
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://content.dropboxapi.com/2/files/upload');assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,`Bearer ${env.DROPBOX_ACCESS_TOKEN}`);
  assert.equal(options.headers['Content-Type'],'application/octet-stream');
  const arg=JSON.parse(options.headers['Dropbox-API-Arg']);assert.equal(arg.mode,'add');assert.equal(arg.autorename,true);assert.equal(arg.mute,false);
  assert.match(arg.path,/^\/uploads\/RECOVERY44_\d{8}_\d{6}_[A-Z0-9]{4}\.png$/);
  let name=arg.path.split('/').at(-1),n=0;const base=name;
  while(stored.has(name))name=base.replace('.png',` (${++n}).png`);
  stored.add(name);calls.push({arg,body:options.body});return Response.json({name});
};
async function upload(name='untrusted-2020-UUID.jpg',type='image/png',bytes=new Uint8Array([137,80,78,71])){
  const form=new FormData();form.append('file',new File([bytes],name,{type}));
  return worker.fetch(new Request('https://worker.invalid/',{method:'POST',headers:{Origin:'https://rlagytjd3188-arch.github.io'},body:form}),env);
}
try{
  sequence=[252,253,254,255,0,25,26,35];let response=await upload('../../untrusted-filename.jpg');let data=await response.json();
  assert.equal(response.status,200);assert.equal(data.filename,'RECOVERY44_20261124_183512_AZ09.png');assert.equal(data.ok,true);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://rlagytjd3188-arch.github.io');
  assert.deepEqual([...new Uint8Array(calls.at(-1).body)],[137,80,78,71]);
  instant='2026-11-23T15:00:00Z';sequence=[0,0,0,0];data=await(await upload()).json();assert.equal(data.filename,'RECOVERY44_20261124_000000_AAAA.png');
  instant='2026-12-31T15:00:00Z';sequence=[0,0,0,0];data=await(await upload()).json();assert.equal(data.filename,'RECOVERY44_20270101_000000_AAAA.png');
  // Force a same-second/random collision: autorename remains true and returned names differ.
  sequence=[0,0,0,0];const again=await(await upload()).json();assert.notEqual(again.filename,data.filename);assert.equal(calls.at(-1).arg.autorename,true);
  instant='2026-11-24T09:35:12Z';sequence=null;const names=[];
  for(let i=0;i<100;i++)names.push((await(await upload()).json()).filename);
  assert.equal(new Set(names).size,100);
  const count=calls.length;
  response=await worker.fetch(new Request('https://worker.invalid/',{method:'OPTIONS',headers:{Origin:'https://rlagytjd3188-arch.github.io'}}),env);assert.equal(response.status,204);
  response=await worker.fetch(new Request('https://worker.invalid/',{method:'OPTIONS',headers:{Origin:'https://other.invalid'}}),env);assert.equal(response.status,403);
  response=await worker.fetch(new Request('https://worker.invalid/'),env);assert.equal(response.status,405);
  response=await upload('bad.txt','text/plain');assert.equal(response.status,400);
  response=await upload('large.png','image/png',new Uint8Array(15*1024*1024+1));assert.equal(response.status,400);
  assert.equal(calls.length,count);
  console.log('PASS: Asia/Seoul dates/midnight/year rollover, 4-character random alphabet, ignored client filename, /uploads/, autorename collision protection, unchanged Dropbox request/CORS/validation.');
}finally{
  globalThis.Date=NativeDate;globalThis.fetch=originalFetch;
  if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else delete globalThis.crypto;
}

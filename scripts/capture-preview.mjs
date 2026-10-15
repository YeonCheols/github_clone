import {spawn} from 'node:child_process';
import {open,readFile,writeFile,mkdir,mkdtemp,readdir,stat,copyFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {createHash} from 'node:crypto';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const rea=resolve(app,'../rea');
const endpoint='http://127.0.0.1:9222';
const origin='http://127.0.0.1:4173';
function previewUrl(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.port!=='4173')return null;
  let path=u.hash.slice(1)||u.pathname;
  if(path==='/'||path==='')path='/morluto/rea';
  return {origin:u.origin,path:path.replace(/\/$/,'')};
 }catch{return null;}
}
const allSteps=[
 ['repository','/morluto/rea','저장소 메인'],
 ['file','/morluto/rea/blob/main/README.md','README 파일'],
 ['issues','/morluto/rea/issues','Issues 목록'],
 ['issue-detail','/morluto/rea/issues/3839','이슈 #3839 상세'],
];
const onlyIndex=process.argv.indexOf('--only');
const requested=onlyIndex<0?allSteps.map(s=>s[0]):(process.argv[onlyIndex+1]||'').split(',');
if(requested.some(name=>!allSteps.some(s=>s[0]===name)))throw new Error('--only에는 repository,file,issues,issue-detail 중 화면 이름을 쉼표로 구분해 주세요.');
const steps=allSteps.filter(s=>requested.includes(s[0]));
if(process.argv.includes('--help')){
 console.log('분석용 Chrome에서 로컬 프리뷰 네 화면을 열어 REA로 캡처합니다. 안내에 따라 같은 탭을 이동하고 Enter를 누르세요. 결과는 evidence/preview-* 에 저장됩니다.');
 console.log('--resume: 직전 수집의 완료된 화면을 보존하고 나머지 화면부터 이어갑니다.');
 console.log('--only issues,issue-detail: 지정한 화면만 새로 수집합니다.');
 process.exit(0);
}
if(!process.stdin.isTTY)throw new Error('일반 터미널에서 실행해 주세요.');
await mkdir(join(app,'evidence'),{recursive:true});
const output=await mkdtemp(join(app,'evidence/preview-'));
const terminal=createInterface({input:process.stdin,output:process.stdout});
const records=[];
if(process.argv.includes('--resume')){
 const folders=await readdir(join(app,'evidence'),{withFileTypes:true});
 const previous=await Promise.all(folders.filter(f=>f.isDirectory()&&f.name.startsWith('preview-')&&join(app,'evidence',f.name)!==output).map(async f=>({path:join(app,'evidence',f.name),time:(await stat(join(app,'evidence',f.name))).mtimeMs})));
 for(const source of previous.sort((a,b)=>b.time-a.time)){
  for(const [name,path] of steps){
   if(records.some(r=>r.name===name))continue;
   let shot,page,bytes,verification;
   try{
    const raw=JSON.parse(await readFile(join(source.path,name+'-screenshot.json'),'utf8'));shot=raw.normalized_result??raw;
    const rawPage=JSON.parse(await readFile(join(source.path,name+'-page.json'),'utf8'));page=rawPage.normalized_result??rawPage;
    bytes=await readFile(join(source.path,name+'.png'));
    try{verification=JSON.parse(await readFile(join(source.path,name+'-route.json'),'utf8'));}catch{}
   }catch{continue;}
   const verified=verification?.path===path&&verification?.target_id===shot.target?.target_id&&verification?.target_id===page.target?.target_id&&verification?.screenshot_sha256===shot.artifact?.sha256&&verification?.urls?.length===3&&verification.urls.every(url=>previewUrl(url)?.path===path);
   if(!verified&&(previewUrl(shot.target?.url)?.path!==path||previewUrl(page.target?.url)?.path!==path))continue;
   if(bytes.length!==shot.artifact?.bytes||createHash('sha256').update(bytes).digest('hex')!==shot.artifact?.sha256)continue;
   for(const suffix of ['.png','-screenshot.json','-page.json'])await copyFile(join(source.path,name+suffix),join(output,name+suffix));
   if(verified)await copyFile(join(source.path,name+'-route.json'),join(output,name+'-route.json'));
   records.push({name,url:verified?verification.urls[0]:shot.target.url,viewport:shot.viewport,captured_at:shot.captured_at,resumed_from:source.path});
   console.log('이전 수집에서 유지: '+name);
  }
 }
}
async function run(name,args){
 const file=join(output,name+'.json'),handle=await open(file,'wx');
 let code;
 try{code=await new Promise((yes,no)=>{
  const child=spawn(process.execPath,[join(rea,'scripts/rea.mjs'),...args,'--format','json'],{cwd:rea,stdio:['ignore',handle.fd,'inherit']});
  child.once('error',no);child.once('close',yes);
 });}finally{await handle.close();}
 const v=JSON.parse(await readFile(file,'utf8'));
 if(code!==0)throw new Error(`${v.code||code}: ${v.message||v.error}. 상세: ${file}`);
 return v.normalized_result??v;
}
let selected;
try{
 console.log('원본을 수집했던 분석용 Chrome 창을 사용해 주세요. 프리뷰 서버는 실행한 채로 두세요.');
 console.log('화면 상단으로 이동하고 브라우저 확대 비율을 원본과 동일하게 유지해 주세요.');
 for(const [name,path,label]of steps){
  if(records.some(r=>r.name===name))continue;
  let attempt=0;
  for(;;){
   const answer=await terminal.question(`\n${label}: ${origin}/#${path}\n같은 분석용 Chrome 탭에서 이 주소를 열고 Enter (중단: q): `);
   if(answer.trim().toLowerCase()==='q')throw new Error('사용자가 중단했습니다.');
   const found=await run(name+'-targets-'+attempt++,['list-browser-targets',endpoint]);
   const previews=found.targets.filter(t=>previewUrl(t.url));
   const candidates=previews.filter(t=>previewUrl(t.url).path===path);
   let target=candidates.find(t=>t.target_id===selected);
   if(!target&&candidates.length===1)target=candidates[0];
   if(!target&&candidates.length>1){
    console.log('같은 화면의 프리뷰 탭이 여러 개 열려 있습니다.');
    candidates.forEach((t,i)=>console.log(`${i+1}. ${t.title} — ${t.url}`));
    const choice=await terminal.question('캡처할 탭 번호: ');
    target=candidates[Number(choice)-1];
   }
   if(!target){
    if(!previews.length){
     console.log('연결된 분석용 Chrome 창에 프리뷰 탭이 없습니다.');
     console.log(`원본 GitHub를 수집했던 Chrome 창의 주소창에 ${origin}/#${path} 를 붙여넣어 주세요.`);
     console.log('일반 Chrome 또는 다른 브라우저 창에 열려 있는 탭은 이 연결에서 보이지 않습니다.');
    }else{
     console.log('프리뷰는 연결됐지만 현재 화면이 다릅니다.');
     previews.forEach(t=>console.log('발견한 프리뷰: '+t.url));
     console.log(`위 안내 주소로 이동해 주세요: ${origin}/#${path}`);
    }
    continue;
   }
   selected=target.target_id;
   const targetOrigin=previewUrl(target.url).origin;
   const args=[endpoint,selected,'--allowed-origins',targetOrigin];
   const urls=[target.url];
   async function verifyRoute(stage,result){
    const discovery=await run(name+'-'+stage+'-targets',['list-browser-targets',endpoint]);
    const current=discovery.targets.find(t=>t.target_id===selected);
    if(previewUrl(current?.url)?.path!==path||previewUrl(current?.url)?.origin!==targetOrigin)throw new Error('캡처 중 페이지가 바뀌었습니다. 안내 주소를 연 상태로 다시 실행해 주세요.');
    // CDP frame URLs can omit the hash. Keep the raw REA result and
    // verify the full route independently through target discovery.
    const documentUrl=new URL(target.url);documentUrl.hash='';
    if(result.target?.target_id!==selected||![target.url,documentUrl.href].includes(result.target?.url))throw new Error('캡처 결과의 대상 탭 또는 문서 주소가 다릅니다.');
    urls.push(current.url);
   }
   const shot=await run(name+'-screenshot',['capture-web-screenshot',...args]);
   await verifyRoute('after-screenshot',shot);
   const bytes=Buffer.from(shot.artifact.data_base64,'base64');
   if(bytes.length!==shot.artifact.bytes||createHash('sha256').update(bytes).digest('hex')!==shot.artifact.sha256)throw new Error('PNG 검증 실패');
   await writeFile(join(output,name+'.png'),bytes,{flag:'wx'});
   const page=await run(name+'-page',['inspect-web-page',...args,'--include-accessibility-text','--include-console-text']);
   await verifyRoute('after-page',page);
   await writeFile(join(output,name+'-route.json'),JSON.stringify({path,target_id:selected,urls,screenshot_sha256:shot.artifact.sha256},null,2));
   records.push({name,url:target.url,viewport:shot.viewport,captured_at:shot.captured_at});
   console.log(`저장 완료: ${name} (${shot.viewport.width} × ${shot.viewport.height})`);
   if(shot.viewport.width!==1200||shot.viewport.height!==860)console.log('원본은 1200 × 860입니다. 크기가 달라 정확한 픽셀 비교에는 제약이 있습니다.');
   break;
  }
 }
 console.log('\n프리뷰 수집 완료. 채팅에 “프리뷰 수집 완료”라고 알려 주세요.');
}catch(e){console.error('\n미완료: '+e.message);process.exitCode=1;}
finally{
 await writeFile(join(output,'summary.json'),JSON.stringify({completed:records.length===steps.length,requested_screens:steps.map(s=>s[0]),records},null,2));
 console.log('결과 폴더: '+output);terminal.close();
}

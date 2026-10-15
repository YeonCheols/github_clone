import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,open} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {collectAriaLinks,buildInventory} from './lib/github-link-inventory.mjs';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),rea=resolve(app,'../rea'),endpoint='http://127.0.0.1:9222';
if(process.argv.includes('--help')){console.log('--layout-diagnostics: 로컬 프리뷰의 화면·요소 너비만 개발 콘솔에 기록해 REA console 이벤트로 수집합니다.');console.log('--preview-profile-pages: 프로필 Overview·Repositories·Stars와 공개 프로필 설정을 캡처합니다.');console.log('--preview-account-pages: 전체 저장소·전역 Issues·PR Inbox 프리뷰를 캡처합니다.');console.log('--preview-home: 로컬 홈 프리뷰를 캡처합니다.');console.log('--include-source: 프리뷰와 원본 GitHub 홈·메뉴를 함께 수집합니다. 프리뷰 옵션만 지정하면 로컬만 수집합니다.');console.log('--pages-from <links.json>: 기존 링크 목록에서 계정 홈의 주요 기능과 저장소 화면을 추가로 읽기 수집합니다. 로그아웃·설정 변경·작성은 수행하지 않습니다.');console.log('REA로 로그인된 GitHub 홈, 하단, 관찰된 전역/사용자 메뉴와 직접 연결 URL을 수집합니다. 쿠키·스토리지·응답 본문은 수집하지 않습니다. 기존 자료는 유지하며 evidence/github-app-*에 저장합니다.');process.exit(0)}
const previewRequested=['--preview-home','--preview-account-pages','--preview-profile-pages'].some(flag=>process.argv.includes(flag));
const previewOnly=previewRequested&&!process.argv.includes('--include-source')&&!process.argv.includes('--pages-from');
const selectionOrigin=previewOnly?'http://127.0.0.1:4173':'https://github.com';
if(!process.stdin.isTTY)throw Error('일반 터미널에서 실행해 주세요.');
const {parse}=createRequire(join(rea,'package.json'))('yaml');
await mkdir(join(app,'evidence'),{recursive:true});const output=await mkdtemp(join(app,'evidence/github-app-'));
const terminal=createInterface({input:process.stdin,output:process.stdout}),records=[],observations=[],gaps=[];
async function run(name,args){
 const path=join(output,name+'.json'),handle=await open(path,'wx');let code;
 try{code=await new Promise((yes,no)=>{const child=spawn(process.execPath,[join(rea,'scripts/rea.mjs'),...args,'--format','json'],{cwd:rea,stdio:['ignore',handle.fd,'inherit']});child.once('error',no);child.once('close',yes)})}finally{await handle.close()}
 let raw;try{raw=JSON.parse(await readFile(path,'utf8'))}catch{throw Error('REA 응답을 확인해 주세요: '+path)}
 if(code!==0||raw.error)throw Error(`${raw.code||code}: ${raw.message||raw.error||'REA 실행 실패'}. 기록: ${path}`);
 return raw.normalized_result??raw;
}
let selected;
async function capture(name,extra=[],startUrl='https://github.com/'){
 const requestedUrl=new URL(startUrl);const layoutDiagnostics=name.startsWith('preview-')&&process.argv.includes('--layout-diagnostics');if(layoutDiagnostics)requestedUrl.searchParams.set('__rea_layout','1');
 const start={url:requestedUrl.origin+requestedUrl.pathname+requestedUrl.hash,query:[...requestedUrl.searchParams].map(([name,value])=>({name,value:{source:'literal',value}}))};
 const scenario={browser:{mode:'connect',cdp_endpoint:endpoint,target_id:selected},start_url:start,environment:{viewport:{width:1200,height:860,device_scale_factor:1},locale:'en-US',timezone:'Asia/Seoul',color_scheme:'dark',reduced_motion:'reduce',service_workers:'allow'},actions:[{step_id:'wait_body',action:'wait_for',locator:{kind:'css',selector:'body'},state:'visible',timeout_ms:15000},{step_id:'settle_home',action:'wait_for_timeout',duration_ms:1500},...extra],capture:{after_each_step:[],at_end:['screenshot','accessibility','url'],events:layoutDiagnostics?['console','page-errors']:[],network:{request_body:false,response_body:false,header_values:false}}};
 const input=join(output,name+'-input.json');await writeFile(input,JSON.stringify(scenario,null,2));
 console.log('수집 중: '+name);
 const capture=await run(name+'-scenario',['capture-browser-scenario',input]);
 const last=capture.steps?.at(-1),artifacts=last?.artifacts;
 if(layoutDiagnostics){const events=(capture.events?.items||[]).filter(event=>JSON.stringify(event).includes('REA_LAYOUT '));await writeFile(join(output,name+'-layout.json'),JSON.stringify(events,null,2));}
 const pageUrl=last?.after_url?.url||last?.after_url;
 if(typeof pageUrl!=='string'||new URL(pageUrl).origin!==requestedUrl.origin||/^\/(?:login|session)(?:\/|$)/.test(new URL(pageUrl).pathname)||(requestedUrl.pathname==='/'&&new URL(pageUrl).pathname!=='/'))throw Error('로그인 또는 대상 경로를 확인해 주세요. 요청 URL: '+startUrl);
 if(requestedUrl.hash&&new URL(pageUrl).hash!==requestedUrl.hash)throw Error('프리뷰 경로가 요청 화면과 다릅니다: '+pageUrl);
 if(new URL(pageUrl).pathname!==requestedUrl.pathname)gaps.push(name+': redirected to '+new URL(pageUrl).pathname);
 const screenshot=artifacts?.screenshot,accessibility=artifacts?.accessibility;
 if(screenshot?.state==='captured'){const a=screenshot.value,b=Buffer.from(a.data_base64,'base64');if(b.length!==a.bytes||createHash('sha256').update(b).digest('hex')!==a.sha256)throw Error('PNG 검증 실패');await writeFile(join(output,name+'.png'),b)}else gaps.push(name+': screenshot missing');
 if(accessibility?.state!=='captured')throw Error(name+': 접근성 자료를 수집하지 못했습니다.');
 const a=accessibility.value,b=Buffer.from(a.text);if(b.length!==a.bytes||createHash('sha256').update(b).digest('hex')!==a.sha256)throw Error('접근성 자료 검증 실패');
 await writeFile(join(output,name+'-accessibility.yaml'),a.text);
 const collected=collectAriaLinks(parse(a.text),{source:name,pageUrl});if(!name.startsWith('preview-'))observations.push(...collected.links);
 const record={name,requested_url:startUrl,url:pageUrl,steps:capture.steps.map(s=>({step_id:s.step_id,status:s.status,error:s.error})),completeness:capture.completeness,links:collected.links.length,buttons:collected.buttons};records.push(record);
 if(capture.completeness?.status!=='complete')gaps.push(name+': '+capture.completeness?.status);
 if(capture.steps.some(s=>s.status!=='completed'))gaps.push(name+': some actions failed');
 console.log(`저장 완료: ${name} — 링크 ${collected.links.length}개`);return collected;
}
let completed=false;
try{
 console.log(previewOnly?'프리뷰 서버를 켜고 분석용 Chrome에서 http://127.0.0.1:4173/ 을 열어 주세요.':'분석용 Chrome에서 YeonCheols 계정으로 https://github.com/ 을 열어 주세요.');
 console.log(previewOnly?'REA가 이 로컬 탭에서 요청한 프리뷰 화면을 이동·조회·캡처합니다. 원본 github.com 화면 수집은 실행하지 않습니다.':'REA가 이 탭에서 홈 이동·화면 대기·하단 스크롤·관찰된 탐색 메뉴 열기만 수행합니다.');
 console.log('화면 크기를 1200 × 860으로 맞추며 다른 탭이나 계정 인증 설정은 변경하지 않습니다.');
 let attempt=0;
 while(!selected){
  const answer=await terminal.question(previewOnly?'로컬 프리뷰 준비 후 Enter (중단: q): ':'홈 준비 후 Enter (중단: q): ');
  if(answer.trim().toLowerCase()==='q')throw Error('사용자 중단');
  if(answer.trim()){console.log('여기는 명령어 입력란이 아닙니다. Chrome을 준비한 뒤 Enter만 눌러 주세요.');continue}
  const found=await run('targets-'+attempt++,['list-browser-targets',endpoint,'--allowed-origins',selectionOrigin]);
  const githubTabs=found.targets.filter(t=>{try{return new URL(t.url).origin===selectionOrigin}catch{return false}});
  const homeTabs=githubTabs.filter(t=>new URL(t.url).pathname==='/');
  const tabs=homeTabs.length?homeTabs:githubTabs;
  let chosen;
  if(tabs.length===1)chosen=tabs[0];
  else if(tabs.length>1){tabs.forEach((t,i)=>console.log(`${i+1}. ${t.title} — ${t.url}`));const number=await terminal.question('수집에 사용할 탭 번호: ');chosen=tabs[Number(number)-1]}
  if(chosen){selected=chosen.target_id;console.log('사용할 탭: '+chosen.url);if(!previewOnly&&new URL(chosen.url).pathname!=='/')console.log('이 탭을 수집 시나리오에서 GitHub 홈으로 이동합니다.')}
  else console.log('연결된 Chrome에 대상 탭이 없습니다. 같은 분석용 창에서 '+selectionOrigin+'/ 을 열어 주세요.');
 }
 if(process.argv.includes('--preview-home'))await capture('preview-home',[{step_id:'wait_local_repositories',action:'wait_for',locator:{kind:'css',selector:'.dash-repository-list li:first-child > a'},state:'visible',timeout_ms:30000}],'http://127.0.0.1:4173/');
 if(process.argv.includes('--preview-account-pages')){
  for(const [name,path,selector]of [['repositories','/repos','.repository-index'],['issues','/issues/assigned','.account-table[data-ready="true"]'],['pulls','/pulls/inbox','.pull-inbox-groups[data-ready="true"]']])await capture('preview-'+name,[{step_id:'wait_local_account_data',action:'wait_for',locator:{kind:'css',selector},state:'visible',timeout_ms:30000}],'http://127.0.0.1:4173/#'+path);
 }
 if(process.argv.includes('--preview-profile-pages')){
  for(const [name,path,selector]of [['profile','/YeonCheols','.profile-readme'],['profile-repositories','/YeonCheols?tab=repositories','.profile-repositories[data-ready="true"]'],['profile-stars','/YeonCheols?tab=stars','.profile-repositories[data-ready="true"]'],['settings-profile','/settings/profile','.settings-profile-grid']])await capture('preview-'+name,[{step_id:'wait_local_profile_data',action:'wait_for',locator:{kind:'css',selector},state:'visible',timeout_ms:30000}],'http://127.0.0.1:4173/#'+path);
 }
 if(!previewOnly){
 const home=await capture('home');
 if(!home.buttons.some(n=>/user navigation|user menu|profile|YeonCheols/i.test(n))&&!home.links.some(l=>/YeonCheols/i.test(l.url))){gaps.push('로그인 계정이 화면 자료로 확인되지 않음');throw Error('로그인 홈인지 확인할 수 없습니다. 분석용 Chrome에서 YeonCheols 로그인 상태를 확인해 주세요.')}
 await capture('home-bottom',[{step_id:'scroll_bottom',action:'press',locator:{kind:'css',selector:'body'},key:'End',timeout_ms:5000},{step_id:'settle_bottom',action:'wait_for_timeout',duration_ms:1200}]);
 const menus=home.buttons.filter(n=>n==='Open menu'||/global navigation|user navigation|user menu/i.test(n)).slice(0,2);
 for(let i=0;i<menus.length;i++)await capture('menu-'+(i+1),[{step_id:'open_menu',action:'click',locator:{kind:'role',role:'button',name:menus[i]},timeout_ms:5000},{step_id:'settle_menu',action:'wait_for_timeout',duration_ms:500}]);
 if(menus.length<2)gaps.push('전역/사용자 메뉴가 둘 다 관찰되지 않았습니다. 숨은 링크는 추가 수집 필요');
 const pagesIndex=process.argv.indexOf('--pages-from');
 if(pagesIndex>=0){
  const manifest=JSON.parse(await readFile(resolve(process.cwd(),process.argv[pagesIndex+1]||''),'utf8'));
  const screens=(manifest.links||[]).filter(item=>{try{const u=new URL(item.url);return u.origin==='https://github.com'&&!u.hash&&(/^\/(?:feed|issues|pulls|repos|notifications|copilot|YeonCheols)$/.test(u.pathname)||/^\/settings\/(?:profile|appearance|accessibility|copilot|organizations|enterprises)$/.test(u.pathname)||/^\/(?:YeonCheols|ycseng-fe-group)\/[^/]+$/.test(u.pathname))}catch{return false}});
  for(let i=0;i<screens.length;i++){
   const target=screens[i];
   try{await capture('page-'+String(i+1).padStart(2,'0'),[],target.url)}catch(error){gaps.push(target.url+': '+error.message);console.error('해당 화면 미완료: '+target.url)}
  }
 }
 }
 completed=true;
}catch(error){console.error('미완료: '+error.message);process.exitCode=1}
finally{
 const links=buildInventory(observations);
 await writeFile(join(output,'links.json'),JSON.stringify({scope:previewOnly?'로컬 프리뷰 화면; 원본 URL 목록 수집 제외':'홈 및 관찰된 탐색 메뉴에서 직접 연결된 URL',unique_urls:links.length,links},null,2));
 await writeFile(join(output,'summary.json'),JSON.stringify({completed,phase:previewOnly?'Local preview capture':'GitHub app discovery: home and navigation',records,unique_urls:links.length,gaps,limitations:['화면과 접근성 트리에 관찰된 링크만 포함합니다.','지연 로딩·닫힌 메뉴·로그인 상태·개인화에 따라 링크가 추가될 수 있습니다.','수집된 목적지 화면의 주요 동작과 GitHub 전체 앱 기능은 아직 분석 완료가 아닙니다.','로그아웃·작성·설정 변경 링크는 방문하지 않았습니다.','REA capture_browser_scenario가 선언한 홈 이동·스크롤·메뉴 클릭을 수행했습니다.']},null,2));
 console.log('결과 폴더: '+output);if(completed)console.log(previewOnly?'로컬 프리뷰 수집 완료. 채팅에 “프리뷰 수집 완료”라고 알려 주세요.':'요청한 홈·메뉴/연결 화면 수집 종료. 채팅에 “홈 수집 완료”라고 알려 주세요.');terminal.close();
}

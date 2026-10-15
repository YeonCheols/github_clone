import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
import {ApiError} from './api-error.mjs';
export {ApiError} from './api-error.mjs';
import {accountRepositories,accountItems,pullInbox} from './account-pages.mjs';
import {publicProfile,profileChanges,readProfile,profileRepositories} from './profile.mjs';

// Only repository-local gh credentials may be used. No token reaches the browser.
export async function ghRequest(endpoint,method='GET',body){
 const authRoot=resolve(root,'.git/gh-local');
 try{await access(resolve(authRoot,'hosts.yml'))}catch{throw new ApiError(401,'저장소 전용 인증이 필요합니다. node scripts/github-local.mjs login 을 실행해 주세요.')}
 const env={...process.env,GH_CONFIG_DIR:authRoot,XDG_CONFIG_HOME:authRoot,GH_PROMPT_DISABLED:'1',GH_PAGER:'cat'};
 for(const key of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN','GH_DEBUG','GH_HOST'])delete env[key];
 const args=['api','--hostname','github.com','--method',method,endpoint,'--include','--header','Accept: application/vnd.github+json','--header','X-GitHub-Api-Version: 2026-03-10'];
 if(body!==undefined)args.push('--input','-');
 const {code,output}=await new Promise((yes,no)=>{
  let output='',size=0;
  const child=spawn('/opt/homebrew/bin/gh',args,{cwd:root,env,stdio:['pipe','pipe','pipe'],signal:AbortSignal.timeout(30000)});
  child.on('error',()=>no(new ApiError(502,'GitHub 연결에 실패했습니다. 네트워크와 저장소 전용 인증을 확인해 주세요.')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>16*1024*1024){child.kill();no(new ApiError(413,'GitHub 응답이 너무 큽니다.'))}else output+=chunk});
  // Never return CLI stderr, configuration contents or credentials to the client.
  child.stderr.resume();child.on('close',code=>yes({code,output}));
  child.stdin.on('error',()=>{});child.stdin.end(body===undefined?undefined:JSON.stringify(body));
 });
 const separator=output.search(/\r?\n\r?\n/),headers=separator<0?'':output.slice(0,separator),raw=separator<0?output:output.slice(separator).replace(/^\r?\n\r?\n/,'');
 const status=Number(headers.match(/^HTTP\/\S+\s+(\d+)/)?.[1])||(code===0?200:502);
 let value;try{value=raw.trim()?JSON.parse(raw):null}catch{throw new ApiError(502,'GitHub 응답을 읽지 못했습니다.')}
 if(status>=400||code!==0)throw new ApiError(status>=400?status:502,status===401?'GitHub 인증이 만료됐습니다. 저장소 전용 로그인을 다시 실행해 주세요.':status===403?'이 작업의 권한이 없거나 GitHub API 사용 한도에 도달했습니다.':status===404?'대상을 찾을 수 없거나 접근 권한이 없습니다.':status===422?'GitHub가 입력을 거부했습니다. 내용과 저장소 상태를 확인해 주세요.':'GitHub 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
 return {data:value,next:/rel="next"/.test(headers)};
}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new ApiError(400,'입력값을 확인해 주세요.');return value.trim()}
function pageOf(params){const p=Number(params.get('page')||1);if(!Number.isInteger(p)||p<1||p>1000)throw new ApiError(400,'잘못된 페이지입니다.');return p}
async function bodyOf(req){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ApiError(415,'JSON 요청이 필요합니다.');let value='',size=0;for await(const part of req){size+=Buffer.byteLength(part);if(size>65536)throw new ApiError(413,'입력이 너무 큽니다.');value+=part}try{const body=JSON.parse(value);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body}catch{throw new ApiError(400,'잘못된 JSON입니다.')}}

export function createGithubMiddleware({request=ghRequest}={}){
 const csrf=randomBytes(32).toString('hex');
 let identity,expires=0;
 async function user(force=false){if(!force&&identity&&Date.now()<expires)return identity;const {data}=await request('user');if(data?.login?.toLowerCase()!=='yeoncheols')throw new ApiError(403,'YeonCheols 계정으로 저장소 전용 인증을 해 주세요.');identity={login:data.login,name:data.name,avatar_url:data.avatar_url};expires=Date.now()+60000;return identity}
 const send=(res,status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(value))};
 return async(req,res,next)=>{
  if(!req.url?.startsWith('/api/github/'))return next();
  try{
   const host=req.headers.host||'';
   if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))throw new ApiError(403,'로컬 브라우저에서만 연결할 수 있습니다.');
   const url=new URL(req.url,`http://${host}`),path=url.pathname.slice('/api/github'.length),method=req.method||'GET';
   if(req.headers.origin&&req.headers.origin!==url.origin)throw new ApiError(403,'다른 출처의 요청은 허용되지 않습니다.');
   if(req.headers['sec-fetch-site']==='cross-site')throw new ApiError(403,'다른 사이트의 요청은 허용되지 않습니다.');
   if(!['GET','POST','PATCH','PUT','DELETE'].includes(method))throw new ApiError(405,'지원하지 않는 메서드입니다.');
   if(method!=='GET'){
    const received=req.headers['x-github-session']||'';
    if(typeof received!=='string'||Buffer.byteLength(received)!==Buffer.byteLength(csrf)||!timingSafeEqual(Buffer.from(received),Buffer.from(csrf)))throw new ApiError(403,'페이지를 새로고침한 뒤 다시 시도해 주세요.');
   }
   const repository=url.searchParams.get('repository')||'morluto/rea';
   if(!/^[a-z0-9][a-z0-9-]{0,38}\/(?!\.{1,2}$)[a-z0-9_.-]{1,100}$/i.test(repository))throw new ApiError(400,'잘못된 저장소입니다.');
   const prefix=`repos/${repository}`;
   const account=await user(method!=='GET');
   let result;
   if(path==='/session'&&method==='GET')result={user:account,repository,csrf};
   else if(path==='/profile'&&method==='GET')result=await readProfile(request,account);
   else if(path==='/profile-repositories'&&method==='GET')result=await profileRepositories(request,url.searchParams);
   else if(path==='/settings/profile'&&method==='GET')result=publicProfile((await request('user')).data);
   else if(path==='/settings/profile'&&method==='PATCH'){const changes=profileChanges(await bodyOf(req));result=publicProfile((await request('user','PATCH',changes)).data);expires=0;}
   else if(path==='/account-repositories'&&method==='GET')result=await accountRepositories(request,url.searchParams);
   else if(path==='/account-items'&&method==='GET')result=await accountItems(request,account,url.searchParams);
   else if(path==='/pull-inbox'&&method==='GET')result=await pullInbox(request,account,url.searchParams);
   else if(path==='/dashboard'&&method==='GET'){
    const page=pageOf(url.searchParams),filter=url.searchParams.get('filter')||'assigned';
    const qualifiers={assigned:'assignee',created:'author',mentioned:'mentions'};
    if(!qualifiers[filter])throw new ApiError(400,'잘못된 대시보드 필터입니다.');
    const search=kind=>request('search/issues?q='+encodeURIComponent(`is:${kind} is:open ${qualifiers[filter]}:${account.login}`)+'&sort=updated&order=desc&per_page=5');
    const [repos,pulls,issues]=await Promise.all([request(`user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&direction=desc&per_page=100&page=${page}`),search('pr'),search('issue')]);
    result={repositories:{items:repos.data.map(r=>({id:r.id,full_name:r.full_name,html_url:r.html_url,private:r.private,owner:{login:r.owner?.login,avatar_url:r.owner?.avatar_url}})),next:repos.next},pulls:{items:pulls.data.items.map(i=>({id:i.id,title:i.title,number:i.number,html_url:i.html_url})),total:pulls.data.total_count},issues:{items:issues.data.items.map(i=>({id:i.id,title:i.title,number:i.number,html_url:i.html_url})),total:issues.data.total_count}};
   }
   else if(path==='/repository'&&method==='GET'){
    const {data:repo}=await request(prefix);
    const ref=encodeURIComponent(repo.default_branch);
    const [contents,readme,commits,languages]=await Promise.all([request(`${prefix}/contents?ref=${ref}`).catch(e=>{if(e.status===404)return {data:[]};throw e}),request(`${prefix}/readme?ref=${ref}`).catch(e=>{if(e.status===404)return {data:null};throw e}),request(`${prefix}/commits?per_page=1`).catch(e=>{if(e.status===409)return {data:[]};throw e}),request(`${prefix}/languages`)]);
    const publicRepo=Object.fromEntries(['id','private','license','name','full_name','html_url','default_branch','description','homepage','topics','forks_count','stargazers_count','open_issues_count','has_issues','archived'].map(key=>[key,repo[key]]));
    publicRepo.owner={login:repo.owner?.login,avatar_url:repo.owner?.avatar_url};
    publicRepo.permissions=Object.fromEntries(['pull','triage','push','maintain','admin'].map(key=>[key,repo.permissions?.[key]===true]));
    result={repo:publicRepo,files:contents.data,readme:readme.data?Buffer.from(readme.data.content||'','base64').toString('utf8'):'',commit:commits.data[0]||null,languages:languages.data};
   }else if(path==='/contents'&&method==='GET'){
    const path=text(url.searchParams.get('path')||'',4096),ref=text(url.searchParams.get('ref')||'main',200,true);
    if(path.split('/').some(p=>p==='.'||p==='..'))throw new ApiError(400,'잘못된 파일 경로입니다.');
    const value=await request(`${prefix}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);
    if(!Array.isArray(value.data)&&value.data.size>0&&value.data.encoding!=='base64')throw new ApiError(413,'이 파일은 기본 파일 API로 표시할 수 없습니다. 원본 GitHub에서 열어 주세요.');
    result=Array.isArray(value.data)?{files:value.data}:{file:value.data,content:Buffer.from(value.data.content||'','base64').toString('utf8')};
   }else if(path==='/issues'&&method==='GET'){
    const query=text(url.searchParams.get('q')||'',1000),page=pageOf(url.searchParams);
    const q=`repo:${repository} is:issue ${query}`;
    // The repository qualifier is server-controlled, not supplied by the browser.
    if(/(?:^|\s)(?:(?:repo|org|user):|OR(?:\s|$))/i.test(query))throw new ApiError(400,'현재 저장소 안에서 검색해 주세요.');
    const value=await request(`search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=30&page=${page}`);
    result={items:value.data.items,total:value.data.total_count,incomplete:value.data.incomplete_results,next:value.next};
   }else if(path==='/issues'&&method==='POST'){
    const body=await bodyOf(req);result=(await request(`${prefix}/issues`,'POST',{title:text(body.title,240,true),body:text(body.body??'',60000)})).data;
   }else if(/^\/issues\/\d+$/.test(path)&&method==='GET')result=(await request(prefix+path)).data;
   else if(/^\/issues\/\d+$/.test(path)&&method==='PATCH'){
    const body=await bodyOf(req);if(!['open','closed'].includes(body.state))throw new ApiError(400,'잘못된 이슈 상태입니다.');result=(await request(prefix+path,'PATCH',{state:body.state})).data;
   }else if(/^\/issues\/\d+\/comments$/.test(path)&&method==='GET'){
    const value=await request(`${prefix}${path}?per_page=100&page=${pageOf(url.searchParams)}`);result={items:value.data,next:value.next};
   }else if(/^\/issues\/\d+\/comments$/.test(path)&&method==='POST'){
    const body=await bodyOf(req);result=(await request(prefix+path,'POST',{body:text(body.body,60000,true)})).data;
   }else if(path==='/star'&&['GET','PUT','DELETE'].includes(method)){
    try{await request(`user/starred/${repository}`,method);result={starred:method!=='DELETE'}}catch(e){if(method==='GET'&&e.status===404)result={starred:false};else throw e}
   }else throw new ApiError(404,'지원하지 않는 API 경로입니다.');
   send(res,200,result);
  }catch(e){send(res,e instanceof ApiError?e.status:500,{error:e instanceof ApiError?e.message:'요청 처리 중 오류가 발생했습니다.'})}
 };
}
export function githubApiPlugin(){return {name:'repository-local-github-api',configureServer(server){server.middlewares.use(createGithubMiddleware())}}}

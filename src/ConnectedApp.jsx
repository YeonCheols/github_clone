import {useCallback,useEffect,useRef,useState} from 'react';
import {App as Prototype} from './Prototype.jsx';
import {Dashboard} from './Dashboard.jsx';
import {repositoryRoute} from './repository-route.mjs';
import {accountPageRoute} from './account-page-route.mjs';
import {AccountPages} from './AccountPages.jsx';
import {ProfilePages} from './ProfilePages.jsx';
import {profilePageRoute} from './profile-route.mjs';

const normalizeIssue=i=>({number:i.number,title:i.title,body:i.body||'',author:i.user?.login||'unknown',state:i.state,labels:(i.labels||[]).map(l=>typeof l==='string'?l:l.name),comments:i.comments||0,time:new Date(i.created_at).toLocaleString(),url:i.html_url,avatar:i.user?.avatar_url,association:i.author_association,assignees:i.assignees||[],milestone:i.milestone});
const normalizeFiles=(items,ref,repoBase)=>items.map(f=>({name:f.name,path:f.path,type:f.type==='dir'?'dir':'file',ref,repoBase}));
export function ConnectedApp(){
 const [offline,setOffline]=useState(false),[session,setSession]=useState(null),[repository,setRepository]=useState(null),[error,setError]=useState(''),[needsAuth,setNeedsAuth]=useState(false),[connecting,setConnecting]=useState(true),[revision,setRevision]=useState(0);
 const [route,setRoute]=useState(location.hash.slice(1)||'/'),[issues,setIssues]=useState([]),[detail,setDetail]=useState(null),[comments,setComments]=useState({number:0,items:[],page:1,next:false}),[star,setStar]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[total,setTotal]=useState(0),[totals,setTotals]=useState({}),[hasMore,setHasMore]=useState(false);
 const [searchState,setSearch]=useState({q:'is:issue state:open',label:'',page:1}),[directoryFiles,setDirectoryFiles]=useState([]);
 const target=repositoryRoute(route),base=target?.base||'/morluto/rea',repositorySlug=target?.slug||'morluto/rea';
 const csrf=useRef(''),writeLock=useRef(false),routeRef=useRef(route);routeRef.current=route;
 const request=useCallback(async(path,{method='GET',body,signal}={})=>{
  const response=await fetch('/api/github'+path,{method,signal,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-Github-Session':csrf.current}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let value;try{value=await response.json()}catch{throw new Error('로컬 API 서버에 연결되지 않았습니다. 프리뷰 서버를 재시작해 주세요.')}
  if(!response.ok){const error=new Error(value.error||'GitHub 요청에 실패했습니다.');error.status=response.status;throw error}return value;
 },[]);
 const api=useCallback((path,options)=>request(/^\/(?:repository|contents|issues|star)(?:[/?]|$)/.test(path)?path+(path.includes('?')?'&':'?')+'repository='+encodeURIComponent(repositorySlug):path,options),[request,repositorySlug]);
 useEffect(()=>{const changed=()=>setRoute(location.hash.slice(1)||'/');addEventListener('hashchange',changed);return()=>removeEventListener('hashchange',changed)},[]);
 useEffect(()=>{
  if(offline)return;const abort=new AbortController();setConnecting(true);setError('');setNeedsAuth(false);setSession(null);setRepository(null);
  request('/session',{signal:abort.signal}).then(value=>{if(abort.signal.aborted)return;csrf.current=value.csrf;setSession(value)}).catch(e=>{if(!abort.signal.aborted){setError(e.message);setNeedsAuth(e.status===401)}}).finally(()=>{if(!abort.signal.aborted)setConnecting(false)});
  return()=>abort.abort();
 },[request,revision,offline]);
 useEffect(()=>{const aliases={'/issues':'/issues/assigned','/pulls':'/pulls/inbox'};if(aliases[route]){window.history.replaceState(null,'','#'+aliases[route]);setRoute(aliases[route])}},[route]);
 const isHome=['/','/dashboard','/home'].includes(route),isRepository=!!target?.supported;
 useEffect(()=>{
  if(!session||offline||!isRepository)return;const abort=new AbortController();setConnecting(true);setError('');setIssues([]);setDetail(null);setComments({number:0,items:[],page:1,next:false});setTotals({});setSearch(old=>({...old,page:1}));
  Promise.all([api('/repository',{signal:abort.signal}),api('/star',{signal:abort.signal})]).then(([repo,star])=>{if(abort.signal.aborted)return;setRepository({...repo,_slug:repositorySlug});setStar(star.starred);setDirectoryFiles([])}).catch(e=>{if(!abort.signal.aborted)setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setConnecting(false)});return()=>abort.abort();
 },[session,offline,isRepository,api,repositorySlug]);
 const number=Number(route.match(/\/issues\/(\d+)/)?.[1]);
 useEffect(()=>{
  if(!repository||repository._slug!==repositorySlug||offline||!route.split('?')[0].endsWith('/issues'))return;
  const abort=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(()=>{const q=searchState.q.replace(/\bis:issue\b/g,'').trim()+(searchState.label?' label:'+JSON.stringify(searchState.label):'');api('/issues?q='+encodeURIComponent(q)+'&page='+searchState.page,{signal:abort.signal}).then(value=>{if(abort.signal.aborted)return;setIssues(old=>searchState.page===1?value.items.map(normalizeIssue):[...new Map([...old,...value.items.map(normalizeIssue)].map(i=>[i.number,i])).values()]);setTotal(value.total);setHasMore(value.next);const state=/(?:is|state):closed/.test(q)?'closed':/(?:is|state):open/.test(q)?'open':null;if(state&&!searchState.label&&!q.replace(/(?:is|state):(?:open|closed)/g,'').trim())setTotals(old=>({...old,[state]:value.total}))}).catch(e=>{if(!abort.signal.aborted)setError(e.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)})},200);
  return()=>{clearTimeout(timer);abort.abort()};
 },[api,repository,offline,route,searchState]);
 useEffect(()=>{
  if(!repository||repository._slug!==repositorySlug||offline||!number)return;
  const abort=new AbortController();setDetail(null);setComments({number,items:[],page:1,next:false});setError('');
  Promise.all([api('/issues/'+number,{signal:abort.signal}),api('/issues/'+number+'/comments',{signal:abort.signal})]).then(([issue,comments])=>{if(abort.signal.aborted)return;setDetail(normalizeIssue(issue));setComments({number,items:comments.items.map(c=>({id:c.id,body:c.body,author:c.user.login,avatar:c.user.avatar_url,time:new Date(c.created_at).toLocaleString()})),page:1,next:comments.next})}).catch(e=>{if(!abort.signal.aborted)setError(e.message)});
  return()=>abort.abort();
 },[api,repository,offline,number]);
 const search=useCallback((q,label)=>setSearch(old=>old.q===q&&old.label===label?old:{q,label,page:1}),[]);
 const loadFile=useCallback(async(path,signal)=>{
  const value=await api('/contents?path='+encodeURIComponent(path)+'&ref='+encodeURIComponent(repository.repo.default_branch),{signal});
  if(signal?.aborted)return value;
  if(value.files)setDirectoryFiles(old=>[...new Map([...old,...normalizeFiles(value.files,repository.repo.default_branch,base)].map(f=>[f.path,f])).values()]);return value;
 },[api,repository,base]);
 const mutate=async work=>{
  if(writeLock.current)throw new Error('이전 작업이 처리 중입니다.');writeLock.current=true;setBusy(true);setError('');
  try{return await work()}catch(e){setError(e.message);throw e}finally{writeLock.current=false;setBusy(false)}
 };
 const live=repository&&repository._slug===repositorySlug?{
  ...repository,issues,detail:detail?.number===number?detail:null,comments:comments.number===number?comments.items:[],star,busy,loading,error,total,totals,hasMore,search,loadFile,
  more:()=>setSearch(old=>({...old,page:old.page+1})),moreComments:comments.number===number&&comments.next,
  canClose:detail?.author===session?.user.login||!!(repository.repo.permissions?.push||repository.repo.permissions?.maintain||repository.repo.permissions?.admin||repository.repo.permissions?.triage),
  loadMoreComments:()=>{const active=number;mutate(async()=>{const value=await api(`/issues/${active}/comments?page=${comments.page+1}`);if(!routeRef.current.startsWith(base+'/issues/')||Number(routeRef.current.match(/\/issues\/(\d+)/)?.[1])!==active)return;setComments(old=>({...old,page:old.page+1,next:value.next,items:[...old.items,...value.items.map(c=>({id:c.id,body:c.body,author:c.user.login,avatar:c.user.avatar_url,time:new Date(c.created_at).toLocaleString()}))]}))}).catch(()=>{})},
  create:(title,body)=>mutate(async()=>{const created=normalizeIssue(await api('/issues',{method:'POST',body:{title,body}}));if(repositoryRoute(routeRef.current)?.slug!==repositorySlug)return;setIssues(old=>[created,...old.filter(i=>i.number!==created.number)]);setDetail(created);location.hash=base+'/issues/'+created.number}),
  comment:body=>{const active=number;return mutate(async()=>{const c=await api(`/issues/${active}/comments`,{method:'POST',body:{body}});if(!routeRef.current.startsWith(base+'/issues/')||Number(routeRef.current.match(/\/issues\/(\d+)/)?.[1])!==active)return;setComments(old=>({...old,items:[...old.items,{id:c.id,body:c.body,author:c.user.login,avatar:c.user.avatar_url,time:new Date(c.created_at).toLocaleString()}]}))})},
  update:changes=>{const active=number;mutate(async()=>{const changed=normalizeIssue(await api('/issues/'+active,{method:'PATCH',body:{state:changes.state}}));if(repositoryRoute(routeRef.current)?.slug!==repositorySlug)return;setIssues(old=>old.map(i=>i.number===active?changed:i));if(routeRef.current.startsWith(base+'/issues/')&&Number(routeRef.current.match(/\/issues\/(\d+)/)?.[1])===active)setDetail(changed)}).catch(()=>{})},
  toggleStar:()=>mutate(async()=>{const value=await api('/star',{method:star?'DELETE':'PUT'});if(repositoryRoute(routeRef.current)?.slug!==repositorySlug)return;setStar(value.starred);setRepository(old=>({...old,repo:{...old.repo,stargazers_count:old.repo.stargazers_count+(value.starred?1:-1)}}))}).catch(()=>{}),
 }:null;
 const files=repository?[...new Map([...normalizeFiles(repository.files,repository.repo.default_branch,base),...directoryFiles].map(f=>[f.path,f])).values()]:[];
 const profilePage=profilePageRoute(route);
 if(profilePage)return <ProfilePages page={profilePage} api={request} user={session?.user} connecting={connecting} connectionError={error} retry={()=>setRevision(n=>n+1)}/>;
 const accountPage=accountPageRoute(route);
 if(accountPage)return <AccountPages key={accountPage.kind} page={accountPage} route={route} api={request} user={session?.user} connecting={connecting} connectionError={error} retry={()=>setRevision(n=>n+1)}/>;
 if(isHome)return <Dashboard api={api} user={session?.user} connecting={connecting} connectionError={error} offline={offline} retry={()=>{setOffline(false);setRevision(n=>n+1)}}/>;
 if(offline&&repositorySlug!=='morluto/rea')return <main className="connection-status"><a href="#/">GitHub Home</a><h1>이 저장소의 스냅샷은 없습니다.</h1><button className="btn" onClick={()=>setOffline(false)}>GitHub 연결</button></main>;
 if(!isRepository)return <main className="connection-status"><a href="#/">GitHub Home</a><h1>이 화면은 아직 재구현되지 않았습니다.</h1><a href={'https://github.com'+route} target="_blank" rel="noreferrer">GitHub에서 열기</a></main>;
 return <><div className="connection-bar"><strong>{offline?'Snapshot · 로컬 저장':session?'GitHub · '+session.user.login:'GitHub 연결'}</strong><span>{offline?'수집 당시 데이터':repositorySlug}</span><button onClick={()=>{setOffline(false);setRevision(n=>n+1)}} disabled={connecting&&!offline}>{connecting&&!offline?'Connecting…':offline?'GitHub 연결':'새로고침'}</button><button onClick={()=>setOffline(!offline)}>{offline?'실제 GitHub 모드':'스냅샷 모드'}</button>{session&&!offline&&<span>이 모드의 작성·변경은 GitHub에 반영됩니다.</span>}</div>{!offline&&error&&<div className="api-error" role="alert">{error}</div>}{offline?<Prototype key="snapshot"/>:repository&&repository._slug===repositorySlug&&session?<Prototype key={repositorySlug} repoBase={base} live={live} repoData={{files}}/>:<main className="connection-status"><h1>{connecting?'GitHub에 연결 중입니다.':'GitHub 연결을 확인해 주세요.'}</h1>{!connecting&&(needsAuth?<><p>일반 터미널에서 저장소 전용 인증을 실행한 뒤 위의 새로고침을 누르세요.</p><code>node /Users/ycseng/Desktop/sub_frontend/github_clone/scripts/github-local.mjs login</code></>:<p>프리뷰 서버와 네트워크 연결을 확인한 뒤 위의 새로고침을 누르세요.</p>)}</main>}</>;
}

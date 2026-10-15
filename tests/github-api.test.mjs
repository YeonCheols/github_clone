import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createGithubMiddleware,ApiError} from '../server/github-api.mjs';

function harness(overrides={}){
 const calls=[];
 const request=async(endpoint,method='GET',body)=>{calls.push({endpoint,method,body});if(overrides.request)return overrides.request(endpoint,method,body);if(endpoint==='user')return {data:{login:'YeonCheols',avatar_url:'avatar'}};if(endpoint==='repos/morluto/rea')return {data:{default_branch:'main',temp_clone_token:'never-return',owner:{login:'morluto',avatar_url:'avatar'}}};if(endpoint.includes('/contents'))return {data:[{name:'README.md',path:'README.md',type:'file'}]};if(endpoint.includes('/readme'))return {data:{content:Buffer.from('# Live README').toString('base64')}};if(endpoint.includes('/commits'))return {data:[{sha:'abc'}]};if(endpoint.includes('/languages'))return {data:{JavaScript:100}};if(endpoint.startsWith('search/'))return {data:{items:[],total_count:0},next:true};return {data:body||{number:42},next:true}};
 const middleware=createGithubMiddleware({request});
 async function send(path,options={}){const req=Readable.from(options.raw!==undefined?[options.raw]:options.body===undefined?[]:[JSON.stringify(options.body)]);req.url='/api/github'+path;req.method=options.method||'GET';req.headers={host:'127.0.0.1:4173',...options.headers};if(options.body!==undefined)req.headers['content-type']='application/json';let output;const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){output=v}};await middleware(req,res,()=>{throw Error('unexpected next')});return {status:res.statusCode,value:JSON.parse(output),headers:res.headers}}
 return {calls,send};
}

test('session exposes expected account and CSRF, never credential data',async()=>{
 const h=harness();const r=await h.send('/session');assert.equal(r.status,200);assert.equal(r.value.user.login,'YeonCheols');assert.equal(r.value.csrf.length,64);assert.equal(r.headers['Cache-Control'],'no-store');assert.deepEqual(Object.keys(r.value).sort(),['csrf','repository','user']);
});
test('repository loads actual contents, README and latest commit',async()=>{const h=harness();const r=await h.send('/repository');assert.equal(r.value.readme,'# Live README');assert.equal(r.value.files[0].name,'README.md');assert.equal(r.value.commit.sha,'abc');assert.equal(r.value.repo.temp_clone_token,undefined)});
test('search scopes repository, preserves pagination and rejects scope injection',async()=>{const h=harness();const r=await h.send('/issues?q=state%3Aclosed&page=2');assert.equal(r.value.next,true);assert.match(decodeURIComponent(h.calls.at(-1).endpoint),/repo:morluto\/rea is:issue state:closed/);assert.match(h.calls.at(-1).endpoint,/page=2/);for(const q of ['repo:other/private','OR test'])assert.equal((await h.send('/issues?q='+encodeURIComponent(q))).status,400)});
test('writes require same-origin session and forward only permitted fields',async()=>{const h=harness();assert.equal((await h.send('/issues',{method:'POST',body:{title:'No token'}})).status,403);assert.equal(h.calls.length,0);const {value}=await h.send('/session');const headers={'x-github-session':value.csrf,origin:'http://127.0.0.1:4173'};const r=await h.send('/issues',{method:'POST',headers,body:{title:'Real title',body:'text',assignees:['admin'],unexpected:'ignore'}});assert.equal(r.status,200);assert.deepEqual(h.calls.at(-1),{endpoint:'repos/morluto/rea/issues',method:'POST',body:{title:'Real title',body:'text'}});assert.equal(h.calls.filter(c=>c.endpoint==='user').length,2)});
test('origin, cross-site, host and account checks precede resource access',async()=>{for(const headers of [{host:'attacker.example'},{origin:'https://attacker.example'},{'sec-fetch-site':'cross-site'}]){const h=harness();assert.equal((await h.send('/session',{headers})).status,403);assert.equal(h.calls.length,0)}const h=harness({request:async()=>({data:{login:'WrongAccount'}})});assert.equal((await h.send('/repository')).status,403);assert.equal(h.calls.length,1)});
test('state changes, comments and star use fixed endpoints and propagate permission failure',async()=>{const h=harness();const {value}=await h.send('/session');const headers={'x-github-session':value.csrf};assert.equal((await h.send('/issues/42',{method:'PATCH',headers,body:{state:'closed'}})).status,200);assert.equal(h.calls.at(-1).endpoint,'repos/morluto/rea/issues/42');assert.equal((await h.send('/issues/42/comments',{method:'POST',headers,body:{body:'Comment'}})).status,200);assert.equal(h.calls.at(-1).endpoint,'repos/morluto/rea/issues/42/comments');assert.equal((await h.send('/star',{method:'PUT',headers})).status,200);assert.equal(h.calls.at(-1).endpoint,'user/starred/morluto/rea');const denied=harness({request:async endpoint=>{if(endpoint==='user')return {data:{login:'YeonCheols'}};throw new ApiError(403,'Permission denied')}});const r=await denied.send('/issues/42');assert.equal(r.status,403);assert.equal(r.value.error,'Permission denied')});
test('validation rejects invalid state, empty input, traversal, invalid pagination and unknown proxy paths',async()=>{const h=harness();const {value}=await h.send('/session');const headers={'x-github-session':value.csrf};for(const [path,body] of [['/issues',{title:' '}],['/issues/42',{state:'deleted'}],['/issues/42/comments',{body:''}]])assert.equal((await h.send(path,{method:path==='/issues/42'?'PATCH':'POST',headers,body})).status,400);assert.equal((await h.send('/issues',{method:'POST',headers,body:null})).status,400);assert.equal((await h.send('/issues?page=-1')).status,400);assert.equal((await h.send('/contents?path=../secret')).status,400);assert.equal((await h.send('/user/repos')).status,404);assert.equal((await h.send('/issues',{method:'POST',headers:{...headers,'content-type':'application/json'},raw:'a'.repeat(65537)})).status,413)});


test('account dashboard uses authenticated repository and assignment queries without leaking repository tokens',async()=>{
 const h=harness({request:async endpoint=>{
  if(endpoint==='user')return {data:{login:'YeonCheols'}};
  if(endpoint.startsWith('user/repos?'))return {data:[{id:1,full_name:'YeonCheols/example',html_url:'https://github.com/YeonCheols/example',temp_clone_token:'never-return',owner:{login:'YeonCheols'}}],next:true};
  return {data:{items:[{id:2,number:3,title:'Assigned item',html_url:'https://github.com/YeonCheols/example/issues/3'}],total_count:1}};
 }});
 const r=await h.send('/dashboard?page=2&filter=created');assert.equal(r.status,200);assert.equal(r.value.repositories.next,true);assert.equal(r.value.repositories.items[0].temp_clone_token,undefined);assert.equal(r.value.issues.total,1);assert.ok(h.calls.some(c=>decodeURIComponent(c.endpoint).includes('author:YeonCheols')));assert.equal((await h.send('/dashboard?filter=invalid')).status,400);
});

test('selected repository scopes content reads and writes; invalid slugs cannot become API paths',async()=>{
 const h=harness();const session=await h.send('/session');const headers={'x-github-session':session.value.csrf};
 await h.send('/issues/42?repository=YeonCheols%2Fgithub_clone');assert.equal(h.calls.at(-1).endpoint,'repos/YeonCheols/github_clone/issues/42');
 await h.send('/issues?repository=YeonCheols%2Fgithub_clone',{method:'POST',headers,body:{title:'Selected repo',body:'Body'}});assert.equal(h.calls.at(-1).endpoint,'repos/YeonCheols/github_clone/issues');
 for(const slug of ['../secret','owner/name/extra','https://example.com/repo','owner/..'])assert.equal((await h.send('/repository?repository='+encodeURIComponent(slug))).status,400);
});

test('profile endpoints expose only public fields and restrict account updates to supported fields',async()=>{
 const writes=[];let name='Original';
 const h=harness({request:async(endpoint,method='GET',body)=>{
  if(endpoint==='user'){if(method==='PATCH'){writes.push(body);name=body.name??name}return {data:{login:'YeonCheols',name,email:'private@example.com',two_factor_authentication:true,plan:{name:'private'}}}}
  throw new Error(endpoint);
 }});
 const session=await h.send('/session'),headers={'x-github-session':session.value.csrf};
 const initial=await h.send('/settings/profile');assert.equal(initial.value.name,'Original');assert.equal(initial.value.email,undefined);assert.equal(initial.value.plan,undefined);
 assert.equal((await h.send('/settings/profile',{method:'PATCH',body:{name:'New'}})).status,403);
 const result=await h.send('/settings/profile',{method:'PATCH',headers,body:{name:'New',bio:'Hello',email:'do-not-forward@example.com',unexpected:'secret'}});
 assert.equal(result.status,200);assert.deepEqual(writes,[{name:'New',bio:'Hello'}]);assert.equal(result.value.name,'New');assert.equal(result.value.email,undefined);
 for(const body of [{bio:'x'.repeat(161)},{hireable:'yes'},{blog:'javascript:alert(1)'},{email:'not-supported'}])assert.equal((await h.send('/settings/profile',{method:'PATCH',headers,body})).status,400);
 assert.equal(writes.length,1);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://127.0.0.1:4173/#/morluto/rea'});
for(const name of ['window','document','location','localStorage','HTMLElement','Event','MouseEvent'])globalThis[name]=dom.window[name];
globalThis.addEventListener=window.addEventListener.bind(window);
globalThis.removeEventListener=window.removeEventListener.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.fetch=async path=>new Response(await readFile(new URL('../public'+path,import.meta.url),'utf8'));
const {act,createElement}=await import('react');
const {createRoot}=await import('react-dom/client');
const {App}=await import('../.qa/ssr/App.js');
const host=document.getElementById('root');
let root;
let copied;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text}}}});
const button=(text)=>[...host.querySelectorAll('button')].find(x=>x.textContent.trim()===text);
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
async function click(el){assert.ok(el,'click target exists');await act(async()=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));await tick()})}
async function type(el,value){assert.ok(el);await act(async()=>{const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await tick()})}
async function route(path){await act(async()=>{location.hash=path;await tick()})}

test('repository → file preview/code → issue filters → local creation/comment/status survive remount',async()=>{
 await act(async()=>{root=createRoot(host);root.render(createElement(App));await tick()});
 assert.match(host.textContent,/Reverse engineer anything/);
 assert.ok(host.querySelector('a[href="#/morluto/rea/blob/main/README.md"]'));
 const codeToggle=host.querySelector('.code-menu>button');
 await click(codeToggle);
 assert.equal(codeToggle.getAttribute('aria-expanded'),'true');
 assert.equal(host.querySelector('.backdrop'),null);
 assert.equal(host.querySelector('[aria-label="Clone address"]').value,'https://github.com/morluto/rea.git');
 await click(button('SSH'));
 assert.equal(host.querySelector('[aria-label="Clone address"]').value,'git@github.com:morluto/rea.git');
 await click(host.querySelector('.clone-address [aria-label="Copy to clipboard"]'));
 assert.equal(copied,'git@github.com:morluto/rea.git');
 assert.ok(host.querySelector('.clone-address [aria-label="Copied!"].copied'));
 await click(button('GitHub CLI'));
 assert.equal(host.querySelector('[aria-label="Clone address"]').value,'gh repo clone morluto/rea');
 assert.ok(host.querySelector('.clone-address [aria-label="Copy to clipboard"]'));
 await click(button('Codespaces'));
 assert.match(host.querySelector('.clone-codespaces').textContent,/Sign in to GitHub/);
 await act(async()=>{document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick()});
 assert.equal(host.querySelector('.clone-panel'),null);
 assert.equal(document.activeElement,codeToggle);
 await click(codeToggle);
 await act(async()=>{document.body.dispatchEvent(new Event('pointerdown',{bubbles:true}));await tick()});
 assert.equal(host.querySelector('.clone-panel'),null);

 await route('/morluto/rea/blob/main/README.md');
 assert.match(host.querySelector('.markdown').textContent,/REA: Reverse Engineer Anything/);
 await click(button('Code'));
 assert.match(host.querySelector('.source-code').textContent,/Reverse Engineer Anything/);
 await route('/morluto/rea/issues');
 assert.ok(host.querySelectorAll('.issue-row').length>5);
 await type(host.querySelector('[aria-label="Search issues"]'),'Getter-result');
 assert.equal(host.querySelectorAll('.issue-row').length,1);
 await route('/morluto/rea/issues/3839');
 assert.match(host.querySelector('.detail-title').textContent,/#3839/);
 assert.match(host.querySelector('.comment-body').textContent,/RangeError/);
 await click(button('New issue'));
 const dialog=host.querySelector('[role="dialog"]');assert.ok(dialog);
 await type(dialog.querySelector('input'),'Local issue integration test');
 await type(dialog.querySelector('textarea'),'Local-only issue body');
 await act(async()=>{dialog.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()});
 assert.match(host.querySelector('.detail-title').textContent,/Local issue integration test/);
 const newPath=location.hash;
 await type(host.querySelector('[aria-label="Comment"]'),'A persisted local comment');
 await act(async()=>{host.querySelector('.comment-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()});
 assert.match(host.textContent,/A persisted local comment/);
 await click(button('Close issue'));
 assert.match(host.querySelector('.status').textContent,/Closed/);
 await act(async()=>{root.unmount();await tick()});
 assert.equal(location.hash,newPath);
 await act(async()=>{root=createRoot(host);root.render(createElement(App));await tick()});
 assert.match(host.querySelector('.detail-title').textContent,/Local issue integration test/);
 assert.match(host.textContent,/A persisted local comment/);
 assert.match(host.querySelector('.status').textContent,/Closed/);
 await act(async()=>{root.unmount();await tick()});
});

test('connected mode reads API data and persists writes through server; failures retain input',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');
 const calls=[];let rejectCreate=true,rejectComment=false;
 const fixture={number:77,title:'Live API issue',body:'Current GitHub body',user:{login:'YeonCheols'},state:'open',labels:[],comments:0,created_at:'2026-10-15T00:00:00Z',author_association:'NONE'};
 const rows=[fixture],discussion=[];
 const priorStorage=localStorage.getItem('gh-preview-issues-v1');
 globalThis.fetch=async(path,options={})=>{
  calls.push({path,options});let value,status=200;const url=new URL(path,'http://127.0.0.1:4173');const body=options.body?JSON.parse(options.body):{};
  if(url.pathname==='/api/github/session')value={user:{login:'YeonCheols'},csrf:'test-session',repository:'morluto/rea'};
  else if(url.pathname==='/api/github/repository')value={repo:{default_branch:'main',forks_count:12,stargazers_count:34,description:'Current repository',owner:{},topics:[],permissions:{push:false}},files:[{name:'README.md',path:'README.md',type:'file'}],readme:'# Current API README',commit:null,languages:{JavaScript:100}};
  else if(url.pathname==='/api/github/star')value={starred:options.method==='PUT'};
  else if(url.pathname==='/api/github/contents')value={content:'# File from GitHub API'};
  else if(url.pathname==='/api/github/issues'&&options.method==='POST'){
   if(rejectCreate){status=403;value={error:'Write permission denied'}}else{const issue={...fixture,...body,number:78};rows.push(issue);value=issue}
  }else if(url.pathname==='/api/github/issues')value={items:rows,total:rows.length,next:false};
  else if(url.pathname.endsWith('/comments')){
   if(options.method==='POST'){if(rejectComment){status=403;value={error:'Comment permission denied'}}else{value={id:1,body:body.body,user:{login:'YeonCheols'},created_at:fixture.created_at};discussion.push(value)}}else value={items:discussion,next:false};
  }else if(/\/issues\/\d+$/.test(url.pathname)){
   value=rows.find(i=>i.number===Number(url.pathname.split('/').at(-1)));if(options.method==='PATCH')value.state=body.state;
  }else throw Error('Unexpected fetch '+path);
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 };
 await route('/morluto/rea');
 await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});
 assert.match(host.textContent,/Current API README/);assert.match(host.textContent,/GitHub · YeonCheols/);
 await route('/morluto/rea/blob/main/README.md');await act(tick);
 assert.match(host.querySelector('.markdown').textContent,/File from GitHub API/);
 await route('/morluto/rea/issues');await act(async()=>{await new Promise(r=>setTimeout(r,260))});
 assert.match(host.querySelector('.issue-row').textContent,/Live API issue/);
 await route('/morluto/rea/issues/77');await act(tick);
 assert.match(host.querySelector('.comment-body').textContent,/Current GitHub body/);
 await click(button('New issue'));
 let dialog=host.querySelector('[role="dialog"]');
 await type(dialog.querySelector('input'),'API-created issue');await type(dialog.querySelector('textarea'),'API body');
 const submit=async()=>{await act(async()=>{host.querySelector('.new-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()})};
 await submit();assert.match(host.querySelector('.new-form [role="alert"]').textContent,/Write permission denied/);assert.equal(host.querySelector('.new-form input').value,'API-created issue');
 rejectCreate=false;await submit();await act(tick);
 assert.match(host.querySelector('.detail-title').textContent,/API-created issue/);
 await type(host.querySelector('[aria-label="Comment"]'),'API comment');rejectComment=true;
 const sendComment=async()=>{await act(async()=>{host.querySelector('.comment-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()})};
 await sendComment();assert.equal(host.querySelector('[aria-label="Comment"]').value,'API comment');
 rejectComment=false;await sendComment();assert.match(host.textContent,/API comment/);assert.equal(host.querySelector('[aria-label="Comment"]').value,'');
 await click(button('Close issue'));assert.equal(rows.find(i=>i.number===78).state,'closed');assert.match(host.querySelector('.status').textContent,/Closed/);
 assert.equal(localStorage.getItem('gh-preview-issues-v1'),priorStorage);
 for(const {options}of calls.filter(c=>['POST','PATCH'].includes(c.options.method)))assert.equal(options.headers['X-Github-Session'],'test-session');
 await act(async()=>{root.unmount();await tick()});
 await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await act(tick);
 assert.match(host.querySelector('.status').textContent,/Closed/);assert.match(host.textContent,/API comment/);
 await route('/morluto/rea');await click(button('스냅샷 모드'));assert.match(host.textContent,/Reverse engineer anything/);
 await route('/morluto/rea/issues');assert.ok(host.querySelectorAll('.issue-row').length>0);
 await act(async()=>{root.unmount();await tick()});
});

test('empty URL stays on account home; menus, repository search and repository/home navigation work',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');const calls=[];
 const repos=Array.from({length:12},(_,i)=>({id:i,full_name:i===0?'morluto/rea':'YeonCheols/repo-'+i,html_url:i===0?'https://github.com/morluto/rea':'https://github.com/YeonCheols/repo-'+i,owner:{login:'YeonCheols'}}));
 globalThis.fetch=async(path)=>{calls.push(path);let value;if(path==='/api/github/session')value={user:{login:'YeonCheols'},csrf:'test',repository:'morluto/rea'};else if(path.startsWith('/api/github/dashboard'))value={repositories:{items:repos,next:false},issues:{items:[],total:0},pulls:{items:[],total:0}};else if(path.split('?')[0]==='/api/github/repository')value={repo:{default_branch:'main',forks_count:0,stargazers_count:0,owner:{},topics:[]},files:[],readme:'# Current repository',languages:{},commit:null};else if(path.split('?')[0]==='/api/github/star')value={starred:false};else throw Error(path);return new Response(JSON.stringify(value),{status:200})};
 await route('');await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await act(tick);
 assert.equal(location.hash,'');assert.match(host.querySelector('h1').textContent,/Good afternoon, YeonCheols/);assert.equal(calls.some(p=>p==='/api/github/repository'),false);
 assert.equal(host.querySelectorAll('.dash-repository-list li').length,10);
 await click(button('Show more'));assert.equal(host.querySelectorAll('.dash-repository-list li').length,12);
 await type(host.querySelector('[aria-label="Find a repository"]'),'morluto/rea');assert.equal(host.querySelectorAll('.dash-repository-list li').length,1);
 await click(host.querySelector('[aria-label="Open user navigation menu"]'));
 assert.ok(host.querySelector('[aria-label="User navigation"] a[href="#/YeonCheols"]'));
 await act(async()=>{document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick()});assert.equal(host.querySelector('.dash-menu'),null);
 await click(host.querySelector('[aria-label="Open menu"]'));await click(host.querySelector('.dash-menu a[href="#/morluto/rea"]'));await act(tick);
 assert.match(host.querySelector('.readme-box').textContent,/Current repository/);
 await click(host.querySelector('[aria-label="GitHub home"]'));await act(tick);assert.ok(host.querySelector('.dashboard-app'));assert.equal(location.hash,'#/');
 await act(async()=>{root.unmount();await tick()});
});


test('switching repositories uses their own API scope, default branch and clone URLs',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');const calls=[];
 globalThis.fetch=async(path,options={})=>{const u=new URL(path,'http://127.0.0.1:4173');const slug=u.searchParams.get('repository');calls.push({path:u.pathname,slug});let value;
  if(u.pathname==='/api/github/session')value={user:{login:'YeonCheols'},csrf:'test'};
  else if(u.pathname==='/api/github/repository')value={repo:{full_name:slug,default_branch:slug==='YeonCheols/github_clone'?'master':'main',forks_count:0,stargazers_count:0,private:true,owner:{},topics:[]},files:[{name:'README.md',path:'README.md',type:'file'}],readme:'# '+slug,languages:{},commit:null};
  else if(u.pathname==='/api/github/star')value={starred:false};else if(u.pathname==='/api/github/contents')value={content:'# Current '+slug};else throw Error(path);
  return new Response(JSON.stringify(value),{status:200})};
 await route('/YeonCheols/github_clone');await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await act(tick);
 assert.match(host.querySelector('.repo-heading').textContent,/github_clone.*Private/);
 assert.ok(host.querySelector('a[href="#/YeonCheols/github_clone/blob/master/README.md"]'));
 await click(host.querySelector('.code-menu>button'));assert.equal(host.querySelector('[aria-label="Clone address"]').value,'https://github.com/YeonCheols/github_clone.git');
 await route('/YeonCheols/github_clone/blob/master/README.md');await act(tick);assert.match(host.querySelector('.markdown').textContent,/Current YeonCheols\/github_clone/);
 await route('/morluto/rea');await act(tick);assert.match(host.querySelector('.readme-box').textContent,/morluto\/rea/);
 assert.ok(calls.some(c=>c.path==='/api/github/contents'&&c.slug==='YeonCheols/github_clone'));assert.ok(calls.some(c=>c.path==='/api/github/repository'&&c.slug==='morluto/rea'));
 await act(async()=>{root.unmount();await tick()});
});

test('global repository, issue and PR pages use live requests, filters and the local new-issue handoff',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');const calls=[];
 const repo={id:'r1',full_name:'YeonCheols/github_clone',html_url:'https://github.com/YeonCheols/github_clone',private:false,description:'Working clone',starred:false,updated_at:'2026-10-15T00:00:00Z',forks_count:0,stargazers_count:0,issues:1,pulls:0,language:null,license:null,can_open_issue:true};
 globalThis.fetch=async(path,options={})=>{const u=new URL(path,'http://127.0.0.1:4173');calls.push({path:u.pathname,params:u.searchParams,method:options.method});let value;
  if(u.pathname==='/api/github/session')value={user:{login:'YeonCheols'},csrf:'test'};
  else if(u.pathname==='/api/github/account-repositories')value={items:!u.searchParams.get('q')||repo.full_name.includes(u.searchParams.get('q'))?[repo]:[],total:1,next:false,cursor:null,filteredPage:!!u.searchParams.get('q')};
  else if(u.pathname==='/api/github/account-items')value={items:[{id:1,title:u.searchParams.get('state')==='closed'?'Closed global issue':'Open global issue',number:11,html_url:'https://github.com/YeonCheols/github_clone/issues/11',labels:[],user:{login:'YeonCheols'},comments:0,updated_at:'2026-10-15T00:00:00Z'}],total:1,counts:{open:1,closed:1},next:false};
  else if(u.pathname==='/api/github/pull-inbox')value={groups:['review','drafts','waiting','action','ready'].map(id=>({id,title:{review:'Needs your review',drafts:'Your drafts',waiting:'Waiting for review or checks',action:'Needs action',ready:'Ready to merge'}[id],total:0,items:[]})),limitations:['Team coverage is unavailable.']};
  else if(u.pathname==='/api/github/star')value={starred:options.method==='PUT'};
  else if(u.pathname==='/api/github/repository')value={repo:{full_name:'YeonCheols/github_clone',default_branch:'master',forks_count:0,stargazers_count:0,owner:{},topics:[]},files:[],readme:'',languages:{},commit:null};
  else if(u.pathname==='/api/github/issues')value={items:[],total:0,next:false};
  else throw Error('Unexpected '+path);
  return new Response(JSON.stringify(value),{status:200});
 };
 const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,330))});
 await route('/repos');await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await settle();
 assert.match(host.querySelector('.repository-index').textContent,/Working clone/);
 assert.equal(host.querySelector('.account-repo-row h2 a').getAttribute('href'),'#/YeonCheols/github_clone');
 await click(host.querySelector('[aria-label="Star YeonCheols/github_clone"]'));assert.equal(host.querySelector('[aria-label="Star YeonCheols/github_clone"]').getAttribute('aria-pressed'),'true');assert.ok(calls.some(c=>c.path==='/api/github/star'&&c.params.get('repository')==='YeonCheols/github_clone'&&c.method==='PUT'));
 await click(host.querySelector('.account-sidebar a[href="#/repos?q=owner%3A%40me"]'));await settle();assert.match(host.querySelector('.account-title h1').textContent,/My repositories/);assert.ok(calls.some(c=>c.path==='/api/github/account-repositories'&&c.params.get('view')==='owner'));
 await type(host.querySelector('[aria-label="Search repositories"]'),'missing');await settle();assert.match(host.querySelector('.account-empty').textContent,/No repositories/);
 await route('/issues');await settle();assert.equal(location.hash,'#/issues/assigned');assert.match(host.querySelector('.account-item-row').textContent,/Open global issue/);
 await click([...host.querySelectorAll('.account-toolbar>button')].find(b=>b.textContent.startsWith('Closed')));await settle();assert.match(host.querySelector('.account-item-row').textContent,/Closed global issue/);
 await click(button('New issue'));await settle();assert.ok(host.querySelector('[aria-label="Select repository for new issue"]'));
 await click(host.querySelector('.account-picker-items a'));await settle();assert.equal(location.hash,'#/YeonCheols/github_clone/issues?new=1');assert.ok(host.querySelector('.new-form'));
 await route('/pulls');await settle();assert.equal(location.hash,'#/pulls/inbox');assert.match(host.querySelector('.pull-inbox-groups').textContent,/Needs your review/);assert.match(host.querySelector('.pull-inbox-groups').textContent,/—/);
 await click(host.querySelector('.pull-inbox-groups summary'));assert.ok(host.querySelector('.pull-inbox-groups details').open);
 await click(host.querySelector('[aria-label="Dismiss tip"]'));assert.equal(host.querySelector('.pull-inbox-tip'),null);
 await click(button('Select repositories'));await type(host.querySelector('.account-repo-filter input'),'YeonCheols/github_clone');await act(async()=>{host.querySelector('.account-repo-filter').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()});await settle();assert.ok(calls.some(c=>c.path==='/api/github/pull-inbox'&&c.params.get('repo')==='YeonCheols/github_clone'));
 await route('/pulls/authored');await settle();assert.match(host.querySelector('.account-title h1').textContent,/Authored by me/);assert.ok(calls.some(c=>c.path==='/api/github/account-items'&&c.params.get('kind')==='pr'&&c.params.get('view')==='authored'));
 await act(async()=>{root.unmount();await tick()});
});

test('global pages ignore stale responses and preserve server state after denied writes',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');let releaseAssigned,assignedStarted=false;
 const repo={id:'r',full_name:'YeonCheols/github_clone',private:false,starred:false,stargazers_count:2,forks_count:0,issues:0,pulls:0,updated_at:'2026-10-15',description:'Permission check'};
 const rows=title=>({items:[{id:1,title,number:1,html_url:'https://github.com/YeonCheols/github_clone/issues/1',labels:[],user:{login:'YeonCheols'},comments:0,updated_at:'2026-10-15'}],total:1,counts:{open:1,closed:0},next:false});
 globalThis.fetch=async(path,options={})=>{
  const u=new URL(path,'http://127.0.0.1:4173');let value;
  if(u.pathname.endsWith('/session'))value={user:{login:'YeonCheols'},csrf:'test'};
  else if(u.pathname.endsWith('/account-items')){
   if(u.searchParams.get('view')==='assigned'){assignedStarted=true;return new Promise(resolve=>{releaseAssigned=()=>resolve(new Response(JSON.stringify(rows('Stale assigned issue'))))})}
   value=rows('Current created issue');
  }else if(u.pathname.endsWith('/account-repositories'))value={items:[repo],total:1,next:false};
  else if(u.pathname.endsWith('/star'))return new Response(JSON.stringify({error:'Star permission denied'}),{status:403});
  else if(u.pathname.endsWith('/pull-inbox'))return new Response(JSON.stringify({error:'PR service unavailable'}),{status:502});
  else throw Error(path);
  return new Response(JSON.stringify(value));
 };
 const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,330))});
 await route('/issues/assigned');await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await settle();assert.equal(assignedStarted,true);
 await route('/issues/created');await settle();assert.match(host.textContent,/Current created issue/);
 await act(async()=>{releaseAssigned();await tick()});assert.doesNotMatch(host.textContent,/Stale assigned issue/);assert.match(host.textContent,/Current created issue/);
 await route('/repos');await settle();const star=host.querySelector('[aria-label="Star YeonCheols/github_clone"]');assert.equal(star.getAttribute('aria-pressed'),'false');
 await click(star);assert.match(host.querySelector('[role="alert"]').textContent,/Star permission denied/);assert.equal(star.getAttribute('aria-pressed'),'false');assert.equal(star.textContent,'2');assert.equal(star.disabled,false);
 await route('/pulls/inbox');await settle();assert.match(host.querySelector('[role="alert"]').textContent,/PR service unavailable/);assert.equal(host.querySelectorAll('.pull-inbox-groups details').length,0);assert.equal(host.querySelector('.pull-inbox-groups').getAttribute('data-ready'),'false');
 await act(async()=>{root.unmount();await tick()});
});

test('profile tabs load account data and public profile editing preserves denied input and saves allowed fields',async()=>{
 const {ConnectedApp}=await import('../.qa/ssr/App.js');const calls=[];let deny=true;
 let profile={login:'YeonCheols',name:'Original name',bio:'Original bio',avatar_url:'https://avatars.githubusercontent.com/u/1',followers:1,following:0};
 globalThis.fetch=async(path,options={})=>{const u=new URL(path,'http://127.0.0.1:4173');calls.push({path:u.pathname,method:options.method,body:options.body,headers:options.headers});let value;
  if(u.pathname.endsWith('/session'))value={user:{login:'YeonCheols',name:profile.name},csrf:'profile-csrf'};
  else if(u.pathname.endsWith('/settings/profile')){if(options.method==='PATCH'){if(deny)return new Response(JSON.stringify({error:'Profile permission denied'}),{status:403});profile={...profile,...JSON.parse(options.body)}}value=profile;}
  else if(u.pathname.endsWith('/profile'))value={profile,readme:'# Current profile README',overview:{repositories:3,stars:1,pinned:[],calendar:{totalContributions:4,weeks:[{contributionDays:[{date:'2026-10-15',contributionCount:4,color:'#238636'}]}]}}};
  else if(u.pathname.endsWith('/profile-repositories'))value={items:[{id:1,full_name:'YeonCheols/github_clone',description:'Profile repo',updated_at:'2026-10-15',stargazers_count:1,forks_count:0}],next:false};
  else if(u.pathname.endsWith('/star'))value={starred:false};else throw Error(path);
  return new Response(JSON.stringify(value));
 };
 const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,330))});
 await route('/YeonCheols');await act(async()=>{root=createRoot(host);root.render(createElement(ConnectedApp));await tick()});await settle();
 assert.match(host.querySelector('.profile-readme').textContent,/Current profile README/);assert.equal(host.querySelector('.profile-calendar span').getAttribute('title'),'2026-10-15: 4 contributions');assert.match(host.querySelector('.profile-sidebar').textContent,/Original name/);
 await click(host.querySelector('.profile-tabs a[href="#/YeonCheols?tab=repositories"]'));await settle();assert.equal(host.querySelector('.profile-repositories h2 a').getAttribute('href'),'#/YeonCheols/github_clone');
 await click(host.querySelector('.profile-tabs a[href="#/YeonCheols?tab=stars"]'));await settle();await click(host.querySelector('[aria-label="Unstar YeonCheols/github_clone"]'));assert.match(host.querySelector('.profile-repositories').textContent,/No repositories/);
 await click(host.querySelector('.profile-edit'));await settle();assert.ok(host.querySelector('form[aria-label="Public profile"]'));
 const input=()=>[...host.querySelectorAll('.settings-profile-grid label')].find(l=>l.textContent.startsWith('Name')).querySelector('input');
 await type(input(),'Updated name');const save=async()=>act(async()=>{host.querySelector('form[aria-label="Public profile"]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick()});
 await save();assert.match(host.querySelector('[role="alert"]').textContent,/Profile permission denied/);assert.equal(input().value,'Updated name');
 deny=false;await save();assert.match(host.querySelector('.profile-success').textContent,/Profile updated on GitHub/);assert.equal(profile.name,'Updated name');const write=calls.findLast(c=>c.method==='PATCH');assert.equal(write.headers['X-Github-Session'],'profile-csrf');assert.deepEqual(JSON.parse(write.body),{name:'Updated name'});
 await route('/YeonCheols');await settle();assert.match(host.querySelector('.profile-sidebar').textContent,/Updated name/);
 await act(async()=>{root.unmount();await tick()});
});

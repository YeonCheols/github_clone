import {ApiError} from './api-error.mjs';
const bounded=(value,max=1000)=>{if(typeof value!=='string'||value.length>max)throw new ApiError(400,'입력값을 확인해 주세요.');return value.trim()};
const pageOf=params=>{const page=Number(params.get('page')||1);if(!Number.isInteger(page)||page<1||page>34)throw new ApiError(400,'잘못된 페이지입니다.');return page};
const repoFields=`id nameWithOwner url isPrivate description isFork isArchived hasIssuesEnabled viewerPermission viewerHasStarred updatedAt forkCount stargazerCount primaryLanguage { name color } licenseInfo { name spdxId } issues(states:OPEN) { totalCount } pullRequests(states:OPEN) { totalCount } owner { login avatarUrl }`;
export async function accountRepositories(request,params){
 const view=params.get('view')||'contributed',sort=params.get('sort')||'relevance',after=params.get('after')||null;
 if(!['contributed','owner','forks','admin'].includes(view)||!['relevance','updated','name','stars'].includes(sort))throw new ApiError(400,'잘못된 저장소 필터입니다.');
 if(after!==null)bounded(after,512);
 const fields={updated:'UPDATED_AT',name:'NAME',stars:'STARGAZERS',relevance:'UPDATED_AT'};
 const ordering=view==='contributed'&&sort==='relevance'?'':`, orderBy:{field:${fields[sort]},direction:${sort==='name'?'ASC':'DESC'}}`;
 const collection=view==='contributed'?`repositoriesContributedTo(first:30,after:$after,includeUserRepositories:true,contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]${ordering})`:`repositories(first:30,after:$after${view==='owner'||view==='forks'?',ownerAffiliations:[OWNER]':''}${view==='forks'?',isFork:true':''}${ordering})`;
 const response=await request('graphql','POST',{query:`query AccountRepositories($after:String){viewer { result:${collection} { totalCount pageInfo { hasNextPage endCursor } nodes { ${repoFields} } } }}`,variables:{after}});
 const result=response.data?.data?.viewer?.result;
 if(response.data?.errors?.length||!result)throw new ApiError(502,'계정 저장소를 조회하지 못했습니다. 권한과 연결 상태를 확인해 주세요.');
 const q=bounded(params.get('q')||'').toLowerCase();
 const items=result.nodes.filter(Boolean).filter(r=>view!=='admin'||r.viewerPermission==='ADMIN').filter(r=>!q||`${r.nameWithOwner} ${r.description||''}`.toLowerCase().includes(q)).map(r=>({id:r.id,full_name:r.nameWithOwner,html_url:r.url,private:r.isPrivate,description:r.description,isFork:r.isFork,admin:r.viewerPermission==='ADMIN',can_open_issue:r.hasIssuesEnabled&&!r.isArchived,starred:r.viewerHasStarred,updated_at:r.updatedAt,forks_count:r.forkCount,stargazers_count:r.stargazerCount,language:r.primaryLanguage,license:r.licenseInfo,issues:r.issues.totalCount,pulls:r.pullRequests.totalCount,owner:{login:r.owner.login,avatar_url:r.owner.avatarUrl}}));
 return {items,total:result.totalCount,next:result.pageInfo.hasNextPage,cursor:result.pageInfo.endCursor,filteredPage:!!q||view==='admin'};
}
const issueFields=i=>({id:i.id,number:i.number,title:i.title,body:i.body,state:i.state,html_url:i.html_url,repository_url:i.repository_url,labels:(i.labels||[]).map(l=>({name:l.name,color:l.color})),user:{login:i.user?.login,avatar_url:i.user?.avatar_url},comments:i.comments,created_at:i.created_at,updated_at:i.updated_at,pull_request:i.pull_request});
export async function accountItems(request,account,params){
 const kind=params.get('kind')||'issue',view=params.get('view')||'assigned',state=params.get('state')||'open',sort=params.get('sort')||'updated';
 const qualifiers={assigned:`assignee:${account.login}`,created:`author:${account.login}`,authored:`author:${account.login}`,mentioned:`mentions:${account.login}`,involves:`involves:${account.login}`,recent:`involves:${account.login}`,reviews:`review-requested:${account.login}`};
 if(!['issue','pr'].includes(kind)||!qualifiers[view]||!['open','closed'].includes(state)||!['updated','created','comments'].includes(sort))throw new ApiError(400,'잘못된 항목 필터입니다.');
 const query=bounded(params.get('q')||'').replaceAll('@me',account.login),page=pageOf(params);
 // q is a user-supplied GitHub search expression; identity, type and state are
 // supplied separately and reinforced after stripping conflicting qualifiers.
 const term=query.replace(/(?:^|\s)(?:is|state):(issue|pr|open|closed)\b/gi,' ').replace(/(?:^|\s)sort:\S+/gi,' ').trim();
 const q=`is:${kind} state:${state} ${qualifiers[view]} archived:false ${term}`;
 const [value,counts]=await Promise.all([request(`search/issues?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=30&page=${page}`),request('graphql','POST',{query:'query StateCounts($open:String!,$closed:String!){open:search(type:ISSUE,query:$open,first:1){issueCount} closed:search(type:ISSUE,query:$closed,first:1){issueCount}}',variables:{open:q.replace('state:'+state,'state:open'),closed:q.replace('state:'+state,'state:closed')}}).catch(()=>null)]);
 const result=counts?.data?.data;
 return {items:value.data.items.map(issueFields),total:value.data.total_count,next:value.next,incomplete:value.data.incomplete_results,counts:typeof result?.open?.issueCount==='number'&&typeof result?.closed?.issueCount==='number'&&!counts.data.errors?.length?{open:result.open.issueCount,closed:result.closed.issueCount}:null};
}
export async function pullInbox(request,account,params){
 const days=Number(params.get('days')||30);if(![30,90,365].includes(days))throw new ApiError(400,'잘못된 기간입니다.');
 const repository=params.get('repo')||'';if(repository&&!/^[a-z0-9][a-z0-9-]{0,38}\/(?!\.{1,2}$)[a-z0-9_.-]{1,100}$/i.test(repository))throw new ApiError(400,'owner/repository 형식으로 입력해 주세요.');
 const since=new Date(Date.now()-days*86400000).toISOString().slice(0,10),login=account.login;
 const groups=[['review','Needs your review',`review-requested:${login} draft:false`],['drafts','Your drafts',`author:${login} draft:true`],['waiting','Waiting for review or checks',`author:${login} draft:false review:required`],['action','Needs action',`author:${login} draft:false review:changes_requested`],['ready','Ready to merge',`author:${login} draft:false review:approved status:success`]];
 const fragments=groups.map(([id,,filter])=>`${id}:search(type:ISSUE,first:10,query:${JSON.stringify(`is:pr is:open updated:>=${since} ${repository?'repo:'+repository:''} ${filter}`)}){issueCount nodes{... on PullRequest{id number title url updatedAt repository{nameWithOwner} isDraft}}}`).join('\n');
 const response=await request('graphql','POST',{query:`query PullRequestInbox{${fragments}}`});const result=response.data?.data;
 if(response.data?.errors?.length||!result)throw new ApiError(502,'PR Inbox를 조회하지 못했습니다.');
 return {groups:groups.map(([id,title])=>({id,title,total:result[id].issueCount,items:result[id].nodes.filter(Boolean).map(i=>({id:i.id,title:i.title,number:i.number,html_url:i.url,repository:i.repository.nameWithOwner,updated_at:i.updatedAt}))})),limitations:['팀 리뷰 요청과 모든 체크·병합 조건의 정확한 Inbox 분류는 GitHub에서 확인해 주세요.']};
}

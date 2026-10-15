import {ApiError} from './api-error.mjs';
const profileKeys=['login','name','avatar_url','html_url','bio','company','location','blog','twitter_username','hireable','followers','following','public_repos'];
export const publicProfile=data=>Object.fromEntries(profileKeys.map(k=>[k,data[k]??null]));
export function profileChanges(body){
 const limits={name:255,bio:160,company:255,location:255,blog:2048,twitter_username:50};const value={};
 for(const [key,max] of Object.entries(limits))if(Object.hasOwn(body,key)){if(typeof body[key]!=='string'||body[key].length>max)throw new ApiError(400,'프로필 입력값을 확인해 주세요.');value[key]=body[key].trim()}
 if(value.blog&&!/^https?:\/\//i.test(value.blog))throw new ApiError(400,'URL은 http:// 또는 https://로 시작해야 합니다.');
 if(Object.hasOwn(body,'hireable')){if(typeof body.hireable!=='boolean')throw new ApiError(400,'잘못된 구직 설정입니다.');value.hireable=body.hireable}
 if(!Object.keys(value).length)throw new ApiError(400,'변경할 프로필 항목이 없습니다.');return value;
}
export async function readProfile(request,account){
 const login=encodeURIComponent(account.login);
 const [profile,readme,activity]=await Promise.all([request('users/'+login),request(`repos/${login}/${login}/readme`).catch(e=>{if(e.status===404)return {data:null};return {error:true}}),request('graphql','POST',{query:'query AccountProfile{viewer{repositories(ownerAffiliations:[OWNER]){totalCount} starredRepositories{totalCount} pinnedItems(first:6,types:REPOSITORY){nodes{... on Repository{nameWithOwner description isPrivate primaryLanguage{name color} stargazerCount forkCount}}} contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount color}}}}}}'}).catch(()=>null)]);
 const viewer=activity?.data?.errors?.length?null:activity?.data?.data?.viewer;
 return {profile:publicProfile(profile.data),readme:readme.data?Buffer.from(readme.data.content||'','base64').toString('utf8'):'',readmeUnavailable:!!readme.error,overview:viewer?{repositories:viewer.repositories.totalCount,stars:viewer.starredRepositories.totalCount,pinned:viewer.pinnedItems.nodes.filter(r=>r?.nameWithOwner),calendar:viewer.contributionsCollection.contributionCalendar}:null};
}
export async function profileRepositories(request,params){
 const tab=params.get('tab')||'repositories',sort=params.get('sort')||'updated',page=Number(params.get('page')||1),type=params.get('type')||'all';
 if(!['repositories','stars'].includes(tab)||!['updated','created','pushed','full_name'].includes(sort)||!Number.isInteger(page)||page<1||page>1000||!['all','public','private','forks','sources'].includes(type))throw new ApiError(400,'잘못된 프로필 저장소 필터입니다.');
 const endpoint=tab==='stars'?`user/starred?sort=${sort==='created'?'created':'updated'}&direction=desc&per_page=30&page=${page}`:`user/repos?affiliation=owner&sort=${sort}&direction=${sort==='full_name'?'asc':'desc'}&per_page=30&page=${page}`;
 const result=await request(endpoint),q=(params.get('q')||'').trim().toLowerCase(),language=params.get('language')||'';
 if(q.length>1000||language.length>100)throw new ApiError(400,'검색어가 너무 깁니다.');
 return {items:result.data.filter(r=>(type==='all'||type==='public'&&!r.private||type==='private'&&r.private||type==='forks'&&r.fork||type==='sources'&&!r.fork)&&(!q||`${r.full_name} ${r.description||''}`.toLowerCase().includes(q))&&(!language||r.language===language)).map(r=>({id:r.id,full_name:r.full_name,private:r.private,description:r.description,language:r.language,stargazers_count:r.stargazers_count,forks_count:r.forks_count,updated_at:r.updated_at})),next:result.next,filteredPage:!!q||!!language||type!=='all'};
}

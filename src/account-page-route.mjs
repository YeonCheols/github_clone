export const issueViews={assigned:'Assigned to me',created:'Created by me',mentioned:'Mentioning me',recent:'Recently updated'};
export const pullViews={inbox:'Inbox',authored:'Authored by me',assigned:'Assigned to me',involves:'Involves me',reviews:'Review requests'};
export const repoViews={contributed:'My contributions',owner:'My repositories',forks:'My forks',admin:'Admin access'};
export function repositoryFilter(query=''){
 const view=/admin:@me/.test(query)?'admin':/fork:true/.test(query)?'forks':/owner:@me/.test(query)?'owner':'contributed';
 return {view,term:query.replace(/(?:contributed-by|owner|admin):@me|fork:true/g,'').trim()};
}
export function accountPageRoute(route){
 const [path,query='']=route.split('?');
 if(path==='/repos')return {kind:'repositories',view:repositoryFilter(new URLSearchParams(query).get('q')||'').view,title:'Repositories'};
 if(/^\/issues(?:\/(?:assigned|created|mentioned|recent))?\/?$/.test(path))return {kind:'issues',view:path.split('/')[2]||'assigned',title:'Issues'};
 if(/^\/pulls(?:\/(?:inbox|authored|assigned|involves|reviews))?\/?$/.test(path))return {kind:'pulls',view:path.split('/')[2]||'inbox',title:'Pull requests'};
 return null;
}
export const repositoryViewQuery={contributed:'contributed-by:@me',owner:'owner:@me',forks:'owner:@me fork:true',admin:'admin:@me'};

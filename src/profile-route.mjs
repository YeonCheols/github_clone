export function profilePageRoute(route){
 const [path,query='']=route.split('?');
 if(path==='/settings'||path==='/settings/profile')return {kind:'settings',title:'Settings'};
 if(path.toLowerCase()!=='/yeoncheols')return null;
 const tab=new URLSearchParams(query).get('tab')||'overview';
 return ['overview','repositories','stars'].includes(tab)?{kind:'profile',tab,title:'YeonCheols'}:null;
}

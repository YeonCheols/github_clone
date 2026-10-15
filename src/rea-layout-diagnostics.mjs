// Opt-in development diagnostics: geometry only, never account content or tokens.
export function startLayoutDiagnostics(){
 let timer;
 const box=selector=>{const element=document.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}};
 const report=()=>{clearTimeout(timer);timer=setTimeout(()=>{console.debug('REA_LAYOUT '+JSON.stringify({innerWidth:window.innerWidth,innerHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio,visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}:null,boxes:Object.fromEntries(['html','body','#root','.profile-shell','.dashboard-app','.dash-header','.global-content','.profile-layout','.settings-layout','.profile-repo-search'].map(selector=>[selector,box(selector)]))}))},200)};
 const observer=new ResizeObserver(report);observer.observe(document.documentElement);observer.observe(document.body);window.addEventListener('hashchange',report);window.addEventListener('resize',report);report();
 return ()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('hashchange',report);window.removeEventListener('resize',report)};
}

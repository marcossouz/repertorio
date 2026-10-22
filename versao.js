window.APP_VERSION='1.8.42';
(function(){
 const v=window.APP_VERSION;
 function pintar(){
  document.querySelectorAll('[data-app-ver]').forEach(el=>{el.textContent=v});
  const base=document.title.replace(/\s+\d+\.\d+\.\d+\s*$/,'');
  const titulo=base+' '+v;
  if(document.title!==titulo)document.title=titulo;
  try{
   const api=window.__TAURI__;
   const win=api&&((api.window&&api.window.getCurrentWindow&&api.window.getCurrentWindow())||(api.webviewWindow&&api.webviewWindow.getCurrentWebviewWindow&&api.webviewWindow.getCurrentWebviewWindow()));
   if(win&&win.setTitle)win.setTitle(titulo);
  }catch(e){}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pintar);
 else pintar();
})();

// Real electron-updater HTTP and SHA512 checks. Fixture bytes are never executed.
const {app,ipcMain}=require('electron');
const {NsisUpdater}=require('electron-updater');
const {AppUpdateController}=require('../packages/app/lib/src/services/app-update');
const {prepareUpdateInstall}=require('../packages/app/lib/src/tasks/updater');
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const evidence=path.resolve(__dirname,'../docs/auto-update-1.0.5');
const profile=fs.mkdtempSync(path.join(evidence,'transport-profile-'));
app.setPath('userData',profile);app.disableHardwareAcceleration();
let assertions=0;const check=(ok,msg)=>{assert(ok,msg);assertions++;};
app.whenReady().then(async()=>{
 const payload=Buffer.alloc(128*1024,65),sha512=crypto.createHash('sha512').update(payload).digest('base64');
 let mode='valid',requests=[];
 const server=http.createServer((req,res)=>{
  requests.push(req.url);
  if(req.url.startsWith('/latest.yml')){
   if(mode==='offline'){res.writeHead(503).end('fixture');return;}
   const version=mode==='older'?'1.0.4':'1.0.6';
   res.end(`version: ${version}\nfiles:\n  - url: fixture.exe\n    sha512: ${sha512}\n    size: ${payload.length}\npath: fixture.exe\nsha512: ${sha512}\nreleaseDate: '2026-10-28T00:00:00Z'\n`);
  }else if(req.url.startsWith('/fixture.exe')){res.setHeader('Content-Length',payload.length);res.end(mode==='corrupt'?Buffer.alloc(payload.length,66):payload);}
  else res.writeHead(404).end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  for(const scenario of ['valid','corrupt','older','offline']){
   mode=scenario;requests=[];const folder=path.join(profile,scenario);fs.mkdirSync(folder);const config=path.join(folder,'app-update.yml');fs.writeFileSync(config,'provider: generic\nurl: http://127.0.0.1/\nupdaterCacheDirName: fixture-updater\n');
   const adapter={version:'1.0.5',name:'update-fixture',isPackaged:true,appUpdateConfigPath:config,userDataPath:folder,baseCachePath:folder,whenReady:()=>Promise.resolve(),onQuit(){},quit(){throw Error('Unexpected app quit');},relaunch(){throw Error('Unexpected relaunch');}};
   const native=new NsisUpdater(undefined,adapter);
   native.httpExecutor=new (require('electron-updater/out/electronHttpExecutor').ElectronHttpExecutor)();
   native.setFeedURL({provider:'generic',url:`http://127.0.0.1:${server.address().port}`});
   native.autoDownload=false;native.autoInstallOnAppQuit=false;native.allowDowngrade=false;native.disableDifferentialDownload=true;native.logger=null;
   let installs=0,saves=0;native.quitAndInstall=(silent,restart)=>{assert(silent&&restart);installs++;};
   native.on('error',error=>console.log('transport-error',scenario,error.message.slice(0,600)));
   const controller=new AppUpdateController(native,'1.0.5',()=>{},async()=>{saves++;});
   await controller.check();check(!requests.some(x=>x.startsWith('/fixture.exe')),'Checking fetched installer without consent');
   if(scenario==='valid'||scenario==='corrupt'){
    check(controller.getState().phase==='available','Update missing');await controller.start();
    if(scenario==='valid'){check(installs===1&&saves===1,'Verified update did not prepare/install');check(controller.installing,'Install guard missing');}
    else{check(installs===0&&saves===0,'Corrupt installer passed verification');check(controller.getState().phase==='error','Checksum error was hidden');}
   }else if(scenario==='older')check(controller.getState().phase==='current'&&installs===0,'Downgrade accepted');
   else check(controller.getState().phase==='error'&&installs===0,'HTTP failure not recoverable');
  }
  let token;const window={isDestroyed:()=>false,webContents:{id:101,isDestroyed:()=>false,send(_channel,id){token=id;}}};
  const oldListeners=ipcMain.listenerCount('app-update-prepared');
  const timeout=prepareUpdateInstall(window,60);const rejected=assert.rejects(timeout);
  ipcMain.emit('app-update-prepared',{sender:{id:102}},{requestId:token,ok:true});
  ipcMain.emit('app-update-prepared',{sender:{id:101}},{requestId:'wrong',ok:true});await rejected;
  check(ipcMain.listenerCount('app-update-prepared')===oldListeners,'Timed-out preparation leaked listener');
  const success=prepareUpdateInstall(window,1000);ipcMain.emit('app-update-prepared',{sender:{id:101}},{requestId:token,ok:true});await success;check(ipcMain.listenerCount('app-update-prepared')===oldListeners,'Successful preparation leaked listener');
  console.log(JSON.stringify({result:'PASS',assertions,realChecksumVerification:true,installerExecuted:false}));
 }finally{server.closeAllConnections();server.close();}
}).then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1);});

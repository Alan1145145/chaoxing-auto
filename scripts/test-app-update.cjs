const {EventEmitter}=require('events');
const assert=require('assert/strict');
const {AppUpdateController}=require('../packages/app/lib/src/services/app-update');
let assertions=0;
const check=(ok,message)=>{assert(ok,message);assertions++;};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Driver extends EventEmitter {
 constructor(){super();this.checks=0;this.downloads=0;this.installs=[];this.version='1.0.6';}
 async checkForUpdates(){this.checks++;if(this.checkError)throw Error('network');this.token={cancelled:false,cancel(){this.cancelled=true;}};this.emit(this.version==='1.0.5'?'update-not-available':'update-available',{version:this.version,releaseNotes:'<b>修复</b>'});return {cancellationToken:this.token};}
 async downloadUpdate(token){this.downloads++;this.emit('download-progress',{percent:40,transferred:40,total:100});if(this.downloadGate)await this.downloadGate.promise;if(token?.cancelled)throw Error('cancelled');if(this.downloadError){this.emit('error',Error('checksum'));throw Error('checksum');}this.emit('update-downloaded',{version:this.version});return ['fixture-never-executed.exe'];}
 quitAndInstall(...args){this.installs.push(args);if(this.installError)this.emit('error',Error('install'));}
}
(async()=>{
 let driver=new Driver(),states=[],saved=0;
 let controller=new AppUpdateController(driver,'1.0.5',s=>states.push(s),async()=>{saved++;});
 check(controller.getState().phase==='idle','Initial status');
 await controller.check();check(driver.downloads===0,'Checking downloaded without consent');check(controller.getState().phase==='available','Available update missing');check(controller.getState().releaseNotes==='修复','Notes not rendered as text');
 await Promise.all([controller.start(),controller.start()]);
 check(driver.downloads===1,'Double click downloaded twice');check(saved===1,'Prepare did not run exactly once');check(JSON.stringify(driver.installs)==='[[true,true]]','Silent install/restart not requested');
 check(states.findIndex(x=>x.phase==='preparing')<states.findIndex(x=>x.phase==='installing'),'Install preceded save');check(controller.installing,'Quit guard not enabled');
 await controller.start();check(driver.installs.length===1,'Install already requested but started twice');
 driver=new Driver();driver.version='1.0.5';controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});await controller.check();check(controller.getState().phase==='current','Same version prompted');await controller.start();check(driver.downloads===0,'No update still downloaded');
 for(const version of ['1.0.4','invalid']){driver=new Driver();driver.version=version;controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});await controller.check();await controller.start();check(!driver.downloads,'Invalid version/downgrade accepted');}
 driver=new Driver();driver.checkError=true;controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});await controller.check();check(controller.getState().phase==='error','Check error not recoverable');driver.checkError=false;await controller.check();check(controller.getState().phase==='available','Check retry failed');
 driver.downloadError=true;await controller.start();check(!driver.installs.length,'Checksum failure installed');check(controller.getState().errorStage==='download','Wrong error stage');driver.downloadError=false;await controller.start();check(driver.installs.length===1,'Failed download retry failed');
 driver=new Driver();let failSave=true;controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{if(failSave)throw Error('disk');});await controller.check();await controller.start();check(driver.installs.length===0,'Save failure installed');check(!controller.installing&&controller.getState().errorStage==='install','Save failure blocked quit guard');failSave=false;await controller.start();check(driver.downloads===1&&driver.installs.length===1,'Install retry should reuse verified download');
 driver=new Driver();driver.downloadGate=deferred();controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});await controller.check();const downloading=controller.start();await new Promise(r=>setImmediate(r));controller.cancel();driver.downloadGate.resolve();await downloading;check(controller.getState().phase==='available'&&!driver.installs.length,'Cancel installed update');driver.downloadGate=undefined;await controller.start();check(driver.installs.length===1&&driver.checks===2,'Cancellation token was reused');
 driver=new Driver();driver.installError=true;controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});await controller.check();await controller.start();check(controller.getState().errorStage==='install'&&!controller.installing,'Installer error trapped normal close');
 driver=new Driver();const gate=deferred();driver.checkForUpdates=async()=>{driver.checks++;await gate.promise;driver.emit('update-not-available');return {};};controller=new AppUpdateController(driver,'1.0.5',()=>{},async()=>{});const a=controller.check(),b=controller.check();gate.resolve();await Promise.all([a,b]);check(driver.checks===1,'Concurrent checks were not merged');
 controller=new AppUpdateController(undefined,'1.0.5',()=>{},async()=>{});check((await controller.check()).phase==='unsupported','Development environment contacted update server');
 console.log(JSON.stringify({result:'PASS',assertions}));
})().catch(error=>{console.error(error);process.exitCode=1;});

// Read the real public GitHub feed after publishing; never download/run an installer.
const {app}=require('electron');
const {NsisUpdater}=require('electron-updater');
const {ElectronHttpExecutor}=require('electron-updater/out/electronHttpExecutor');
const {AppUpdateController}=require('../packages/app/lib/src/services/app-update');
const {UPDATE_REPOSITORY}=require('../packages/app/lib/src/tasks/updater');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const expected=require('../packages/app/package.json').version;
const profile=fs.mkdtempSync(path.resolve(__dirname,'../docs/auto-update-1.0.5/release-profile-'));
app.setPath('userData',profile);app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const results=[];
 for(const version of ['0.0.1',expected]){
  const folder=path.join(profile,version);fs.mkdirSync(folder);const config=path.join(folder,'app-update.yml');fs.writeFileSync(config,'provider: github\nowner: Alan1145145\nrepo: chaoxing-auto\n');
  const adapter={version,name:'update-feed-verification',isPackaged:true,appUpdateConfigPath:config,userDataPath:folder,baseCachePath:folder,whenReady:()=>Promise.resolve(),onQuit(){},quit(){throw Error('No installation allowed');},relaunch(){throw Error('No relaunch allowed');}};
  const native=new NsisUpdater(undefined,adapter);native.httpExecutor=new ElectronHttpExecutor();native.setFeedURL(UPDATE_REPOSITORY);native.autoDownload=false;native.autoInstallOnAppQuit=false;native.allowPrerelease=false;native.allowDowngrade=false;native.logger=null;
  native.on('error',error=>console.error(error.message.slice(0,400)));
  let downloads=0;native.downloadUpdate=async()=>{downloads++;throw Error('Download not allowed in feed verification');};
  const controller=new AppUpdateController(native,version,()=>{},async()=>{throw Error('Install not allowed');});await controller.check();
  const state=controller.getState();assert.equal(downloads,0);
  if(version===expected)assert.equal(state.phase,'current');else{assert.equal(state.phase,'available');assert.equal(state.version,expected);}
  results.push({current:version,phase:state.phase,available:state.version||null});
 }
 console.log(JSON.stringify({result:'PASS',repository:UPDATE_REPOSITORY.owner+'/'+UPDATE_REPOSITORY.repo,results,installerDownloaded:false}));
}).then(()=>app.exit(0)).catch(error=>{console.error(error);app.exit(1);});

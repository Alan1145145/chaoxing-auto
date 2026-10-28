const {_electron:electron}=require('playwright-core');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const evidence=path.resolve(__dirname,'../docs/auto-update-1.0.5');const profile=fs.mkdtempSync(path.join(evidence,'ui-profile-'));
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({version:'0.0.0',render:{state:{first:false,setup:false,newBrowserSetup:false},notifies:[{id:'chaoxing-auto-tutorial-1.0.0',content:[]}]}}));
 const application=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'model-test-bootstrap.cjs')],cwd:path.resolve(__dirname,'../packages/app'),env:{...process.env,MODEL_TEST_PROFILE:profile,MODEL_TEST_UPDATER:'1'}});
 let assertions=0;const check=(ok,msg)=>{assert(ok,msg);assertions++;};
 try{
  const page=await application.firstWindow();page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.waitForSelector('.app-navigation');
  await page.evaluate(()=>document.fonts.ready);
  await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(760,440));
  const updateButton=await page.getByRole('button',{name:'检查更新',exact:true}).boundingBox();
  check(updateButton.x+updateButton.width<=620,'Update button overlaps native window controls on a small screen');
  await page.getByRole('button',{name:'检查更新',exact:true}).click();
  await page.getByRole('heading',{name:'发现新版本',exact:true}).waitFor();
  check(await application.evaluate(()=>globalThis.__updateFixture.downloads)===0,'Checking downloaded without consent');
  await page.getByRole('button',{name:'稍后',exact:true}).click();
  await page.locator('.update-entry').click();await page.getByRole('button',{name:'立即更新',exact:true}).click();
  await page.getByRole('heading',{name:'正在下载更新',exact:true}).waitFor();
  await page.getByRole('button',{name:'取消下载',exact:true}).click();await page.getByRole('heading',{name:'发现新版本',exact:true}).waitFor();
  check(await application.evaluate(()=>globalThis.__updateFixture.installs.length)===0,'Cancelled download installed');
  await page.getByRole('button',{name:'稍后',exact:true}).click();
  await page.evaluate(()=>{window.store.render.setting.ocs.store['fixture.update.persist']='saved-before-install';location.hash='/browser/update-fixture';});
  await page.locator('webview:visible').waitFor();await page.waitForTimeout(700);
  await page.locator('.update-entry').click();await page.getByRole('button',{name:'立即更新',exact:true}).click();
  await page.getByRole('heading',{name:'正在下载更新',exact:true}).waitFor();
  await application.evaluate(()=>globalThis.__updateFixture.complete());
  await page.getByRole('heading',{name:'正在更新软件',exact:true}).waitFor();
  check(await page.locator('webview').count()===0,'Embedded course was not closed before install');
  const saved=await application.evaluate(()=>{
   const fixture=globalThis.__updateFixture;
   return {value:globalThis.__modelTest.configState().config.store['fixture.update.persist'],installs:fixture.installs,downloads:fixture.downloads};
  });
  check(saved.value==='saved-before-install','Preferences were not persisted before install');check(JSON.stringify(saved.installs)==='[[true,true]]','One click did not request silent install and restart');check(saved.downloads===2,'Unexpected duplicate download');
  check(errors.length===0,'Renderer errors: '+errors.join(';'));
  await page.screenshot({path:path.join(evidence,'update-ui.png')});console.log(JSON.stringify({result:'PASS',assertions,installerExecuted:false}));
 } catch(error) {const page=await application.firstWindow();console.log('update-ui-debug',await page.evaluate(()=>({text:document.body.innerText.slice(-1400)})));await page.screenshot({path:path.join(evidence,'update-ui-failed.png')});throw error;} finally {await application.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();}).catch(()=>{});await application.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

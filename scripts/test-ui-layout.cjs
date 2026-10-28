const {_electron:electron}=require('playwright-core');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const evidence=path.resolve(__dirname,'../docs/model-browser-fixes');
 const profile=fs.mkdtempSync(path.join(evidence,'layout-ui-profile-'));
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({version:'0.0.0',render:{state:{first:false,setup:false,newBrowserSetup:false},notifies:[{id:'chaoxing-auto-tutorial-1.0.0',content:[]}]}}));
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'model-test-bootstrap.cjs')],cwd:path.resolve(__dirname,'../packages/app'),env:{...process.env,MODEL_TEST_PROFILE:profile}});
 const results=[];const check=(ok,name,detail)=>results.push({name,ok:!!ok,detail});
 try{
  const page=await app.firstWindow();await page.waitForSelector('.app-navigation');
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  for(const [width,height] of [[1360,800],[900,560],[760,440]]){
   await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setSize(width,height),{width,height});
   await page.getByRole('button',{name:'模型接入',exact:true}).click();
   await page.getByRole('button',{name:'接入千问',exact:true}).click();
   const modal=page.locator('.model-provider-modal:visible');
   await modal.getByRole('button',{name:'取消',exact:true}).hover();
   await modal.locator('.arco-modal-body').hover();await page.mouse.wheel(0,1300);await page.waitForTimeout(200);
   await page.mouse.move(width-25,height-25);await page.mouse.wheel(0,1000);await page.waitForTimeout(200);
   const layout=await modal.evaluate(el=>{
    const wrapper=el.closest('.arco-modal-wrapper'),root=document.scrollingElement;
    const box=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
    return {viewport:innerHeight,modal:box(el),header:box(el.querySelector('.arco-modal-header')),footer:box(el.querySelector('.arco-modal-footer')),wrapper:{height:wrapper.clientHeight,scrollHeight:wrapper.scrollHeight,top:wrapper.scrollTop},root:{height:root.clientHeight,scrollHeight:root.scrollHeight,top:root.scrollTop}};
   });
   check(layout.header.top>=31&&layout.footer.bottom<=height+1,'Modal pinned inside '+width+'x'+height,layout);
   check(layout.wrapper.scrollHeight<=layout.wrapper.height+1&&layout.root.top===0,'No outer modal/document scroll '+width+'x'+height,layout);
   const adapter=modal.locator('.arco-select-view').last();await adapter.click();
   const option=page.locator('.arco-select-option:visible').filter({hasText:'DeepSeek'});await option.hover();
   const box=await option.boundingBox();check(box.y>=32&&box.y+box.height<=height,'Adapter dropdown is visible '+width+'x'+height,box);
   await option.click();check((await adapter.innerText()).includes('DeepSeek'),'Adapter selection works '+width+'x'+height);
   await page.waitForTimeout(600);
   await page.screenshot({path:path.join(evidence,`layout-modal-${width}.png`)});
   await modal.getByRole('button',{name:'取消',exact:true}).click();
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1360,800));
  await page.evaluate(()=>location.hash='/browser/layout-fixture');await page.locator('webview').waitFor();await page.waitForTimeout(900);
  const normal=await page.locator('webview:visible').boundingBox();
  check(normal.height>=800*0.72,'Browser receives most vertical space',normal);
  if(!process.env.AUDIT_BASELINE){
   await page.getByRole('button',{name:'专注浏览',exact:true}).click();await page.waitForTimeout(600);
   const focused=await page.locator('webview:visible').boundingBox();
   check(focused.height>=800*0.82&&focused.width>=1340,'Focus mode enlarges guest viewport',focused);
   await page.screenshot({path:path.join(evidence,'layout-browser-focus.png')});
   await page.getByRole('button',{name:'退出专注',exact:true}).click();
   check(await page.locator('.app-navigation').isVisible(),'Can restore app navigation');
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(700,440));
   const controls=await page.getByRole('button',{name:'返回列表',exact:true}).boundingBox();
   check(controls.x+controls.width<=700,'Browser controls fit small window',controls);
  }
  check(errors.length===0,'Renderer errors',errors);
  const report={result:results.every(x=>x.ok)?'PASS':'FAIL',results};fs.writeFileSync(path.join(evidence,process.env.AUDIT_BASELINE?'layout-before-result.json':'layout-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert(results.every(x=>x.ok),'UI layout regressions failed');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

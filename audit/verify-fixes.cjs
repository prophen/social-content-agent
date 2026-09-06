/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node/browser regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require('playwright');
process.chdir(path.resolve(__dirname, '..'));
const baseURL = process.env.A11Y_BASE_URL || 'http://localhost:3000';
const outputDirectory = path.join(__dirname, 'results');
fs.mkdirSync(outputDirectory, { recursive: true });
const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
const modules = {};
for (const [name, pkg, file] of [
  ['react', 'react', 'react.production.js'],
  ['react/jsx-runtime', 'react', 'react-jsx-runtime.production.js'],
  ['react-dom', 'react-dom', 'react-dom.production.js'],
  ['react-dom/client', 'react-dom', 'react-dom-client.production.js'],
  ['scheduler', 'scheduler', 'scheduler.production.js'],
]) modules[name] = fs.readFileSync(path.join(path.dirname(require.resolve(`${pkg}/package.json`, { paths: [path.dirname(require.resolve('react-dom/package.json'))] })), 'cjs', file), 'utf8');
modules['next/link'] = 'module.exports = {default: ({children,...props}) => require("react").createElement("a",props,children)};';
modules['next/navigation'] = 'module.exports = { useParams: () => ({id:"fixture"}), useSearchParams: () => new URLSearchParams(), useRouter: () => ({push(){},replace(){},refresh(){}}) };';
modules['@/lib/supabase/client'] = 'module.exports = {createClient: () => ({auth: {signInWithPassword: async () => ({error: window.authFailure ? new Error("Invalid fixture credentials") : null})}})};';
modules['@/app/components/AuthControls'] = 'module.exports = {default: () => require("react").createElement("button",null,"Sign out")};';
const results = { note: 'Authentication uses the real Next.js route. Protected UI uses actual page components with mocked router, auth controls and API responses in an isolated browser; no real account or draft changes.' };
const date = '2026-09-06T12:00:00.000Z';
const draft = { id: 'fixture', topic: 'Accessibility fixture', content: 'A short social post.', status: 'draft', createdAt: date, updatedAt: date, scheduledFor: null, publishedAt: null };
function bundle(file) {
  const sources = { ...modules, entry: transpile(file) };
  return `const process={env:{NODE_ENV:'production'}};const sources=${JSON.stringify(sources)};const cache={};function require(id){if(!cache[id]){const module={exports:{}};cache[id]=module;new Function('require','module','exports',sources[id])(require,module,module.exports)}return cache[id].exports}require('react-dom/client').createRoot(document.getElementById('root')).render(require('react').createElement(require('entry').default));`;
}
const luminance = hex => {
  const c = hex.match(/../g).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    async function axe(label) {
      await page.addScriptTag({path:require.resolve('axe-core')});
      const data = await page.evaluate(async () => {
        const r = await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
        return {violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id),passes:r.passes.length};
      });
      results[label]=data;
      assert.deepEqual(data.violations,[],label);
    }
    await page.goto(new URL('/sign-in', baseURL).href);
    const signIn = page.getByRole('tab',{name:'Sign in',exact:true});
    const signUp = page.getByRole('tab',{name:'Create account',exact:true});
    await signIn.waitFor();
    assert.equal(await page.title(),'Sign in or create an account | Social Content Agent');
    await axe('signIn');
    await signIn.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await signUp.getAttribute('aria-selected'),'true');
    assert.equal(await signUp.evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#email').evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await signUp.evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await signIn.getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await signUp.getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');
    assert.equal(await signIn.getAttribute('aria-selected'),'true');
    await page.keyboard.press('End');
    assert.equal(await signUp.getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('tabpanel',{name:'Create account'}).count(),1);
    results.tabs='Arrow keys wrap, Home/End select, Tab exits to email and Shift+Tab returns to selected tab; panel is associated.';
    await axe('signUp');
    await page.setViewportSize({width:320,height:800});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
    await page.screenshot({path:path.join(outputDirectory, 'sign-up-320.png'),fullPage:true});
    results.reflow='Create account has no overflow at 320 CSS pixels.';
    let state = {...draft};
    let fail = false;
    await page.route('https://audit.test/**', async route => {
      const url = new URL(route.request().url());
      if(url.pathname.startsWith('/api/')) {
        if (route.request().method()==='PATCH') {
          if(fail) return route.fulfill({status:500,json:{error:'Fixture failure'}});
          state={...state,...route.request().postDataJSON()};
        }
        return route.fulfill({json: url.pathname.endsWith('/events') ? {events:[]} : url.pathname==='/api/drafts' ? {drafts:[state]} : url.pathname==='/api/generate-draft' ? {draft:'Generated fixture content.'} : {draft:state}});
      }
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Accessibility fixture</title></head><body><div id="root"></div></body></html>'});
    });
    async function render(file) {
      await page.goto('https://audit.test/');
      await page.addStyleTag({path:'app/globals.css'});
      await page.addScriptTag({content:bundle(file)});
    }
    await page.setViewportSize({width:1280,height:900});
    await render('app/drafts/[id]/page.tsx');
    await page.getByRole('button',{name:'Save changes',exact:true}).waitFor();
    await page.evaluate(()=>{window.originalStatus=document.querySelector('.save-message[role=status]');window.originalAlert=document.querySelector('#editor-error');});
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await page.locator('.save-message[role=status]').filter({hasText:'Changes saved.'}).waitFor();
    fail=true;
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Save failed: Fixture failure'}).waitFor();
    await page.getByRole('button',{name:'Approve draft',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Approval failed: Fixture failure'}).waitFor();
    fail=false;
    await page.getByRole('button',{name:'Approve draft',exact:true}).click();
    await page.locator('.save-message[role=status]').filter({hasText:'Draft approved.'}).waitFor();
    await page.getByRole('button',{name:'Schedule post',exact:true}).click();
    assert.equal(await page.locator('#scheduled-for').getAttribute('aria-invalid'),'true');
    assert.equal(await page.locator('#scheduled-for').getAttribute('aria-describedby'),'editor-error');
    await page.getByRole('alert').filter({hasText:'Choose a future date and time first.'}).waitFor();
    await page.locator('#scheduled-for').fill('2099-01-01T12:00');
    fail=true;
    await page.getByRole('button',{name:'Schedule post',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Scheduling failed: Fixture failure'}).waitFor();
    await axe('approvedEditorWithError');
    fail=false;
    await page.getByRole('button',{name:'Schedule post',exact:true}).click();
    await page.locator('.save-message[role=status]').filter({hasText:'Draft scheduled.'}).waitFor();
    assert.equal(await page.evaluate(()=>window.originalStatus===document.querySelector('.save-message[role=status]')&&window.originalAlert===document.querySelector('#editor-error')),true);
    results.editor='Save/approve/schedule success and failure update correct persistent regions; date validation is associated with its input.';
    await axe('scheduledEditor');
    await render('app/drafts/page.tsx');
    await page.getByRole('link',{name:'Open draft: Accessibility fixture',exact:true}).waitFor();
    await page.getByRole('button',{name:'Published',exact:true}).click();
    await page.getByRole('status').filter({hasText:'No published drafts yet.'}).waitFor();
    await axe('emptyFilteredDashboard');
    await render('app/drafts/new/page.tsx');
    await page.getByRole('button',{name:'Generate with AI',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Enter a topic before generating a draft.'}).waitFor();
    assert.equal(await page.getByLabel('Topic',{exact:true}).getAttribute('aria-invalid'),'true');
    assert.equal(await page.getByLabel('Topic',{exact:true}).getAttribute('aria-describedby'),'new-draft-error');
    await page.getByLabel('Topic',{exact:true}).fill('Test topic');
    assert.equal(await page.getByLabel('Topic',{exact:true}).getAttribute('aria-invalid'),'false');
    await page.getByRole('button',{name:'Generate with AI',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Draft generated.'}).waitFor();
    assert.equal(await page.getByLabel('Draft content',{exact:true}).inputValue(),'Generated fixture content.');
    await axe('newDraftAfterGeneration');
    await render('app/sign-in/SignInForm.tsx');
    await page.getByLabel('Email address',{exact:true}).fill('fixture@example.com');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.evaluate(()=>{window.authFailure=true;window.authAlert=document.querySelector('[role=alert]');window.authStatus=document.querySelector('[role=status]');});
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Invalid fixture credentials'}).waitFor();
    await axe('signInErrorFixture');
    await page.evaluate(()=>{window.authFailure=false;});
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Signed in. Redirecting...'}).waitFor();
    assert.equal(await page.evaluate(()=>window.authAlert===document.querySelector('[role=alert]')&&window.authStatus===document.querySelector('[role=status]')),true);
    results.formFeedback='Empty topic is marked invalid and associated with its error; correcting it clears validation. Authentication success/error update separate persistent regions (mocked auth).';
    const css=fs.readFileSync('app/globals.css','utf8');
    const border=css.match(/--control-border: #([a-f0-9]+)/)[1];
    results.borderContrast={};
    for(const background of ['ffffff','edf3ff']) {
      const ratio=(luminance(background)+.05)/(luminance(border)+.05);
      assert.ok(ratio>=3);
      results.borderContrast[background]=Number(ratio.toFixed(2));
    }
    results.titles={};
    for(const file of ['app/sign-in/page.tsx','app/drafts/layout.tsx','app/drafts/new/layout.tsx','app/drafts/[id]/layout.tsx']) {
      const title=fs.readFileSync(file,'utf8').match(/title: "([^"]+)"/)[1];
      results.titles[file]=title;
    }
    assert.equal(new Set(Object.values(results.titles)).size,4);
    fs.writeFileSync(path.join(outputDirectory, 'verification.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

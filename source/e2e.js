// 実ブラウザ(Chrome headless / CDP)での検算。実行: node source/e2e.js
const path = require('path'), fs = require('fs');
const { launch } = require('./cdp');
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
let n = 0, f = 0;
const ok = (c, m) => { n++; if (!c) { f++; console.log('NG', m); } };
(async () => {
  const b = await launch(9376);
  const setText = t => b.ev(`(()=>{const e=document.getElementById('txt');e.value=${JSON.stringify(t)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const wait = () => b.sleep(260);
  const info = () => b.ev(`(()=>({n:document.querySelectorAll('#flist li').length, head:document.getElementById('headline').textContent, marks:document.querySelectorAll('#annot .m').length, badges:document.querySelectorAll('#annot .bd').length, annotHidden:document.getElementById('annotSec').hidden, sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, errs:window.__errs||0}))()`);
  await b.open(PAGE, 375, 800, 2, true);
  await b.ev(`window.__errs=0;window.addEventListener('error',()=>window.__errs++);true`);
  let i = await info(); ok(i.n === 0 && i.annotHidden && /文章を入れると/.test(i.head), 'E1 初期状態は空');
  // サンプル
  await b.ev(`document.getElementById('sampleBtn').click()`); await wait(); i = await info();
  ok(i.n === 8 && /8件/.test(i.head) && /確認6件・ヒント2件/.test(i.head), 'E2 サンプルで8件（確認6・ヒント2）: ' + i.head);
  ok(i.marks >= 8 && i.badges === 8 && !i.annotHidden, 'E2 印つき本文に印と番号 ' + i.marks + '/' + i.badges);
  ok(i.sw <= i.cw, 'E2 375px 横スクロールなし ' + i.sw + '/' + i.cw);
  // 件数表示
  const cnt = await b.ev(`document.getElementById('counts').textContent.replace(/\\s+/g,' ')`); console.log(cnt);
  ok(/文字数 157/.test(cnt) && /224/.test(cnt) && /ハッシュタグ 5個/.test(cnt) && /URL 1件/.test(cnt), 'E3 数の表示');
  // 「本文の印へ」
  await b.ev(`document.querySelectorAll('#flist .jump')[4].click()`); await b.sleep(150);
  ok(await b.ev(`!!document.querySelector('#annot .m.flash')`), 'E4 本文の印へ → 強調');
  // XSS
  await setText('<img src=x onerror="window.__x=1"><script>window.__x=2<\/script> ｽﾀｰﾄ'); await wait();
  ok(await b.ev(`window.__x===undefined && document.querySelectorAll('#annot img, #flist img, #annot script').length===0`), 'E5 HTMLとして解釈されない');
  ok((await b.ev(`document.getElementById('annot').textContent`)).includes('<img src=x'), 'E5 そのまま文字として表示');
  // 空 → 初期状態
  await b.ev(`document.getElementById('clearBtn').click()`); await wait(); i = await info(); ok(i.n === 0 && i.annotHidden, 'E6 空にする');
  // 0件
  await setText('今日はお休みです。'); await wait(); i = await info(); ok(i.n === 0 && /気になる点は見つかりませんでした/.test(i.head) && !/問題なし|OK|安心|安全/.test(i.head), 'E7 0件の文言: ' + i.head);
  // 280超
  await setText('あ'.repeat(150)); await wait(); i = await info();
  ok(i.n === 1 && await b.ev(`document.getElementById('cOver').textContent.includes('目安を超えて')`), 'E8 280超で警告1件');
  ok(await b.ev(`document.querySelector('#annot .m').textContent.length===10`), 'E8 超過10字に印');
  // 10000字
  const big = ('今日はお休みです。10/31(金)まで ｽﾀｰﾄ https://x.example/a #タグ ' + 'あ'.repeat(30)).repeat(100).slice(0, 10000);
  const t0 = await b.ev(`(()=>{const t=performance.now();const e=document.getElementById('txt');e.value=${JSON.stringify(big)};e.dispatchEvent(new Event('input',{bubbles:true}));return t})()`);
  await b.sleep(400); const done = await b.ev(`performance.now()`); i = await info(); ok(i.n > 0 && i.n <= 60, 'E9 10000字で動く ' + i.n + '件');
  const tt = await b.ev(`(()=>{const t=performance.now();window.dispatchEvent(new Event('x'));const e=document.getElementById('txt');e.value=${JSON.stringify(big)};e.dispatchEvent(new Event('input',{bubbles:true}));return 0})()`);
  await b.ev(`(()=>{const e=document.getElementById('txt');e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); await b.sleep(300);
  const dur = await b.ev(`new Promise(r=>{const s=performance.now();const e=document.getElementById('txt');e.value=${JSON.stringify(big + 'a')};e.dispatchEvent(new Event('input',{bubbles:true}));const iv=setInterval(()=>{if(document.querySelectorAll('#flist li').length){clearInterval(iv);r(performance.now()-s)}},5);setTimeout(()=>r(-1),2000)})`);
  console.log('10000字: 入力→一覧 約', Math.round(dur), 'ms（debounce 120ms 込み）'); ok(dur > 0 && dur < 500, 'E9 500ms未満 ' + dur);
  // 保存系を使っていない
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const ui = html.slice(html.indexOf('<script id="ui">'));
  ['localStorage', 'sessionStorage', 'indexedDB', 'download', 'clipboard', 'navigator.share', 'toDataURL', 'createObjectURL', 'fetch(', 'XMLHttpRequest', 'innerHTML', 'eval(', 'document.write'].forEach(w => ok(!html.slice(0, html.indexOf('cloudflareinsights')).includes(w), 'E10 使っていない: ' + w));
  ok(!/href="#"|href="https?:\/\/(bit\.ly|forms\.gle|lin\.ee|goo\.gl|t\.co)/.test(html), 'E10 href="#"・短縮URLのリンクなし（検出用の一覧は除く）');
  ok(/mw-footer/.test(html) && /みちAIワークス/.test(html), 'E10 素性表記フッタ');
  // ダーク
  await b.open(PAGE, 375, 800, 2, true, 'dark'); await b.ev(`document.getElementById('sampleBtn').click()`); await wait();
  const dk = await b.ev(`(()=>{const m=document.querySelector('#annot .m');const cs=getComputedStyle(m);const bd=getComputedStyle(document.querySelector('#annot .bd'));return {bg:cs.backgroundColor,color:cs.color,bodyBg:getComputedStyle(document.body).backgroundColor,bdBg:bd.backgroundColor,bdColor:bd.color}})()`);
  console.log('dark', JSON.stringify(dk)); ok(dk.bodyBg !== 'rgb(246, 244, 245)', 'E11 ダークが効く');
  // 横スクロール（極端な入力）
  await b.open(PAGE, 375, 800, 2, true);
  for (const [name, t] of [['全文URL', 'https://' + 'a'.repeat(120) + '.example/' + 'b'.repeat(120)], ['半角カナ', 'ｱ'.repeat(300)], ['絵文字', '😀'.repeat(200)], ['改行だけ', '\n'.repeat(50)], ['長い語', 'あ'.repeat(400)]]) {
    await setText(t); await wait(); i = await info(); ok(i.sw <= i.cw, 'E12 横スクロールなし: ' + name + ' ' + i.sw + '/' + i.cw);
  }
  console.log('合計', n, '件・失敗', f, '件'); b.close(); setTimeout(() => process.exit(f ? 1 : 0), 300);
})().catch(e => { console.error(e); process.exit(2); });

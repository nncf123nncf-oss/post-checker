// 投稿カード用の実画面を撮る(Chrome headless / CDP)。実行: node source/shoot.js <出力フォルダ> [YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2]); const DATE = process.argv[3] || '2026-10-12';
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });
const CARD2 = '【秋の感謝祭のお知らせ】みなと堂では、日ごろのご愛顧への感謝を込めて、10月26日(日)から2日間、店内の全商品を特別価格でご提供いたします。限定のブレンドコーヒー、季節の焼き菓子セット、手ぬぐいなど、どれも数に限りがありますので、お早めにお越しください。当日は午後15時から、コーヒーの試飲会も開催します。ご予約は不要です。詳細はこちら https://minato-do';
(async () => {
  const b = await launch(9377);
  const rect = sel => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,h:r.height}})()`);
  const setText = t => b.ev(`(()=>{const e=document.getElementById('txt');e.value=${JSON.stringify(t)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  // Card1: デスクトップ900px・2カラム。サンプル（確認6・ヒント2）
  await b.open(PAGE, 900, 1300, 2, false);
  await b.ev(`document.getElementById('sampleBtn').click()`); await b.sleep(400);
  // 右の結果の枠は、実際のページでも内側でスクロールする（max-height）。Card1では、5件目の下で終わる高さにして、項目の途中で切れないようにする
  const N1 = +(process.env.CARD1_ITEMS || 5);
  await b.ev(`(()=>{const o=document.querySelector('.a-out'),li=document.querySelectorAll('#flist li')[${N1 - 1}];const h=li.getBoundingClientRect().bottom-o.getBoundingClientRect().top+15;o.style.maxHeight=h+'px';return h})()`); await b.sleep(200);
  const lay = await rect('.layout'), out = await rect('.a-out'), ann = await rect('.a-annot'), inp = await rect('.a-in');
  console.log('card1', JSON.stringify({ lay, out, ann, inp }));
  await b.shot(path.join(OUT, '01-desktop-sample-' + DATE + '.png'), { x: 0, y: Math.max(0, lay.top - 12), width: 900, height: Math.max(out.bottom, ann.bottom) - lay.top + 24 });
  await b.shot(path.join(OUT, 'source-desktop-full.png'), { x: 0, y: 0, width: 900, height: await b.ev('document.documentElement.scrollHeight') });
  // Card2: 375px・DPR2。別の文（文字数オーバー・曜日・午後15時・URLの形。すべて「確認」）
  await b.open(PAGE, 375, 900, 2, true);
  await setText(CARD2); await b.sleep(400);
  const hd = await rect('.a-out h2'), lst = await rect('#flist'), tx = await rect('#txt'), cn = await rect('#counts'), a2 = await rect('.a-annot');
  console.log('card2', JSON.stringify({ hd, lst, tx, cn, a2, n: await b.ev(`document.querySelectorAll('#flist li').length`) }));
  await b.shot(path.join(OUT, '02-mobile375-confirm-' + DATE + '.png'), { x: 0, y: hd.top - 8, width: 375, height: lst.bottom - hd.top + 16 });
  await b.shot(path.join(OUT, 'source-mobile375-full.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });

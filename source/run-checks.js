// 検査の部分(index.html の <script id="core">)の検算。実行: node source/run-checks.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.X=PC;', ctx); const X = ctx.X;
let n = 0, f = 0; const J = v => JSON.stringify(v);
const eq = (a, b, m) => { n++; if (J(a) !== J(b)) { f++; console.log('NG', m, J(a), '!=', J(b)); } };
const tr = (c, m) => eq(!!c, true, m);
const NOW = new Date(2026, 9, 12); // 2026-10-12
const C = t => X.check(t, { now: NOW });
const rules = t => C(t).findings.map(x => x.rule);
const has = (t, r, m) => tr(rules(t).includes(r), (m || t) + ' → ' + r + ' が出る (実際: ' + J(rules(t)) + ')');
const not = (t, r, m) => tr(!rules(t).includes(r), (m || t) + ' → ' + r + ' が出ない');
const none = (t, m) => eq(rules(t), [], (m || t) + ' → 何も出ない');

// S1
eq(C('').findings, [], 'S1 空'); eq(C('   \n  ').findings, [], 'S1 空白だけ');
// S2 サンプル
const s = C(X.SAMPLE);
eq(s.findings.map(x => x.rule), ['hw-kana', 'date-wday', 'fw-digit', 'url-after', 'url-scheme', 'date-invalid', 'tag-dup', 'tag-many'], 'S2 サンプルの検出が過不足なし');
eq([s.stats.warn, s.stats.hint], [6, 2], 'S2 確認6・ヒント2');
tr(s.findings.every(x => X.SAMPLE.slice(x.start, x.end) === x.snippet || x.snippet.endsWith('…')), 'S2 snippet が本文と一致');
// S3 誤検知（出てはいけない）
none('比率は1:1と16:9です', 'S3 比率'); none('24:30にオープン', 'S3 24:30'); none('得点は10/50でした', 'S3 10/50'); none('3/4の人が', 'S3 3/4'); none('A4/10枚', 'S3 A4/10');
none('24/7営業です', 'S3 24/7'); none('2026.10.31（土）に開催です', 'S3 正しい曜日(年あり)'); none('10月31日（土）に開催です', 'S3 10月31日(土) 今年の暦で合う');
none('1つ目はこちら', 'S3 1つ目'); none('月に1回お届けします', 'S3 月に1回');
none('詳細 https://example.com/a_b?c=d#e 2026/10/31 です', 'S3 URL内の#と日付'); none('順位は #1 です', 'S3 #1');
none('ますます人々ははは', 'S3 ますます人々ははは');
none('25:30に動画が始まります', 'S3 25:30 は拾わない'); none('0120-12-3456まで', 'S3 電話番号'); none('サイズは1,000mm', 'S3 単位');
none('2024年2月29日にオープン', 'S3 閏日'); none('10/31(土)からです', 'S3 (土) は今年で合う');
// S4 文体
none('今日はお休みです。明日は開店します。', 'S4 丁寧体のみ'); none('今日は休みだ。明日は開ける。', 'S4 普通体のみ');
has('今日はお休みです。明日は開店する。', 'style-mix', 'S4 混在'); none('今日はお休みです。\nhttps://example.com\n#お知らせ #休み', 'S4 URL・タグ行は数えない');
none('今日は休み\n#休み', 'S4 体言止め');
// S5 文字数
eq(X.units('あ'.repeat(140)), 280, 'S5 140字=280'); not('あ'.repeat(140), 'len-over'); has('あ'.repeat(140) + 'a', 'len-over', 'S5 281');
let r5 = C('あ'.repeat(140) + 'ab').findings.filter(x => x.rule === 'len-over')[0]; eq([r5.start, r5.end], [140, 142], 'S5 超過位置は280ユニットの次の文字から');
eq(X.units('a'.repeat(280)), 280, 'S5 半角280'); eq(X.overflowIndex('a'.repeat(281), 280), 280, 'S5 281文字目');
eq(X.chars('😀a'), 2, 'S5 絵文字は1字'); eq(X.units('😀'), 2, 'S5 絵文字は2ユニット');
const corpusPath = path.join(__dirname, 'corpus.json');
if (fs.existsSync(corpusPath)) { const corp = JSON.parse(fs.readFileSync(corpusPath, 'utf8')); corp.forEach((c, i) => eq(X.units(c.s), c.u, 'S5 Python一致 #' + i + ' ' + c.s.slice(0, 12))); console.log('corpus', corp.length); }
// S6 全角半角
has('ＡＩを使う', 'fw-alpha'); has('１０個と5個', 'fw-digit'); eq(C('全品１０％オフ').findings.map(x => x.level), ['hint'], 'S6 全角数字のみ→ヒント');
eq(C('全品１０％オフと5個').findings.map(x => x.level), ['warn'], 'S6 全角数字+半角数字→確認'); has('ｱｲｳ', 'hw-kana');
has('（東京）と(大阪府)', 'br-mix'); none('(東京)だけ', 'S6 半角括弧のみ'); has('「こんにちは', 'br-open'); has('こんにちは」', 'br-close'); not('１）はい ２）いいえ', 'br-close', 'S6 全角の番号）は閉じ忘れとしない');
has('おはようございます、今日は晴れです。\nお昼にね,食べた', 'punct-mix'); none('Hello, world. It is fine', 'S6 英文のカンマは拾わない');
has('すごい！本当に!', 'mix-bang', 'S6 !と！'); has('本当に？ほんと?', 'mix-q', 'S6 ?と？');
eq(rules('すごい！本当に？').length, 0, 'S6 全角どうし→なし'); none('すごい！ https://example.com/a!b', 'S6 URL内の!は拾わない');
has('全角　スペースと 半角 スペース', 'mix-space'); none('全角　スペースだけ', 'S6 全角スペースのみ');
has('#a ＃b', 'tag-mix');
// S7 URL
has('見て ttps://x.example/a', 'url-scheme'); has('見て htps://x.example', 'url-scheme'); has('見て https:/x.example', 'url-scheme'); has('見て https//x.example', 'url-scheme'); has('見て https;//x.example', 'url-scheme');
has('見て https://', 'url-short'); has('見て https://example/a', 'url-host'); has('見て https://exa..mple.com', 'url-host'); has('見て http://localhost:3000/', 'url-local'); has('見て http://192.168.0.5/a', 'url-local');
has('見て https://x.example/。', 'url-after'); not('見て https://x.example/ ですよ', 'url-after'); has('見て https://x.example/a)', 'url-trail'); has('見て https://x.example/.', 'url-trail'); none('見て https://x.example/a_(b) ですよ', 'S7 ()を含むURL');
has('見て ｈｔｔｐｓ：／／ｘ．ｅｘａｍｐｌｅ', 'url-fwscheme'); has('見て https://x．example/a', 'url-fw');
has('https://x.example/a https://x.example/a/ 二回', 'url-dup'); has('https://bit.ly/abc', 'url-shorturl'); has('見て www.example.com', 'url-www'); not('見て https://www.example.com', 'url-www');
none('https://x.example/a と http://y.example:8080/b?c=1#d ですよ', 'S7 正しいURL2つ'); none('メール: a@b.example', 'S7 メール'); none('https://sub.example.co.jp/path', 'S7 co.jp');
// S8 日付
has('2/30に', 'date-invalid'); has('4月31日に', 'date-invalid'); has('13月5日に', 'date-invalid'); has('2025年2月29日に', 'date-invalid'); none('2024年2月29日', 'S8 閏日');
has('10/31(金)に', 'date-wday', 'S8 今年・来年とも合わず'); none('10/31(土)に', 'S8 今年の暦で合う'); none('10/31(日)に', 'S8 来年の暦で合う');
has('2026年10月31日（金）に', 'date-wday'); none('2026年10月31日（土）に', 'S8'); none('2026/10/31 土曜日に', 'S8'); has('2026/10/31 金曜日に', 'date-wday');
has('10/31(土)と10/31(日)', 'date-wday-diff'); has('12:75に', 'time-invalid'); has('午後15時に', 'time-ampm'); has('3時75分に', 'time-invalid'); none('午後3時15分に', 'S8'); none('12:30に', 'S8');
eq(C('10/31(金)に').findings[0].msg.includes('2026年は土曜日'), true, 'S8 メッセージに実際の曜日');
eq(X.check('10/31(金)に', { now: new Date(2027, 0, 5) }).findings.length, 1, 'S8 2027年起点でも判定が動く');
// S9 箇条書き
has('3つのポイント\n・A\n・B\n・C\n・D', 'list-count'); not('3つのポイント\n・A\n・B\n・C', 'list-count'); not('3つのポイントと5選です\n・A\n・B\n・C\n・D', 'list-count', 'S9 数の表現が2つ'); not('3つのポイントです', 'list-count'); not('3つのポイント\n・A', 'list-count', 'S9 箇条書き1行');
has('3つのコツ\n1. A\n2. B\n3. C\n4. D', 'list-count', 'S9 番号');
has('1,000円と2000円', 'money-mix'); none('1,000円と2,000円', 'S9'); none('2026年は100円', 'S9');
// S10 ハッシュタグ・打ち間違い
none('#a #b #c #d', 'S10 4個'); has('#a #b #c #d #e', 'tag-many'); has('#a #A', 'tag-dup'); has('#タグです', 'tag-sentence'); none('https://x.example/#a #b', 'S10 URL内');
has('をを', 'typo-dup'); has('ありがとうですです', 'typo-dup'); has('はい、、そうです', 'typo-dup'); has('はい。。そう', 'typo-dup'); none('はい。。。そう', 'S10 。。。は拾わない');
// レビュー①の反映（回帰）
['詳しくは https://example.com！', '詳しくは（https://example.com）', '詳しくは https://example.com？', '予約 https://example.com/reserve，どうぞ', 'https://example.com～'].forEach(t => { not(t, 'url-fw', 'R1 URLの直後の全角記号'); not(t, 'url-host', 'R1'); });
has('https://example.com！', 'url-after', 'R1 ヒントに回る'); has('見て https://x．example/a', 'url-fw'); has('見て https://x.example/ａ', 'url-fw', 'R1 全角英字はURLの中身');
not('5個入り\n・a\n・b', 'list-count', 'R2 個'); not('2点\n- a\n- b\n- c', 'list-count', 'R2 点'); has('3選\n・a\n・b\n・c\n・d', 'list-count', 'R2 選は見る');
eq(C('縮尺は1:75です').findings.map(x => x.level), ['hint'], 'R5 時刻でない文脈はヒント'); eq(C('12:75から開始します').findings.map(x => x.level), ['warn'], 'R5 時刻の文脈は確認');
not('A）りんご\nB）みかん', 'br-close', 'R6 英字の項目記号'); not('ア）りんご\nイ）みかん', 'br-close', 'R6'); has('りんご）です', 'br-close', 'R6 本物の閉じ忘れは出る');
{ const t = 'ttps://x.example/a' + '😀'.repeat(40); C(t).findings.forEach(x => { tr(!/[\uDC00-\uDFFF]/.test(t.charAt(x.start)) && !/[\uD800-\uDBFF]/.test(t.charAt(x.end - 1)), 'R7 範囲が絵文字を割らない ' + x.rule); }); }
eq(C('あ'.repeat(10001)).truncated, true, 'R4 10000字超は先頭だけ'); eq(C('あ'.repeat(10000)).truncated, false, 'R4'); eq(C('あ'.repeat(20000)).text.length, 10000, 'R4 切り詰め');
// 件数の上限・番号
const big = C('ｱ '.repeat(100) + 'をを'.repeat(100)); tr(big.findings.length <= 60, '件数の上限'); eq(big.findings.map(x => x.n), big.findings.map((_, i) => i + 1), '番号は連番');
// 位置の整合
['ttps://x.example/a ですよ', 'この ｽﾀｰﾄ は ＡＩ', X.SAMPLE].forEach(t => C(t).findings.forEach(x => { tr(x.start >= 0 && x.end <= t.length && x.end > x.start, '範囲が本文内 ' + x.rule); }));
// 性能: 10000字
const long = ('今日はお休みです。10/31(金)まで ｽﾀｰﾄ https://x.example/a #タグ ' + 'あ'.repeat(30)).repeat(100).slice(0, 10000);
const t0 = Date.now(); const rl = C(long); const dt = Date.now() - t0; console.log('10000字の検査', dt, 'ms', rl.findings.length, '件'); tr(dt < 500, 'S11 10000字が500ms未満');
console.log('合計', n, '件・失敗', f, '件'); process.exit(f ? 1 : 0);

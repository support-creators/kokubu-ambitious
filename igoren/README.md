# いごれん

国分アンビシャス広場の子どもの囲碁教室で、イゴロクの問題だけを解くための静的ページです。進級テスト、冒険マップ、CPU対局、先生用の画面はありません。記録は見ているブラウザの中だけに残り、サーバーや表計算シートへは送りません。

画面の文言は、小さなお子さんが読めるようにひらがなを中心にしています。

## 問題の取り出し方

元にしたのは [support-creators/kokubu-ambitious](https://github.com/support-creators/kokubu-ambitious) の `igo/index.html`（main、画面の表示は v0.5.1）です。このリポジトリは読んで中身を写しただけで、変更はしていません。

追加問題は、その HTML の `<script id="krPack" type="application/json">` に入っています。形式は `kokubu.problem-pack.v1`、pack の fingerprint は `a94de1209db8423e45e97ff7356985922ebdfee559ba86ff05343f47990bd8f4` です。

`problems` は 1,471 問で、`source` フィールドの内訳は次のとおりです。

| source | 内容 | 問数 |
| --- | --- | --- |
| `legacy` | もとの進級用 | 144 |
| `island` | 囲碁アイランド | 156 |
| `draft` | 新作 | 200 |
| `igoroku` | イゴロク | 971 |

このページに入れたのは `source === "igoroku"` の 971 問だけです。ID はすべて `IGOROKU-` で始まります。囲碁アイランド、新作、既存の 144 問は入れていません。

971 問はどれも `kind` が `move` で、出典の正解印（`result === "success"`）が付いた手順があります。元アプリの `KidPack.convert` と `verify`（ルールエンジン `GoEngine`）に通し、その手順が盤の上で最後まで打てることを確認してから、ページが読む形の JSON にしました。石の取り方、コウ、自殺手の判定と、正解・やり直しの見方は、そのアプリの練習モードに合わせています。出典に判定印のない分岐は失敗にせず、手を戻して別の手を探すよう表示します。

仮の級位（`assessment.gradeRange`）が付いているのは 125 問だけです（30〜28級が 37、27〜25級が 26、25〜21級が 62）。残りの 846 問は空欄だったので、級位では分けていません。リストは元の教材ごとのまとまり（だいたい 40〜50 問）です。

盤のルールと描画は `engine.js` に、元の `GoEngine` と `drawBoard` から写しています。13路・19路は、石と答えの周りだけを見せる切り取り方も元のアプリと同じです。元の資料自体が、その図が部分図か全局図かを未確認としています。座標は元データのままです。ランダムな回転はかけていません。教材の図と同じ向きで出すためです。

## あいことば

GitHub Pages にはサーバー側のパスワードがありません。問題そのものはブラウザの中で復号します。

公開するファイルに入るのは `problems.enc.json` だけです。中身は AES-256-GCM で、鍵はパスフレーズから PBKDF2-SHA256（60 万回以上、塩と IV は毎回ランダム）で作ります。暗号文の末尾には GCM の認証タグが付いていて、ブラウザの WebCrypto で復号できます。

ページを開くと「あいことば」を聞きます。合うと問題が出ます。違うと「あいことばが ちがうよ」と出ます。あいことばは `localStorage` にも `sessionStorage` にも保存しません。ページを開き直すと、また聞きます。解けた問題の印だけが、今までどおり `localStorage` の `igoren.v1` に残ります。

この錠の強さは、あいことばの強さと同じです。短い言葉や推測される言葉では守れません。HTML、CSS、JavaScript、見た目の文章は、あいことばがなくても誰でも読めます。隠れているのは問題データだけです。

作り直すときは、リポジトリの直下で次を実行します。パスフレーズは環境変数だけで渡し、引数には書きません。

```sh
IGOREN_PASSWORD='あいことば' node tools/build-encrypted.mjs igoren-problems.plain.json
```

シェルの履歴に残したくないときは、`read -s IGOREN_PASSWORD` で入力してから `export IGOREN_PASSWORD` し、終わったら `unset IGOREN_PASSWORD` してください。

できた `problems.enc.json` を、ページと同じ場所に置きます。平文の `igoren-problems.plain.json` と `problems.js` は公開しないでください。`.gitignore` にも入っています。

`index.html` をファイルとして直接開くと、暗号化ファイルを読めないブラウザがあります。ローカルでは静的サーバーで開きます。

```sh
python3 -m http.server 47321
```

## GitHub Pages で出すとき

ファイルはリポジトリの直下に置いてあります。`problems.enc.json` を置いてから公開します。

1. GitHub のリポジトリで Settings → Pages を開く
2. Build and deployment の Branch を `main`、フォルダを `/ (root)` にする
3. 保存する

しばらくすると `https://<ユーザー名>.github.io/<リポジトリ名>/` で開きます。検索避けに `noindex,nofollow` と `robots.txt` を付けていますが、アドレスを知っていればページ自体は開きます。

以前のコミット `ceb826c` には、平文の `problems.js` が残っています。ファイルを後から消しても、その履歴には問題が残ります。公開する前に、履歴ごと新しいリポジトリを作り直してください。

## 利用許可

イゴロクの問題をここに載せてよいかは、まだ権利者に確認できていません。確認が取れるまで、このページをインターネットに公開しないでください。教室の内部テスト用です。許可を得たとは書いていません。あいことばを付けても、利用許可の代わりにはなりません。

## ファイル

- `index.html` … ページ
- `style.css` … 見た目
- `app.js` … あいことば、画面、答え合わせ
- `engine.js` … 盤のルールと描画
- `problems.enc.json` … 暗号化した 971 問（作ったあとで置く）
- `tools/build-encrypted.mjs` … 平文 JSON を暗号化するための道具
- `robots.txt` … クローラを拒む
- `test/check.mjs` … 問数、着手の合法性、あいことばの確認

確認は `node test/check.mjs 平文.json` です。`problems.enc.json` がまだ無いときは、復号のブラウザ確認はスキップしたと表示します。あるときは、環境変数 `IGOREN_PASSWORD` のあいことばで 971 問が開くことと、違うあいことばが失敗することを見ます。

# しりとりアプリ

Deno + TypeScript で実装した、ブラウザで遊べるしりとりゲームです。
モードを選んでから遊ぶ構成になっており、今回は「通常モード」のみ実装しています。

アプリ本体は [`shiritori-deno/`](./shiritori-deno) にあります。

## デプロイ先URL

<!-- TODO: Deno Deploy 成功後に記入 -->

現時点では Deno Deploy へのデプロイ中に以下のビルドエラーが発生しており、
まだ公開できていません（対応中）。

```
Entrypoint at '/tmp/build/src/server.js' not found
```

ローカルでは `shiritori-deno/` ディレクトリで
`deno run -A --watch server.ts` を実行すると `http://localhost:8000` で動作します。

## 実装した機能

### 画面構成
1. モード選択画面 — モードを配列で定義し、そこから自動でボタンを生成している
   （`shiritori-deno/public/app.js` の `MODES`）。今後モードを追加する場合は
   配列に要素を追加するだけでよい構造にしてある。
2. モード説明画面 — 選んだモードの説明文と「ゲームスタート」ボタンを表示
3. ゲーム画面 — しりとり本体

### 必須仕様
- 直前の単語の表示
- 単語の入力・送信フォーム
- 接続判定（前の単語の末尾と入力単語の先頭が一致するか）とエラー表示
- 「ん」で終わる単語を入力するとゲーム終了
- すでに使った単語を入力するとゲーム終了
- リセット機能（ゲーム中・終了後どちらでも実行可能）

### 追加機能
- 単語履歴の一覧表示
- Wikipedia OpenSearch API を使い、実在しない単語を弾く
  （API が失敗した場合はゲーム進行を止めないよう、実在チェックをスキップして
  通過させる fail-open 方式にしている）

判定ロジックの詳細（判定の優先順位、長音「ー」の扱いなど未解決の点）は
[`shiritori-deno/ISSUES.md`](./shiritori-deno/ISSUES.md) にまとめている。

## 技術スタック

- 言語: TypeScript
- ランタイム: Deno
- サーバー: `Deno.serve` + `@std/http/file-server` の `serveDir`
- フロントエンド: 素の HTML / CSS / JavaScript（ビルドツールなし）

## ローカルでの起動方法

```bash
cd shiritori-deno
deno run -A --watch server.ts
```

`http://localhost:8000` にアクセスする。

## 参考にしたWebサイト

- Deno公式ドキュメント（[docs.deno.com](https://docs.deno.com) / [deno.land](https://deno.land)）
  — `Deno.serve` の使い方、`@std/http/file-server` の `serveDir` の使い方の確認

## AIの活用について

- **どの部分に使ったか**: 実装手順書（フェーズ分け・ステップ分割）の作成、
  `server.ts` のAPI実装、しりとりの判定ロジック（接続判定・「ん」判定・既出判定の
  優先順位設計）、Wikipedia OpenSearch API との連携部分、フロントエンドの
  画面切り替えJS、README のたたき台作成
- **どう使ったか**: Claude Code と対話しながら実装方針・判定順序・未決事項を
  すり合わせ、Claude Code にコードを実装させた上で、動作確認（curl でのAPI検証、
  各終了条件の実機テスト）を行い、内容を自分で理解・確認した。

# しりとりアプリ

Deno + TypeScript で実装するブラウザ動作のしりとりゲームです。

## デプロイ先 URL

<!-- TODO: Deno Deploy 後に記入 -->

## 機能（予定）

- 直前の単語の表示
- 単語入力フォームと送信ボタン
- しりとりバリデーション
- 「ん」で終わる単語でゲーム終了
- 過去に使用した単語でゲーム終了
- リセット機能
- 単語履歴の一覧表示
- Wikipedia OpenSearch API による実在単語チェック

## 技術スタック

- 言語: TypeScript / JavaScript
- ランタイム: Deno
- デプロイ: Deno Deploy（予定）

## ローカルでの起動方法

```bash
cd shiritori-deno
deno run -A --watch server.ts
```

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
- Yahoo! JAPAN テキスト解析API「ルビ振り(V2)」による読み取得と、
  読みベースの接続判定（長音「ー」・カタカナ表記・漢字表記に対応）

## 技術スタック

- 言語: TypeScript / JavaScript
- ランタイム: Deno
- デプロイ: Deno Deploy（予定）

## かな変換API（読みベース接続判定）について

「タクシー」→「い」から始まる単語、のように長音や漢字表記が絡む接続判定を
正しく行うため、入力単語の読み（ひらがな）を Yahoo! JAPAN テキスト解析API
「ルビ振り(V2)」で取得し、正規化（カタカナ→ひらがな、長音「ー」を直前の
母音に変換）した上で前後の単語の接続を判定しています。

- 参考: [ルビ振り(V2) - Yahoo!デベロッパーネットワーク](https://developer.yahoo.co.jp/webapi/jlp/furigana/v2/furigana.html)
- API利用には Client ID（アプリケーションID）が必要です。取得は各自
  [Yahoo!デベロッパーネットワーク](https://developer.yahoo.co.jp/) で行ってください。
- 取得した Client ID はコードに直接書かず、環境変数 `YAHOO_APP_ID` で渡します。
  - ローカル: `.env` などに保存し、シェルの環境変数として渡す（`.env` はコミットしない）
  - Deno Deploy: プロジェクトの Environment Variables に `YAHOO_APP_ID` を設定する
- `YAHOO_APP_ID` が未設定、またはAPI呼び出しが失敗した場合はエラーにせず、
  入力単語の表記そのものを使った従来の接続判定にフォールバックします
  （しりとりの進行自体は止まりません）。
- Yahoo!デベロッパーネットワークの利用規約に基づき、`public/index.html` の末尾に
  規定のクレジット表示（「Webサービス by Yahoo! JAPAN」テキストリンク）を設置しています。
  HTMLソース・配置位置・見た目は変更しないでください。

## ローカルでの起動方法

1. `shiritori-deno/.env` の `YAHOO_APP_ID=` の右側に、取得した Client ID を貼り付ける
   （`.env` は `.gitignore` で除外済みなので GitHub には上がらない。未設定のままでも
   表記ベースの判定にフォールバックして動作する）
2. 以下を実行する

```bash
cd shiritori-deno
deno task dev
```

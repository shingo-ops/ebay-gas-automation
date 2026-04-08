# セットアップガイド

このガイドでは、eBay API スプレッドシートツールの初期セットアップ手順を説明します。

## 目次
1. [前提条件](#前提条件)
2. [eBay Developer アカウントの作成](#ebay-developer-アカウントの作成)
3. [Google スプレッドシートの準備](#google-スプレッドシートの準備)
4. [コードのデプロイ](#コードのデプロイ)
5. [設定の入力](#設定の入力)
6. [認証の実行](#認証の実行)
7. [動作確認](#動作確認)

---

## 前提条件

以下のアカウントとアクセス権限が必要です：

- **Google アカウント**: スプレッドシート作成に必要
- **eBay アカウント**: eBay Developer Program 登録に必要
- **インターネット接続**: API 通信に必要

---

## eBay Developer アカウントの作成

### 1. eBay Developer Program に登録

1. [eBay Developer Program](https://developer.ebay.com/) にアクセス
2. 「Join Now」または「Sign In」をクリック
3. eBay アカウントでログイン（アカウントがない場合は作成）
4. 利用規約に同意して登録を完了

### 2. アプリケーションキーセットの取得

1. Developer Program ダッシュボードにログイン
2. 「My Account」→「Application Keys」に移動
3. 新しいアプリケーションを作成：
   - Application Title: `eBay Spreadsheet Tool`（任意の名前）
   - Application Description: スプレッドシートツールの説明を入力

### 3. Sandbox Keys の取得

1. 「Sandbox Keys」セクションで「Create a keyset」をクリック
2. 以下の情報を取得（後で使用）：
   - **App ID (Client ID)**: `YOUR_CLIENT_ID_HERE`
   - **Cert ID (Client Secret)**: `YOUR_CLIENT_SECRET_HERE`
   - **Dev ID**: 必要に応じて取得

### 4. Production Keys の取得（本番環境用）

1. 「Production Keys」セクションで「Create a keyset」をクリック
2. Sandbox Keys と同様に情報を取得
3. **重要**: 本番環境では実際の取引が発生するため、テスト完了後に使用

### 5. Redirect URL の設定（Authorization Code Grant 用）

1. Application Settings で Redirect URL を設定
2. 推奨設定: `https://localhost`（テスト用）
3. 本番環境では実際の Web アプリの URL を設定

---

## Google スプレッドシートの準備

### 1. スプレッドシートの作成

1. [Google スプレッドシート](https://sheets.google.com/) にアクセス
2. 新しいスプレッドシートを作成
3. ファイル名を設定（例: `eBay API ツール`）

### 2. Apps Script エディタを開く

1. メニューバーから「拡張機能」→「Apps Script」を選択
2. Apps Script エディタが新しいタブで開きます
3. デフォルトの `Code.gs` が表示されます

---

## コードのデプロイ

### 方法 A: 手動コピー（推奨・簡単）

1. **ファイルの作成**
   - Apps Script エディタで、左サイドバーの「+」ボタンをクリック
   - 「スクリプト」を選択して以下のファイルを作成：
     - `Code.gs`
     - `Config.gs`
     - `OAuth.gs`
     - `EbayAPI.gs`
     - `Utils.gs`
     - `Products.gs`
     - `Inventory.gs`

2. **コードのコピー**
   - 本プロジェクトの `src/` フォルダ内の各ファイルの内容をコピー
   - 対応する Apps Script ファイルにペースト

3. **保存**
   - すべてのファイルを保存（Ctrl+S / Cmd+S）
   - プロジェクト名を設定（例: `eBay API Tool`）

### 方法 B: clasp を使用（高度）

clasp（Command Line Apps Script Projects）を使用すると、コマンドラインからデプロイできます。

1. **clasp のインストール**
   ```bash
   npm install -g @google/clasp
   ```

2. **Google アカウントにログイン**
   ```bash
   clasp login
   ```

3. **プロジェクトのクローン**

   既存のスクリプトの場合：
   ```bash
   # スプレッドシートから Script ID を取得
   # URL: https://script.google.com/.../.../edit の部分
   clasp clone <SCRIPT_ID>
   ```

   新規作成の場合：
   ```bash
   cd 02_apps/ebay-spreadsheet-tool
   clasp create --type sheets --title "eBay API Tool"
   ```

4. **コードをプッシュ**
   ```bash
   cd 02_apps/ebay-spreadsheet-tool
   clasp push
   ```

5. **ブラウザで開く**
   ```bash
   clasp open
   ```

---

## 設定の入力

### 1. Config.gs の編集

Apps Script エディタで `Config.gs` を開き、以下の値を入力します：

```javascript
const CONFIG = {
  // eBay API 認証情報（必須）
  EBAY_CLIENT_ID: 'あなたの Client ID をここに入力',
  EBAY_CLIENT_SECRET: 'あなたの Client Secret をここに入力',

  // 環境設定（開発時は SANDBOX を使用）
  EBAY_ENVIRONMENT: 'SANDBOX', // 'SANDBOX' または 'PRODUCTION'

  // マーケットプレイス設定
  EBAY_MARKETPLACE_ID: 'EBAY_US', // EBAY_US, EBAY_GB, EBAY_DE など

  // その他の設定は変更不要
  ...
};
```

### 2. スクリプトプロパティへの保存（推奨）

セキュリティのため、認証情報はスクリプトプロパティに保存することを推奨します：

1. Apps Script エディタで「プロジェクトの設定」（歯車アイコン）をクリック
2. 「スクリプト プロパティ」セクションで「プロパティを追加」
3. 以下のプロパティを追加：
   - `EBAY_CLIENT_ID`: あなたの Client ID
   - `EBAY_CLIENT_SECRET`: あなたの Client Secret
   - `EBAY_ENVIRONMENT`: `SANDBOX` または `PRODUCTION`
   - `EBAY_MARKETPLACE_ID`: `EBAY_US` など

4. スクリプトプロパティを使用すると、`Config.gs` のハードコードされた値より優先されます

---

## 認証の実行

### 1. スプレッドシートの権限承認

初回実行時、Google がスクリプトの権限を要求します：

1. スプレッドシートに戻る（リロードが必要な場合があります）
2. カスタムメニュー「eBay API」が表示されます
3. 任意のメニュー項目をクリック
4. 「承認が必要です」ダイアログが表示されたら「権限を確認」をクリック
5. Google アカウントを選択
6. 「このアプリは確認されていません」と表示される場合：
   - 「詳細」をクリック
   - 「（プロジェクト名）に移動」をクリック
7. 要求された権限を確認して「許可」をクリック

### 2. eBay API 認証（Client Credentials Grant）

1. スプレッドシートのメニューから「eBay API」→「認証」を選択
2. 自動的に Client Credentials Grant でトークンを取得します
3. 成功すると、アクセストークンが内部に保存されます（有効期限: 2時間）

### 3. 認証状態の確認

Apps Script エディタで以下を実行して認証を確認：

1. エディタで `OAuth.gs` を開く
2. 関数 `testAuthentication` を選択
3. 「実行」ボタンをクリック
4. 実行ログを確認（「表示」→「ログ」）

---

## 動作確認

### 1. 設定の確認

1. Apps Script エディタで `Config.gs` を開く
2. 関数 `showConfigInfo` を選択
3. 「実行」ボタンをクリック
4. ログに設定情報が表示されることを確認

### 2. API 接続テスト

1. Apps Script エディタで `EbayAPI.gs` を開く
2. 関数 `testApiConnection` を選択
3. 「実行」ボタンをクリック
4. ログに以下が表示されれば成功：
   ```
   === API 接続テスト ===
   ✓ 設定OK
   ✓ トークンOK
   商品検索テストを実行します...
   ✓ API 接続成功
   検索結果: XXX 件
   ```

### 3. 商品検索テスト

1. スプレッドシートに戻る
2. メニューから「eBay API」→「商品検索」を選択
3. 検索キーワードを入力（例: `laptop`）
4. 検索結果が「商品マスタ」シートに表示されることを確認

---

## トラブルシューティング

### 認証エラー

**エラー**: `設定エラー: eBay Client ID が設定されていません`

**解決方法**:
- `Config.gs` の `EBAY_CLIENT_ID` と `EBAY_CLIENT_SECRET` が正しく入力されているか確認
- スクリプトプロパティを使用している場合は、プロパティ名が正確か確認

**エラー**: `トークン取得に失敗しました`

**解決方法**:
- Client ID と Client Secret が正しいか確認
- eBay Developer Program のステータスページで API の稼働状況を確認
- Sandbox 環境の場合は `EBAY_ENVIRONMENT` が `SANDBOX` に設定されているか確認

### スクリプトの権限エラー

**エラー**: `このアプリは確認されていません`

**解決方法**:
- 「詳細」→「（プロジェクト名）に移動」をクリックして権限を付与
- これは開発中の自作スクリプトの場合に表示される正常な動作です

### API 呼び出しエラー

**エラー**: `API エラー (401): Unauthorized`

**解決方法**:
- トークンの有効期限が切れている可能性があります（2時間）
- 再度認証を実行してください

**エラー**: `API エラー (429): Too Many Requests`

**解決方法**:
- API レート制限に達しています
- しばらく待ってから再試行してください
- `Config.gs` の `RATE_LIMIT_DELAY` を増やしてください

---

## 次のステップ

セットアップが完了したら、[使用方法ガイド](usage.md) を参照して実際の機能を試してみてください。

## サポート

問題が解決しない場合は、以下を確認してください：

- [eBay Developer Program ドキュメント](https://developer.ebay.com/docs)
- [Google Apps Script ドキュメント](https://developers.google.com/apps-script)
- プロジェクトの `docs/ebay_api_comprehensive_research.md` で API の詳細を確認

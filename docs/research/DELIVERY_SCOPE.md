# eBay利益計算ツール - 納品機能範囲

**作成日**: 2026年3月28日
**目的**: 納品時に含まれる機能と除外される機能を明確化

---

## ✅ 納品時に含まれる機能

### 1. トリガー設定機能

**ファイル**: Setup.gs

| 関数名 | 機能 | 用途 |
|--------|------|------|
| `completeInitialSetup()` | ワンクリック初期設定 | 権限承認+トリガー設定+検証を一括実行 |
| `setupOnOpenTrigger()` | onOpenトリガー設定 | スプレッドシートを開いたときにメニュー自動表示 |
| `enableEditTrigger()` | 編集時トリガー有効化 | URL編集時の自動カテゴリ取得（オプション） |
| `disableEditTrigger()` | 編集時トリガー無効化 | トリガー無効化 |
| `removeAllTriggers()` | 全トリガー削除 | トラブル時のリセット |
| `showTriggers()` | トリガー一覧表示 | 設定確認 |

**納品理由**: スプレッドシート運用に必須

---

### 2. Item URLからの商品情報取得

**ファイル**: EbayAPI.gs, Functions.gs

| 関数名 | 機能 | 取得データ |
|--------|------|----------|
| `getCategoryFromUrl()` | URLからカテゴリ取得 | 商品タイトル、カテゴリID、カテゴリ名 |
| `extractItemIdFromUrl()` | URLから商品ID抽出 | Item ID |
| `getItemFromEbay()` | eBay API商品情報取得 | 商品詳細 |
| `getProductInfoFromUrl()` | 商品情報統合取得 | タイトル、カテゴリ、画像、価格等 |

**取得データ**:
- 商品タイトル（Title）
- カテゴリID（Category ID）
- カテゴリ名（Category Name）

**納品理由**:
- リサーチシートB8セル（Item URL）から商品情報を自動取得
- 手動入力の手間を削減

---

### 3. 画像URL取得

**ファイル**: EbayAPI.gs, ImageHandler.gs

| 関数名 | 機能 | 処理内容 |
|--------|------|----------|
| `getProductInfoFromUrl()` | 商品情報取得（画像含む） | eBay APIから画像URLを取得 |
| `downloadAndSaveImage()` | 画像ダウンロード | 画像URLから画像をダウンロードしてGoogleドライブに保存 |
| `extractFolderId()` | フォルダID抽出 | GoogleドライブURLからフォルダIDを抽出 |

**取得データ**:
- 画像URL（eBay API）
- Googleドライブ保存URL（保存後）

**納品理由**:
- リサーチシートG11セル（画像URL）から画像を取得
- Googleドライブに保存してURLを出品シートに転記

---

### 4. 出品シートへの転記

**ファイル**: Functions.gs

| 関数名 | 機能 | 転記データ |
|--------|------|----------|
| `transferListingData()` | リサーチ→出品転記 | 全出品データ |
| `findEmptyRowInColumn()` | 空白行検索 | 転記先行を自動検出 |
| `getColumnByHeader()` | ヘッダー列検索 | 動的列マッピング |

**転記データ**:
- リサーチ担当（Research Staff）
- 商品タイトル（Title）
- カテゴリID（Category ID）
- カテゴリ名（Category Name）
- 仕入れ価格（Cost）
- 販売価格（Selling Price）
- 利益（Profit）
- 利益率（Profit Margin）
- 画像URL（Image 1）
- その他リサーチシートのデータ

**納品理由**:
- リサーチシートから出品シートへのデータ転記は主要機能
- ヘッダーマッピングにより柔軟な列配置に対応

---

### 5. スペックURLからのItem Specifics取得

**ファイル**: EbayAPI.gs, Functions.gs

| 関数名 | 機能 | 取得データ |
|--------|------|----------|
| `getItemSpecifics()` | Item Specifics取得 | 商品仕様（スペック） |
| `sortItemSpecifics()` | スペック並び替え | 優先度順ソート |
| `applyItemSpecificsColors()` | スペック色分け | 優先度別色分け |

**取得データ**:
- Item Specifics（商品仕様）
  - Brand（ブランド）
  - Model（モデル）
  - Type（タイプ）
  - Color（カラー）
  - Size（サイズ）
  - その他スペック

**処理内容**:
1. スペックURLから商品IDを抽出
2. eBay APIでItem Specificsを取得
3. 優先度順にソート（REQUIRED → RECOMMENDED → その他）
4. 色分け（赤 → 青 → グレー）
5. 出品シートに転記

**納品理由**:
- リサーチシートD8セル（スペックURL）からスペックを取得
- eBay出品に必要な商品仕様を自動取得

---

### 6. メニュー機能

**ファイル**: Menu.gs

```
初期設定メニュー
├── ワンクリック初期設定（推奨）
├── 設定を表示
├── 設定を検証
└── 個別設定（上級者向け）

eBay APIメニュー
├── 出品（transferListingData）
├── URLからカテゴリ取得（getCategoryFromUrl）
└── eBay API接続テスト
```

**納品理由**:
- ユーザーが機能を実行するためのUI
- 初期設定と日常業務の両方に対応

---

### 7. 設定管理機能

**ファイル**: Config.gs, Setup.gs

| 関数名 | 機能 | 用途 |
|--------|------|------|
| `getEbayConfig()` | 設定読み込み | ツール設定シートから設定を取得 |
| `validateConfig()` | 設定検証 | 必須項目の入力チェック |
| `showConfig()` | 設定表示 | 現在の設定を表示 |
| `checkConfig()` | 設定検証実行 | 設定の妥当性確認 |

**設定項目**:
- eBay App ID
- eBay Cert ID
- eBay Dev ID
- Sandbox モード（本番/テスト切り替え）
- 画像フォルダURL（Googleドライブ）
- 出品シートURL
- カテゴリマスタURL

**納品理由**:
- eBay API認証情報の管理
- ユーザーごとの設定カスタマイズ

---

### 8. OAuth認証機能

**ファイル**: Config.gs

| 関数名 | 機能 | 用途 |
|--------|------|------|
| `getOAuthToken()` | OAuthトークン取得 | eBay API認証 |
| `testOAuthToken()` | トークンテスト | 認証確認 |

**納品理由**:
- eBay APIへのアクセスに必須
- Client Credentials Grantフローで自動取得

---

## ❌ 納品時に除外される機能

### 1. 開発・デバッグ用ファイル（17ファイル）

**.claspignore で除外**:
- CheckFormulas.gs
- DetailedInspection.gs
- DiagnoseNoDataIssue.gs
- FixNoDataIssues.gs
- FixRefError.gs
- InspectAllShippingSheets.gs
- InspectExcludeListMisalignment.gs
- InspectFormulas.gs
- InspectRefError.gs
- InspectRow13Detail.gs
- InspectSearchBaseSheet.gs
- InspectSheet.gs
- InvestigateQColumnValidation.gs
- SaveInvestigationResults.gs
- VerifyCurrentState.gs
- VerifyHeaderMapping.gs

**除外理由**: 開発時のデバッグ・検証用、本番運用では不要

---

### 2. clasp関連ファイル

**手動削除**:
- `.clasp.json`（claspプロジェクト設定）
- `.clasprc.json`（clasp認証情報）
- `node_modules/`（開発依存パッケージ）

**除外理由**:
- ローカル開発環境専用
- 納品先には不要
- セキュリティリスク（認証情報含む）

---

### 3. Test.gs（テスト関数）

**除外を推奨**:
```javascript
function testImageDownload()
function testImageInfo()
function testEbayApi()
function testOAuthToken()
```

**除外理由**:
- 開発時のAPI接続テスト用
- 本番運用では使用しない
- ただし、メニュー「eBay API」→「eBay API接続テスト」で呼び出し可能なため、トラブルシューティング用に残すことも検討

**推奨**: Test.gsを .claspignore に追加（現在はコメントアウト状態）

---

## 📋 納品ファイル一覧

### コアファイル（8ファイル）

| ファイル名 | 行数 | 役割 |
|-----------|------|------|
| **appsscript.json** | 16行 | OAuthスコープ定義 |
| **Config.gs** | ~300行 | 設定管理・OAuth認証 |
| **EbayAPI.gs** | ~500行 | eBay API連携 |
| **Functions.gs** | ~400行 | データ転記・カテゴリ取得 |
| **ImageHandler.gs** | ~150行 | 画像ダウンロード・保存 |
| **Menu.gs** | ~40行 | メニュー定義 |
| **Setup.gs** | ~370行 | 初期設定・トリガー管理 |
| **Utils.gs** | ~100行 | ユーティリティ関数 |

**合計**: 約1,876行

---

## 🔐 必須OAuthスコープ（appsscript.json）

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

| スコープ | 用途 | 必須理由 |
|---------|------|---------|
| `spreadsheets` | スプレッドシート読み書き | データ転記、設定読み込み |
| `drive` | Googleドライブアクセス | 画像保存フォルダアクセス |
| `drive.file` | ドライブファイル作成 | 画像ファイル作成 |
| `script.external_request` | 外部URL取得 | eBay API呼び出し、画像ダウンロード |
| `script.scriptapp` | トリガー管理 | トリガー作成・削除・一覧取得 |

**納品時の扱い**:
- ✅ **削除しない**: appsscript.json は納品必須
- ✅ **理由**: スプレッドシート上での関数実行に必要
- ❌ **clasp run とは無関係**: ローカル実行用ではない

---

## 📖 納品時のユーザーマニュアル

### 納品ドキュメント一覧

| ドキュメント | 用途 | 納品推奨 |
|------------|------|---------|
| **PRODUCTION_SETUP_GUIDE.md** | 実運転初期設定ガイド | ✅ 必須 |
| **IMAGE_BUTTON_FUNCTIONS.md** | 画像ボタン設置ガイド | ✅ 必須 |
| **ONE_CLICK_SETUP_EVIDENCE.md** | ワンクリック初期設定エビデンス | ⚠️ 参考資料 |
| **MENU_DISPLAY_EVIDENCE.md** | メニュー表示エビデンス | ⚠️ 参考資料 |
| **SETUP_CONSOLIDATION_EVIDENCE.md** | コード統合エビデンス | ❌ 開発用 |
| **SETUP_CODE_ANALYSIS.md** | コード分析エビデンス | ❌ 開発用 |

**推奨**:
- ユーザー向けガイドのみ納品
- 開発エビデンスは除外

---

## 🎯 納品時の初期設定手順（ユーザー向け）

### Step 1: ツール設定シートの準備

スプレッドシートに「ツール設定」シートを作成し、以下を入力：
- eBay App ID
- eBay Cert ID
- eBay Dev ID
- Sandbox: FALSE（本番環境）
- 画像フォルダURL（Googleドライブ）
- 出品シートURL
- カテゴリマスタURL

---

### Step 2: ワンクリック初期設定

1. メニュー「初期設定」→「ワンクリック初期設定（推奨）」をクリック
2. 権限承認画面で「許可」をクリック
3. 完了メッセージを確認
4. スプレッドシートをリロード（F5キー）

**実行内容**:
- ✅ 権限承認（5つのOAuthスコープ）
- ✅ onOpenトリガー設定（メニュー自動表示）
- ✅ 設定検証（必須項目チェック）

---

### Step 3: 日常業務

#### メイン機能: 出品

1. リサーチシートにデータを入力
   - B8セル: Item URL
   - D8セル: スペックURL（オプション）
   - G11セル: 画像URL
   - その他: 仕入れ価格、販売価格等

2. メニュー「eBay API」→「出品」をクリック
   または画像ボタン「📦 出品」をクリック

3. 処理内容:
   - Item URLから商品タイトル・カテゴリを取得
   - スペックURLからItem Specificsを取得
   - 画像URLから画像をダウンロード
   - すべてのデータを出品シートに転記

---

## 🔬 納品前チェックリスト

### コード

- ✅ appsscript.json に5つのOAuthスコープが定義されている
- ✅ Setup.gs に `completeInitialSetup()` 関数が実装されている
- ✅ Menu.gs に「ワンクリック初期設定」メニューが配置されている
- ✅ Functions.gs に `transferListingData()` 関数が実装されている
- ✅ EbayAPI.gs に商品情報取得・スペック取得機能が実装されている
- ✅ ImageHandler.gs に画像ダウンロード機能が実装されている
- ✅ .claspignore で開発用ファイルが除外されている

### ドキュメント

- ✅ PRODUCTION_SETUP_GUIDE.md が作成されている
- ✅ IMAGE_BUTTON_FUNCTIONS.md が作成されている
- ❌ 開発エビデンスファイルは除外する

### 削除対象

- ❌ .clasp.json を削除
- ❌ .clasprc.json を削除（存在する場合）
- ❌ node_modules/ を削除（存在する場合）
- ⚠️ Test.gs を .claspignore に追加するか検討

---

## ✅ 結論

### 納品機能範囲

**5つの主要機能**:
1. ✅ トリガー設定（onOpen, onEdit）
2. ✅ Item URLから商品タイトル・カテゴリ取得
3. ✅ 画像URL取得・ダウンロード
4. ✅ 出品シートへのデータ転記
5. ✅ スペックURLからItem Specifics取得

**納品ファイル**:
- コアファイル: 8ファイル（約1,876行）
- ドキュメント: 2ファイル（ユーザーガイドのみ）

**除外ファイル**:
- 開発用ファイル: 17ファイル
- clasp関連: 2-3ファイル
- 開発エビデンス: 4ファイル

**OAuthスコープ**:
- 必須5スコープ（clasp run とは無関係）
- appsscript.json は納品必須

---

**最終更新**: 2026年3月28日
**ステータス**: ✅ 納品範囲確定

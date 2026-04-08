# 初期設定コード分析レポート

## 📊 全ファイル調査結果

### 調査対象ファイル: 25ファイル

---

## 🎯 初期設定関連コードの分類

### 1. **Setup.gs（現在の配置）**

#### 権限承認関連
- `authorizePermissions()` - 全権限承認実行
- `showAuthorizationGuide()` - 権限承認ガイド表示

#### トリガー管理
- `enableEditTrigger()` - 編集時トリガー有効化
- `disableEditTrigger()` - 編集時トリガー無効化
- `showTriggers()` - トリガー一覧表示
- `onEdit(e)` - 編集時実行関数

#### 設定管理
- `initialSetup()` - 初期セットアップ実行
- `showConfig()` - 設定表示
- `checkConfig()` - 設定検証

**判定**: ✅ **適切に配置済み**

---

### 2. **InstallTrigger.gs（統合対象）**

#### トリガー設定
- `setupOnOpenTrigger()` - onOpenトリガー設定
- `removeAllTriggers()` - 全トリガー削除

**判定**: ⚠️ **Setup.gsに統合すべき**
- 理由: トリガー管理機能はSetup.gsに集約するべき
- Setup.gsには既にトリガー管理機能があり、重複している

---

### 3. **Config.gs（OAuth関連のみ検討）**

#### 設定読み込み（保持）
- `getConfig()` - ツール設定シート読み込み
- `getEbayConfig()` - eBay設定取得
- `extractSpreadsheetId()` - スプレッドシートID抽出
- `validateConfig()` - 設定検証

#### OAuth管理（移動検討）
- `getOAuthToken()` - OAuthトークン取得
- `clearOAuthToken()` - OAuthトークンクリア

**判定**: △ **OAuth関連は保持**
- 理由: OAuthトークンは実運転でも頻繁に使用される
- Config.gsは設定読み込みの中核なので、OAuth関連も含めて保持が適切

---

### 4. **Menu.gs（独立保持）**

#### メニュー定義
- `onOpen()` - メニュー構築
- `onInstall(e)` - インストール時メニュー構築

**判定**: ✅ **独立ファイルとして保持**
- 理由: メニュー定義は独立した機能
- onOpen()はトリガーとして動作するため、専用ファイルが適切

---

### 5. **開発/デバッグ用ファイル（実運転では不要）**

以下のファイルは開発・検証用で、実運転では使用しない：

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
- Test.gs
- VerifyCurrentState.gs
- VerifyHeaderMapping.gs

**判定**: ℹ️ **開発用として保持（デプロイから除外可能）**

---

## 🔧 統合計画

### Phase 1: InstallTrigger.gs → Setup.gs 統合

**移動する関数**:
1. `setupOnOpenTrigger()` → Setup.gsに統合
2. `removeAllTriggers()` → Setup.gsに統合

**移動後の削除**:
- InstallTrigger.gs ファイルを削除

---

### Phase 2: Setup.gs 構造整理

**セクション分け**:

```javascript
// ==========================================
// 1. 権限承認セクション
// ==========================================
function authorizePermissions() { ... }
function showAuthorizationGuide() { ... }

// ==========================================
// 2. トリガー管理セクション
// ==========================================
function setupOnOpenTrigger() { ... }      // InstallTriggerから移動
function enableEditTrigger() { ... }
function disableEditTrigger() { ... }
function removeAllTriggers() { ... }       // InstallTriggerから移動
function showTriggers() { ... }
function onEdit(e) { ... }

// ==========================================
// 3. 設定管理セクション
// ==========================================
function initialSetup() { ... }
function showConfig() { ... }
function checkConfig() { ... }
```

---

## 📋 実装後のファイル構成

### 実運転で使用するファイル（9ファイル）

1. **Setup.gs** - 初期設定・権限・トリガー管理（統合後）
2. **Menu.gs** - メニュー定義
3. **Config.gs** - 設定読み込み・OAuth管理
4. **Functions.gs** - データ転記処理
5. **EbayAPI.gs** - eBay API連携
6. **ImageHandler.gs** - 画像処理
7. **Utils.gs** - ユーティリティ関数
8. **appsscript.json** - プロジェクト設定

### 開発/デバッグ用ファイル（17ファイル）

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
- Test.gs
- VerifyCurrentState.gs
- VerifyHeaderMapping.gs

---

## ✅ 実装推奨事項

### 優先度: 高

1. **InstallTrigger.gsをSetup.gsに統合**
   - トリガー管理機能を一箇所に集約
   - InstallTrigger.gsを削除

2. **Setup.gsのコメント整理**
   - セクション分けを明確化
   - 各関数の役割を明記

### 優先度: 中

3. **開発用ファイルの整理**
   - `dev/` フォルダを作成
   - 開発用ファイルを移動
   - `.claspignore` で本番デプロイから除外

### 優先度: 低

4. **ドキュメント作成**
   - 初期設定手順書
   - トリガー設定ガイド
   - トラブルシューティング

---

## 📝 エビデンス確立

### 初期設定関連コードの完全リスト

| ファイル | 関数名 | 用途 | 統合先 |
|---------|--------|------|--------|
| Setup.gs | authorizePermissions | 権限承認 | ✅ 配置済み |
| Setup.gs | showAuthorizationGuide | ガイド表示 | ✅ 配置済み |
| Setup.gs | initialSetup | 初期セットアップ | ✅ 配置済み |
| Setup.gs | showConfig | 設定表示 | ✅ 配置済み |
| Setup.gs | checkConfig | 設定検証 | ✅ 配置済み |
| Setup.gs | enableEditTrigger | トリガー有効化 | ✅ 配置済み |
| Setup.gs | disableEditTrigger | トリガー無効化 | ✅ 配置済み |
| Setup.gs | showTriggers | トリガー一覧 | ✅ 配置済み |
| Setup.gs | onEdit | 編集時実行 | ✅ 配置済み |
| InstallTrigger.gs | setupOnOpenTrigger | onOpenトリガー設定 | ⚠️ Setup.gsへ移動 |
| InstallTrigger.gs | removeAllTriggers | 全トリガー削除 | ⚠️ Setup.gsへ移動 |
| Config.gs | getOAuthToken | OAuthトークン取得 | ✅ Config.gsに保持 |
| Config.gs | clearOAuthToken | OAuthトークンクリア | ✅ Config.gsに保持 |
| Config.gs | validateConfig | 設定検証 | ✅ Config.gsに保持 |
| Menu.gs | onOpen | メニュー構築 | ✅ Menu.gsに保持 |
| Menu.gs | onInstall | インストール時 | ✅ Menu.gsに保持 |

**合計**: 16関数
- Setup.gs配置済み: 9関数 ✅
- 移動必要: 2関数 ⚠️
- 現状維持: 5関数 ✅

---

## 🎯 結論

**統合対象**: InstallTrigger.gs（2関数）のみ

**実運転用コアファイル**: 8ファイル
1. Setup.gs（統合後）
2. Menu.gs
3. Config.gs
4. Functions.gs
5. EbayAPI.gs
6. ImageHandler.gs
7. Utils.gs
8. appsscript.json

**次のステップ**: InstallTrigger.gsの内容をSetup.gsに統合し、ファイルを削除

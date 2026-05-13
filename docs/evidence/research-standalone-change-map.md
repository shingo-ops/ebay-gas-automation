# リサーチシート スタンドアロン分離 変更マップ

**作成日:** 2026-05-11  
**PR #55 エビデンス**  
**調査対象:** `gas/research/container/` + `gas/research/lowest-price/`  
**調査方法:** grep による全量特定（コード変更なし）

---

## サマリー

| 種別 | 件数 | 最大難易度 |
|------|------|------------|
| getActiveSpreadsheet() | **40箇所** | 🔴 Config.gs:9 グローバル変数 |
| PropertiesService | **12箇所** | 🔴 OAuthトークン (クライアント固有) |
| getUi() | **72箇所** | 🟠 バインド側への全移動が必要 |
| LockService.getScriptLock() | **6箇所** | 🟡 getUserLock() に置換 |
| onOpen / トリガー | **17箇所** | 🟠 バインドスクリプトへ移動 |

---

## 1. getActiveSpreadsheet() 変更箇所 (40箇所)

### 分類

| 分類 | 説明 | 対処方針 |
|------|------|---------|
| A: グローバル変数 | `const ss = ...` をグローバルスコープで定義 | 削除 → 関数内で `getTargetSpreadsheetResearch(spreadsheetId)` を呼ぶ |
| B: シート操作 | `getSheetByName()` / `getActiveSheet()` 等 | `getTargetSpreadsheetResearch(spreadsheetId)` に置換 |
| C: toast のみ | `SpreadsheetApp.getActiveSpreadsheet().toast(...)` | `ss.toast()` に統合 (ssを関数冒頭で取得) |

### container/Config.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 9 | **A** | `const ss = SpreadsheetApp.getActiveSpreadsheet();` | **最重要。削除。全ファイルが参照するグローバル変数** |

### container/TransferLog.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 26 | B | `var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得に変更 |
| 100 | B | `.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME)` | ss 変数から取得 |
| 115 | B | `.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME)` | ss 変数から取得 |

### container/ConditionDropdown.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 171 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 183 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 221 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |

### container/Setup.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 60 | B | `.getActiveSpreadsheet().getActiveSheet()` | ss.getSheetByName() に変更 (activeSheetはバインド依存) |
| 227 | B | `.getActiveSpreadsheet().getActiveSheet()` | 同上 |
| 314 | B | `const ss = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 567 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 595 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 622 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 651 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 684 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 725 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 735 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 746 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 761 | B | `const ss = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |

### container/EbayLowestPrice.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 109 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 127 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 148 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |

### container/Functions.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 573 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 592 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 611 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 717 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 798 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 896 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 926 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 972 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |
| 975 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |

### container/ResetResearch.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 38 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() (リセットキャンセル通知) |
| 118 | B | `.getActiveSpreadsheet().getActiveSheet()` | ss.getSheetByName() に変更 |
| 152 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |

### container/SpecSheetCreator.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| 11 | B | `const ss = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 47 | C | `.getActiveSpreadsheet().toast(...)` | ss.toast() |

### lowest-price/EbayLowestPrice.gs

| 行 | 分類 | コード | 対処 |
|----|------|--------|------|
| **18** | **A** | `const ss = SpreadsheetApp.getActiveSpreadsheet();` | **グローバル変数。削除。** |
| 121 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 137 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |
| 156 | B | `const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();` | パラメータから取得 |

### 補足: `getActiveSheet()` について

`getActiveSheet()` は現在ユーザーが表示しているシートを返すバインド依存のAPI。
スタンドアロン版では使用不可。各箇所で対象シート名が明確なため、
`getSheetByName('シート名')` に置換する。

---

## 2. PropertiesService 変更箇所 (12箇所、7キー)

### キー分類

| キー | 説明 | クライアント固有? | 移動先 |
|------|------|-----------------|--------|
| `EBAY_ACCESS_TOKEN` | OAuthアクセストークン | **YES** | バインドスクリプト側 ScriptProperties |
| `EBAY_TOKEN_EXPIRY` | トークン有効期限 | **YES** | バインドスクリプト側 ScriptProperties |
| `INITIAL_SETUP_COMPLETED` | 初回セットアップ完了フラグ | **YES** | バインドスクリプト側 ScriptProperties |
| `LP_BATCH_PROGRESS` | 最安値バッチ進捗 | **YES** | バインドスクリプト側 ScriptProperties |
| `HANDLE_EDIT_LAST_RUN` | onEdit デバウンスタイムスタンプ | **YES** | バインドスクリプト側 ScriptProperties |
| `LP_YYYYMMDD` (lpTodayKey()) | 日次API呼び出し数カウント | **YES** | バインドスクリプト側 ScriptProperties |
| `DEBUG_TRANSFER` | 転記デバッグデータ | NO (廃止可) | 廃止 → Logger.log に置換 |

### 変更箇所詳細

| ファイル | 行 | キー | 分類 | 対処 |
|---------|-----|------|------|------|
| container/Config.gs | 461 | `EBAY_ACCESS_TOKEN`, `EBAY_TOKEN_EXPIRY` | クライアント固有 | バインド側から props を引数で受け取る |
| container/Config.gs | 563 | `EBAY_ACCESS_TOKEN`, `EBAY_TOKEN_EXPIRY` | クライアント固有 | 同上 |
| container/Setup.gs | 40 | `INITIAL_SETUP_COMPLETED` | クライアント固有 | バインド側から props を引数で受け取る |
| container/Setup.gs | 344 | `INITIAL_SETUP_COMPLETED` | クライアント固有 | 同上 |
| container/Setup.gs | 470 | `HANDLE_EDIT_LAST_RUN` | クライアント固有 | 同上 |
| container/EbayLowestPrice.gs | 240 | `LP_BATCH_PROGRESS` | クライアント固有 | バインド側から props を引数で受け取る |
| container/EbayLowestPrice.gs | 938 | `LP_YYYYMMDD` | クライアント固有 | 同上 |
| container/EbayLowestPrice.gs | 943 | `LP_YYYYMMDD` | クライアント固有 | 同上 |
| container/Utils.gs | 1123 | `DEBUG_TRANSFER` | デバッグ用 | 廃止 or Logger.log に置換 |
| lowest-price/EbayLowestPrice.gs | 277 | `LP_BATCH_PROGRESS` | クライアント固有 | バインド側から props を引数で受け取る |
| lowest-price/EbayLowestPrice.gs | 1002 | `LP_YYYYMMDD` | クライアント固有 | 同上 |
| lowest-price/EbayLowestPrice.gs | 1006 | `LP_YYYYMMDD` | クライアント固有 | 同上 |

### 実装方針（Phase 3 で確定）

```javascript
// 変更前（ライブラリ側がストレージを直接操作 → 全クライアント共有 = 危険）
const token = PropertiesService.getScriptProperties().getProperty('EBAY_ACCESS_TOKEN');

// 変更後（バインドスクリプト側からプロパティオブジェクトを受け取る）
function getEbayAccessToken(bindProps) {
  // bindProps = バインドスクリプト側で PropertiesService.getScriptProperties() を渡す
  return bindProps.getProperty('EBAY_ACCESS_TOKEN');
}
```

---

## 3. getUi() 変更箇所 (72箇所)

### 分類

| 分類 | 説明 | 対処方針 |
|------|------|---------|
| A: alert / ButtonSet | ユーザーへのダイアログ表示 | 戻り値 `{success, message}` オブジェクトに変更。バインド側で getUi().alert() |
| B: prompt (入力ダイアログ) | ユーザーからの入力取得 | バインド側で prompt を実行し、値をライブラリ関数に渡す |

### container/Functions.gs (14箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 36 | B | 担当者入力プロンプト |
| 563 | A | 出品キャンセル確認 |
| 582 | A | 出品キャンセル確認 |
| 601 | A | 出品キャンセル確認 |
| 627, 630 | A | 出品確認ダイアログ |
| 654 | A | 担当者未入力エラー |
| 672, 675 | A | カテゴリID確認 |
| 706 | A | URL未入力エラー |
| 979, 982 | A | 転記確認ダイアログ |
| 1000 | A | 転記結果表示 |
| 1023 | A | 転記エラー表示 |

### container/Setup.gs (24箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 39 | A | セットアップ開始確認 |
| 242, 245 | A | セットアップ完了/失敗 |
| 257, 265 | A | API接続テスト結果 |
| 280 | A | 設定表示ダイアログ |
| 347, 350 | A | フラグリセット完了 |
| 366 | A | セットアップエラー |
| 388 | A | セットアップ完了 |
| 392 | A | セットアップエラー |
| 416 | A | 設定内容表示 |
| 419 | A | 設定取得エラー |
| 431 | A | 設定正常確認 |
| 434 | A | 設定エラー表示 |
| 438 | A | 検証エラー |
| 672 | B | カテゴリID入力プロンプト |
| 715, 718 | A | カテゴリ取得結果 |
| 765 | A | リサーチシート未発見エラー |
| 773 | A | Item URL未入力エラー |
| 783, 786 | A | スペック取得確認 |
| 791 | A | エラーダイアログ |

### container/EbayLowestPrice.gs (14箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 92 | A | メニュー設置 (onOpen内) |
| 140 | A | onEditトリガー登録完了 |
| 157 | A | 自動実行解除完了 |
| 210 | A | ロック取得失敗 |
| 218 | A | 設定シート未発見 |
| 224 | A | キーワード未入力 |
| 235 | A | 有効キーワードなし |
| 264, 267 | A | バッチ完了結果 |
| 276, 279 | A | バッチ失敗結果 |
| 296 | A | 処理完了 |
| 327, 330 | A | エラー表示 |

### container/TransferLog.gs (2箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 154, 157 | A | ログクリーンアップ完了 |

### container/SpecSheetCreator.gs (1箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 18 | B | カテゴリID確認ダイアログ |

### container/ResetResearch.gs (2箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 23 | A | リセット確認ダイアログ |
| 106 | A | リセットエラー表示 |

### lowest-price/EbayLowestPrice.gs (15箇所)

| 行 | 分類 | 用途 |
|----|------|------|
| 101 | A | メニュー設置 (onOpen内) |
| 130 | A | onEditトリガー登録完了 |
| 148 | A | 自動実行設定完了 |
| 162 | A | 自動実行解除 |
| 256 | A | ロック取得失敗 |
| 263 | A | 設定シート未発見 |
| 266 | A | キーワード未入力 |
| 274 | A | 有効キーワードなし |
| 299, 302 | A | バッチ結果表示 |
| 311, 314 | A | バッチ失敗表示 |
| 331 | A | 処理完了 |
| 369, 372 | A | エラー表示 |

---

## 4. LockService 変更箇所 (6箇所)

全箇所が `LockService.getScriptLock()` → `LockService.getUserLock()` に置換。

| ファイル | 行 | 用途 | 対処 |
|---------|-----|------|------|
| container/EbayLowestPrice.gs | 172 | 最安値バッチの排他制御 | getUserLock() に変更 |
| container/EbayLowestPrice.gs | 208 | 最安値バッチの排他制御 | getUserLock() に変更 |
| container/Setup.gs | 463 | onEdit デバウンス排他制御 | getUserLock() に変更 |
| container/Functions.gs | 625 | 出品処理の排他制御 | getUserLock() に変更 |
| lowest-price/EbayLowestPrice.gs | 176 | 最安値バッチの排他制御 | getUserLock() に変更 |
| lowest-price/EbayLowestPrice.gs | 254 | 最安値バッチの排他制御 | getUserLock() に変更 |

**注意:** `getUserLock()` はユーザー単位のロック。同一ユーザーが2つのスプレッドシートで
同時実行した場合はブロックされる（許容範囲）。異なるユーザー間はブロックしない。

---

## 5. onOpen / トリガー 変更箇所 (17箇所)

### onOpen() — 2箇所（バインドスクリプト側に移動）

| ファイル | 行 | 内容 |
|---------|-----|------|
| container/EbayLowestPrice.gs | 91 | `function onOpen()` — メニュー設置 |
| lowest-price/EbayLowestPrice.gs | 100 | `function onOpen()` — メニュー設置 |

→ バインドスクリプト (bind/Menu.gs) の `onOpen()` から `ResearchLib.createMenu(ss)` を呼ぶ。

### ScriptApp.newTrigger() — 5箇所

| ファイル | 行 | トリガー関数 | 用途 |
|---------|-----|------------|------|
| container/EbayLowestPrice.gs | 116 | `handleEditLowestPrice` | onEditトリガー |
| container/EbayLowestPrice.gs | 134 | `runAllLowestPrice` | 毎日9時の自動実行 |
| container/Setup.gs | 327 | `handleEdit` | onEditトリガー（メインリサーチシート） |
| container/TransferLog.gs | 175 | `cleanupOldLogs` | 定期ログクリーンアップ |
| lowest-price/EbayLowestPrice.gs | 125 | `handleEditLowestPrice` | onEditトリガー |
| lowest-price/EbayLowestPrice.gs | 142 | `runAllLowestPrice` | 毎日9時の自動実行 |

→ `ScriptApp.newTrigger()` はライブラリから呼べる（バインド先スプレッドシートに紐づく）。
ただし、ハンドラ関数（`handleEdit` 等）はバインドスクリプト側に定義が必要。

### ScriptApp.deleteTrigger() — 7箇所 / getProjectTriggers() — 1箇所

| ファイル | 行 | 内容 |
|---------|-----|------|
| container/EbayLowestPrice.gs | 113, 131, 153 | トリガー削除 |
| container/Setup.gs | 322 | トリガー削除 |
| container/TransferLog.gs | 167, 169 | トリガー削除 |
| lowest-price/EbayLowestPrice.gs | 123, 140, 160 | トリガー削除 |

→ `ScriptApp.getProjectTriggers()` はライブラリから呼べる（呼び出し元のプロジェクトを参照）。
`deleteTrigger()` も同様。これらはライブラリ内に残したまま動作する可能性が高い。
**Phase 2 のデプロイ後に動作確認が必要。**

---

## 6. 変更しない箇所（ライブラリ化しても問題ない）

| 種別 | 理由 |
|------|------|
| `SpreadsheetApp.openById(id)` | ID指定のため、アクティブ依存なし |
| `SpreadsheetApp.create()` | 新規作成のため、バインド不要 |
| `UrlFetchApp.*` | HTTPリクエスト、バインド不要 |
| `Logger.log()` | ログ出力、バインド不要 |
| `Utilities.*` | ユーティリティ、バインド不要 |
| `JSON.parse/stringify` | 標準JS、バインド不要 |
| `ScriptApp.newTrigger()` | ライブラリから呼び出し可能 |
| `ScriptApp.getProjectTriggers()` | ライブラリから呼び出し可能（要確認） |

---

## 7. 対応ファイル一覧（影響を受けるファイル）

| ファイル | 変更の必要性 | 主な変更内容 |
|---------|------------|------------|
| container/Config.gs | **必須** | グローバルss削除、PropertiesService委譲設計 |
| container/Functions.gs | **必須** | getActiveSpreadsheet×9、getUi×14 |
| container/Setup.gs | **必須** | getActiveSpreadsheet×12、getUi×24、PropertiesService×3、LockService×1、トリガー×2 |
| container/EbayLowestPrice.gs | **必須** | getActiveSpreadsheet×3、getUi×14、PropertiesService×3、LockService×2、onOpen×1、トリガー×5 |
| container/TransferLog.gs | **必須** | getActiveSpreadsheet×3、getUi×2、トリガー×3 |
| container/ConditionDropdown.gs | **必須** | getActiveSpreadsheet×3 |
| container/ResetResearch.gs | **必須** | getActiveSpreadsheet×3、getUi×2 |
| container/SpecSheetCreator.gs | **必須** | getActiveSpreadsheet×2、getUi×1 |
| container/Utils.gs | 軽微 | PropertiesService×1 (DEBUG_TRANSFER廃止) |
| lowest-price/EbayLowestPrice.gs | **必須** | getActiveSpreadsheet×4（グローバルss含む）、getUi×15、PropertiesService×3、LockService×2、onOpen×1、トリガー×6 |
| container/EbayAPI.gs | 要確認 | 直接のgetActiveSpreadsheet無し。ただしConfig.gsのgetOAuthToken()を呼び出す |
| container/ImageHandler.gs | 要確認 | 調査対象パターン未検出（ほぼ影響なしと推定） |
| container/ItemCache.gs | 要確認 | 調査対象パターン未検出（ほぼ影響なしと推定） |
| container/MercariShopsDPoP.gs | 要確認 | 調査対象パターン未検出（ほぼ影響なしと推定） |
| container/PolicyManager.gs | 要確認 | 調査対象パターン未検出（ほぼ影響なしと推定） |

---

---

## 8. Phase 3 実装設計 — PropertiesService 委譲パターン

### 設計原則

ライブラリは `PropertiesService` を一切呼ばない。
バインドスクリプトがプロパティの読み書きを全て担う。

```
[バインドスクリプト]                          [スタンドアロンライブラリ]
const props = PropertiesService                 ←── 直接呼び出し不可
  .getScriptProperties();
const propsData = props.getProperties(); ──→ 引数として渡す (plain object)
const result = ResearchLib.foo(ssId, propsData, ...);
applyNewProps_(props, result.newProps);  ←── newProps を書き戻す
```

### propsData パターン（読み取り）

```javascript
// バインドスクリプト側
const propsData = PropertiesService.getScriptProperties().getProperties();
// propsData は { KEY: 'value', ... } の plain object

// ライブラリ側（reads）
function getOAuthTokenSA(propsData, ebayConfig) {
  const token = propsData['EBAY_ACCESS_TOKEN'];
  const expiry = propsData['EBAY_TOKEN_EXPIRY'];
  // ...
}
```

### newProps パターン（書き込み）

```javascript
// ライブラリ側（writes: newProps を返す）
return {
  success: true,
  token: token,
  newProps: {
    EBAY_ACCESS_TOKEN: token,      // 文字列 → setProperty
    EBAY_TOKEN_EXPIRY: expiryStr   // 文字列 → setProperty
  }
};
// null 値 = deleteProperty の指示
// 例: { EBAY_ACCESS_TOKEN: null }  → deleteProperty('EBAY_ACCESS_TOKEN')

// バインドスクリプト側の書き戻しヘルパー
function applyNewProps_(scriptProps, newProps) {
  if (!newProps) return;
  Object.keys(newProps).forEach(function(key) {
    if (newProps[key] === null) {
      scriptProps.deleteProperty(key);
    } else {
      scriptProps.setProperty(key, newProps[key]);
    }
  });
}
```

### PropertiesManager.gs 公開 API 一覧

| 関数 | 引数 | 戻り値 | 対応キー |
|------|------|--------|---------|
| `getOAuthTokenSA(propsData, ebayConfig)` | propsData, ebayConfig | `{success, token, newProps?}` | EBAY_ACCESS_TOKEN, EBAY_TOKEN_EXPIRY |
| `clearOAuthTokenSA()` | なし | `{success, newProps}` | EBAY_ACCESS_TOKEN=null, EBAY_TOKEN_EXPIRY=null |
| `checkInitialSetupSA(propsData)` | propsData | `{isDone: boolean}` | INITIAL_SETUP_COMPLETED |
| `markInitialSetupCompleteSA()` | なし | `{newProps}` | INITIAL_SETUP_COMPLETED='true' |
| `resetInitialSetupFlagSA()` | なし | `{newProps}` | INITIAL_SETUP_COMPLETED=null |
| `getDebounceLastRunSA(propsData)` | propsData | `number` (timestamp, 0 if not set) | HANDLE_EDIT_LAST_RUN |
| `saveDebounceLastRunSA(timestamp)` | timestamp: number | `{newProps}` | HANDLE_EDIT_LAST_RUN=String(timestamp) |
| `getBatchProgressSA(propsData)` | propsData | `{startIndex: number, totalCount: number}` | LP_BATCH_PROGRESS |
| `saveBatchProgressSA(totalCount, completedCount)` | totalCount, completedCount | `{newProps}` | LP_BATCH_PROGRESS=JSON |
| `clearBatchProgressSA()` | なし | `{newProps}` | LP_BATCH_PROGRESS=null |
| `lpCheckRateLimitSA(propsData, maxDaily)` | propsData, maxDaily | `boolean` (true=制限内) | LP_REQ_YYYYMMDD |
| `lpIncrementRequestCountSA(propsData)` | propsData | `{newProps}` | LP_REQ_YYYYMMDD=N+1 |

### キー → 関数 マッピング（全7キー）

| キー | 管理関数 | 用途 |
|------|---------|------|
| `EBAY_ACCESS_TOKEN` | getOAuthTokenSA / clearOAuthTokenSA | OAuthアクセストークン本体 |
| `EBAY_TOKEN_EXPIRY` | getOAuthTokenSA / clearOAuthTokenSA | トークン有効期限（ms UNIX timestamp文字列） |
| `INITIAL_SETUP_COMPLETED` | checkInitialSetupSA / markInitialSetupCompleteSA / resetInitialSetupFlagSA | 初回セットアップ完了フラグ |
| `LP_BATCH_PROGRESS` | getBatchProgressSA / saveBatchProgressSA / clearBatchProgressSA | 最安値バッチ進捗JSON |
| `HANDLE_EDIT_LAST_RUN` | getDebounceLastRunSA / saveDebounceLastRunSA | onEdit デバウンス用最終実行タイムスタンプ |
| `LP_REQ_YYYYMMDD` | lpCheckRateLimitSA / lpIncrementRequestCountSA | 日次リクエスト数カウント（キー名に日付が含まれる） |
| `DEBUG_TRANSFER` | — | **廃止** → Logger.log に置換（Phase 4以降） |

---

*調査者: Claude Code (claude-sonnet-4-6)*  
*調査対象: gas/research/ ディレクトリ全 .gs ファイル*
*Phase 3 設計追記: 2026-05-11*

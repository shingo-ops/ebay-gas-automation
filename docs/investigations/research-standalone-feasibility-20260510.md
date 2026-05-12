# リサーチシート スタンドアロン分離 実現可能性調査

**調査日:** 2026-05-10  
**対象:** `gas/research/container/` → スタンドアロンライブラリ化  
**参照モデル:** `gas/listing/standalone/`（出品ツール）  
**調査種別:** 読み取り専用（コード変更なし）

---

## 結論

**条件付きYES — 技術的に実現可能。ただし大規模リファクタリングが必要。**

| 項目 | 評価 |
|------|------|
| 技術的実現可能性 | ○ 可能（出品ツールで実証済みの同一パターン） |
| 推奨アプローチ | Hybrid方式（後述） |
| 総工数見積もり | **約60〜80時間**（コア移行30h + PropertiesService設計20h + テスト20h） |
| 最大リスク | OAuth トークンの PropertiesService 設計（クライアント間漏洩リスク） |

---

## Task 1: 現在の構成

### ファイル一覧

```
gas/research/container/
├── Config.gs          614行  ← グローバルss定義あり（最重要）
├── Functions.gs      1132行  ← メイン処理、45+のgetActiveSpreadsheet()呼び出し
├── Utils.gs          1377行  ← ユーティリティ
├── Setup.gs           795行  ← 初期設定、onEdit()トリガー登録
├── ProductImageFetcher.gs 1544行
├── ConditionDropdown.gs   528行
├── EbayAPI.gs         716行  ← OAuth トークン管理
├── SpecSheetCreator.gs    836行
├── PolicyManager.gs       376行
├── ImageHandler.gs        285行
├── ItemCache.gs           231行
├── TransferLog.gs         182行
├── MercariShopsDPoP.gs    174行
└── ResetResearch.gs       157行

gas/research/lowest-price/
└── EbayLowestPrice.gs    1249行  ← onOpen()でメニュー設置
```

**合計行数:** 約10,000行

### バインド依存の現状

`Config.gs` の冒頭でグローバルスコープに固定：

```javascript
const ss = SpreadsheetApp.getActiveSpreadsheet(); // ← 全ファイルで参照
```

この1行が全ファイルのスプレッドシートアクセスの根幹。ライブラリ化するとこの呼び出しが失敗する。

---

## Task 2: 技術的制約

### 制約一覧

| 制約 | 影響箇所 | 深刻度 | 解決策 |
|------|---------|--------|--------|
| `getActiveSpreadsheet()` | 全ファイル（45+箇所） | 🔴 Critical | `spreadsheetId` パラメータ化 |
| `PropertiesService` per-library | EbayAPI.gs（11箇所） | 🔴 Critical | トークンを呼び出し側スプレッドシートに保存 |
| `getUi()` | 全体（19+箇所） | 🟠 High | バインドスクリプト側に移動 |
| `onOpen()` | EbayLowestPrice.gs | 🟠 High | バインドスクリプト側に移動 |
| `LockService.getScriptLock()` | 4箇所 | 🟡 Medium | `getUserLock()` への変更、またはアーキテクチャ設計 |
| ライブラリ手動追加 | 全クライアント | 🟡 Medium | セットアップドキュメントで対応 |

---

### 制約1: `getActiveSpreadsheet()` — 45+箇所（Critical）

**問題:** ライブラリ実行コンテキストでは `getActiveSpreadsheet()` はライブラリのスクリプト自体にバインドされたシートを探す。呼び出し元のシートは取得できない。

**出品ツールの解決策（実証済み）:**
```javascript
// gas/listing/standalone/Config.gs:9
var CURRENT_SPREADSHEET_ID = null;

// gas/listing/standalone/Config.gs（ユーティリティ）
function getTargetSpreadsheet(spreadsheetId) {
  const id = spreadsheetId || CURRENT_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}
```

**リサーチ側への適用:**
- `const ss = SpreadsheetApp.getActiveSpreadsheet()` をグローバルから削除
- `CURRENT_SPREADSHEET_ID` グローバル変数を導入
- 全関数の冒頭で `const ss = getTargetSpreadsheetResearch(spreadsheetId)` に統一
- メニュー/トリガーからの呼び出しはバインドスクリプト側で `spreadsheetId` を渡す

**影響ファイル:** Config.gs, Functions.gs, Utils.gs, Setup.gs, ProductImageFetcher.gs, ConditionDropdown.gs, SpecSheetCreator.gs, PolicyManager.gs, ImageHandler.gs, ItemCache.gs, TransferLog.gs, ResetResearch.gs

---

### 制約2: `PropertiesService` — OAuth トークン共有問題（Critical）

**問題（最重要）:** ライブラリの `PropertiesService.getScriptProperties()` はライブラリのスクリプトIDに紐づく **共有** プロパティを返す。

```
Client A → ResearchLib.getAccessToken() → lib_script_properties["EBAY_ACCESS_TOKEN"]
Client B → ResearchLib.getAccessToken() → 同じ lib_script_properties["EBAY_ACCESS_TOKEN"] ← 漏洩！
```

`EBAY_ACCESS_TOKEN`（期限2時間）がクライアント間で共有されると：
- Client A のトークンで Client B のAPIリクエストが通る
- Client B が自分のリフレッシュトークンでトークン更新すると Client A の呼び出しが失敗

**現状で使用している ScriptProperties キー（EbayAPI.gs）:**
- `EBAY_ACCESS_TOKEN` — アクセストークン本体（クライアント固有）
- `EBAY_TOKEN_EXPIRY` — 有効期限（クライアント固有）
- `INITIAL_SETUP_COMPLETED` — 初期設定完了フラグ（クライアント固有）
- `LP_BATCH_PROGRESS` — バッチ進捗（クライアント固有）

**解決策オプション:**

| オプション | 方法 | メリット | デメリット |
|-----------|------|----------|------------|
| **A: SpreadsheetApp.openById().getSheetByName('設定')** | トークンをシートに書く | ライブラリ不要、クライアント分離 | シートへの読み書きコスト、セキュリティ懸念 |
| **B: PropertiesService の呼び出し元委譲** | バインドスクリプト側のScriptPropertiesを渡す | 完全クライアント分離 | APIが複雑（token文字列を引数で渡す） |
| **C: トークンをシークレットシートに保存** | 非表示シートにトークンを保存 | 出品ツールの実績なし、安全性低 | セキュリティリスク |

**推奨: オプションB**  
バインドスクリプト側から `{accessToken, expiry}` オブジェクトをライブラリ関数に渡す。ライブラリはストレージを持たず、APIコール専用とする。

---

### 制約3: `getUi()` — 19+箇所（High）

**問題:** ライブラリから `SpreadsheetApp.getUi()` を呼ぶと `Exception: Cannot call SpreadsheetApp.getUi() from this context` エラー。

**現在使用箇所（主要）:**
- 設定ダイアログ表示（Setup.gs）
- カテゴリID確認ダイアログ
- エラーアラート表示
- 進捗プロンプト

**解決策:** UI操作はすべてバインドスクリプト側の薄いラッパーに移動。ライブラリ関数は `{success, message, data}` オブジェクトを返すのみ（出品ツールの `Menu.gs` パターン）。

---

### 制約4: `onOpen()` / `onEdit()` — トリガー（High）

**問題:** ライブラリ内の `onOpen()` は Googleのシンプルトリガーとして自動実行されない。

- `EbayLowestPrice.gs` の `onOpen()` → バインドスクリプトに移動
- `Setup.gs` の `onEdit()` インストーラブルトリガー → バインドスクリプトのセットアップ関数から登録

**解決策:** バインドスクリプト（AUTO_SETUP_SCRIPT.gs 相当）に `onOpen()` のスタブを置き、ライブラリの `createMenu()` 関数を呼ぶ。

---

### 制約5: `LockService.getScriptLock()` — 4箇所（Medium）

**問題:** ライブラリの `getScriptLock()` はライブラリのスクリプトIDに紐づくロック。クライアントAがロックを取得すると、クライアントBも同ライブラリを使用している場合にブロックされる。

**影響箇所:** 主に画像取得・バッチ処理の排他制御

**解決策:** `LockService.getUserLock()` に変更（ユーザー単位のロック）。または呼び出し元からロックオブジェクトを渡す設計。

---

## Task 3: 初回セットアップ自動化

### できる範囲 ✅

| 機能 | 方法 |
|------|------|
| バインドスクリプト配布 | GitHub から clasp push |
| メニュー設置 | バインドスクリプトの onOpen() → `ResearchLib.createMenu()` |
| シート初期構造作成 | `ResearchLib.setupSheets(spreadsheetId)` をメニューから実行 |
| プルダウン・入力規則 | ライブラリ内で setDataValidation() 実行可能 |
| バッチトリガー登録 | `ScriptApp.newTrigger().forSpreadsheet(id)` — ライブラリ内から可能 |
| デプロイ自動化 | GitHub Actions + clasp（既存ワークフロー踏襲） |

### できない範囲 ❌

| 機能 | 理由 | 代替 |
|------|------|------|
| ライブラリの自動追加 | Apps Script UI での手動追加が必須 | ドキュメント＋スクリプトIDをコピペ |
| OAuth 認証ダイアログ | getUi() 不可 | バインドスクリプト側で表示 |
| リフレッシュトークンの自動保存 | PropertiesService 問題 | バインドスクリプト側の ScriptProperties に保存 |

### セットアップフロー（想定）

```
1. クライアント: スプレッドシートを新規作成
2. Shingo: バインドスクリプト(AUTO_SETUP_SCRIPT)をclasp pushで配布
3. クライアント: Apps Script 画面でライブラリ追加（スクリプトIDコピペ）
4. クライアント: スプレッドシートメニュー「初期設定」を実行
5. バインドスクリプト: ResearchLib.setup(ss.getId()) を呼び出し
6. ライブラリ: シート構造・プルダウン・トリガーをセットアップ
7. クライアント: eBay OAuth 認証（バインドスクリプト側でダイアログ表示）
```

---

## Task 4: 出品ツールとの比較

| 項目 | 出品ツール (listing/standalone) | リサーチツール（移行後想定） |
|------|--------------------------------|------------------------------|
| `getActiveSpreadsheet()` 除去 | ✅ 完了 | 要対応（45+箇所） |
| PropertiesService 設計 | ✅ `DEFAULT_SPREADSHEET_ID`, `CLIENTS` のみ | 🔴 要設計（OAuth トークン） |
| UI ダイアログ | ✅ バインドスクリプト側 | 要移動（19+箇所） |
| onOpen/onEdit | ✅ バインドスクリプト側 | 要移動 |
| LockService | ❓ 使用箇所少 | 要対応（4箇所） |
| clasp デプロイ | ✅ GitHub Actions 完備 | 既存ワークフロー踏襲可能 |
| マルチクライアント | ✅ CURRENT_SPREADSHEET_ID | 同パターン適用可能 |
| ライブラリ手動追加 | ✅ (AUTO_SETUP_SCRIPT.gs で説明) | 同様 |
| 総規模 | ~3,000行 | ~10,000行（3.3倍） |

**出品ツールで実証済みのパターン**は全て再利用可能。規模が3.3倍 + PropertiesService 設計が追加で複雑になる点が主な差異。

---

## Task 5: 移行コスト

### 工数見積もり

| フェーズ | 作業内容 | 工数 |
|---------|---------|------|
| **Phase 1: 基盤整備** | Config.gs修正、CURRENT_SPREADSHEET_ID導入、getTargetSpreadsheetResearch()実装 | 4h |
| **Phase 2: SS依存除去** | 全ファイル(14ファイル)の getActiveSpreadsheet() → getTargetSpreadsheetResearch() | 12h |
| **Phase 3: PropertiesService設計** | OAuth トークン管理の設計変更（最複雑） | 16h |
| **Phase 4: UI分離** | getUi() 呼び出しをバインドスクリプトへ移動（19+箇所） | 8h |
| **Phase 5: トリガー移動** | onOpen/onEdit をバインドスクリプトへ、LockService修正 | 4h |
| **Phase 6: AUTO_SETUP_SCRIPT** | バインドスクリプト作成（メニュー、セットアップ、認証フロー） | 8h |
| **Phase 7: デプロイ設定** | GitHub Actions ワークフロー追加、clasp設定 | 4h |
| **Phase 8: テスト・検証** | 既存クライアントで動作確認 | 16h |
| **バッファ** | 想定外の依存・バグ対応 | 8h |
| **合計** | | **80h** |

### リスク評価

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| OAuth トークン設計ミス → クライアント間漏洩 | 中 | 🔴 Critical | Phase 3 で十分なレビューと単体テスト |
| `getActiveSpreadsheet()` の取りこぼし | 高 | 🟠 High | grep 全量確認後に移行 |
| LockService の cross-client ブロック | 低 | 🟡 Medium | バッチ処理のユーザー単位ロック化 |
| ライブラリ手動追加の手順ミス | 中 | 🟡 Medium | セットアップドキュメント整備 |
| 既存クライアントへの影響 | 低 | 🟠 High | 移行は新規クライアントのみ。既存はコンテナバインドを維持 |

---

## 推奨実装方針

### Hybrid 方式（推奨）

**既存クライアントはコンテナバインドのまま維持し、新規クライアントのみスタンドアロン版を使用する。**

```
[既存] container-bound (gas/research/container/) → そのまま継続
[新規] standalone library (gas/research/standalone/) → 新規作成
```

**理由:**
1. 既存クライアントへの影響ゼロ（移行リスクを新規のみに限定）
2. スタンドアロン版の品質が安定してから既存クライアントを段階移行
3. 出品ツールで同様のパターン（container と standalone の並存）が実証済み

### 実装優先度

| 優先度 | 内容 | 前提条件 |
|--------|------|---------|
| P0 | Phase 1〜2（SS依存除去）| なし（最初に着手） |
| P1 | Phase 3（PropertiesService設計）| P0 完了後、設計レビュー必須 |
| P2 | Phase 4〜5（UI・トリガー分離）| P1 完了後 |
| P3 | Phase 6〜8（バインドスクリプト・デプロイ）| P2 完了後 |

### 移行を開始する前に決定すべき事項

1. **OAuth トークンの保存先**: バインドスクリプト側 ScriptProperties（推奨）か、非公開シートか
2. **LockService 戦略**: `getUserLock()` で十分か、クライアント横断ロックは不要か
3. **既存クライアントへの移行計画**: 新規のみか、全クライアント移行するか

---

*調査者: Claude Code (claude-sonnet-4-6)*  
*調査対象コミット: develop ブランチ最新（2026-05-10時点）*

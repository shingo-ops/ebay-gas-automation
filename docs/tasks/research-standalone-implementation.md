# リサーチシート スタンドアロン分離 実装タスク

**作成日:** 2026-05-10  
**設計根拠:** `docs/decisions/ADR-008-research-standalone.md`  
**参照レポート:** `docs/investigations/research-standalone-feasibility-20260510.md`

---

## 設計の特徴

### エビデンスファースト

Phase 1 (PR #55) で全変更箇所をコードで grep して文書化してから実装開始。
推測でコードを書かない。「取りこぼし」による不具合を防ぐ。

### GitHub で完全追跡可能

```
PR #54  ブランチ・ドキュメント
PR #55  Phase 1: 調査エビデンス
PR #56  Phase 2: 基盤作成
PR #57  Phase 3: PropertiesService ← Shingoレビュー必須
PR #58  Phase 4: SS依存除去 (45+箇所)
PR #59  Phase 5: UI・トリガー分離
PR #60  Phase 6: バインドスクリプト
PR #61  Phase 7: 統合テスト → main マージ
```

不具合発生 → 該当PRまで `git revert` で即座に戻れる。

### 既存クライアントへの影響ゼロ

`gas/research/container/` は Phase 6 完了まで一切変更しない。
中尾さんの環境に影響なし。

> **重要: Phase 3 は Shingo のレビュー必須**
>
> PropertiesService の設計はセキュリティ上の最重要フェーズ。
> PR が作成されたら必ずレビューしてからマージする。

---

## 背景

設計決定 (確定済み):
- OAuthトークン: バインドスクリプト側 ScriptProperties に保存
- LockService: getUserLock() (ユーザー単位)
- 移行対象: 新規クライアントのみ (既存は現状維持)

---

## 原則

### エビデンスファースト

各フェーズの実装前に「何を変更するか・何が影響を受けるか」をコードで確認してから PR を作成する。

### GitHub 追跡可能設計

- フェーズごとに独立した PR を作成
- PR 単位で動作確認 → マージの順序を厳守
- 不具合発生時は該当 PR まで git revert で戻せる状態を維持
- コミットメッセージに「何のエビデンスに基づいて変更したか」を記載

### リグレッション防止

- 各 PR マージ前に既存の出品ツールが正常動作することを確認
- 既存クライアント (コンテナバインド) には一切影響を与えない

---

## フェーズ構成 (8 PR)

### Phase 0: ブランチ戦略の確立 (PR #54) ← 本 PR

**目的**: 長期開発のブランチを作成し、フェーズごとの PR の土台を作る

```
main
  └── feature/research-standalone  ← 長期ブランチ
        ├── phase-1/evidence
        ├── phase-2/foundation
        ├── phase-3/properties-service
        ├── phase-4/ss-dependency-removal
        ├── phase-5/ui-trigger-separation
        └── phase-6/bind-script
```

作業内容:
1. `feature/research-standalone` ブランチを main から作成 ✅
2. ADR-008 を `docs/decisions/ADR-008-research-standalone.md` として保存 ✅
3. 実装計画を `docs/tasks/research-standalone-implementation.md` として保存 ✅
4. PR #54: ドキュメントのみ → main にマージ

---

### Phase 1: 依存箇所の全量調査とエビデンス記録 (PR #55)

**目的**: 変更が必要な全箇所をコードで特定し、文書化する。実装は一切しない。調査のみ。

#### 調査1-1: getActiveSpreadsheet() の全量特定

```bash
grep -rn "getActiveSpreadsheet\|SpreadsheetApp\.getActive()" \
  gas/research/ --include="*.gs" > \
  docs/evidence/research-standalone-active-ss-locations.txt
```

#### 調査1-2: PropertiesService の全量特定

```bash
grep -rn "PropertiesService\|ScriptProperties\|UserProperties" \
  gas/research/ --include="*.gs" > \
  docs/evidence/research-standalone-properties-locations.txt
```

各箇所について:
- どのキーを読み書きしているか
- クライアント固有データか共有データか
- バインド側に移すべきかライブラリに残すべきか

#### 調査1-3: getUi() の全量特定

```bash
grep -rn "getUi()\|SpreadsheetApp\.getUi" \
  gas/research/ --include="*.gs" > \
  docs/evidence/research-standalone-ui-locations.txt
```

#### 調査1-4: LockService の全量特定

```bash
grep -rn "LockService\|getScriptLock\|getUserLock" \
  gas/research/ --include="*.gs" > \
  docs/evidence/research-standalone-lock-locations.txt
```

#### 調査1-5: onOpen / onEdit / トリガーの全量特定

```bash
grep -rn "onOpen\|onEdit\|ScriptApp.newTrigger" \
  gas/research/ --include="*.gs" > \
  docs/evidence/research-standalone-trigger-locations.txt
```

#### エビデンス文書の作成

`docs/evidence/research-standalone-change-map.md` を作成:

```markdown
# リサーチシート スタンドアロン分離 変更マップ

## getActiveSpreadsheet() 変更箇所 (XX箇所)
| ファイル | 行 | 変更内容 |

## PropertiesService 変更箇所 (XX箇所)
| ファイル | 行 | キー名 | 分類 | 移動先 |

## getUi() 変更箇所 (XX箇所)
| ファイル | 行 | 変更内容 |

## LockService 変更箇所 (XX箇所)
| ファイル | 行 | 変更内容 |

## トリガー変更箇所
| ファイル | 行 | 変更内容 |

## 変更しない箇所
(ライブラリ化しても問題ない箇所のリスト)
```

PR #55: エビデンス文書のみ → feature/research-standalone にマージ

---

### Phase 2: スタンドアロン基盤の作成 (PR #56)

**目的**: `gas/research/standalone/` ディレクトリを作成し、基盤となる Config.gs と
getTargetSpreadsheetResearch() を実装する。既存コードには一切触れない。

作業内容:

1. `gas/research/standalone/` ディレクトリ作成
2. `gas/research/standalone/Config.gs` 作成:
   - `CURRENT_SPREADSHEET_ID` グローバル変数
   - `getTargetSpreadsheetResearch(spreadsheetId)` 関数
   - 出品ツールの `gas/listing/standalone/Config.gs` のパターンを踏襲

3. `gas/research/standalone/.clasp.json` 作成:
   - `{"scriptId": "REPLACED_BY_CI", "rootDir": "."}`

4. `gas/research/standalone/appsscript.json` 作成:
   - 出品ツールのスコープを参考に必要なスコープを定義

5. `.github/workflows/deploy-gas.yml` に `deploy-research-standalone` ジョブを追加:
   - `gas/research/standalone/**` の変更をトリガー
   - secrets: `RESEARCH_SA_PROD` / `RESEARCH_SA_DEV`（Shingo が事前に GitHub Secrets に追加）

6. audit ワークフロー群に `gas/research/standalone/appsscript.json` のパスを追加

**動作確認**: 空のスタンドアロンスクリプトが正常にデプロイされるか確認

PR #56: 基盤のみ → feature/research-standalone にマージ

---

### Phase 3: PropertiesService の設計変更 (PR #57) ← 最重要・Shingo レビュー必須

**目的**: OAuthトークン管理をバインドスクリプト側に移す。セキュリティ上の最重要フェーズ。

#### エビデンス確立 (実装前)

Phase 1 の調査結果を元に以下を確定:
1. ライブラリ側に残すプロパティキー（共有データ）
2. バインド側に移すプロパティキー（クライアント固有データ）
   - `EBAY_ACCESS_TOKEN`
   - `EBAY_TOKEN_EXPIRY`
   - `INITIAL_SETUP_COMPLETED`
   - `LP_BATCH_PROGRESS` 等

#### 実装

`gas/research/standalone/EbayTokenManager.gs` 作成:

```javascript
/**
 * バインドスクリプト側の ScriptProperties を受け取って API コール
 * ライブラリ自身は PropertiesService を持たない
 *
 * @param {GoogleAppsScript.Properties.Properties} bindProps
 *   呼び出し元の PropertiesService.getScriptProperties()
 */
function getAccessTokenFromProps(bindProps) {
  const token = bindProps.getProperty('EBAY_ACCESS_TOKEN');
  const expiry = bindProps.getProperty('EBAY_TOKEN_EXPIRY');
  // トークン有効期限チェック・自動更新ロジック
}

function saveAccessTokenToProps(bindProps, token, expiry) {
  bindProps.setProperty('EBAY_ACCESS_TOKEN', token);
  bindProps.setProperty('EBAY_TOKEN_EXPIRY', expiry);
}
```

#### テスト

- クライアントAのトークンがクライアントBから見えないことを確認
- トークンの更新が正常に動作することを確認

> **PR #57 は必ず Shingo がレビューしてからマージする**

PR #57 → feature/research-standalone にマージ

---

### Phase 4: getActiveSpreadsheet() の除去 (PR #58)

**目的**: Phase 1 の変更マップに基づき、全ファイルの getActiveSpreadsheet() を
getTargetSpreadsheetResearch() に変更する。

作業内容:
- Phase 1 のエビデンス文書の全箇所を機械的に変換
- 1ファイルずつ変更してコミット（粒度を細かく保つ）

変換パターン:
```javascript
// 変更前
const ss = SpreadsheetApp.getActiveSpreadsheet();

// 変更後
const ss = getTargetSpreadsheetResearch(spreadsheetId);
```

**注意**: スタンドアロン側のファイルのみ。`gas/research/container/` は変更しない。

PR #58 → feature/research-standalone にマージ

---

### Phase 5: UI・トリガーの分離 (PR #59)

**目的**: getUi() とトリガー処理をバインドスクリプト側に移動する。

作業内容:

1. ライブラリ側: getUi() を削除し、戻り値オブジェクトに変更
   ```javascript
   // 変更前
   SpreadsheetApp.getUi().alert('完了しました');

   // 変更後
   return { success: true, message: '完了しました' };
   ```

2. LockService: `getScriptLock()` → `getUserLock()` に変更（4箇所）

3. `onOpen()` / `onEdit()`: スタンドアロン側から削除

PR #59 → feature/research-standalone にマージ

---

### Phase 6: バインドスクリプトの作成 (PR #60)

**目的**: 新規クライアント向けの薄いラッパースクリプトを作成する。

`gas/research/bind/` ディレクトリ作成:

```
gas/research/bind/
├── Menu.gs        ← onOpen() でメニュー設置、ライブラリ呼び出し
├── Setup.gs       ← 初回セットアップ、OAuth認証
├── Properties.gs  ← ScriptProperties 管理（トークン保存）
├── .clasp.json
└── appsscript.json  ← ライブラリ依存定義（ResearchLib のスクリプトID）
```

`.github/workflows/deploy-gas.yml` に `deploy-research-bind` ジョブを追加:
- secrets: `RESEARCH_BIND_PROD` / `RESEARCH_BIND_DEV`

**初回セットアップフロー**:
```
クライアントがメニュー「初期設定」を実行
  ↓
Properties.gs が ScriptProperties を初期化
  ↓
ResearchLib.setupSheets(ss.getId()) を呼び出し
  ↓
シート構造・プルダウン・トリガーを自動作成
  ↓
OAuth認証フロー (バインド側で getUi() を呼び出し)
  ↓
完了
```

PR #60 → feature/research-standalone にマージ

---

### Phase 7: 統合テスト・デプロイ (PR #61)

**目的**: 新規スプレッドシートでの動作を完全確認してから main にマージする。

テストシナリオ:

| # | シナリオ | 期待動作 |
|---|---|---|
| 1 | 新規スプレッドシートで初回セットアップ | シート構造が自動作成される |
| 2 | eBay OAuth 認証 | トークンがバインド側 ScriptProperties に保存される |
| 3 | 2クライアントで同時使用 | トークンが混在しない |
| 4 | リサーチ→出品シート転記 | 正常に動作する |
| 5 | 既存クライアント（コンテナバインド）| 一切影響なし |

全テスト通過後:
`feature/research-standalone` → `main` へ PR 作成・マージ

PR #61: 統合テスト完了 → main にマージ

---

## ブランチ・PR 戦略まとめ

```
main
  └── feature/research-standalone  (長期ブランチ)
        ├── PR #55: Phase 1 エビデンス文書
        ├── PR #56: Phase 2 基盤作成
        ├── PR #57: Phase 3 PropertiesService ← Shingo レビュー必須
        ├── PR #58: Phase 4 SS依存除去
        ├── PR #59: Phase 5 UI・トリガー分離
        └── PR #60: Phase 6 バインドスクリプト

最終: feature/research-standalone → main (PR #61)
```

各 PR の粒度:
- 1PR = 1フェーズ = 1つの責務
- 不具合発生時は該当 PR まで revert で戻せる
- CI が全 PR で通ること

---

## 制約

- 既存の `gas/research/container/` は Phase 6 完了まで一切変更しない
- Phase 3 (PropertiesService) は Shingo のレビュー後にマージする
- 各フェーズの実装前にエビデンス文書を更新してから着手する
- シークレット情報（スクリプトID・トークン）をコードにハードコードしない

## 完了条件

1. 新規スプレッドシートで初回セットアップが1クリックで完了する
2. 統合テスト5件が全てパスする
3. 既存クライアントへの影響がゼロ
4. PR #54〜#61 が全て GitHub 上に記録されており、不具合発生時に任意の PR まで revert できる状態
5. ADR-008 が最終的な設計内容で更新されている

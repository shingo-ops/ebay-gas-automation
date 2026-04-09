# ebay-db 設計定義書
カテゴリマスタ・コンディションマスタ・自動更新システム

**bay-auto Project** | shingo-ops/bay-auto  
HIGH LIFE JPN（Treasure Island JP）

**Version 2.0 | 2026-04-10**

---

## v2.0 主要変更点（v1.1からの差分）

- Google Drive経由を廃止 → GitHub経由（CSVをリポジトリにコミット）に変更
- GCP_SERVICE_ACCOUNT_KEY / DRIVE_CSV_FOLDER_ID は不要に
- configシートを廃止 → 全設定をPropertiesServiceに移動（原本ブック3シート構成）
- マーケットごとにCSV分割（1マーケット1ファイル・1シート）
- コンディション取得APIを sell/metadata/v1 getItemConditionPolicies に修正
- condition_enumはハードコードマッピングで補完
- sync-ebay-db.ymlにclasp pushステップを追加（GAS自動デプロイ）
- 整合性チェック強化（空データPASS問題への対応）
- DISCORD_WEBHOOK → DISCORD_WEBHOOK_EBAYDB に名称変更

---

## 1. 概要

本ドキュメントは bay-auto リポジトリの ebay-db プロジェクトの設計定義書である。eBayの対象マーケットプレイス（US/GB/DE/AU）の全リーフカテゴリのスペック、コンディション、FVFレートを自動取得し、クライアント向けの出品ツール（listing）と利益計算ツール（research）にマスタデータを提供するシステムを定義する。

### 設計方針

- データ取得から配信まで完全自動化（人間の作業はDiscord通知の確認のみ）
- 原本ブックとサービス提供用ブックの分離によるロジック・アカウント隠蔽
- Gemini 2.5 Flash-Lite によるFVFレート抽出・日本語翻訳の自動化
- 月1回のGitHub Actions cronによる定期更新
- 小規模（4マーケット）で動作確認後、段階的にスケール（FR等を追加）

### 1.1 対象マーケットプレイス

| マーケットID | 国 | category_tree_id | 状態 |
|---|---|---|---|
| EBAY_US | アメリカ | 0 | ✅ 対応済み |
| EBAY_GB | イギリス（UK） | 3 | ✅ 対応済み |
| EBAY_DE | ドイツ | 77 | ✅ 対応済み |
| EBAY_AU | オーストラリア | 15 | ✅ 対応済み |
| EBAY_FR | フランス | — | ⏳ 後日追加 |

---

## 2. システム構成

### 2.1 データフロー

| 段階 | 処理内容 | 実行環境 |
|---|---|---|
| ① 生成 | eBay API からマーケットごとにスペック・コンディション取得 | Python / GitHub Actions |
| ② 変換 | Gemini 2.5 Flash-Lite でFVFレート抽出・日本語コンディション自動生成 | Python / Gemini API |
| ③ 出力 | マーケットごとのCSVをGitHubリポジトリにコミット | Python / git |
| ④ デプロイ | clasp push で最新GASコードをGASにデプロイ | clasp / GitHub Actions |
| ⑤ 取込 | clasp run → GASがGitHub raw URLからCSV取得 → シートにインポート | GAS（原本ブック） |
| ⑥ 検証 | 整合性チェック（空データ検知・condition_id存在確認・FVFレート範囲） | GAS（原本ブック） |
| ⑦ 転記 | 整合性PASS後、原本 → サービス提供用ブックへ自動転記 | GAS（原本ブック） |
| ⑧ 通知 | Discord Webhook で差分サマリー・チェック結果を通知 | GAS |

#### v1.1からの変更点

- Google Drive経由を廃止（サービスアカウントのストレージクォータ問題を回避）
- CSVはGitHubリポジトリにコミットしてgit管理（履歴追跡可能）
- GASはUrlFetchAppでGitHub raw URLからCSVをダウンロード
- clasp pushステップを追加（コード変更時の手動デプロイ不要）

### 2.2 ブック構成

| ブック | アカウント | 公開範囲 | 役割 |
|---|---|---|---|
| 原本ブック | Shingo 本アカウント | 非公開 | Python取得データの書き込み先・ロジック格納 |
| サービス提供用ブック | ステルスアカウント | リンク共有：閲覧者 | クライアントが参照するマスタデータ |
| listing/container | 各クライアント | クライアント所有 | 出品時のプルダウン表示に使用 |
| research/container | 各クライアント | クライアント所有 | 利益計算時のFVFレート参照に使用 |

---

## 3. 原本ブック シート構造

原本ブックは3シート＋マーケット別シートで構成される。configシートは廃止し、全設定値はPropertiesServiceで管理する。

### 3.1 category_master_EBAY_XX（マーケット別・4シート）

マーケットごとに1シートを作成。シート名は `category_master_EBAY_US` / `_EBAY_GB` / `_EBAY_DE` / `_EBAY_AU`。

| 列 | 列名 | 型 | ソース | 説明・例 |
|---|---|---|---|---|
| A | marketplace_id | 文字列 | Python | EBAY_US |
| B | category_tree_id | 文字列 | Python | 0 |
| C | category_id | 文字列 | Python | 261581 |
| D | category_name | 文字列 | Python | Cell Phones & Smartphones |
| E | conditions_json | JSON | Python | [{"id":"1000","name":"New",...}] |
| F | fvf_rate | 数値 | Gemini | 13.25（%） |
| G | last_synced | 日付 | Python | 2026-04-10 |

#### データソースと取得API

- **fetchItemAspects**（Taxonomy API）：全リーフカテゴリのスペック一括取得（gzip圧縮JSON）
- **getItemConditionPolicies**（Sell Metadata API）：マーケットごとにコンディション一括取得（limit=100ページネーション）  
  ※ 旧実装の `commerce/taxonomy/v1` エンドポイントはfetchItemAspectsのカテゴリIDと互換性がなく404エラー → `sell/metadata/v1` に修正済み
- eBay公式料率ページ → Gemini 2.5 Flash-LiteでFVFレート構造化抽出

### 3.2 condition_ja_map

コンディションIDごとの日本語表記を管理するシート。全マーケット共通で1シート。

| 列 | 列名 | 型 | ソース | 説明・例 |
|---|---|---|---|---|
| A | condition_id | 数値 | Python | 2750 |
| B | condition_name | 文字列 | Python | Like New |
| C | condition_enum | 文字列 | Python（マッピング） | LIKE_NEW |
| D | ja_display | 文字列 | Gemini | 未使用品同様 |
| E | ja_description | 文字列 | Gemini | 開封済みだが使用感なし、付属品完備 |
| F | last_synced | 日付 | Python | 2026-04-10 |

#### condition_enum マッピング（ハードコード）

`getItemConditionPolicies` は condition_enum を返さないため、Pythonで静的マッピングを適用：

| condition_id | condition_enum |
|---|---|
| 1000 | NEW |
| 1500 | NEW_OTHER |
| 1750 | NEW_WITH_DEFECTS |
| 2000 | CERTIFIED_REFURBISHED |
| 2010 | EXCELLENT_REFURBISHED |
| 2020 | VERY_GOOD_REFURBISHED |
| 2030 | GOOD_REFURBISHED |
| 2500 | SELLER_REFURBISHED |
| 2750 | LIKE_NEW |
| 2990 | PRE_OWNED_EXCELLENT |
| 3000 | USED_EXCELLENT |
| 3010 | PRE_OWNED_FAIR |
| 4000 | USED_VERY_GOOD |
| 5000 | USED_GOOD |
| 6000 | USED_ACCEPTABLE |
| 7000 | FOR_PARTS_OR_NOT_WORKING |

### 3.3 sync_log（更新履歴）

| 列 | 列名 | 型 | 説明・例 |
|---|---|---|---|
| A | sync_date | 日付時刻 | 2026-04-10 03:00 |
| B | type | 文字列 | category_master / condition_ja_map |
| C | action | 文字列 | added / removed / changed |
| D | detail | 文字列 | category 261581: condition changed |
| E | status | 文字列 | pending / synced / error |

---

## 4. 設定管理（PropertiesService）

configシートは廃止。全設定値はGASのPropertiesService（スクリプトプロパティ）で管理する。コードやスプレッドシートに機密値がハードコードされない。

| プロパティ名 | 用途 | 値の例 |
|---|---|---|
| SERVICE_BOOK_ID | サービス提供用ブックのスプレッドシートID | 1-xPb7Jnk... |
| GEMINI_API_KEY | Gemini 2.5 Flash-Lite API キー | AIza... |
| DISCORD_WEBHOOK_EBAYDB | Discord通知用Webhook URL（ebay-db専用） | https://discord.com/api/webhooks/... |
| AUTO_SYNC_ENABLED | 自動同期の有効/無効 | TRUE / FALSE |
| LAST_FULL_SYNC | 最終同期日時（GAS自動更新） | 2026-04-10 |

#### configシート廃止の理由

- スプレッドシートのconfigシートはエディタ権限があれば誰でも閲覧可能
- SERVICE_BOOK_ID（ステルスアカウントのID）やAPI Keyが露出するリスク
- PropertiesServiceはスクリプトエディタからのみ閲覧可能
- シートをコピーしても値は引き継がれない（セキュリティ向上）

---

## 5. 自動更新フロー

### 5.1 月次更新処理（GitHub Actions cron）

| Step | 処理 | 実行環境 | 詳細 |
|---|---|---|---|
| 1 | カテゴリ取得 | Python | fetchItemAspects でマーケットごとにスペック取得（gzip圧縮JSON） |
| 2 | コンディション取得 | Python | getItemConditionPolicies でマーケットごとに全カテゴリのコンディション取得（limit=100ページネーション） |
| 3 | FVFレート抽出 | Python + Gemini | eBay公式料率ページHTML → Gemini 2.5 Flash-Lite でJSON化 |
| 4 | CSV生成 | Python | マーケットごとに category_master_EBAY_XX.csv + 共通の condition_ja_map.csv を生成 |
| 5 | GitHubコミット | git | ebay-db/output/ にCSVをコミット・プッシュ |
| 6 | GASデプロイ | clasp push | 最新のGASコードをGASプロジェクトにデプロイ |
| 7 | シートインポート | clasp run | GASがGitHub raw URLからCSV取得 → Utilities.parseCsv → setValuesで一括書き込み |
| 8 | 通知 | GAS | Discord Webhook で差分サマリー・チェック結果を通知 |

### 5.2 整合性チェック項目

| # | チェック項目 | FAIL条件 | 対応 |
|---|---|---|---|
| 1 | データ空チェック | category_masterのデータ行が0件 | 転記ブロック＋Discord通知 |
| 2 | conditions_json空チェック | conditions_jsonが全て`[]`のカテゴリが一定割合以上 | 転記ブロック＋Discord通知 |
| 3 | condition_id存在確認 | conditions_jsonのIDがcondition_ja_mapに未登録 | 転記ブロック＋Discord通知 |
| 4 | ja_display空欄チェック | condition_ja_mapのja_display列が空欄 | 転記ブロック＋Discord通知 |
| 5 | FVFレート範囲チェック | fvf_rateが0%未満または20%超 | 転記ブロック＋Discord通知 |

#### v1.1からの改善：空データPASS問題への対応

- v1.1では `conditions_json` が全て `[]` でも整合性チェックがPASSし、空データが転記されていた
- v2.0では「データ空チェック」「conditions_json空チェック」を追加
- データが0件またはコンディション情報が取得できていない場合は転記をブロック

---

## 6. ファイル構成

### 6.1 リポジトリ構成（ebay-db配下）

| パス | 種別 | 役割 |
|---|---|---|
| ebay-db/scripts/fetch_category_master.py | Python | fetchItemAspects でマーケットごとにスペック取得 |
| ebay-db/scripts/fetch_conditions.py | Python | sell/metadata/v1 getItemConditionPolicies でコンディション取得 |
| ebay-db/scripts/extract_fvf.py | Python | eBay料率ページ → Gemini でFVFレート抽出 |
| ebay-db/scripts/generate_csv.py | Python | JSONデータ結合 → マーケット別CSV生成 |
| ebay-db/scripts/requirements.txt | 設定 | Python依存パッケージ定義 |
| ebay-db/output/category_master_EBAY_US.csv | データ | USマーケットのカテゴリマスタ |
| ebay-db/output/category_master_EBAY_GB.csv | データ | GBマーケットのカテゴリマスタ |
| ebay-db/output/category_master_EBAY_DE.csv | データ | DEマーケットのカテゴリマスタ |
| ebay-db/output/category_master_EBAY_AU.csv | データ | AUマーケットのカテゴリマスタ |
| ebay-db/output/condition_ja_map.csv | データ | コンディション日本語マッピング（全マーケット共通） |
| ebay-db/docs/ebay_db_design_report.md | ドキュメント | 設計定義書（本ドキュメント） |
| gas/ebay-db/container/Config.gs | GAS | PropertiesService読み込み・sync_log追記 |
| gas/ebay-db/container/ImportSync.gs | GAS | CSVインポート・差分検出・整合性チェック・転記 |
| gas/ebay-db/container/GeminiTranslate.gs | GAS | Gemini APIで日本語コンディション自動生成 |
| gas/ebay-db/container/DiscordNotify.gs | GAS | Discord Webhook通知 |
| .github/workflows/sync-ebay-db.yml | YAML | 月次自動更新ワークフロー |

#### v1.1から削除されたファイル

- `ebay-db/scripts/upload_to_drive.py` — Google Drive経由を廃止したため不要

---

## 7. GitHub Secrets

| Secret名 | 用途 | 状態 |
|---|---|---|
| CLASPRC_JSON | clasp push / run によるGASデプロイ・実行の認証 | ✅ 登録済み |
| EBAY_DB_CB_DEV | ebay-db/container の.clasp.json scriptId | ✅ 登録済み |
| EBAY_CLIENT_ID | eBay API OAuth認証（Client ID） | ✅ 登録済み |
| EBAY_CLIENT_SECRET | eBay API OAuth認証（Client Secret） | ✅ 登録済み |
| DISCORD_WEBHOOK_AUDIT | Discord通知用Webhook URL | ✅ 登録済み |
| GEMINI_API_KEY | Gemini 2.5 Flash-Lite API キー | ✅ 登録済み |
| CLAUDE_CODE_OAUTH_TOKEN | Claude Code 認証トークン | ✅ 登録済み |

#### v1.1から削除されたSecrets

- `GCP_SERVICE_ACCOUNT_KEY` — Google Drive経由廃止により不要
- `DRIVE_CSV_FOLDER_ID` — Google Drive経由廃止により不要

---

## 8. AIモデル選定方針

| 優先順位 | モデル | 入力 / 1M | 出力 / 1M | 採用条件 |
|---|---|---|---|---|
| 第1候補（採用） | Gemini 2.5 Flash-Lite | $0.10 | $0.40 | コスト最安・無料枠あり |
| 第2候補 | Claude Haiku 4.5 | $0.80 | $4.00 | Flash-Liteで精度不足の場合 |
| 第3候補 | Gemini 2.5 Flash | $0.30 | $2.50 | Haikuが高コストの場合 |
| 第4候補 | OpenAI GPT系 | 要調査 | 要調査 | 上記全てで精度不足の場合 |

#### 精度検証の判断基準

- FVFレート抽出：公式料率ページからの抽出正確性（100%一致が目標）
- ja_display翻訳：メルカリ・ヤフオクのユーザーが直感的に選択できる表現か
- 検証タイミング：シート作成後に実データで精度検証を実施
- 切り替え判断：精度不足時はコストを許容して高品質モデルに切り替え

※ Gemini 2.0 Flash は2026年6月1日に廃止予定のため採用しない

---

## 9. コスト試算

※ シート作成後に実データで再計算が必要

| 処理 | 入力トークン | 出力トークン | 推定コスト |
|---|---|---|---|
| FVFレート抽出 | 約20,000 | 約5,000 | $0.004 |
| ja_display生成（初回全件50行） | 約100,000 | 約25,000 | $0.020 |
| ja_display生成（月次差分5件） | 約10,000 | 約2,500 | $0.002 |
| 月額合計（通常運用） | — | — | 約$0.006 |
| 年間合計 | — | — | 約$0.07 |

#### コスト再計算メモ

- [ ] 4マーケットのリーフカテゴリ総数（CSVの実行数）を確認
- [ ] eBay料率ページのHTML実サイズ（トークン数）を測定
- [ ] condition_ja_mapの実行数を確認
- [ ] 無料枠（1日1,000リクエスト）内に収まるか検証

---

## 10. 実装で得られた教訓

| # | 問題 | 原因 | 対策 |
|---|---|---|---|
| 1 | CSVがヘッダーのみ（データ空） | fetchItemAspectsのレスポンスキー名の誤り（aspectMetadataResponses→categoryAspects） | API公式ドキュメントでレスポンス構造を確認してから実装 |
| 2 | 全マーケットで500エラー | AcceptヘッダーをApplication/octet-streamに変更したため | Acceptはapplication/jsonのまま、レスポンスのContent-Typeで判定 |
| 3 | エラーが検知されず空データが成功扱い | 例外を握りつぶして正常終了していた | データ0件時にexit(1)でワークフローを異常終了させる |
| 4 | GAS 6分タイムアウト | 55,849行を1回で書き込もうとした | マーケットごとにCSV分割（1マーケット1シート） |
| 5 | Drive APIで403エラー | サービスアカウントにストレージクォータがない | Google Drive経由を廃止 → GitHub経由に変更 |
| 6 | コンディション全て404 | commerce/taxonomy/v1のエンドポイントがfetchItemAspectsのIDと非互換 | sell/metadata/v1 getItemConditionPoliciesに変更 |
| 7 | 空データで整合性チェックPASS | conditions_json=[]をチェックしていなかった | 空データチェック・conditions_json空チェックを追加 |
| 8 | GASに古いコードが残る | clasp pushがワークフローに含まれていなかった | sync-ebay-db.ymlにclasp pushステップを追加 |

---

## 11. 設計決定事項サマリー

| # | 決定事項 | 決定内容 | 理由 |
|---|---|---|---|
| 1 | シート構成 | マーケット別category_master + condition_ja_map + sync_log | マーケット分割で6分制限回避 |
| 2 | 設定管理 | PropertiesService（configシート廃止） | 機密値の隠蔽・コピー時の漏洩防止 |
| 3 | データ配信経路 | GitHub経由（CSVをリポジトリにコミット） | Drive権限問題回避・git履歴管理 |
| 4 | CSV分割 | 1マーケット1ファイル | GAS 6分制限対応・管理しやすさ |
| 5 | コンディション取得 | sell/metadata/v1 getItemConditionPolicies | taxonomy/v1は非互換で404 |
| 6 | condition_enum | Pythonでハードコードマッピング | APIがenumを返さないため |
| 7 | 転記タイミング | 整合性チェックPASS後に自動転記 | 空データの配信防止 |
| 8 | FVFレート取得 | Gemini 2.5 Flash-Lite で自動抽出 | 完全自動化・月額$0.006 |
| 9 | 日本語翻訳 | Gemini 2.5 Flash-Lite で自動生成 | 精度不足時はHaiku/Flash/OpenAIに切替 |
| 10 | GASデプロイ | sync-ebay-db.ymlにclasp pushステップ | コード変更の自動反映 |
| 11 | マーケット範囲 | US/GB/DE/AU（FRは後日追加） | 小規模で動作確認後にスケール |
| 12 | 環境分離 | DEV/PROD各2つ（エディタ+シート） | HEADデプロイ事故の防止 |
| 13 | クライアントアクセス | openByUrl()で直接読み取り | 権限管理不要（リンク共有：閲覧者） |
| 14 | 人間の作業 | Discord通知の確認のみ | 問題なければ何もしなくてよい |

---

*HIGH LIFE JPN（Treasure Island JP） | ebay-db 設計定義書 v2.0 | 2026-04-10 | Confidential*

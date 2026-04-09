# ebay-db 設計定義書
カテゴリマスタ・コンディションマスタ・自動更新システム

**bay-auto Project** | shingo-ops/bay-auto  
HIGH LIFE JPN（Treasure Island JP）  
Version 1.1 | 2026-04-09

---

## 1. 概要

本ドキュメントは bay-auto リポジトリの ebay-db プロジェクトの設計定義書である。eBayの全マーケットプレイス・全リーフカテゴリのスペック、コンディション、FVFレートを自動取得し、クライアント向けの出品ツール（listing）と利益計算ツール（research）にマスタデータを提供するシステムを定義する。

### 設計方針
- データ取得から配信まで完全自動化（人間の作業はDiscord通知の確認のみ）
- 原本ブックとサービス提供用ブックの分離によるロジック・アカウント隠蔽
- Gemini 2.5 Flash-Lite によるFVFレート抽出・日本語翻訳の自動化
- 月1回のGitHub Actions cronによる定期更新

---

## 2. システム構成

### 2.1 データフロー

| 段階 | 処理内容 | 実行環境 |
|---|---|---|
| ① 生成 | eBay API（fetchItemAspects + getItemConditionPolicies）から全リーフカテゴリのデータ取得 | Python / GitHub Actions |
| ② 変換 | Gemini 2.5 Flash-Lite でFVFレート抽出・日本語コンディション自動生成 | Python / Gemini API |
| ③ 出力 | category_master.csv + condition_ja_map.csv を Google Drive に出力 | Python |
| ④ 取込 | GASトリガーでCSVを原本ブックにインポート・差分検出 | GAS（原本ブック） |
| ⑤ 検証 | 整合性チェック（condition_idの存在確認・ja_display空欄・FVFレート範囲） | GAS（原本ブック） |
| ⑥ 転記 | 整合性PASS後、原本 → サービス提供用ブックへ自動転記 | GAS（原本ブック） |
| ⑦ 通知 | Discord Webhook で差分サマリー・AI生成日本語一覧・FVF変更を通知 | GAS / GitHub Actions |
| ⑧ 消費 | クライアントのシートがサービス提供用ブックを openByUrl() で読み取り | GAS（各クライアント） |

### 2.2 ブック構成

| ブック | アカウント | 公開範囲 | 役割 |
|---|---|---|---|
| 原本ブック | Shingo 本アカウント | 非公開 | Python取得データの書き込み先・ロジック格納 |
| サービス提供用ブック | ステルスアカウント | リンク共有：閲覧者 | クライアントが参照するマスタデータ |
| listing/container | 各クライアント | クライアント所有 | 出品時のプルダウン表示に使用 |
| research/container | 各クライアント | クライアント所有 | 利益計算時のFVFレート参照に使用 |

**隠蔽の目的**
1. ロジック隠蔽：原本のシート構造やPython取得の仕組みがクライアントに見えない
2. アカウント隠蔽：Shingoの本アカウントがクライアントに紐付かない
3. 構造隠蔽：サービス提供用ブックには簡素化されたデータのみ転記（sync_log・configは転記しない）

---

## 3. 原本ブック シート構造

### 3.1 category_master

eBayの全マーケットプレイス・全リーフカテゴリのスペック・コンディション・FVFレートを1行=1カテゴリで集約するマスタシート。

| 列 | 列名 | 型 | ソース | 説明・例 |
|---|---|---|---|---|
| A | marketplace_id | 文字列 | Python | EBAY_US / EBAY_GB / EBAY_DE 等 |
| B | category_tree_id | 文字列 | Python | 0（US）/ 3（GB）/ 77（DE）等 |
| C | category_id | 文字列 | Python | 261581 |
| D | category_name | 文字列 | Python | Cell Phones & Smartphones |
| E | required_specs_json | JSON | Python | [{"name":"Brand","values":[...]}] |
| F | recommended_specs_json | JSON | Python | [{"name":"Color","values":[...]}] |
| G | optional_specs_json | JSON | Python | [{"name":"MPN","values":[...]}] |
| H | conditions_json | JSON | Python | [{"id":"1000","name":"New",...}] |
| I | fvf_rate | 数値 | Gemini | 13.25（%） |
| J | last_synced | 日付 | Python | 2026-04-09 |

**データソース**
- fetchItemAspects：全リーフカテゴリのスペック一括取得（gzip圧縮JSON、100MB超）
- getItemConditionPolicies：カテゴリ別コンディション＋表示名取得
- eBay公式料率ページ → Gemini 2.5 Flash-LiteでFVFレート構造化抽出
- 行数：全マーケットプレイスの全リーフカテゴリ（数万行）

### 3.2 condition_ja_map

コンディションIDごとの日本語表記を管理するシート。カテゴリ固有の表示名（Graded / Pre-owned等）にも対応。1行=1つのカテゴリ固有コンディション。

| 列 | 列名 | 型 | ソース | 説明・例 |
|---|---|---|---|---|
| A | condition_id | 数値 | Python | 2750 |
| B | condition_name | 文字列 | Python | Like New（デフォルト表示名） |
| C | condition_enum | 文字列 | Python | LIKE_NEW |
| D | category_display | 文字列 | Python | Graded（カテゴリ固有表示名） |
| E | category_ids | 文字列 | Python | 183050,183454,261328 |
| F | ja_display | 文字列 | Gemini | 鑑定済み（Graded） |
| G | ja_description | 文字列 | Gemini | 第三者鑑定機関が検査・スコアリング済み |
| H | last_synced | 日付 | Python | 2026-04-09 |

**カテゴリ固有コンディションの例**
- Condition ID 2750：デフォルト「Like New」→ トレカでは「Graded（鑑定済み）」
- Condition ID 4000：デフォルト「Very Good」→ トレカでは「Ungraded（未鑑定）」
- Condition ID 3000：デフォルト「Used」→ アパレルでは「Pre-owned - Good」
- Condition ID 2990：アパレル専用「Pre-owned - Excellent」
- Condition ID 1000：デフォルト「New」→ アパレルでは「New with tags」

### 3.3 sync_log（更新履歴）

| 列 | 列名 | 型 | 説明・例 |
|---|---|---|---|
| A | sync_date | 日付時刻 | 2026-04-09 03:00 |
| B | type | 文字列 | category_master / condition_ja_map |
| C | action | 文字列 | added / removed / changed |
| D | detail | 文字列 | category 261581: condition changed |
| E | status | 文字列 | pending / synced / error |

### 3.4 config（設定）

| 列 | 列名 | 値の例 |
|---|---|---|
| A | SERVICE_BOOK_ID | サービス提供用ブックのスプレッドシートID |
| B | CSV_FOLDER_ID | Python出力CSVの格納先Google DriveフォルダID |
| C | DISCORD_WEBHOOK | 通知用Webhook URL |
| D | AUTO_SYNC_ENABLED | TRUE / FALSE |
| E | LAST_FULL_SYNC | 2026-04-09 |

---

## 4. 自動更新フロー

### 4.1 月次更新処理（GitHub Actions cron）

| Step | 処理 | 実行環境 | 詳細 |
|---|---|---|---|
| 1 | データ取得 | Python | fetchItemAspects + getItemConditionPolicies で全リーフカテゴリ取得 |
| 2 | FVFレート抽出 | Python + Gemini | eBay公式料率ページHTML → Gemini 2.5 Flash-Lite でJSON化 |
| 3 | CSV出力 | Python | category_master.csv + condition_ja_map.csv を Google Drive に出力 |
| 4 | CSVインポート | GAS | CSVを原本ブックに取り込み、既存データとの差分検出 |
| 5 | 日本語生成 | GAS + Gemini | ja_display空欄行を検出 → Gemini Flash-Lite で自動翻訳 |
| 6 | 整合性チェック | GAS | condition_id存在確認・ja_display空欄チェック・FVFレート範囲チェック |
| 7 | 転記 | GAS | 整合性PASS時のみ → サービス提供用ブックへ自動転記 |
| 8 | 通知 | GAS | Discord Webhook で差分サマリー・チェック結果を通知 |

### 4.2 整合性チェック項目

| # | チェック項目 | FAIL条件 | 対応 |
|---|---|---|---|
| 1 | condition_id 存在確認 | category_masterのconditions_jsonに含まれるIDがcondition_ja_mapに未登録 | 転記ブロック＋Discord通知 |
| 2 | ja_display 空欄チェック | condition_ja_mapのF列が空欄の行が存在 | 転記ブロック＋Discord通知 |
| 3 | FVFレート範囲チェック | fvf_rateが0%未満または20%超 | 転記ブロック＋Discord通知 |

**FAIL時のDiscord通知例**
```
⚠️ 整合性チェック FAIL
- condition_ja_mapにja_display未入力: 3件
  → condition_id 2990 (Pre-owned - Excellent)
  → condition_id 3010 (Pre-owned - Fair)
- 転記はブロックされました
- 原本ブックで確認後、GASメニューから再実行してください
```

---

## 5. リポジトリ構成

### 5.1 bay-auto リポジトリ内の位置づけ

| パス | 種別 | 役割 |
|---|---|---|
| `gas/ebay-db/container/` | GAS（コンテナバインド） | 原本ブックの転記ロジック・整合性チェック |
| `ebay-db/scripts/` | Python | eBay API取得 → CSV出力 → Google Drive アップロード |
| `ebay-db/docs/` | ドキュメント | 設計定義書（本ファイル） |
| `listing/standalone/` | GAS（ライブラリ） | EbayLib本体（18ファイル） |
| `listing/container/` | GAS（コンテナバインド） | UIトリガー（2ファイル） |
| `research/container/` | GAS（コンテナバインド） | 利益計算ツール（10ファイル） |

### 5.2 クライアントからマスタへのアクセス

| 消費元 | アクセス方法 | 取得データ |
|---|---|---|
| listing/container | シート内のURL設定 → openByUrl() | カテゴリスペック・コンディションプルダウン |
| research/container | シート内のURL設定 → openByUrl() | FVFレート・コンディション情報 |

---

## 6. コスト試算

### 6.1 Gemini API 料金（2026年4月時点）

| モデル | 入力 / 1Mトークン | 出力 / 1Mトークン |
|---|---|---|
| **Gemini 2.5 Flash-Lite（採用）** | $0.10 | $0.40 |
| Gemini 2.5 Flash | $0.30 | $2.50 |
| Gemini 2.5 Pro | $1.25 | $10.00 |

### 6.2 月次コスト試算

| 処理 | 推定コスト |
|---|---|
| FVFレート抽出 | $0.004 |
| ja_display生成（初回全件50行） | $0.020 |
| ja_display生成（月次差分5件） | $0.002 |
| **月額合計（通常運用）** | **約$0.006** |
| **年間合計** | **約$0.07** |

---

## 7. AIモデル選定方針

### 7.1 採用モデルと切り替え基準

| 優先順位 | モデル | 採用条件 |
|---|---|---|
| 第1候補（採用） | Gemini 2.5 Flash-Lite | コスト最安・無料枠あり（1日1,000リクエスト） |
| 第2候補 | Claude Haiku 4.5 | Flash-Liteで精度不足の場合 |
| 第3候補 | Gemini 2.5 Flash | Flash-Liteで精度不足かつHaikuが高コストの場合 |
| 第4候補 | OpenAI GPT系 | 上記全てで精度不足の場合 |

---

## 8. GitHub Actions 実行フロー

### 8.1 ワークフロー定義

| ファイル名 | トリガー | 処理内容 |
|---|---|---|
| `sync-ebay-db.yml` | cron: 毎月1日 03:00 UTC / 手動dispatch | 月次自動更新フロー（全処理） |

### 8.2 必要な GitHub Secrets

| Secret名 | 用途 | 状態 |
|---|---|---|
| CLASPRC_JSON | clasp run によるGASリモート実行の認証 | ✅ 登録済み |
| EBAY_DB_CB_DEV | ebay-db/container DEV環境の.clasp.json | ✅ 登録済み |
| EBAY_CLIENT_ID | eBay API OAuth認証 | ✅ 登録済み |
| EBAY_CLIENT_SECRET | eBay API OAuth認証 | ✅ 登録済み |
| DISCORD_WEBHOOK_AUDIT | Discord通知用Webhook URL | ✅ 登録済み |
| GCP_SERVICE_ACCOUNT_KEY | Google Drive API アクセス | ❌ 要追加 |
| GEMINI_API_KEY | Gemini 2.5 Flash-Lite API | ❌ 要追加 |
| DRIVE_CSV_FOLDER_ID | CSV出力先のGoogle DriveフォルダID | ❌ 要追加 |

---

## 9. 実装スコープ

### 9.1 新規作成ファイル

| パス | 言語 | 役割 |
|---|---|---|
| `ebay-db/scripts/fetch_category_master.py` | Python | fetchItemAspects でスペック一括取得 |
| `ebay-db/scripts/fetch_conditions.py` | Python | getItemConditionPolicies でコンディション取得 |
| `ebay-db/scripts/extract_fvf.py` | Python | eBay料率ページ → Gemini でFVFレート抽出 |
| `ebay-db/scripts/generate_csv.py` | Python | JSONデータ結合 → CSV生成 |
| `ebay-db/scripts/upload_to_drive.py` | Python | CSV → Google Drive アップロード |
| `ebay-db/scripts/requirements.txt` | 設定 | Python依存パッケージ定義 |
| `gas/ebay-db/container/ImportSync.gs` | GAS | CSVインポート・差分検出・整合性チェック・転記 |
| `gas/ebay-db/container/GeminiTranslate.gs` | GAS | Gemini APIで日本語コンディション自動生成 |
| `gas/ebay-db/container/DiscordNotify.gs` | GAS | Discord Webhook通知 |
| `gas/ebay-db/container/Config.gs` | GAS | configシートからの設定値読み込み |
| `.github/workflows/sync-ebay-db.yml` | YAML | 月次自動更新ワークフロー |

---

## 10. 設計決定事項サマリー

| # | 決定事項 | 決定内容 | 理由 |
|---|---|---|---|
| 1 | シート構成 | category_master + condition_ja_map の2シート | 1シート集約でシンプル化 |
| 2 | テーブル名統一 | condition_group_map（コード側に統一） | 既存ロジックの修正不要 |
| 3 | カテゴリ範囲 | 全マーケットプレイス・全リーフカテゴリ | クライアントの取扱カテゴリを限定しない |
| 4 | Python書き込み先 | CSV出力 → GASで自動インポート | Sheets APIへの依存回避 |
| 5 | 転記タイミング | 整合性チェックPASS後に自動転記 | 不整合データの配信防止 |
| 6 | 転記ロジック配置 | 原本ブックのコンテナバインドGAS | 原本側で完結させる |
| 7 | FVFレート取得 | Gemini 2.5 Flash-Lite で自動抽出 | 完全自動化・月額$0.006 |
| 8 | 日本語翻訳 | Gemini 2.5 Flash-Lite で自動生成 | メルカリ・ヤフオク風の表現に自動変換 |
| 9 | AIモデル選定 | 第1候補: Gemini 2.5 Flash-Lite | コスト最安・無料枠。精度不足時は順次切り替え |
| 10 | 実行環境 | GitHub Actions cron → Python → clasp run | 全処理をGitHub上で完結 |
| 11 | 人間の作業 | Discord通知の確認のみ | 問題なければ何もしなくてよい |
| 12 | GASライブラリ構成 | standalone=18ファイル / container=2ファイル | ビジネスロジック隠蔽 |
| 13 | 環境分離 | DEV/PROD各2つ（エディタ+シート） | HEADデプロイ事故の防止 |
| 14 | クライアントアクセス | openByUrl()で直接読み取り | 権限管理不要（リンク共有：閲覧者） |

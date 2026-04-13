# ebay-gas-automation

eBay出品自動化のためのGoogle Apps Script（GAS）・Python・Cloudflare Workersを管理するリポジトリ。

## ドキュメント

### 出品ツール

| ドキュメント | 内容 |
|-------------|------|
| [出品ツール概要](docs/listing/README.md) | 機能概要・使い方 |
| [出品ツール仕様書](docs/listing/listing-tool-spec.md) | 詳細仕様 |
| [設定ガイド](docs/listing/CONFIG_GUIDE.md) | ツール設定シートの設定方法 |
| [クイックスタート](docs/listing/QUICK_START.md) | 初期セットアップ手順 |
| [エラーハンドリングガイド](docs/listing/ERROR_HANDLING_GUIDE.md) | エラー対処法 |
| [Item Specificsガイド](docs/listing/ITEM_SPECIFICS_GUIDE.md) | Item Specifics設定方法 |
| [2ステップフローガイド](docs/listing/TWO_STEP_FLOW_GUIDE.md) | 出品フロー詳細 |
| [作業ステータス](docs/listing/WORK_STATUS.md) | 現在の開発状況 |
| [マルチテナント対応TODO](docs/listing/TODO_multitenancy.md) | 今後の実装予定 |
| [API調査レポート](docs/listing/ebay_api_comprehensive_research.md) | eBay API調査結果 |
| [実装ロードマップ](docs/listing/implementation-roadmap.md) | 実装計画 |

### リサーチツール

| ドキュメント | 内容 |
|-------------|------|
| [リサーチツール概要](docs/research/README.md) | 機能概要 |
| [本番セットアップガイド](docs/research/PRODUCTION_SETUP_GUIDE.md) | 本番環境の設定手順 |
| [技術仕様書](docs/research/TECH_SPEC_EBAY_LISTING_SYSTEM.md) | 技術詳細 |
| [ユーザー仕様書](docs/research/USER_SPEC_EBAY_LISTING_SYSTEM.md) | ユーザー向け仕様 |
| [配送範囲定義](docs/research/DELIVERY_SCOPE.md) | 配送対象範囲 |

### eBay DB

| ドキュメント | 内容 |
|-------------|------|
| [eBay DB設計定義書](ebay-db/docs/ebay_db_design_report.md) | DB設計・スキーマ定義 |

---

## プロジェクト構成

```
ebay-gas-automation/
├── gas/
│   ├── listing/
│   │   ├── standalone/    # 出品ツール本体（EbayLib）
│   │   └── container/     # スプレッドシートバインド（メニュー・トリガー）
│   ├── research/
│   │   ├── container/     # リサーチツール（バインド）
│   │   └── lowest-price/  # 最安値取得
│   └── ebay-db/
│       └── container/     # eBay DBツール（バインド）
├── ebay-db/
│   ├── docs/              # eBay DB設計定義書
│   ├── output/            # 出力データ
│   └── scripts/           # データ取得スクリプト
├── proxy/                 # Pythonプロキシサーバー
├── workers/               # Cloudflare Workers
│   └── ebay-proxy/
├── docs/
│   ├── listing/           # 出品ツール仕様書
│   └── research/          # リサーチツール仕様書
└── CLAUDE.md              # Claude Code向け開発ガイド
```

## アーキテクチャ

### GASの2層構造

```
スプレッドシート
  └── container/Code.gs（バインドスクリプト）
        ├── メニュー表示
        ├── トリガー（handleEdit）
        └── EbayLib.*（スタンドアロンをライブラリ参照）
              └── standalone/（EbayLib本体）
                    ├── ListingManager.gs  # 出品・転記・DB管理
                    ├── EbayAPI.gs         # eBay API呼び出し
                    ├── Config.gs          # 設定・ヘッダーマッピング
                    ├── PolicyManager.gs   # ポリシー管理
                    ├── Menu.gs            # メニュー関数
                    └── ClientManager.gs   # マルチテナント管理
```

### 出品フロー

```
1. 出品ボタン押下
2. Phase1: 出品DBにSKUを予約・商品データを転記
   └── 失敗時: エラー表示して出品中止
3. Phase2: eBay APIで出品（AddFixedPriceItem）
   └── 失敗時: DB行をクリア（ロールバック）してエラー表示
4. Phase3: Promoted Listing設定（任意）
5. Phase4: DBにItem ID・出品URL・ステータス・タイムスタンプを更新
   └── 失敗時: 出品シートにItem IDを書き戻し・データは保持
6. Phase5: 出品シートのデータをクリア（書式・プルダウンは維持）
```

---

## 開発環境セットアップ

### 必要なツール

```bash
# Node.js（clasp用）
node -v  # v18以上推奨

# clasp（GAS CLI）
npm install -g @google/clasp

# clasp ログイン
clasp login
```

### ブランチ構成

| ブランチ | 用途 |
|---------|------|
| `main` | 本番環境（保護ブランチ） |
| `develop` | 開発環境 |

---

## デプロイ

**手動デプロイは禁止。必ずGitHub Actions経由でデプロイします。**

| ブランチ | デプロイ先 |
|---------|-----------|
| `develop` push | 各GASの開発用プロジェクト |
| `main` push（PRマージ） | 各GASの本番プロジェクト |

### デプロイ対象

| ジョブ | 対象ディレクトリ | Secrets |
|--------|----------------|---------|
| deploy-listing-standalone | gas/listing/standalone/ | LISTING_SA_PROD / LISTING_SA_DEV |
| deploy-listing-container | gas/listing/container/ | LISTING_CO_PROD / LISTING_CO_DEV |
| deploy-research-container | gas/research/container/ | RESEARCH_CO_PROD / RESEARCH_CO_DEV |
| deploy-ebay-db-container | gas/ebay-db/container/ | EBAY_DB_CO_PROD / EBAY_DB_CO_DEV |

### スクリプトIDの管理

`.clasp.json` の `scriptId` は `REPLACED_BY_CI` というプレースホルダーになっています。
GitHub Actionsが実行時にSecretsから実際のIDに置き換えます。

**⚠️ ローカルで `.clasp.json` を直接編集してコミットしないでください。**

---

## 開発フロー

```
develop ブランチで実装
  ↓
GASエディタで動作確認（develop用プロジェクト）
  ↓
PR作成（develop → main）
  ↓
レビュー・マージ → 本番デプロイ
```

### 1機能1PRの原則

- 1つの機能・バグ修正ごとに1つのPRを作成する
- 複数機能をまとめてdevelopに積み上げない
- PR前に必ず動作確認を行う

### ⚠️ やってはいけないこと

```
❌ GASエディタでコードを直接編集する
❌ clasp push を手動で実行する
❌ .clasp.json の scriptId を直接書き換えてコミットする
❌ main ブランチに直接 push する
❌ APIキー・トークンをコードに直接書く
❌ .env ファイルをコミットする
```

---

## コード管理

### ローカル・GitHub・GASの同期フロー

```
ローカル（~/ebay-gas-automation/）
  ↓ git push
GitHub（shingo-ops/bay-auto）
  ↓ GitHub Actions（clasp push --force）
GAS（Google Apps Script）
```

### ずれが起きた場合の対処

| ケース | 対処 |
|--------|------|
| GASエディタで直接編集した | ローカルのコードで上書き（Actions再実行） |
| Actions が Skipping push した | workflow_dispatch で手動再実行 |
| ローカルとGitHubがずれた | `git status` で確認・`git pull` で同期 |

---

## eBay API リファレンス

| API | 用途 | 公式ドキュメント |
|-----|------|----------------|
| Trading API | 出品・更新・取り下げ | [Trading API Reference](https://developer.ebay.com/api-docs/traditionalapi/reference/trading/index.html) |
| AddFixedPriceItem | 固定価格出品 | [AddFixedPriceItem](https://developer.ebay.com/DevZone/XML/docs/Reference/eBay/AddFixedPriceItem.html) |
| ReviseFixedPriceItem | 出品更新 | [ReviseFixedPriceItem](https://developer.ebay.com/DevZone/XML/docs/Reference/eBay/ReviseFixedPriceItem.html) |
| EndFixedPriceItem | 出品取り下げ | [EndFixedPriceItem](https://developer.ebay.com/DevZone/XML/docs/Reference/eBay/EndFixedPriceItem.html) |
| Browse API | 商品検索・完了済みリスト | [Browse API Reference](https://developer.ebay.com/api-docs/buy/browse/overview.html) |
| Metadata API | カテゴリ・コンディション取得 | [Metadata API Reference](https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html) |
| Account API | ポリシー管理 | [Account API Reference](https://developer.ebay.com/api-docs/sell/account/overview.html) |

### 認証

| 項目 | 内容 | 参考 |
|------|------|------|
| OAuth 2.0 | アクセストークン・リフレッシュトークン | [OAuth Guide](https://developer.ebay.com/api-docs/static/oauth-tokens.html) |
| Access Token有効期限 | 2時間（自動更新済み） | [Token Management](https://developer.ebay.com/api-docs/static/oauth-token-types.html) |
| Sandbox環境 | テスト用環境 | [Sandbox Guide](https://developer.ebay.com/api-docs/static/sandbox-landing.html) |

---

## スプレッドシート構成

### 出品スプレッドシート

| シート名 | 用途 |
|---------|------|
| 出品 | 出品データ入力・管理（5行目以降がデータ行） |
| ツール設定 | APIキー・ポリシー・DB URL等の設定 |
| ポリシー | eBayポリシー一覧 |
| category_master | カテゴリマスター |
| condition_master | コンディションマスター |

### スクリプトプロパティ

| プロパティ | 用途 | 設定対象 |
|-----------|------|---------|
| DEFAULT_SPREADSHEET_ID | 開発・テスト用スプレッドシートID | standalone |
| CLIENTS | マルチテナント用クライアント一覧JSON（暫定） | standalone |

---

## テスト関数

GASエディタから直接実行できるテスト関数：

| 関数名 | ファイル | 用途 |
|--------|---------|------|
| testTransferToOutputDb() | ListingManager.gs | DB転記の単体テスト |
| inspectOutputDbRow() | ListingManager.gs | DB指定行の内容確認 |

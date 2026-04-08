# eBay API スプレッドシートツール

Google スプレッドシートから eBay API を利用するための統合ツール

## 概要

このプロジェクトは、Google Apps Script を使用して eBay API とスプレッドシートを連携させ、在庫管理、商品検索、注文管理などを効率化するツールです。

## 主要機能（予定）

### 商品管理
- [ ] eBay カタログ検索
- [ ] 商品情報の一括取得
- [ ] 在庫情報の同期
- [ ] 商品リスティングの作成・更新

### 注文管理
- [ ] 注文情報の取得
- [ ] 注文ステータスの更新
- [ ] 配送情報の管理

### 分析・レポート
- [ ] 販売データの取得
- [ ] パフォーマンス分析
- [ ] 財務データの集計

### その他
- [ ] 自動更新機能（トリガー設定）
- [ ] エラー処理とログ記録
- [ ] UI カスタムメニュー

## プロジェクト構造

```
ebay-spreadsheet-tool/
├── README.md                    # このファイル
├── docs/                        # ドキュメント
│   ├── ebay_api_comprehensive_research.md  # eBay API 詳細調査レポート
│   ├── setup.md                # セットアップガイド
│   └── usage.md                # 使用方法
├── src/                        # ソースコード
│   ├── Code.gs                 # メインエントリーポイント
│   ├── Config.gs               # 設定管理
│   ├── EbayAPI.gs              # eBay API クライアント
│   ├── OAuth.gs                # OAuth 認証処理
│   ├── SpreadsheetUI.gs        # スプレッドシート UI
│   ├── Products.gs             # 商品関連機能
│   ├── Orders.gs               # 注文関連機能
│   ├── Inventory.gs            # 在庫関連機能
│   └── Utils.gs                # ユーティリティ関数
├── config/                     # 設定ファイル
│   ├── .clasp.json.sample      # clasp 設定サンプル
│   ├── appsscript.json         # Apps Script マニフェスト
│   └── config.sample.gs        # 設定サンプル
└── tests/                      # テストコード（任意）
    └── test.gs
```

## セットアップ

### 前提条件

1. Google アカウント
2. eBay Developer Program アカウント
3. eBay API 認証情報（Client ID と Client Secret）

### 手順

#### 1. eBay Developer アカウントの作成

1. [eBay Developer Program](https://developer.ebay.com/) にアクセス
2. アカウントを作成してサインイン
3. アプリケーションキーセットを取得
   - Production Keys と Sandbox Keys を取得
   - Client ID（App ID）
   - Client Secret（Cert ID）

#### 2. Google スプレッドシートの準備

1. 新しい Google スプレッドシートを作成
2. 拡張機能 > Apps Script を開く

#### 3. コードのデプロイ

**方法 A: 手動コピー（簡単）**

1. `src/` フォルダ内の各 `.gs` ファイルの内容をコピー
2. Apps Script エディタで同名のファイルを作成してペースト
3. `config/config.sample.gs` を参考に `Config.gs` を編集

**方法 B: clasp を使用（推奨）**

```bash
# clasp のインストール
npm install -g @google/clasp

# Google アカウントにログイン
clasp login

# プロジェクトのクローン（既存の場合）
clasp clone <scriptId>

# または新規作成
clasp create --type sheets --title "eBay API Tool"

# コードをプッシュ
clasp push
```

#### 4. eBay API 認証情報の設定

1. `Config.gs` を開く
2. 以下の情報を入力:
   ```javascript
   const CONFIG = {
     EBAY_CLIENT_ID: 'あなたの Client ID',
     EBAY_CLIENT_SECRET: 'あなたの Client Secret',
     EBAY_ENVIRONMENT: 'SANDBOX', // または 'PRODUCTION'
     EBAY_MARKETPLACE_ID: 'EBAY_US' // 対象マーケットプレイス
   };
   ```

#### 5. OAuth 認証の実行

1. スプレッドシートに戻る
2. カスタムメニュー「eBay API」→「認証」を実行
3. 表示される URL にアクセスして認証を完了

## 使用方法

### カスタムメニュー

スプレッドシートに「eBay API」メニューが追加されます：

- **認証**: eBay API の OAuth 認証を実行
- **商品検索**: キーワードで商品を検索
- **在庫同期**: eBay の在庫情報を取得
- **注文取得**: 最新の注文情報を取得
- **設定**: API 設定の確認・更新

### シート構成

#### 1. 商品マスタシート
- eBay 商品情報の一覧
- SKU、タイトル、価格、在庫数など

#### 2. 注文管理シート
- 注文情報の一覧
- 注文ID、購入者情報、配送ステータスなど

#### 3. 在庫シート
- 在庫レベルの管理
- SKU、在庫数、ロケーションなど

#### 4. 設定シート
- API 設定情報
- 更新頻度、フィルター条件など

詳細は `docs/usage.md` を参照してください。

## eBay API について

このツールが利用する eBay API の詳細情報は `docs/ebay_api_comprehensive_research.md` を参照してください。

### 使用する主要 API

- **Browse API**: 商品検索と取得
- **Inventory API**: 在庫管理とリスティング
- **Fulfillment API**: 注文管理と配送
- **Analytics API**: パフォーマンス分析
- **Taxonomy API**: カテゴリ情報

## 開発情報

### API レート制限

- デフォルト制限が適用されます
- 大量のデータ処理には注意が必要
- Analytics API で使用状況を監視可能

### エラーハンドリング

- すべての API 呼び出しは try-catch でラップ
- エラーログは専用シートに記録
- ユーザーには分かりやすいメッセージを表示

### ログ記録

```javascript
// ログの記録例
Logger.log('API call started');
logToSheet('エラー', 'API呼び出しに失敗しました', error.message);
```

## トラブルシューティング

### 認証エラー
- Client ID と Client Secret が正しいか確認
- OAuth トークンの有効期限（2時間）を確認
- Sandbox/Production 環境の設定を確認

### API 呼び出しエラー
- レート制限に達していないか確認
- リクエストパラメータが正しいか確認
- eBay API のステータスページを確認

### スプレッドシートのパフォーマンス
- 一度に大量のデータを処理しない
- バッチ処理を活用
- 必要に応じてキャッシュを使用

## ロードマップ

### Phase 1: 基本機能（現在）
- [x] プロジェクト構造の作成
- [ ] OAuth 認証の実装
- [ ] 基本的な API クライアントの実装
- [ ] 商品検索機能

### Phase 2: 在庫管理
- [ ] 在庫情報の取得
- [ ] 在庫の一括更新
- [ ] 在庫同期の自動化

### Phase 3: 注文管理
- [ ] 注文情報の取得
- [ ] 注文ステータスの更新
- [ ] 配送情報の管理

### Phase 4: 分析機能
- [ ] 販売データの可視化
- [ ] パフォーマンスレポート
- [ ] カスタムダッシュボード

## 参考リンク

- [eBay Developer Program](https://developer.ebay.com/)
- [eBay API ドキュメント](https://developer.ebay.com/docs)
- [Google Apps Script ドキュメント](https://developers.google.com/apps-script)
- [clasp - Apps Script CLI](https://github.com/google/clasp)

## ライセンス

このプロジェクトは個人利用を目的としています。

## 作成者

谷澤 真吾

## 更新履歴

- 2026-03-10: プロジェクト初期化、eBay API 調査完了

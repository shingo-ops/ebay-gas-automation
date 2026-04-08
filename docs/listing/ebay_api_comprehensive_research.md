# eBay API 徹底調査レポート

調査日: 2026年3月10日

## 目次
1. [概要](#概要)
2. [API アーキテクチャ](#apiアーキテクチャ)
3. [主要APIカテゴリと機能](#主要apiカテゴリと機能)
4. [認証とセキュリティ](#認証とセキュリティ)
5. [利用制限と料金](#利用制限と料金)
6. [開発者リソース](#開発者リソース)
7. [マーケットプレイスサポート](#マーケットプレイスサポート)
8. [非推奨機能と移行ガイド](#非推奨機能と移行ガイド)
9. [ベストプラクティス](#ベストプラクティス)
10. [実用例](#実用例)

---

## 概要

eBay APIは、eBayのビジネスロジックとデータベースと直接通信する多様なソリューションを作成するための強力なツールセットです。現在、eBayは最新のRESTful APIへの移行を推進しており、これらのAPIは従来のSOAPベースのAPIと比較して、パフォーマンス、スケーラビリティ、ユーザーフレンドリー性が向上しています。

### 主要な特徴
- **プラットフォーム規模**: 約1億8200万人のユーザー、10億以上のアクティブな商品リスティング
- **グローバル展開**: 30カ国以上で展開
- **API種類**: RESTful API（推奨）とTraditional API（レガシー）

---

## APIアーキテクチャ

### RESTful API（推奨）
- **認証**: OAuth 2.0アクセストークン
- **データフォーマット**: JSON
- **仕様**: OpenAPI Specification (OAS)準拠
- **特徴**:
  - 40以上のプログラミング言語でクライアント生成可能
  - 高パフォーマンス
  - 現代的な開発体験

### Traditional API（レガシー）
- **プロトコル**: SOAP/XML
- **状態**: 段階的廃止中
- **主要API**: Trading API, Finding API（2025年2月5日廃止予定）, Shopping API（2025年2月5日廃止予定）

---

## 主要APIカテゴリと機能

### 1. Buy APIs（購入者向けAPI）

#### Browse API
- **機能**:
  - 商品検索とカスタマイズされた商品セット作成
  - 画像検索（Base64文字列による検索）
  - 商品の互換性チェック
  - eBayショッピングカートへの商品追加・削除・数量変更
- **対応マーケットプレイス**: US, DE, UK, AU（画像検索）
- **状態**: アクティブ（限定リリース）

#### Deal API
- **機能**:
  - eBayのディールやイベントの検索と詳細取得
  - ディール関連商品の取得
- **状態**: 限定リリース

#### Feed API
- **機能**:
  - 日次アイテムフィードファイル（新規リスティング）
  - 週次ブートストラップフィードファイル（全商品）
  - アイテムグループ（バリエーション情報）フィード
  - 優先アイテムの変更フィード
- **用途**: 大量データのバッチ処理
- **状態**: ベータ版

#### Marketing API
- **機能**:
  - 商品発見支援
  - 「他のユーザーが閲覧した商品」「他のユーザーが購入した商品」の取得
  - アップセル・クロスセルの促進
- **状態**: 限定リリース

#### Order API
- **機能**:
  - 注文情報の取得と管理
  - eBayメンバーおよびゲスト向け注文処理
- **状態**: 限定リリース

#### Marketplace Insights API
- **機能**:
  - 販売済み商品の検索（キーワード、GTIN、カテゴリ、製品別）
  - 販売履歴データの取得
  - 市場トレンドと消費者行動の分析
- **状態**: 限定リリース（ビジネスレベルアクセスが必要）

---

### 2. Sell APIs（販売者向けAPI）

#### Inventory API
- **機能**:
  - 在庫アイテムレコードの作成と管理
  - 在庫レベルの追跡
  - SKUベースの在庫管理
  - リスティングへの変換
  - カタログ製品マッチング（ePID、GTIN）
  - バリエーションリスティング管理
  - リアルタイム在庫チェック機能
- **画像サポート**: 最大24枚の画像（ほぼ全カテゴリで無料）
- **重要な制限**: Inventory APIで作成されたリスティングはSeller Hubや他のプラットフォームで編集不可

#### Fulfillment API
- **機能**:
  - 注文の取得と検索（getOrder, getOrders）
  - 配送パッケージと追跡番号の関連付け（createShippingFulfillment）
  - 全額・部分払い戻し（issueRefund）
  - 支払い紛争の管理
- **対応**: 全eBayマーケットプレイス

#### Analytics API
- **機能**:
  - 顧客サービスメトリクス評価の取得
  - トップリスティングのバイヤーエンゲージメント追跡
  - 過去2年間のバイヤー行動ベンチマーク
  - トラフィックレポート
  - セラープロファイル詳細
  - API使用率監視（getRateLimits、getUserRateLimits）

#### Finances API
- **機能**:
  - ペイアウト情報の取得（getPayouts、getPayoutSummary）
  - トランザクション情報の取得（getTransactions、getTransactionSummary）
  - 送金詳細の取得（getTransfer）
  - 未分配資金の集計情報（getSellerFundsSummary）
- **用途**: 銀行へのペイアウト、ローン/返済、配送コストなどの財務情報管理

#### Recommendation API
- **機能**:
  - リスティング設定の最適化情報提供
  - Promoted Listings広告キャンペーン設定支援
  - 市場トレンドに基づく推奨事項（バイヤー需要、競合状況）
- **制限**: 一度に最大500のリスティングID

#### Negotiation API
- **機能**:
  - ウォッチリスト追加者への割引オファー送信
  - カート放棄ユーザーへの割引オファー送信
  - 価格割引またはリスト価格の再設定
- **目的**: 販売速度の向上

#### Account API
- **機能**:
  - ビジネスポリシーへのオプトイン
  - ビジネスポリシーの作成と管理
  - 配送料金テーブルの取得（getRateTables）

#### Listing API
- **機能**:
  - アイテムドラフトの作成（createItemDraft）
  - パートナー向け機能
- **用途**: パートナーサイトの情報を使用してeBayドラフトを作成

#### Logistics API
- **機能**:
  - eBay交渉済み配送料金での配送ラベル提供
  - 複数の配送サービスからの料金比較
  - 配送見積もりの取得（shipping_quote）
  - 配送ラベルの作成（shipment）
- **対象**: eBay注文専用

#### Metadata API
- **機能**:
  - マーケットプレイス設定詳細の取得
  - カテゴリポリシー情報の取得
  - 返品ポリシー情報の取得
  - 配送ポリシー情報の取得
  - 交渉価格ポリシー情報の取得

#### Compliance API
- **状態**: 非推奨（2026年3月30日廃止予定）

---

### 3. Commerce APIs（コマース共通API）

#### Catalog API
- **機能**:
  - eBayカタログ内の製品検索
  - 製品詳細の取得
- **用途**: 商品リスティング作成時のカタログマッチング

#### Taxonomy API
- **機能**:
  - カテゴリツリーの取得（getCategoryTree）
  - デフォルトカテゴリツリーIDの取得（getDefaultCategoryTreeId）
  - カテゴリアスペクトの取得（getItemAspectsForCategory）
  - 全リーフカテゴリのアスペクト取得（fetchItemAspects）
  - パーツ互換性情報の取得
- **マーケットプレイスサポート**: 20以上のマーケットプレイス

#### Translation API
- **機能**:
  - アイテムタイトルの翻訳
  - アイテム説明の翻訳
  - 検索クエリの翻訳
  - Eコマース最適化されたAI翻訳
- **技術**: 社内AI技術と最新アルゴリズム
- **用途**: 新規市場への商品展開

#### Identity API
- **機能**:
  - 認証ユーザーのデータ取得
  - eBayユーザーID取得（デフォルトスコープ）
  - 個人情報取得（住所、メール、電話など - 追加スコープ必要）

#### Media API
- **機能**:
  - 画像のアップロードと取得
  - 動画のアップロードと取得（米国で利用可能）
  - ドキュメントのアップロードと取得（GPSR規制用）

#### Notification API
- **機能**:
  - イベント通知のサブスクリプション管理（subscription）
  - 配信先エンドポイントの作成と管理（destination）
  - 公開鍵の取得（public_key）
  - 通知のフィルタリングとテスト
- **SDK**: Java、Node.js、.NET
- **特徴**:
  - API呼び出しとしてカウントされない
  - 複数のペイロードスキーマバージョンサポート
  - メッセージ整合性検証
  - プレイバックとリカバリ機能
- **応答要件**: HTTP 200 OKが必要（応答がない場合は失敗として記録）

---

### 4. Developer APIs

#### Analytics API (Developer)
- **機能**:
  - API統合に関するインサイト提供
  - 全RESTful APIおよびTrading APIの呼び出し制限と使用状況データ取得

---

### 5. Post-Order APIs

#### Post-Order API
- **キャンセル機能**:
  - キャンセルリクエストの作成
  - キャンセル詳細の取得（GET /post-order/v2/cancellation/{cancelId}）
  - 払い戻し確認（POST /post-order/v2/cancellation/{cancelId}/confirm）
  - 有料・無料注文の両方に対応
  - 自動全額払い戻し

- **返品機能**:
  - 返品リクエストの承認
  - 全額・部分払い戻しの発行（POST /post-order/v2/return/{returnId}/issue_refund）
  - 交換品の送付
  - 返品承認/拒否（POST /post-order/v2/return/{returnId}/decide）
  - RMA番号の提供

---

## 認証とセキュリティ

### OAuth 2.0 認証

#### 前提条件
- アクティブなeBay Developer Programアカウント
- OAuth 2.0クライアント認証情報

#### クライアント認証情報グラントフロー
- **用途**: アプリケーション所有のリソースへのアクセス
- **トークン有効期間**: 7,200秒（2時間）
- **エンドポイント**: https://api.sandbox.ebay.com/identity/v1/oauth2/token（サンドボックス）
- **リクエスト内容**:
  - Authorizationヘッダー: "Basic" + Base64エンコードされたOAuth認証情報
  - grant_type: "client_credentials"
  - scope: URLエンコードされたスコープのリスト

#### 認証コードグラントフロー
- **用途**: ユーザーアクセストークンの取得
- **プロセス**:
  1. 認証URLの生成
  2. ユーザーの同意取得
  3. コールバック後のコード交換
  4. アクセストークンとリフレッシュトークンの取得

#### 公式クライアントライブラリ
- **Java**: GitHub上で提供、2026年3月更新
- **Python**: Python 2.7対応
- **Node.js**: 公式OAuthクライアントあり

### セキュリティベストプラクティス

#### エラー処理
- エラー、スタックトレース、デバッグ情報をユーザーに表示しない
- センシティブ情報をログに記録しない
- アプリケーションレベルエラーとインフラエラーを適切に処理

#### 2026年のAPIセキュリティ重要事項
- 支出、状態変更、顧客への影響を引き起こす全エンドポイントに対して：
  - 名前付き所有者の設定
  - クォータモデルの実装
  - 不正利用対策プレイブックの準備
- オブジェクトレベル認証の徹底
- API在庫の適切な管理
- OWASP API Security Top 10への準拠

---

## 利用制限と料金

### API呼び出し制限
- **基本制限**: デフォルト制限は個人および小規模ビジネス向け
- **制限の種類**:
  - 総呼び出し数制限
  - 呼び出しレート制限
  - 日次制限（86,400秒のタイムウィンドウ）
  - 短時間制限（例：300秒）
- **制限拡大**: Application Growth Checkを完了することで上限拡大可能

### OAuth レート制限
- トークンエンドポイント（https://api.ebay.com/identity/v1/oauth2/token）に適用
- grant_type値ごとに異なる制限

### 料金
- **基本利用**: 無料
- **登録**: eBayチームの承認が必要
- **2017年以降**: Open API アクセスは無料提供
- **公式ドキュメント**: API呼び出し料金の記載なし

### 使用状況監視
- Analytics APIのgetRateLimitsメソッドで監視可能
- 全RESTful APIとレガシーTrading APIの使用状況確認

---

## 開発者リソース

### SDK

#### TypeScript/JavaScript/Node.js
- **hendt/ebay-api**:
  - 190+ GitHub stars
  - RESTful APIとTraditional API両対応
  - 2026年2月-3月更新
  - 全eBay APIの実装を目指す
- **公式OAuth Node.jsクライアント**: eBay提供

#### Python
- **Python eBay SDK**:
  - Finding、Shopping、Merchandising、Trading APIに対応
  - 呼び出しの標準化
  - レスポンス処理、エラー処理、デバッグの簡素化

#### Java
- **eBay SDK for Java**:
  - 公式提供
  - 注意: コミュニティでは動作しないとの報告あり

#### サードパーティオプション
- **Apideck**: Java、Python、Node.js、TypeScriptで統合SDK提供

### 開発ツール

#### Sandbox環境
- **目的**: 本番環境に影響を与えないテスト環境
- **特徴**:
  - 本番環境と同様の機能を複製
  - テストユーザーとテストマネーのみ
  - Buying、Selling、After Saleフローのテスト
  - 本番料金なし
- **必要条件**: Sandbox専用アプリケーションキー（本番キーは使用不可）

#### API Explorer
- **機能**:
  - ほとんどのeBay APIメソッドのサンプル呼び出し実行
  - SandboxとProduction環境での動作
  - リクエストのテスト

#### テストユーザー
- **定義**: Sandbox環境にのみ存在する仮想eBayアカウント
- **用途**: テストフェーズでのモック取引

---

## マーケットプレイスサポート

### グローバル展開
- **国数**: 30カ国以上
- **地域**: アフリカ、アジア、中央アメリカとカリブ海、ヨーロッパ、中東、北アメリカ、オセアニア、東南アジア、南アメリカ

### 2025-2026年の拡張
- eBay for Charityプログラムがドイツとカナダ（英語版・フランス語版）に拡大

### API別サポート
- 各Buy APIでサポートするマーケットプレイスが異なる
- searchByImageメソッド: US、DE、UK、AUのみ

### 最新情報の入手方法
- GeteBayDetails呼び出しで現在サポートされている国コードのリストを取得可能
- 公式ドキュメント（developer.ebay.com）で最新のマーケットプレイスサポート情報を確認

---

## 非推奨機能と移行ガイド

### 2026年の主要な非推奨機能

#### GetCategoryFeatures
- **廃止日**: 2026年5月4日
- **代替**: Metadata API
- **移行ガイド**: GetCategoryFeatures Migration Guide提供

#### Compliance API
- **廃止日**: 2026年3月30日
- **状態**: 非推奨

#### Trading API ItemType
- **影響**: 一部フィールドがWSDLから削除
- **予定日**: 2026年2月16日

### 2025年に廃止されたAPI
- **Finding API**: 2025年2月5日廃止
- **Shopping API**: 2025年2月5日廃止
- **代替**: RESTful Browse API

### 移行リソース
1. **API Deprecation Status ページ**: 非推奨および廃止予定のAPI機能一覧
2. **マイグレーションガイド**:
   - GetCategorySpecifics（Trading API）→ Taxonomy API
   - Shopping/Finding API → Browse API
3. **API Updates**: developer.ebay.comで最新情報を確認

### 重要な変更事項
- **ユーザー名 → 不変のユーザーID**: データ処理要件への対応
- **財務データ保護**: 特定ユーザーの財務データ保護
- **APIライセンス契約更新**: 2025年6月投稿、データ保護対策と国際規制準拠の強化

---

## ベストプラクティス

### 効率的なAPI利用
1. **データのローカルキャッシュ**: 重複データの取得を避ける
2. **定期的なリリースノート確認**: API更新情報を常にチェック
3. **柔軟な実装**: 変更に対応できる設計
4. **各呼び出しのベストプラクティスに従う**: eBay定義のガイドラインを遵守

### エラー処理
1. **基本的なエラー処理の実装**: 最低限必須
2. **エラータイプの理解**:
   - アプリケーションレベルエラー（ビジネスデータの問題）
   - インフラエラー（eBay側のサーバー問題）
3. **警告への対応**: 警告付きでも処理は継続される
4. **グレースフルな処理**: エラーを適切に処理してユーザー体験を維持

### Notification API のベストプラクティス
- HTTP 200 OK応答を返す
- 応答しない場合、通知は再送されない
- 失敗として記録される

### バージョン管理
- APIライフサイクルとバージョニングポリシーの理解
- 非推奨通知への迅速な対応
- 計画的な移行実施

---

## 実用例

### ユースケース

#### 1. 販売アプリケーション
- **機能**: エンドツーエンドの販売体験
- **対象**: プロフェッショナルセラー
- **実装内容**:
  - アカウント設定
  - 在庫リスティング
  - マーケティング
  - 販売パフォーマンスレポート

#### 2. 購入アプリケーション
- **機能**: eBayサイト外での購入体験
- **実装内容**:
  - 購入可能商品の取得
  - チェックアウト
  - 注文追跡
  - ソーシャルアプリケーションへの統合

#### 3. コマース運用
- **機能**:
  - 適切なeBayカテゴリの特定
  - eBayカタログでの製品検索
  - ユーザーアカウントプロファイル情報の取得

### 統合例

#### 在庫管理
- 正確な在庫レベルの統合
- 在庫の自動同期

#### 注文処理
- 注文ステータスの取得と更新
- フルフィルメントプロセスの自動化

#### 製品管理
- 様々な条件での製品検索
- ソフトウェアから直接入札・購入

#### 配送管理
- 注文処理の自動化
- 複数タスクの自動化

### AI機能（2026年）
- **Inventory Mapping API**: 既存の製品データを高品質リスティングに変換
- **AI駆動の推奨事項**: 最適化された商品リスティング作成支援

---

## 参考リンク

### 公式ドキュメント
- [eBay Developer Program](https://developer.ebay.com/)
- [Understand the eBay APIs](https://developer.ebay.com/api-docs/static/gs_understand-the-ebay-apis.html)
- [Using eBay RESTful APIs](https://developer.ebay.com/api-docs/static/ebay-rest-landing.html)
- [API Deprecation Status](https://developer.ebay.com/develop/get-started/api-deprecation-status)
- [Sandbox Environment](https://developer.ebay.com/develop/tools/sandbox)
- [Security Best Practices](https://developer.ebay.com/api-docs/static/gs_security-best-practices.html)
- [Platform Notifications](https://developer.ebay.com/api-docs/static/platform-notifications-landing.html)

### API別ドキュメント

#### Buy APIs
- [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html)
- [Feed API](https://developer.ebay.com/api-docs/buy/feed/static/overview.html)
- [Marketplace Insights API](https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html)

#### Sell APIs
- [Inventory API](https://developer.ebay.com/api-docs/sell/inventory/overview.html)
- [Fulfillment API](https://developer.ebay.com/api-docs/sell/fulfillment/overview.html)
- [Analytics API](https://developer.ebay.com/api-docs/sell/analytics/overview.html)
- [Finances API](https://developer.ebay.com/api-docs/sell/finances/static/overview.html)
- [Recommendation API](https://developer.ebay.com/api-docs/sell/recommendation/overview.html)
- [Negotiation API](https://developer.ebay.com/api-docs/sell/negotiation/resources/methods)
- [Logistics API](https://developer.ebay.com/api-docs/sell/logistics/overview.html)
- [Metadata API](https://developer.ebay.com/api-docs/sell/metadata/resources/methods)

#### Commerce APIs
- [Taxonomy API](https://developer.ebay.com/api-docs/commerce/taxonomy/overview.html)
- [Translation API](https://developer.ebay.com/api-docs/commerce/translation/overview.html)
- [Identity API](https://developer.ebay.com/api-docs/commerce/identity/overview.html)
- [Media API](https://developer.ebay.com/api-docs/commerce/media/overview.html)
- [Notification API](https://developer.ebay.com/api-docs/buy/notification/overview.html)

#### Post-Order APIs
- [Post-Order API User Guide](https://developer.ebay.com/api-docs/user-guides/static/post-order-user-guide-landing.html)

### SDK とツール
- [SDKs and Widgets](https://developer.ebay.com/develop/sdks-and-widgets)
- [ebay-api (TypeScript/Node.js)](https://github.com/hendt/ebay-api)
- [ebay-oauth-java-client](https://github.com/eBay/ebay-oauth-java-client)
- [ebay-oauth-python-client](https://github.com/eBay/ebay-oauth-python-client)
- [ebay-oauth-nodejs-client](https://opensource.ebay.com/ebay-oauth-nodejs-client/)

### コミュニティとサポート
- [eBay Community - APIs](https://community.ebay.com/t5/eBay-APIs-SDKs/bd-p/APIs-SDKs)
- [API Updates](https://developer.ebay.com/updates/api-updates)
- [Developer Newsletter](https://developer.ebay.com/updates/newsletter/q4_2025)

---

## まとめ

eBay APIは包括的で強力なエコシステムを提供しており、購入、販売、コマース運用のあらゆる側面をカバーしています。2026年現在、eBayは最新のRESTful APIへの移行を推進しており、開発者はより高性能で使いやすいツールを利用できます。

### 主要なポイント
1. **RESTful APIへの移行**: レガシーAPIからRESTful APIへの移行が推奨されている
2. **無料アクセス**: 基本的にAPI利用は無料
3. **充実したドキュメント**: 包括的な公式ドキュメントとサンドボックス環境
4. **グローバル対応**: 30カ国以上のマーケットプレイスサポート
5. **セキュリティ重視**: OAuth 2.0とベストプラクティスの徹底
6. **継続的な進化**: AI機能の追加など、常に新機能が追加されている

### 開発開始に向けて
1. eBay Developer Programアカウントの作成
2. Sandboxアプリケーションキーの取得
3. Sandbox環境でのテスト
4. RESTful APIの優先的な使用
5. 非推奨APIからの移行計画の策定

このレポートは2026年3月10日時点の情報に基づいています。最新情報は[eBay Developer Program](https://developer.ebay.com/)で確認してください。

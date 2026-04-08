# eBay スプレッドシートツール 実装ロードマップ

**作成日**: 2026-03-10
**最終更新**: 2026-03-10

---

## 🚨 重要：実装待ち機能リスト

このドキュメントは、実装する機能の完全なリストです。
**絶対に忘れないこと** - 1つずつ詳細を決めて実装していきます。

---

## 📋 実装待ち機能（優先順位順）

### Phase 1: コア機能（最優先）🔥

#### 1. 出品機能
**ステータス**: ⏳ 未実装
**優先度**: 🔴 最高
**依存関係**: なし

**概要**:
- スプレッドシートの商品データからeBayに出品
- 3ステップ: 在庫アイテム作成 → オファー作成 → リスティング公開

**使用API**:
- Inventory API
  - PUT /sell/inventory/v1/inventory_item/{sku}
  - POST /sell/inventory/v1/offer
  - POST /sell/inventory/v1/offer/{offerId}/publish

**必要な実装**:
- [ ] Listing.gs の作成
- [ ] ValidationRules.gs の作成
- [ ] 単一商品出品機能
- [ ] 一括出品機能
- [ ] ステータス管理
- [ ] エラーハンドリング

**関連仕様書**:
- `docs/listing-tool-spec.md`
- `docs/api-feasibility-check.md`

---

#### 2. 出品後の価格調整・在庫変更機能
**ステータス**: ⏳ 未実装
**優先度**: 🔴 最高
**依存関係**: 機能1（出品機能）

**概要**:
- 出品後にスプレッドシートで価格・在庫数を変更
- 変更内容をeBayに自動反映

**使用API**:
- Inventory API
  - PUT /sell/inventory/v1/offer/{offerId} (価格変更)
  - PUT /sell/inventory/v1/inventory_item/{sku} (在庫変更)

**必要な実装**:
- [ ] updatePrice() 関数
- [ ] updateInventoryQuantity() 関数
- [ ] スプレッドシートから一括更新
- [ ] 変更検知機能（オプション）

**関連仕様書**:
- `docs/api-feasibility-check.md`

---

#### 3. 出品前の価格リサーチ機能
**ステータス**: ⏳ 未実装
**優先度**: 🔴 最高
**依存関係**: なし

**概要**:
- キーワードで競合商品を検索
- 最安値、最高値、平均価格（相場）を自動計算
- 推奨価格を提案

**使用API**:
- Browse API
  - GET /buy/browse/v1/item_summary/search（既存実装あり）

**取得情報**:
- 最安値
- 最高値
- 平均価格（相場）
- 中央値
- 価格分布
- コンディション別価格
- 推奨価格帯

**必要な実装**:
- [ ] PriceResearch.gs の作成
- [ ] researchCompetitorPrices() 関数
- [ ] analyzePrices() 関数（統計分析）
- [ ] writePriceResearchToSheet() 関数
- [ ] batchPriceResearch() 関数（一括）
- [ ] 価格分布グラフ生成

**関連仕様書**:
- `docs/price-research-spec.md`

---

#### 4. 競合eBay URLからItem Specifics取得機能
**ステータス**: ⏳ 未実装
**優先度**: 🟡 高
**依存関係**: なし

**概要**:
- 競合のeBayリスティングURLを貼り付け
- Item Specifics（Brand, Model, Color など）を自動取得
- スプレッドシートに自動入力

**使用API**:
- Browse API
  - GET /buy/browse/v1/item/{item_id}（既存実装あり）

**取得情報**:
- Item Specifics（全アスペクト）
- カテゴリID
- 商品タイトル
- 商品説明
- 価格
- コンディション
- 画像URL（最大24枚）

**必要な実装**:
- [ ] ItemSpecificsExtractor.gs の作成
- [ ] extractItemIdFromUrl() 関数
- [ ] extractItemSpecificsFromEbayUrl() 関数
- [ ] fillItemSpecificsToSheet() 関数
- [ ] 短縮URL展開機能
- [ ] 一括取得機能

**関連仕様書**:
- `docs/item-specifics-extraction-spec.md`

---

#### 5. 競合eBay URLから商品タイトル取得機能
**ステータス**: ⏳ 未実装
**優先度**: 🟡 高
**依存関係**: 機能4（Item Specifics取得）と統合可能

**概要**:
- 競合の良いタイトルを参考にする
- タイトル最適化のヒントを得る

**使用API**:
- Browse API（機能4と同じ）

**必要な実装**:
- [ ] 機能4に含まれる（追加実装不要）
- [ ] タイトル分析機能（オプション）
- [ ] キーワード抽出機能（オプション）

**関連仕様書**:
- `docs/item-specifics-extraction-spec.md`（統合）

---

#### 6. カテゴリ取得機能
**ステータス**: ⏳ 未実装
**優先度**: 🟡 高
**依存関係**: なし

**概要**:
- eBayのカテゴリツリーを取得
- カテゴリマスタシートに保存
- キーワードでカテゴリ検索
- カテゴリ別の必須アスペクト取得

**使用API**:
- Taxonomy API
  - GET /commerce/taxonomy/v1/category_tree/{category_tree_id}
  - GET /commerce/taxonomy/v1/get_default_category_tree_id
  - GET /commerce/taxonomy/v1/category_tree/{id}/get_item_aspects_for_category

**必要な実装**:
- [ ] CategoryManager.gs の作成
- [ ] fetchCategoriesToSheet() 関数
- [ ] searchCategory() 関数
- [ ] getCategoryAspects() 関数
- [ ] カテゴリマスタシート作成
- [ ] アスペクトマスタシート作成

**関連仕様書**:
- `docs/api-feasibility-check.md`
- `docs/listing-tool-spec.md`

---

### Phase 2: 効率化機能 ⚡

#### 7. 仕入元URLから画像自動取得機能
**ステータス**: ⏳ 未実装
**優先度**: 🟢 中
**依存関係**: なし

**概要**:
- 仕入元サイト（Yahoo!、楽天など）のURLから商品画像を自動取得
- Google Driveに保存
- eBay出品用のURLを生成

**使用技術**:
- HTMLスクレイピング（UrlFetchApp）
- Google Drive API
- eBay Media API（オプション）

**対応サイト**:
- Yahoo!ショッピング
- 楽天市場
- Amazon
- メルカリ
- その他（汎用）

**必要な実装**:
- [ ] ImageExtractor.gs の作成
- [ ] extractImageUrlsFromPage() 関数（汎用）
- [ ] extractImagesByDomain() 関数（サイト別）
- [ ] extractImagesFromYahooShopping() 関数
- [ ] extractImagesFromRakuten() 関数
- [ ] extractImagesFromAmazon() 関数
- [ ] extractImagesFromMercari() 関数
- [ ] downloadImageToDrive() 関数
- [ ] uploadImageToEbayMedia() 関数（オプション）
- [ ] prepareImagesFromSourceUrl() 関数（統合）
- [ ] robots.txtチェック機能

**関連仕様書**:
- `docs/image-extraction-spec.md`

**⚠️ 注意事項**:
- 仕入先との契約で画像使用許諾を確認
- robots.txtとサイト利用規約を遵守
- 著作権・知的財産権を尊重

---

#### 8. テラピーク検索結果エクスポート機能
**ステータス**: ✅ 調査完了 - ❌ 直接API不可（代替案あり）
**優先度**: 🟢 中
**依存関係**: なし

**概要**:
- Terapeak（テラピーク）の市場調査データを取得
- 販売トレンド、需要予測などの分析データをスプレッドシートに

**調査結果**:
- ✅ **調査完了**: Terapeak API は一般開発者には提供されていない
- ❌ **直接エクスポート不可**: Marketplace Insights API は承認が必要（困難）
- ✅ **代替案1**: Browse API で現在の出品を分析（無料・推奨）
- ✅ **代替案2**: ZIK Analytics/Algopix などの有料 API（$29/月〜）
- ✅ **代替案3**: 自前でトレンドデータを蓄積

**調査事項**:
- [x] eBay APIでTeraepak相当のデータが取得可能か？ → ❌ 不可
- [x] Marketplace Insights API の利用可能性 → ⚠️ 承認必要（困難）
- [x] 代替手段の検討 → ✅ Browse API + 有料API

**関連仕様書**:
- `docs/terapeak-investigation.md` - 詳細調査結果
- `docs/price-research-spec.md` - 代替機能（価格リサーチ）

---

### Phase 3: 高度な機能 🚀

#### 9. 価格トレンド分析機能
**ステータス**: ⏳ 未実装（Phase 1の価格リサーチの拡張）
**優先度**: 🔵 低
**依存関係**: 機能3（価格リサーチ）

**概要**:
- 定期的に価格調査を実行
- 時系列データを記録
- トレンドグラフを生成

**必要な実装**:
- [ ] trackPriceTrend() 関数
- [ ] 時系列データ保存
- [ ] トレンドグラフ生成
- [ ] トリガー設定（自動実行）

---

#### 10. トップセラー分析機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低
**依存関係**: 機能3（価格リサーチ）

**概要**:
- 高評価セラーの価格戦略を分析
- 成功パターンを学習

**必要な実装**:
- [ ] analyzeTopSellersPricing() 関数
- [ ] セラー評価フィルター
- [ ] 分析レポート生成

---

#### 11. 配送コスト込み価格分析機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低
**依存関係**: 機能3（価格リサーチ）

**概要**:
- 送料込みの実質価格で競合分析
- 無料配送の割合を算出

**必要な実装**:
- [ ] analyzeTotalCost() 関数
- [ ] 配送オプション分析

---

#### 12. AI推奨価格機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低
**依存関係**: 機能3（価格リサーチ）

**概要**:
- 機械学習で最適価格を予測
- 季節変動を考慮

---

#### 13. 自動価格改定機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低
**依存関係**: 機能2（価格変更）、機能3（価格リサーチ）

**概要**:
- 定期的に競合価格を監視
- 自動で価格を調整
- 最低価格の設定

---

### Phase 4: UI/UX改善 🎨

#### 14. 出品プレビュー機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低

**概要**:
- 出品前に表示イメージを確認
- HTMLプレビュー生成

---

#### 15. 一括編集機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低

**概要**:
- 複数商品の価格・カテゴリを一括変更
- 検索・置換機能

---

#### 16. テンプレート機能
**ステータス**: ⏳ 未実装
**優先度**: 🔵 低

**概要**:
- よく使う設定をテンプレート化
- カテゴリ別テンプレート

---

## 📊 実装状況サマリー

### 優先度別
- 🔴 最高優先度: 3機能
- 🟡 高優先度: 3機能
- 🟢 中優先度: 2機能
- 🔵 低優先度: 8機能

### ステータス別
- ✅ 完了: 0機能
- 🔍 調査完了: 1機能（テラピーク - 代替案あり）
- 🔄 実装中: 0機能
- ⏳ 未実装: 15機能

---

## 🎯 実装の進め方

### ステップ1: 詳細設計
各機能について、以下を決定：
1. 具体的な仕様
2. UI/UX設計
3. データフロー
4. エラーハンドリング
5. テストケース

### ステップ2: 実装
1. コアロジックの実装
2. スプレッドシート統合
3. UI作成
4. テスト

### ステップ3: 検証
1. 機能テスト
2. 統合テスト
3. ユーザーテスト

### ステップ4: ドキュメント更新
1. 使用方法の記載
2. トラブルシューティング
3. 実装完了マーク ✅

---

## 📝 実装ルール

### 必須事項
1. **仕様書の作成**: 実装前に必ず仕様書を作成
2. **コメントの記載**: コードには詳細なコメントを記載
3. **エラーハンドリング**: すべての関数に適切なエラー処理
4. **ログ記録**: 重要な処理はログシートに記録
5. **テスト**: 実装後は必ずテスト実行

### 命名規則
- 関数名: camelCase (例: `createOffer()`)
- 変数名: camelCase (例: `itemId`)
- 定数: UPPER_SNAKE_CASE (例: `MAX_RETRIES`)
- ファイル名: PascalCase.gs (例: `Listing.gs`)

---

## 🔗 関連ドキュメント

### 既存の仕様書
1. `listing-tool-spec.md` - 出品ツール仕様書
2. `api-feasibility-check.md` - API実現可能性チェック
3. `image-extraction-spec.md` - 画像自動取得仕様書
4. `item-specifics-extraction-spec.md` - Item Specifics取得仕様書
5. `price-research-spec.md` - 価格リサーチ仕様書
6. `ebay_api_comprehensive_research.md` - eBay API詳細調査
7. `terapeak-investigation.md` - テラピーク機能調査結果
8. `zik-algopix-comparison.md` - ZIK Analytics vs Algopix 徹底比較
9. `available-data-summary.md` - 取得可能データ一覧（カラム設計含む）

### プロジェクトファイル
- `README.md` - プロジェクト概要
- `setup.md` - セットアップ手順
- `usage.md` - 使用方法

---

## 📅 更新履歴

| 日付 | 内容 | 更新者 |
|------|------|--------|
| 2026-03-10 | 初版作成、全16機能を記録 | 谷澤真吾 |

---

## ⚠️ 重要な注意事項

### このドキュメントについて
- **絶対に削除しないこと**
- **実装状況を必ず更新すること**
- **新機能追加時は必ずこのリストに追加すること**

### 実装時の注意
- **1つずつ実装**: 複数機能を同時に実装しない
- **詳細設計優先**: 実装前に必ず詳細を決定
- **テストを忘れない**: 実装後は必ずテスト
- **ドキュメント更新**: 完了後は使用方法を記載

---

**このドキュメントは、プロジェクトの「マスタータスクリスト」です。**
**実装漏れを防ぐため、常にこのリストを参照してください。**

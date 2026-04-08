# テラピーク検索結果エクスポート機能 調査結果

**作成日**: 2026-03-10
**ステータス**: ❌ **直接APIアクセス不可（代替案あり）**

---

## 🔍 調査結果サマリー

### 結論
**Terapeak のデータを直接 API でエクスポートすることは、一般開発者には不可能です。**

しかし、類似の機能は以下の方法で実現可能：
1. ✅ **eBay Browse API** を使用した現在の出品データ分析（すでに実装済み）
2. ✅ **サードパーティAPI** を使用した市場調査データ取得
3. ⚠️ **Marketplace Insights API** の利用申請（承認は困難）

---

## 📊 Terapeak とは

### Terapeak の機能
- eBay の過去 3 年分の実際の販売データを分析
- 平均価格、配送コスト、総販売数、総売上を提供
- Best Offer で受け入れられた価格も含む
- カテゴリ別、キーワード別のトレンド分析

### Terapeak の提供形態
- **無料版**: Seller Hub ユーザーは Product Research 機能を無料で利用可能
- **アクセス方法**: eBay Seller Hub または eBay モバイルアプリ（Selling Tab > Seller Tools）
- **API 提供**: ❌ **なし** - UI のみでのアクセス

---

## 🚫 Terapeak API が存在しない理由

### eBay Community での開発者からの質問
多くの開発者が Terapeak のデータへのプログラムアクセスを求めていますが、eBay は以下の理由で提供していません：

1. **データの価値保護**: 市場調査データは eBay の貴重な資産
2. **有料サービスへの誘導**: Terapeak を使わせることで eBay への依存を高める
3. **API 乱用防止**: 大量のデータ取得による負荷を避ける

**eBay Community での回答**:
> "Terapeak Research does not have an API available."
> "The Marketplace Insights API is only available to high-end developers (like Terapeak)."

---

## 🔑 eBay が提供する関連 API

### 1. Marketplace Insights API ⚠️

**エンドポイント**: `GET /buy/marketplace_insights/v1/item_sales/search`

#### 機能
- 過去 90 日間の販売履歴データを検索
- キーワード、GTIN、カテゴリ、商品で検索可能
- 販売価格、販売数、トレンドデータを取得

#### 制限事項
**🚨 重要**: この API は **Limited Release** です。
- ✅ **Sandbox 環境**: 誰でもテスト可能
- ❌ **Production 環境**: eBay の承認が必要
- ❌ **承認基準**: 特定の業種・メタカテゴリのみ
- ❌ **一般開発者**: 承認が非常に困難

#### API 仕様例
```javascript
// Marketplace Insights API（承認が必要）
function searchSoldItems(keyword, categoryId) {
  const params = {
    q: keyword,
    category_ids: categoryId,
    limit: 200,
    offset: 0
  };

  // この API は承認なしでは Production で使用不可
  return ebayApiRequest(
    '/buy/marketplace_insights/v1/item_sales/search',
    'GET',
    params
  );
}
```

**レスポンス例**:
```json
{
  "itemSales": [
    {
      "itemId": "123456789012",
      "title": "Apple MacBook Pro 14-inch M3",
      "price": {
        "value": "1999.99",
        "currency": "USD"
      },
      "soldDate": "2026-03-01T10:30:00.000Z",
      "soldQuantity": 1,
      "condition": "NEW"
    }
  ],
  "total": 1500,
  "limit": 200,
  "offset": 0
}
```

---

### 2. Analytics API ✅（自分のデータのみ）

**エンドポイント**: `GET /sell/analytics/v1/traffic_report`

#### 機能
- **自分自身の出品** のパフォーマンスを分析
- バイヤートラフィック、クリック数、インプレッション数
- カスタマーサービス指標
- 過去 2 年分のデータを比較可能

#### 制限事項
- ⚠️ **競合データは取得不可**: 自分の出品のみ
- ⚠️ **市場調査には不向き**: Terapeak の代替にはならない

#### 用途
- 自分の出品のパフォーマンス改善
- トラフィック分析
- カスタマーサービス評価の確認

---

## ✅ 実現可能な代替案

### 方法1: Browse API を使用した現在の出品分析（推奨）

**すでに実装済み** の機能を活用：

```javascript
// 既存の searchItems() を使用
function analyzeLiveListings(keyword, options) {
  options = options || {};

  const params = {
    q: keyword,
    limit: 200,  // 最大 200 件
    filter: 'conditions:{NEW}',  // 新品のみ
    sort: 'price'  // 価格順
  };

  const response = searchItems(keyword, params);

  // 統計分析
  const prices = response.itemSummaries.map(item =>
    parseFloat(item.price.value)
  ).sort((a, b) => a - b);

  return {
    totalResults: response.total,
    averagePrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    medianPrice: prices[Math.floor(prices.length / 2)],
    listings: response.itemSummaries
  };
}
```

**できること**:
- ✅ 現在の出品価格相場を取得
- ✅ 最安値・最高値・平均価格・中央値を算出
- ✅ 競合の Item Specifics を取得
- ✅ 商品画像、タイトル、説明を取得
- ✅ セラー評価、送料情報を取得

**できないこと**:
- ❌ **過去の販売データ**: 現在の出品のみ（売り切れた商品は取得不可）
- ❌ **販売個数**: 何個売れたかは不明
- ❌ **販売期間**: どれくらいの期間で売れたかは不明
- ❌ **Best Offer 価格**: 受け入れられた価格は不明

---

### 方法2: サードパーティ API の利用（有料）

Terapeak と同等の機能を提供する外部サービス：

#### 1. ZIK Analytics（推奨）

**料金**: $29/月〜
**API 提供**: ✅ あり（バルクデータ処理可能）

**機能**:
- 過去の販売データ分析
- 商品トレンド調査
- 競合分析
- カテゴリ別売上データ

**API 例**:
```javascript
// ZIK Analytics API（仮想例）
function getZikSalesData(keyword) {
  const apiKey = 'YOUR_ZIK_API_KEY';

  const url = 'https://api.zikanalytics.com/v1/sales';
  const params = {
    keyword: keyword,
    marketplace: 'ebay_us',
    period: '90days'
  };

  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(params)
  };

  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}
```

---

#### 2. Algopix

**料金**: $29/月〜
**API 提供**: ✅ あり（バルクデータ処理可能）

**機能**:
- 複数マーケットプレイス対応（eBay、Amazon、Walmart）
- 過去の販売データ
- 推奨価格の算出
- 需要予測

---

#### 3. ScrapingBee

**料金**: 従量課金制
**API 提供**: ✅ あり（大量データ収集に最適）

**機能**:
- eBay の大量データをスクレイピング
- プロキシ管理不要
- CAPTCHA 自動解決
- カスタム調査パイプライン構築可能

**⚠️ 注意**: スクレイピングは eBay の利用規約に違反する可能性があります。

---

### 方法3: Marketplace Insights API の利用申請

**ステップ**:
1. eBay Developer Program に登録
2. Marketplace Insights API のアクセスを申請
3. eBay のビジネス審査を通過（承認は困難）
4. 承認後、Production 環境でデータ取得

**承認基準**（推測）:
- 大規模なビジネス用途
- 特定の業種・カテゴリに限定
- eBay に価値を提供できるサービス

**現実的な評価**: ❌ **一般開発者には承認されない可能性が高い**

---

## 🎯 推奨アプローチ

### 短期的な解決策（無料）

**すでに実装済みの Browse API を最大限活用**:

1. ✅ **価格リサーチ機能**（`price-research-spec.md` に詳細あり）
   - 現在の出品データから統計分析
   - 最安値、最高値、平均価格、中央値を算出
   - 推奨価格帯を提案

2. ✅ **Item Specifics 取得**（`item-specifics-extraction-spec.md` に詳細あり）
   - 競合の出品内容を詳細に分析
   - Brand、Model、Color などを自動取得

3. ✅ **定期的な調査の自動化**
   - Time-driven Trigger で 1 日 1 回実行
   - トレンドデータを蓄積
   - 過去データとの比較分析

**メリット**:
- 完全無料
- API 承認不要
- すでに実装済み
- 十分な精度

**デメリット**:
- 過去の販売データは取得できない
- 販売個数が不明

---

### 中長期的な解決策（有料）

**ZIK Analytics または Algopix の API を統合**:

1. 月額 $29 で過去の販売データにアクセス
2. 販売個数、販売期間、トレンドデータを取得
3. より精度の高い市場調査が可能

**統合方法**:
```javascript
// ZikAPI.gs を作成
function getHistoricalSalesData(keyword) {
  const zikData = getZikSalesData(keyword);
  const browseData = analyzeLiveListings(keyword);

  // 両方のデータを統合
  return {
    historicalData: zikData,      // 過去の販売データ
    currentListings: browseData   // 現在の出品データ
  };
}
```

---

## 📝 実装の優先順位

### Phase 1: 無料の Browse API を活用（最優先） ✅

すでに仕様書が作成済み：
- `price-research-spec.md` - 価格リサーチ機能
- `item-specifics-extraction-spec.md` - Item Specifics 取得機能

**実装タスク**:
1. PriceResearch.gs の作成
2. researchCompetitorPrices() 関数
3. analyzePrices() 関数（統計分析）
4. writePriceResearchToSheet() 関数
5. batchPriceResearch() 関数（一括）

**これで実現できること**:
- 現在の市場価格相場の把握
- 競合分析
- 推奨価格の算出
- 日次トレンド追跡（自前で蓄積）

---

### Phase 2: 有料 API の統合（オプション） 🔵

必要性を評価した上で検討：
- ZIK Analytics API
- Algopix API

**メリット**:
- 過去の販売データ
- 販売個数
- より詳細なトレンド分析

**デメリット**:
- 月額 $29 のコスト
- 外部サービスへの依存

---

## 📚 参考リンク

### eBay Community での議論
- [Get data of terapeak research using API](https://community.ebay.com/t5/Traditional-APIs-Search/Get-data-of-terapeak-research-using-API/td-p/33565469)
- [Terapeak API Documentation](https://community.ebay.com/t5/Seller-Tools/Terapeak-API-Documentation/td-p/32138281)
- [eBay Marketplace Insights API](https://community.ebay.com/t5/APIs-Feedback-Comments-and/eBay-Marketplace-Insights-API/td-p/34933936)

### eBay 公式ドキュメント
- [Analytics API Overview](https://developer.ebay.com/api-docs/sell/analytics/overview.html)
- [Marketplace Insights API Overview](https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html)
- [Marketplace Insights API - Item Sales Search](https://developer.ebay.com/api-docs/buy/marketplace-insights/resources/item_sales/methods/search)

### サードパーティツール
- [ZIK Analytics - Terapeak Alternatives](https://www.zikanalytics.com/blog/terapeak-alternatives/)
- [Best eBay Research Tools for 2026](https://www.scrapingbee.com/blog/must-have-ebay-research-tools/)
- [Terapeak: Effective Market Research Tools](https://export.ebay.com/en/marketing/ebay-services-and-tools-help-seller/terapeak/)

---

## ✅ 最終結論

### Terapeak データの直接エクスポート
❌ **API 経由では不可能**（一般開発者には承認されない）

### 代替案
1. ✅ **Browse API で現在の出品を分析**（推奨・無料）
   - すでに仕様書作成済み
   - 十分な精度で市場調査可能
   - 実装優先度: 🔴 最高

2. ✅ **有料 API の利用**（オプション）
   - ZIK Analytics: $29/月
   - Algopix: $29/月
   - 過去データが必要な場合のみ検討

3. ⚠️ **Marketplace Insights API の申請**（非推奨）
   - 承認が困難
   - 特定用途のみ

---

## 🎯 次のステップ

1. **Phase 1 の価格リサーチ機能を実装** - `price-research-spec.md` に基づく
2. 数週間運用してデータを蓄積
3. 必要性を評価した上で有料 API の導入を検討

**重要**: まずは無料の Browse API で十分な価値を提供できます。

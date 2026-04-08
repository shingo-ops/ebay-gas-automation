# eBay 競合価格リサーチ機能 仕様書

**作成日**: 2026-03-10
**バージョン**: 1.0.0

---

## 結論：完全に実現可能 ✅（公式API使用）

eBay Browse API の `searchItems` メソッドを使用することで、**公開検索結果を完全に解析**し、競合の相場と最安値を自動取得できます。

---

## 目次

1. [概要](#概要)
2. [実現方法](#実現方法)
3. [技術仕様](#技術仕様)
4. [実装例](#実装例)
5. [価格分析機能](#価格分析機能)
6. [スプレッドシート統合](#スプレッドシート統合)
7. [高度な分析機能](#高度な分析機能)

---

## 概要

### 目的

出品前に競合の価格を調査し、適正な価格設定を行う。

### 活用シーン

1. **新規出品前**: 適正価格の設定
2. **価格改定**: 競合価格変動の監視
3. **市場分析**: カテゴリ別の価格トレンド把握
4. **仕入れ判断**: 利益が出る仕入れ価格の算出

### 取得できる情報

- ✅ 検索結果の商品一覧（最大200件）
- ✅ 各商品の価格
- ✅ 最安値
- ✅ 最高値
- ✅ 平均価格（相場）
- ✅ 中央値
- ✅ 価格分布
- ✅ 販売中の商品数
- ✅ 売れ筋の価格帯
- ✅ コンディション別価格

---

## 実現方法

### 使用API

**Browse API** の `searchItems` メソッド

**エンドポイント**: `GET /buy/browse/v1/item_summary/search`

**実装状況**: ✅ **既に実装済み**（EbayAPI.gs:104）

### APIの特徴

- ✅ 公開検索結果と同じデータを取得
- ✅ 様々な検索条件・フィルターに対応
- ✅ ソート機能あり（価格昇順・降順など）
- ✅ ページネーション対応（大量データ取得可能）
- ✅ 構造化されたJSONレスポンス

---

## 技術仕様

### 1. 基本的な検索（既存実装）

```javascript
/**
 * 商品を検索（Browse API）
 * ※ 既に実装済み（EbayAPI.gs:104）
 *
 * @param {string} query - 検索クエリ
 * @param {Object} options - 検索オプション
 * @returns {Object} 検索結果
 */
function searchItems(query, options) {
  options = options || {};

  const params = {
    q: query,
    limit: options.limit || 50,
    offset: options.offset || 0
  };

  // フィルターを追加
  if (options.filter) {
    params.filter = options.filter;
  }

  // ソート順を追加
  if (options.sort) {
    params.sort = options.sort;
  }

  try {
    const response = ebayApiRequest(
      '/buy/browse/v1/item_summary/search',
      'GET',
      params
    );

    Logger.log('検索結果: ' + response.total + ' 件');
    return response;
  } catch (error) {
    Logger.log('商品検索エラー: ' + error.toString());
    throw error;
  }
}
```

### 2. APIレスポンス例

```json
{
  "href": "https://api.ebay.com/buy/browse/v1/item_summary/search?q=macbook+pro&limit=50",
  "total": 5247,
  "next": "https://api.ebay.com/buy/browse/v1/item_summary/search?q=macbook+pro&limit=50&offset=50",
  "limit": 50,
  "offset": 0,
  "itemSummaries": [
    {
      "itemId": "v1|123456789012|0",
      "title": "Apple MacBook Pro 14-inch M3 Chip 16GB RAM 512GB SSD",
      "price": {
        "value": "1999.99",
        "currency": "USD"
      },
      "condition": "New",
      "itemWebUrl": "https://www.ebay.com/itm/123456789012",
      "image": {
        "imageUrl": "https://i.ebayimg.com/images/g/xxx/s-l1600.jpg"
      },
      "seller": {
        "username": "seller123",
        "feedbackPercentage": "99.8",
        "feedbackScore": 5000
      },
      "shippingOptions": [
        {
          "shippingCost": {
            "value": "0.00",
            "currency": "USD"
          },
          "type": "FREE"
        }
      ],
      "buyingOptions": ["FIXED_PRICE"]
    }
    // ... 最大50件
  ]
}
```

### 3. 価格リサーチ専用関数

```javascript
/**
 * キーワードで価格調査を実行
 *
 * @param {string} keyword - 検索キーワード
 * @param {Object} options - オプション
 * @returns {Object} 価格分析結果
 */
function researchCompetitorPrices(keyword, options) {
  options = options || {};

  try {
    Logger.log(`価格調査開始: ${keyword}`);

    // 検索オプションを設定
    const searchOptions = {
      limit: options.limit || 200,  // 最大200件取得
      offset: 0,
      sort: 'price'  // 価格昇順
    };

    // フィルター条件を追加
    if (options.condition) {
      searchOptions.filter = `condition:${options.condition}`;
    }

    if (options.minPrice || options.maxPrice) {
      const priceFilter = `price:[${options.minPrice || '*'}..${options.maxPrice || '*'}]`;
      searchOptions.filter = searchOptions.filter
        ? searchOptions.filter + ',' + priceFilter
        : priceFilter;
    }

    // 検索実行
    const searchResult = searchItems(keyword, searchOptions);

    if (!searchResult || !searchResult.itemSummaries || searchResult.itemSummaries.length === 0) {
      return {
        success: false,
        error: '検索結果が見つかりませんでした'
      };
    }

    // 価格分析
    const analysis = analyzePrices(searchResult.itemSummaries);

    // 結果をまとめる
    const result = {
      success: true,
      keyword: keyword,
      totalResults: searchResult.total,
      analyzedItems: searchResult.itemSummaries.length,
      analysis: analysis,
      items: searchResult.itemSummaries,
      timestamp: new Date()
    };

    Logger.log(`価格調査完了: ${result.analyzedItems}件を分析`);
    return result;

  } catch (error) {
    Logger.log(`価格調査エラー: ${error.toString()}`);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 4. 価格分析ロジック

```javascript
/**
 * 商品リストから価格を分析
 *
 * @param {Array} items - 商品リスト
 * @returns {Object} 分析結果
 */
function analyzePrices(items) {
  // 価格を抽出（数値に変換）
  const prices = items
    .filter(item => item.price && item.price.value)
    .map(item => parseFloat(item.price.value))
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      error: '価格情報が見つかりませんでした'
    };
  }

  // 基本統計
  const count = prices.length;
  const min = prices[0];
  const max = prices[prices.length - 1];
  const sum = prices.reduce((acc, price) => acc + price, 0);
  const average = sum / count;

  // 中央値
  const median = count % 2 === 0
    ? (prices[count / 2 - 1] + prices[count / 2]) / 2
    : prices[Math.floor(count / 2)];

  // 標準偏差
  const variance = prices.reduce((acc, price) => {
    return acc + Math.pow(price - average, 2);
  }, 0) / count;
  const stdDev = Math.sqrt(variance);

  // パーセンタイル
  const percentile25 = prices[Math.floor(count * 0.25)];
  const percentile75 = prices[Math.floor(count * 0.75)];

  // 価格帯分布（10個の範囲に分割）
  const priceRanges = createPriceRanges(min, max, 10);
  const distribution = calculateDistribution(prices, priceRanges);

  // 推奨価格帯（25-75パーセンタイル）
  const recommendedPriceRange = {
    low: percentile25,
    high: percentile75,
    optimal: median  // 中央値を最適価格として提案
  };

  // コンディション別分析
  const byCondition = analyzeByCondition(items);

  return {
    count: count,
    min: min.toFixed(2),
    max: max.toFixed(2),
    average: average.toFixed(2),
    median: median.toFixed(2),
    stdDev: stdDev.toFixed(2),
    percentile25: percentile25.toFixed(2),
    percentile75: percentile75.toFixed(2),
    recommendedPriceRange: {
      low: recommendedPriceRange.low.toFixed(2),
      high: recommendedPriceRange.high.toFixed(2),
      optimal: recommendedPriceRange.optimal.toFixed(2)
    },
    distribution: distribution,
    byCondition: byCondition
  };
}

/**
 * 価格帯を作成
 */
function createPriceRanges(min, max, segments) {
  const ranges = [];
  const step = (max - min) / segments;

  for (let i = 0; i < segments; i++) {
    const rangeMin = min + (step * i);
    const rangeMax = min + (step * (i + 1));
    ranges.push({
      min: rangeMin.toFixed(2),
      max: rangeMax.toFixed(2),
      label: `$${rangeMin.toFixed(0)}-$${rangeMax.toFixed(0)}`
    });
  }

  return ranges;
}

/**
 * 価格分布を計算
 */
function calculateDistribution(prices, ranges) {
  return ranges.map(range => {
    const count = prices.filter(price =>
      price >= parseFloat(range.min) && price <= parseFloat(range.max)
    ).length;

    return {
      range: range.label,
      count: count,
      percentage: ((count / prices.length) * 100).toFixed(1)
    };
  });
}

/**
 * コンディション別に分析
 */
function analyzeByCondition(items) {
  const byCondition = {};

  items.forEach(item => {
    const condition = item.condition || 'Unknown';
    const price = parseFloat(item.price.value);

    if (!byCondition[condition]) {
      byCondition[condition] = {
        count: 0,
        prices: []
      };
    }

    byCondition[condition].count++;
    byCondition[condition].prices.push(price);
  });

  // 各コンディションの統計を計算
  Object.keys(byCondition).forEach(condition => {
    const prices = byCondition[condition].prices.sort((a, b) => a - b);
    const count = prices.length;

    byCondition[condition].min = prices[0].toFixed(2);
    byCondition[condition].max = prices[count - 1].toFixed(2);
    byCondition[condition].average = (
      prices.reduce((acc, p) => acc + p, 0) / count
    ).toFixed(2);
    byCondition[condition].median = (
      count % 2 === 0
        ? (prices[count / 2 - 1] + prices[count / 2]) / 2
        : prices[Math.floor(count / 2)]
    ).toFixed(2);

    delete byCondition[condition].prices;  // 生データは削除
  });

  return byCondition;
}
```

---

## 実装例

### 例1: 基本的な価格調査

```javascript
// キーワードで価格調査
const result = researchCompetitorPrices('MacBook Pro 14');

// 結果を表示
Logger.log('=== 価格調査結果 ===');
Logger.log(`検索キーワード: ${result.keyword}`);
Logger.log(`総検索結果数: ${result.totalResults}件`);
Logger.log(`分析対象: ${result.analyzedItems}件`);
Logger.log('');
Logger.log('=== 価格統計 ===');
Logger.log(`最安値: $${result.analysis.min}`);
Logger.log(`最高値: $${result.analysis.max}`);
Logger.log(`平均価格: $${result.analysis.average}`);
Logger.log(`中央値: $${result.analysis.median}`);
Logger.log('');
Logger.log('=== 推奨価格帯 ===');
Logger.log(`下限: $${result.analysis.recommendedPriceRange.low}`);
Logger.log(`最適: $${result.analysis.recommendedPriceRange.optimal}`);
Logger.log(`上限: $${result.analysis.recommendedPriceRange.high}`);
```

**出力例**:
```
=== 価格調査結果 ===
検索キーワード: MacBook Pro 14
総検索結果数: 5247件
分析対象: 200件

=== 価格統計 ===
最安値: $1299.00
最高値: $2999.00
平均価格: $1899.50
中央値: $1899.99

=== 推奨価格帯 ===
下限: $1799.00
最適: $1899.99
上限: $1999.00
```

### 例2: コンディション指定で調査

```javascript
// 新品のみで調査
const newItemsResult = researchCompetitorPrices('iPhone 15 Pro', {
  condition: 'NEW',
  limit: 200
});

// 中古品で調査
const usedItemsResult = researchCompetitorPrices('iPhone 15 Pro', {
  condition: 'USED_EXCELLENT',
  limit: 200
});

// 比較
Logger.log('新品平均価格: $' + newItemsResult.analysis.average);
Logger.log('中古品平均価格: $' + usedItemsResult.analysis.average);
const priceDiff = parseFloat(newItemsResult.analysis.average) -
                  parseFloat(usedItemsResult.analysis.average);
Logger.log('価格差: $' + priceDiff.toFixed(2));
```

### 例3: 価格帯を指定して調査

```javascript
// $500-$1000の価格帯で調査
const result = researchCompetitorPrices('Gaming Laptop', {
  minPrice: 500,
  maxPrice: 1000,
  limit: 200
});

Logger.log(`この価格帯の競合数: ${result.analyzedItems}件`);
Logger.log(`この価格帯での平均価格: $${result.analysis.average}`);
```

---

## 価格分析機能

### 1. 価格分布グラフデータ

```javascript
// 価格分布を取得
const distribution = result.analysis.distribution;

// 結果例:
[
  { range: "$1200-$1370", count: 15, percentage: "7.5" },
  { range: "$1370-$1540", count: 25, percentage: "12.5" },
  { range: "$1540-$1710", count: 40, percentage: "20.0" },
  { range: "$1710-$1880", count: 50, percentage: "25.0" },  // ★最頻価格帯
  { range: "$1880-$2050", count: 45, percentage: "22.5" },
  { range: "$2050-$2220", count: 20, percentage: "10.0" },
  { range: "$2220-$2390", count: 5, percentage: "2.5" }
]
```

### 2. コンディション別価格

```javascript
// コンディション別の統計
const byCondition = result.analysis.byCondition;

// 結果例:
{
  "New": {
    count: 120,
    min: "1799.00",
    max: "2499.00",
    average: "1999.50",
    median: "1999.99"
  },
  "Used - Excellent": {
    count: 50,
    min: "1299.00",
    max: "1799.00",
    average: "1549.00",
    median: "1549.99"
  },
  "Used - Good": {
    count: 30,
    min: "999.00",
    max: "1499.00",
    average: "1249.00",
    median: "1249.99"
  }
}
```

### 3. 推奨価格の算出

```javascript
/**
 * 利益目標から推奨価格を算出
 */
function calculateRecommendedPrice(competitorAnalysis, costPrice, targetMargin) {
  const avgPrice = parseFloat(competitorAnalysis.average);
  const medianPrice = parseFloat(competitorAnalysis.median);

  // コストと目標利益率から最低価格を計算
  const minPrice = costPrice * (1 + targetMargin);

  // 競合価格を考慮した推奨価格
  const recommendedPrice = Math.max(minPrice, medianPrice * 0.95);  // 中央値の95%

  // 利益率を計算
  const actualMargin = ((recommendedPrice - costPrice) / costPrice) * 100;

  return {
    recommendedPrice: recommendedPrice.toFixed(2),
    minPrice: minPrice.toFixed(2),
    competitorAverage: avgPrice.toFixed(2),
    competitorMedian: medianPrice.toFixed(2),
    actualMargin: actualMargin.toFixed(1) + '%',
    isCompetitive: recommendedPrice <= avgPrice
  };
}

// 使用例
const pricing = calculateRecommendedPrice(
  result.analysis,
  1200,  // 仕入れ価格 $1200
  0.30   // 目標利益率 30%
);

Logger.log(`推奨販売価格: $${pricing.recommendedPrice}`);
Logger.log(`実際の利益率: ${pricing.actualMargin}`);
Logger.log(`競争力: ${pricing.isCompetitive ? '競争力あり' : '要検討'}`);
```

---

## スプレッドシート統合

### 1. 価格調査シートの作成

```javascript
/**
 * 価格調査結果をスプレッドシートに書き込む
 */
function writePriceResearchToSheet(keyword, result) {
  const sheet = getOrCreateSheet('価格調査');

  // ヘッダー（初回のみ）
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:M1').setValues([[
      '調査日時',
      'キーワード',
      '検索結果数',
      '分析件数',
      '最安値',
      '最高値',
      '平均価格',
      '中央値',
      '推奨価格（下限）',
      '推奨価格（最適）',
      '推奨価格（上限）',
      '標準偏差',
      'ステータス'
    ]]);
    sheet.getRange('A1:M1')
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
  }

  // データ行を追加
  sheet.appendRow([
    formatDate(result.timestamp),
    keyword,
    result.totalResults,
    result.analyzedItems,
    '$' + result.analysis.min,
    '$' + result.analysis.max,
    '$' + result.analysis.average,
    '$' + result.analysis.median,
    '$' + result.analysis.recommendedPriceRange.low,
    '$' + result.analysis.recommendedPriceRange.optimal,
    '$' + result.analysis.recommendedPriceRange.high,
    '$' + result.analysis.stdDev,
    result.success ? '成功' : 'エラー'
  ]);

  // 価格セルに数値フォーマット
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 5, 1, 8).setNumberFormat('$#,##0.00');

  Logger.log('価格調査結果をシートに記録しました');
}
```

### 2. 詳細データシートの作成

```javascript
/**
 * 価格分布の詳細をシートに書き込む
 */
function writePriceDistribution(keyword, distribution) {
  const sheet = getOrCreateSheet('価格分布_' + keyword.replace(/\s+/g, '_'));

  // クリア
  sheet.clear();

  // ヘッダー
  sheet.getRange('A1:C1').setValues([['価格帯', '商品数', '割合']]);
  sheet.getRange('A1:C1')
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // データ
  distribution.forEach((item, index) => {
    sheet.getRange(index + 2, 1, 1, 3).setValues([[
      item.range,
      item.count,
      item.percentage + '%'
    ]]);
  });

  // グラフを作成
  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange('A1:B' + (distribution.length + 1)))
    .setPosition(5, 5, 0, 0)
    .setOption('title', `価格分布: ${keyword}`)
    .setOption('hAxis', { title: '価格帯' })
    .setOption('vAxis', { title: '商品数' })
    .build();

  sheet.insertChart(chart);

  Logger.log('価格分布シートを作成しました');
}
```

### 3. 一括価格調査機能

```javascript
/**
 * 複数キーワードの一括価格調査
 */
function batchPriceResearch() {
  const ui = SpreadsheetApp.getUi();
  const sheet = getOrCreateSheet('出品管理');
  const data = readDataFromSheet('出品管理', { startRow: 2 });

  let successCount = 0;
  let errorCount = 0;

  data.forEach((row, index) => {
    const rowNumber = index + 2;
    const keyword = row[1];  // B列: 商品名
    const hasResearch = row[28];  // AC列: 価格調査済みフラグ

    if (keyword && !hasResearch) {
      try {
        Logger.log(`価格調査: ${keyword}`);

        // 価格調査実行
        const result = researchCompetitorPrices(keyword, { limit: 100 });

        if (result.success) {
          // 価格調査シートに記録
          writePriceResearchToSheet(keyword, result);

          // 推奨価格を出品管理シートに記入
          sheet.getRange(rowNumber, 6).setValue(result.analysis.recommendedPriceRange.optimal);  // F列: 価格
          sheet.getRange(rowNumber, 29).setValue('完了');  // AC列: ステータス

          successCount++;
        } else {
          errorCount++;
          sheet.getRange(rowNumber, 29).setValue('エラー');
        }

        // レート制限対策
        Utilities.sleep(2000);

      } catch (error) {
        errorCount++;
        Logger.log(`エラー: ${keyword} - ${error.message}`);
        sheet.getRange(rowNumber, 29).setValue('エラー: ' + error.message);
      }
    }
  });

  ui.alert(
    '一括価格調査完了',
    `成功: ${successCount}件\nエラー: ${errorCount}件`,
    ui.ButtonSet.OK
  );
}
```

---

## 高度な分析機能

### 1. トレンド分析（時系列）

```javascript
/**
 * 定期的に価格調査を実行してトレンドを記録
 */
function trackPriceTrend(keyword) {
  // 価格調査実行
  const result = researchCompetitorPrices(keyword);

  // トレンドシートに記録
  const sheet = getOrCreateSheet('価格トレンド');

  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:F1').setValues([[
      '日時', 'キーワード', '最安値', '平均価格', '最高値', '商品数'
    ]]);
  }

  sheet.appendRow([
    new Date(),
    keyword,
    result.analysis.min,
    result.analysis.average,
    result.analysis.max,
    result.analyzedItems
  ]);

  // トリガーで毎日実行するように設定可能
}
```

### 2. セラー分析

```javascript
/**
 * トップセラーの価格戦略を分析
 */
function analyzeTopSellersPricing(keyword) {
  const result = searchItems(keyword, { limit: 100, sort: 'price' });

  // 高評価セラーの価格を抽出
  const topSellerPrices = result.itemSummaries
    .filter(item =>
      item.seller.feedbackPercentage >= 98 &&
      item.seller.feedbackScore >= 1000
    )
    .map(item => ({
      price: parseFloat(item.price.value),
      seller: item.seller.username,
      feedbackScore: item.seller.feedbackScore
    }));

  // 統計
  const avgTopSellerPrice = topSellerPrices.reduce((acc, item) => acc + item.price, 0) / topSellerPrices.length;

  return {
    topSellerCount: topSellerPrices.length,
    avgPrice: avgTopSellerPrice.toFixed(2),
    sellers: topSellerPrices
  };
}
```

### 3. 配送コスト分析

```javascript
/**
 * 配送料込みの実質価格で分析
 */
function analyzeTotalCost(items) {
  const totalCosts = items.map(item => {
    const itemPrice = parseFloat(item.price.value);
    let shippingCost = 0;

    if (item.shippingOptions && item.shippingOptions.length > 0) {
      const shipping = item.shippingOptions[0];
      if (shipping.shippingCost) {
        shippingCost = parseFloat(shipping.shippingCost.value);
      }
    }

    return {
      itemPrice: itemPrice,
      shippingCost: shippingCost,
      totalCost: itemPrice + shippingCost,
      isFreeShipping: shippingCost === 0
    };
  });

  // 統計
  const avgTotal = totalCosts.reduce((acc, item) => acc + item.totalCost, 0) / totalCosts.length;
  const freeShippingCount = totalCosts.filter(item => item.isFreeShipping).length;
  const freeShippingPercentage = (freeShippingCount / totalCosts.length) * 100;

  return {
    avgTotalCost: avgTotal.toFixed(2),
    freeShippingPercentage: freeShippingPercentage.toFixed(1) + '%',
    totalCosts: totalCosts
  };
}
```

---

## カスタムメニュー追加

```javascript
// Code.gs の onOpen() に追加
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('eBay API')
    .addItem('🔐 認証', 'showAuthDialog')
    .addSeparator()
    .addItem('🔍 商品検索', 'showSearchDialog')
    .addItem('📦 在庫同期', 'syncInventory')
    .addItem('📋 注文取得', 'fetchOrders')
    .addSeparator()
    .addItem('📝 Item Specifics取得（選択行）', 'fetchItemSpecificsForSelectedRow')
    .addItem('📝 Item Specifics一括取得', 'autoFetchItemSpecificsFromSheet')
    .addSeparator()
    .addItem('💰 価格調査（選択行）', 'researchPriceForSelectedRow')        // ★追加
    .addItem('💰 価格調査一括実行', 'batchPriceResearch')                    // ★追加
    .addItem('📈 価格トレンド記録', 'showPriceTrendDialog')                  // ★追加
    .addSeparator()
    .addItem('📊 ダッシュボード作成', 'createDashboard')
    .addSeparator()
    .addItem('⚙️ 設定', 'showSettingsDialog')
    .addItem('ℹ️ バージョン情報', 'showAboutDialog')
    .addToUi();
}

/**
 * 選択行の価格調査
 */
function researchPriceForSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeRow = sheet.getActiveCell().getRow();

  if (activeRow === 1) {
    SpreadsheetApp.getUi().alert('データ行を選択してください');
    return;
  }

  const keyword = sheet.getRange(activeRow, 2).getValue();  // B列: 商品名

  if (!keyword) {
    SpreadsheetApp.getUi().alert('商品名が入力されていません');
    return;
  }

  try {
    const result = researchCompetitorPrices(keyword, { limit: 100 });

    if (result.success) {
      // 価格調査シートに記録
      writePriceResearchToSheet(keyword, result);

      // 推奨価格をセルに入力
      sheet.getRange(activeRow, 6).setValue(result.analysis.recommendedPriceRange.optimal);

      SpreadsheetApp.getUi().alert(
        '価格調査完了',
        `キーワード: ${keyword}\n` +
        `分析対象: ${result.analyzedItems}件\n\n` +
        `最安値: $${result.analysis.min}\n` +
        `平均価格: $${result.analysis.average}\n` +
        `最高値: $${result.analysis.max}\n\n` +
        `推奨価格: $${result.analysis.recommendedPriceRange.optimal}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert('エラー', result.error, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('エラー', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
```

---

## まとめ

### 実現可能性
✅ **完全に実現可能**（既存APIで対応）

### 取得できる情報
- ✅ 検索結果の全商品データ
- ✅ 最安値・最高値・平均価格・中央値
- ✅ 価格分布
- ✅ コンディション別価格
- ✅ 推奨価格帯
- ✅ セラー情報
- ✅ 配送コスト

### 活用メリット
1. **作業効率化**: 手動調査が10秒で完了
2. **精度向上**: 統計的な分析で適正価格を算出
3. **利益最大化**: データに基づく価格設定
4. **競争力強化**: 市場動向の把握

### 推奨度
⭐⭐⭐⭐⭐ **最優先実装推奨**

出品前のリサーチが**自動化**され、データドリブンな価格設定が可能になります。

---

## 次のステップ

1. `PriceResearch.gs` の作成
2. 価格分析ロジックの実装
3. スプレッドシート統合
4. カスタムメニュー追加

実装を開始しますか？

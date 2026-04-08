# ZIK Analytics vs Algopix 徹底比較レポート

**作成日**: 2026-03-10
**調査目的**: Terapeak代替ツールとして、販売履歴データの取得・保持が可能か検証

---

## 📊 エグゼクティブサマリー

### 重要な結論

1. **ZIK Analytics**: ❌ **API なし** - Web UI のみ、CSV エクスポート可能
2. **Algopix**: ✅ **API あり** - ただし販売履歴データは**推定値のみ**
3. **Terapeak 販売履歴の代替**: ⚠️ **両方とも完全な代替にはならない**

---

## 🎯 調査結果：Terapeak販売履歴のデータ化

### ❌ 結論：完全な代替は不可能

| 項目 | Terapeak | ZIK Analytics | Algopix |
|------|----------|---------------|---------|
| **過去の販売データ** | ✅ 3年分 | ⚠️ 30日間のみ | ❌ 推定値のみ |
| **実際の販売価格** | ✅ あり | ✅ あり（30日） | ❌ 推定 |
| **販売個数** | ✅ あり | ✅ あり（30日） | ❌ 推定 |
| **Best Offer価格** | ✅ あり | ❌ なし | ❌ なし |
| **データエクスポート** | ❌ 不可 | ✅ CSV | ⚠️ API |
| **API アクセス** | ❌ なし | ❌ なし | ✅ あり |
| **データ保持** | ❌ 不可 | ✅ CSV保存可 | ✅ API保存可 |

---

## 1️⃣ ZIK Analytics 詳細分析

### ✅ 成功事例

#### 事例1: 7桁収益達成（Michael Girvan氏）
**成功要因**:
- ZIK Analytics を使用して5年間ドロップシッピング
- 複数ストアを運営し、7桁の収益を達成
- リアルタイムの販売データで需要を検証

**利用機能**:
- Competitor Research: 競合の売上・在庫を追跡
- Product Research: 売れている商品をリアルタイムで発見

**成功のポイント**:
- 推測ではなく実際の販売データに基づく商品選定
- 30日間の販売トレンドで需要を確認
- 競合分析で価格戦略を最適化

---

#### 事例2: $5,000利益（Daniel氏）
**成功要因**:
- Facebook Marketplace で30日間で $5,000 の利益
- ZIK Analytics で需要検証

**成功のポイント**:
- 販売実績のある商品のみを選定
- 売上データで商品の実績を確認

---

#### 事例3: 初心者の成功（新規セラー）
**成功要因**:
- **3日間で最初の勝利商品を発見**
- 以前は推測に頼っていたが、ZIK で実データを利用

**成功のポイント**:
- 初心者でも使いやすいインターフェース
- 明確な販売データで判断可能

---

### ❌ 失敗事例・問題点

#### 問題1: データ精度の問題
**報告内容**:
- データが間違っていることがある
- 大量に販売した商品が「需要なし」と表示
- 競合分析データが古い・不正確
- ZIK と Terapeak でデータの不一致

**失敗要因**:
- eBay の API データ更新遅延
- ZIK の独自アルゴリズムの限界
- リアルタイムではなく数時間遅れのデータ

**ユーザーの声**:
> "Products I sold in large quantities showed up as having no demand"
> "Competitor analysis data was frequently incorrect and outdated"
> "Heavily flawed research results with inconsistencies between ZIK and Terapeak"

---

#### 問題2: 請求・キャンセルの問題
**報告内容**:
- トライアルのキャンセルができない
- キャンセル後も請求される
- 請求システムの不具合

**失敗要因**:
- UI の不具合
- 課金システムの設計ミス

---

#### 問題3: カスタマーサポートの問題
**報告内容**:
- 問題をエスカレーションすると言いながら解決しない
- 24時間後に「問題なし」と返答
- 複数回の催促が必要

**失敗要因**:
- サポート体制の不足
- 技術チームとの連携不足

---

#### 問題4: 技術的制限
**報告内容**:
- ログアウトを繰り返す
- 保存した検索データが消える
- eBay への直接インポート機能がない
- データ更新が遅い

**失敗要因**:
- システムの不安定性
- API 統合の不足

---

### 📊 ZIK Analytics の実力

**Trustpilot評価**: 4.7/5（677レビュー）
**ユーザー数**: 159,000+ eコマースビジネス
**効果**: 初回販売までの時間が **3倍速く**

---

### 🔍 ZIK Analytics の機能詳細

#### データ取得可能期間
- ✅ **7日間、14日間、21日間、30日間** から選択可能
- ⚠️ **最大30日間のみ** - これ以上の過去データは取得不可

#### 取得可能なデータ
1. **セラー分析**
   - 総売上（Total Revenue）
   - 出品数（Active Listings）
   - 販売個数（Sold Items）
   - 平均価格（Average Price）
   - フィードバックスコア
   - **売上率（Sell-through Rate）**

2. **商品分析**
   - 商品画像
   - タイトル
   - 現在価格
   - 販売個数
   - 売上金額
   - 30日間の販売数

3. **競合追跡**
   - リアルタイムのセラーデータ
   - 売上統計
   - ベストセラー商品

---

### 💾 データエクスポート機能

#### CSV エクスポート対応
1. ✅ **My Products から全商品エクスポート**
2. ✅ **選択した商品のみエクスポート**
3. ✅ **Store Analytics データのエクスポート**
4. ✅ **Ali Growth Scanner からエクスポート**

#### エクスポート可能な情報
- 商品画像URL
- タイトル
- 現在価格
- 販売個数
- 売上金額
- VeRO ブランド除外オプション
- 制限キーワード除外オプション

#### エクスポートフロー
```
ZIK Analytics
  ↓
My Products / Store Analytics
  ↓
Export to CSV
  ↓
スプレッドシート編集可能
  ↓
AutoDS / Salefreaks / 手動アップロード
```

---

### 🔌 統合パートナー（API代替）

ZIK Analytics には API がないため、以下のパートナーとの統合を提供：

1. **AutoDS**
   - ZIK から商品をエクスポート
   - eBay、Shopify、Amazon に自動出品
   - 在庫・価格・注文を自動同期

2. **Salefreaks**
   - ZIK から eBay リスティング作成
   - 一括出品対応

3. **その他**
   - Dropshipman
   - KalDrop
   - DSM Tool
   - 3Dsellers

---

### 💰 ZIK Analytics 料金プラン

| プラン | 料金（月額） | 料金（年額） | 特徴 |
|--------|-------------|-------------|------|
| **PRO (eBay)** | $39.9 | 50%割引 | 基本機能 |
| **PRO+ (eBay)** | $59.9 | 50%割引 | 高度な機能 |
| **Enterprise** | $89.9 | 50%割引 | 全機能 |
| **Pro (Shopify)** | $14.99 | 50%割引 | Shopify特化 |

**トライアル**: 7日間 $1

**別の情報源**:
- PRO: $14.99/月
- PRO+: $29.99/月
- 範囲: $29.99 〜 $899.88

---

### ⚠️ ZIK Analytics の制限事項

1. ❌ **API なし** - プログラム的なアクセス不可
2. ⚠️ **30日間のみ** - それ以上の過去データは取得不可
3. ⚠️ **eBay のみ** - Amazon、Walmart の比較不可
4. ❌ **Best Offer 価格なし** - 受け入れられた価格は不明
5. ⚠️ **データ精度** - 時々不正確
6. ❌ **予測分析なし** - トレンド予測機能なし
7. ❌ **在庫管理統合なし**
8. ⚠️ **検証ステージに強い** - 運用・拡大には不向き

---

## 2️⃣ Algopix 詳細分析

### ✅ 成功事例

#### 公式ケーススタディ
残念ながら、**公式の詳細なケーススタディは見つかりませんでした**。

#### ポジティブレビュー
- 市場調査機能が強力
- データインサイトが役立つ
- 複数マーケットプレイス対応が便利

---

### ❌ 失敗事例・問題点

#### 問題1: 請求・返金の問題
**報告内容**:
- 年間サブスクリプションに予期せず請求
- 返金が受けられない
- アカウントキャンセルができない
- キャンセル後も請求が続く

**ユーザーの声**:
> "You cannot get a refund. There is no such thing as customer service"

**Scamadviser評価**: 2.5/5（5レビュー）

---

#### 問題2: カスタマーサポートの問題
**報告内容**:
- 返金・キャンセルに関する対応が悪い
- 約束が守られない

---

#### 問題3: 価格の問題
**報告内容**:
- 無料プランの制限が厳しい（1日10検索のみ）
- 有料プランが高価

---

#### 問題4: パフォーマンスの問題
**報告内容**:
- ソフトウェアが遅い時がある

---

#### 問題5: プラットフォーム制限
**報告内容**:
- eBay、Amazon、Walmart 以外には対応していない

---

### 🔍 Algopix の機能詳細

#### データ取得機能
- ✅ **リアルタイム市場分析**
- ⚠️ **販売推定値** - 実際の販売データではない
- ✅ **価格比較**（eBay、Amazon、Walmart）
- ✅ **需要レベル**
- ✅ **競合分析**
- ✅ **利益予測**

#### 取得できるデータ
1. **商品分析**
   - 商品識別子（ASIN、UPC、GTIN）
   - 推奨価格
   - 費用内訳
   - **需要レベル**（推定）
   - 競合インサイト
   - **利益予測**

2. **マーケット比較**
   - Amazon、eBay、Walmart の価格
   - Marketability Score（市場性スコア）
   - 配送コスト見積もり

3. **販売推定**
   - ⚠️ **月間販売数推定** - 実際の販売データではない
   - ⚠️ **GMV 推定**（総商品取扱高）

---

### ⚠️ 重要：Algopix は「推定値」のみ

Algopix のデータは以下の特徴があります：

- ❌ **実際の販売履歴データではない**
- ✅ **推定値（Estimates）**
- ❌ **eBay の sold items（販売済み商品）は取得不可**
- ⚠️ **「Sales Estimates」と明記**

**ユーザーレビューより**:
> "Algopix allows you to collect real-time product data but fails to include historic data"

---

### 🔌 Algopix API 詳細

#### API の存在
- ✅ **API あり**
- 公式ドキュメント: https://docs.algopix.com/

#### API エンドポイント
1. **Product Analysis API**
   - 複数チャネルの商品データ分析
   - 販売推定値を含む

2. **Product Details API**
   - GTIN、ASIN、AID で商品属性取得

3. **Product Matching API**
   - ASIN、AID で商品マッチング
   - 最大10商品を返す

4. **Products Categories API**
   - カテゴリ別の商品取得

5. **Pricing API**
   - 価格データ取得

---

#### API 認証
- **方法**: API Key
- **設定**: Account > API Keys で作成
- **ヘッダー**: `X-API-KEY: YOUR_API_KEY`

---

#### API リクエスト例（推測）
```javascript
// Product Analysis API
function analyzeProductWithAlgopix(asin) {
  const apiKey = 'YOUR_ALGOPIX_API_KEY';
  const apiUrl = 'https://api.algopix.com/v3/products';

  const payload = {
    "productIdentifiers": [{
      "type": "ASIN",
      "value": asin
    }],
    "markets": ["ebay_us", "amazon_us", "walmart_us"],
    "resources": ["PRODUCT_DETAILS", "ANALYSIS"]
  };

  const options = {
    method: 'post',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const data = JSON.parse(response.getContentText());

  return data;
}
```

---

#### API レスポンス構造
```json
{
  "products": [{
    "title": "Product Name",
    "currentPrice": 49.99,
    "recommendedPrice": {
      "min": 45.00,
      "max": 55.00
    },
    "demand": "HIGH",
    "competition": "MEDIUM",
    "profitability": {
      "estimatedProfit": 10.00,
      "roi": 20.0
    },
    "salesEstimate": {
      "monthlySales": 500,
      "gmv": 24995.00
    }
  }]
}
```

---

#### ⚠️ API 料金・制限（未確認）

**公開情報なし** - 以下は要問合せ：
- ❓ **レート制限** - 1分/1時間/1日あたりのリクエスト数
- ❓ **リクエスト単価** - API コール1回あたりの料金
- ❓ **プラン別制限** - Free/Basic/Professional/Enterprise
- ❓ **月間リクエスト上限**

---

### 💰 Algopix 料金プラン

| プラン | 料金（月額） | 料金（年額） | API | 制限 |
|--------|-------------|-------------|-----|------|
| **Free** | $0 | $0 | ❓ | 10検索/日 |
| **Basic** | $27.99 | 40%割引 | ❓ | 制限あり |
| **Professional** | $29〜 | 40%割引 | ✅ | 無制限検索 |
| **Business** | 不明 | 不明 | ✅ | 高度な機能 |
| **Enterprise** | カスタム | カスタム | ✅ | 優先サポート |

**別の情報源**:
- Unlimited Plan: $34.99/月 または $27.99/年
- Real-time Data Subscription: カスタム価格
- 範囲: $19.99/月〜

**トライアル**: 7日間無料

---

### 🔌 Algopix 統合機能

#### Zapier 統合
- ✅ タスク自動化
- ✅ 商品詳細取得
- ✅ 市場インサイト取得
- ✅ 需要分析
- ✅ 価格最適化

#### Google Sheets 統合（可能性）
- Zapier 経由で Google Sheets に接続可能
- n8n などのワークフロー自動化ツールで統合可能
- 直接の Google Sheets アドオンは見つからず

#### API 統合
- ✅ ERP/CRM システムと統合
- ✅ マルチチャネル出品ソフトウェアと統合
- ✅ 頻繁な価格更新を自動化

---

### ⚠️ Algopix の制限事項

1. ❌ **実際の販売履歴データなし** - 推定値のみ
2. ❌ **eBay sold items なし**
3. ⚠️ **API 料金・制限が不明**
4. ❌ **過去データなし** - リアルタイムのみ
5. ⚠️ **3大マーケットプレイスのみ** - eBay、Amazon、Walmart
6. ⚠️ **カスタマーサポートに問題あり**
7. ⚠️ **返金・キャンセルのトラブル報告多数**

---

## 📊 総合比較表

### 基本機能比較

| 項目 | ZIK Analytics | Algopix |
|------|---------------|---------|
| **API** | ❌ なし | ✅ あり |
| **料金** | $29.99〜/月 | $27.99〜/月 |
| **トライアル** | 7日 $1 | 7日無料 |
| **ユーザー数** | 159,000+ | 不明 |
| **評価** | 4.7/5 (677) | 2.5/5 (5) |

---

### データ取得比較

| データ項目 | ZIK Analytics | Algopix |
|-----------|---------------|---------|
| **販売履歴** | ✅ 30日間 | ❌ 推定のみ |
| **販売個数** | ✅ 実データ | ❌ 推定値 |
| **販売価格** | ✅ 実データ | ⚠️ 現在価格 |
| **需要レベル** | ✅ 実データ | ✅ 推定値 |
| **競合分析** | ✅ あり | ✅ あり |
| **利益予測** | ❌ なし | ✅ あり |
| **クロスマーケット** | ❌ eBayのみ | ✅ 3市場 |

---

### データエクスポート比較

| 項目 | ZIK Analytics | Algopix |
|------|---------------|---------|
| **CSV エクスポート** | ✅ あり | ❓ 不明 |
| **API アクセス** | ❌ なし | ✅ あり |
| **Zapier** | ❌ なし | ✅ あり |
| **Google Sheets** | ⚠️ CSV経由 | ⚠️ Zapier経由 |
| **スプレッドシート統合** | ❌ 直接なし | ❌ 直接なし |

---

### データ精度比較

| 項目 | ZIK Analytics | Algopix |
|------|---------------|---------|
| **データソース** | eBay 公式API | 複数マーケット |
| **データ種別** | ✅ 実データ | ⚠️ 推定値 |
| **更新頻度** | リアルタイム | リアルタイム |
| **精度の問題** | ⚠️ あり（報告多数） | ⚠️ 推定値のため精度不明 |

---

## 🎯 Terapeak 販売履歴の代替可能性

### 質問：Terapeak の販売履歴をデータ化して保持可能か？

#### ❌ ZIK Analytics での代替
**可能性**: ⚠️ **部分的に可能**

**できること**:
- ✅ 過去30日間の販売データをCSVエクスポート
- ✅ 定期的にエクスポートして自前でデータ蓄積
- ✅ スプレッドシートで履歴管理

**できないこと**:
- ❌ 30日以上前のデータは取得不可
- ❌ API がないため自動化困難
- ❌ Best Offer 価格は取得不可
- ❌ Terapeak の3年分には及ばない

**実現方法**:
```
毎日/毎週 ZIK Analytics にログイン
  ↓
Store Analytics でデータ確認
  ↓
CSV エクスポート
  ↓
Google Sheets にインポート
  ↓
30日間のデータを蓄積
  ↓
独自の販売履歴データベース構築
```

**評価**: ⭐⭐⭐☆☆ (3/5)
- 手動作業が必要
- 30日間の制限
- 長期的には有効

---

#### ❌ Algopix での代替
**可能性**: ❌ **不可能**

**理由**:
- ❌ 実際の販売履歴データを取得できない
- ❌ 推定値のみ
- ❌ eBay の sold items にアクセスできない
- ⚠️ API はあるがデータが不足

**評価**: ⭐☆☆☆☆ (1/5)
- 販売履歴の代替にはならない
- 市場分析ツールとしては有用

---

### ✅ 推奨アプローチ

#### 方法1: ZIK Analytics で短期データ蓄積
**ステップ**:
1. ZIK Analytics PRO+ プラン契約（$29.99/月）
2. 毎週末にデータをCSVエクスポート
3. Google Sheets に自動インポート（Apps Script）
4. 独自のデータベースを構築

**メリット**:
- 実データを取得可能
- 月額$29.99で低コスト
- スプレッドシート統合が容易

**デメリット**:
- 30日間の制限
- 手動作業が必要
- API がない

**実装難易度**: ⭐⭐☆☆☆ (2/5)

---

#### 方法2: eBay Browse API で独自データ蓄積
**ステップ**:
1. すでに実装済みの Browse API を活用
2. 定期実行（Time-driven Trigger）
3. 毎日現在の出品データを記録
4. スプレッドシートに蓄積

**メリット**:
- 完全無料
- API 制限が緩い
- すでに実装済み
- 自動化可能

**デメリット**:
- 現在の出品のみ
- 売り切れた商品は追跡不可

**実装難易度**: ⭐☆☆☆☆ (1/5) - すでに実装済み

---

#### 方法3: ZIK + Browse API のハイブリッド
**ステップ**:
1. Browse API で日次の出品データ収集
2. ZIK Analytics で週次の販売データ取得
3. 両方のデータをマージ

**メリット**:
- 最も包括的
- 実データと推定データの両方
- 長期的なトレンド把握

**デメリット**:
- 月額$29.99のコスト
- 実装が複雑

**実装難易度**: ⭐⭐⭐☆☆ (3/5)

---

## 💡 最終推奨

### 質問への回答

#### 1. 導入事例と成功事例
- **ZIK Analytics**: ✅ 明確な成功事例あり（7桁収益、$5,000利益など）
- **Algopix**: ❌ 公式ケーススタディなし

#### 2. 失敗事例と失敗要因
- **ZIK Analytics**: データ精度、請求問題、サポート問題
- **Algopix**: 返金・キャンセル問題、カスタマーサポート問題

#### 3. Terapeak 販売履歴のデータ化
- **ZIK Analytics**: ⚠️ 部分的に可能（30日間、CSV経由）
- **Algopix**: ❌ 不可能（推定値のみ）
- **推奨**: eBay Browse API + ZIK Analytics のハイブリッド

#### 4. API の詳細な料金とできること
- **ZIK Analytics**: ❌ API なし、$29.99/月、CSV エクスポートのみ
- **Algopix**: ✅ API あり、$27.99〜/月、レート制限・料金不明

#### 5. レート制限
- **ZIK Analytics**: N/A（API なし）
- **Algopix**: ❓ 公開情報なし（要問合せ）

---

## 🎯 結論と推奨アクション

### 即時実装可能な解決策

**Phase 1: 無料の eBay Browse API を活用**（推奨 ⭐⭐⭐⭐⭐）
- すでに実装済み
- 完全無料
- 定期実行で独自データベース構築
- 実装: `price-research-spec.md` 参照

**Phase 2: ZIK Analytics でデータ補完**（オプション ⭐⭐⭐☆☆）
- 月額 $29.99
- 30日間の実データ取得
- 週次CSVエクスポート
- Google Sheets に蓄積

**Phase 3: 長期運用で独自データベース**（長期戦略 ⭐⭐⭐⭐⭐）
- 数ヶ月〜1年のデータ蓄積
- Terapeak を超える独自データベース
- 完全にコントロール可能

---

### Algopix は推奨しない理由

1. ❌ 実際の販売履歴データなし
2. ❌ 推定値のみで精度不明
3. ⚠️ API 料金・制限が不明
4. ⚠️ カスタマーサポートに問題多数
5. ⚠️ 返金・キャンセルのトラブル報告

---

## 📚 参考リンク・エビデンス

### ZIK Analytics
- [ZIK Analytics Success Stories](https://www.zikanalytics.com/success-stories/)
- [eBay Dropshipping Success Stories 2026](https://www.zikanalytics.com/blog/ebay-dropshipping-success-stories/)
- [ZIK Analytics Review 2026: Is It Worth It for eBay Sellers?](https://winninghunter.com/insights/zik-analytics-review/)
- [ZIK Analytics Trustpilot Reviews](https://www.trustpilot.com/review/zikanalytics.com)
- [ZIK Analytics Pricing Plans](https://www.zikanalytics.com/pricing)
- [ZIK Analytics Integrations](https://www.zikanalytics.com/integrations/)
- [Competitor Research Guide](https://help.zikanalytics.com/en/articles/7978193-competitor-research-guide)
- [How to Find Sold Items on eBay](https://www.zikanalytics.com/blog/how-to-find-sold-items-on-ebay/)
- [eBay Sales Tracker](https://www.zikanalytics.com/solutions/ebay-sales-tracker)

### Algopix
- [Algopix Trustpilot Reviews](https://www.trustpilot.com/review/algopix.com)
- [Algopix Reviews on G2](https://www.g2.com/products/algopix/reviews)
- [Algopix APIs Introduction](https://docs.algopix.com/docs/algopix-api-documentation/ZG9jOjQ2NDA2-introduction)
- [Product Analysis API](https://docs.algopix.com/docs/algopix-api-documentation/75a59d726dacd-product-analysis-api)
- [Algopix Zapier Integrations](https://zapier.com/apps/algopix/integrations)
- [Algopix Review: Pricing, Service, & More (2026)](https://www.webretailer.com/reviews/algopix/)

### 比較記事
- [5 Best Terapeak Alternatives in 2026](https://www.zikanalytics.com/blog/terapeak-alternatives/)
- [Best eBay Research Tools for 2026](https://www.scrapingbee.com/blog/must-have-ebay-research-tools/)
- [Top 6 eBay Analytics and Product Research Tools](https://www.3dsellers.com/blog/top-6-ebay-analytics-and-product-research-tools)
- [5 Best eBay Sales Trackers in 2025](https://www.zikanalytics.com/blog/ebay-sales-trackers/)

---

## 📝 調査メモ

### 調査で確認できなかった項目

1. **Algopix API の詳細**
   - ❓ レート制限
   - ❓ リクエスト単価
   - ❓ プラン別の制限
   - ❓ 月間リクエスト上限

2. **ZIK Analytics のデータ精度**
   - ⚠️ 不正確との報告多数
   - ⚠️ Terapeak との不一致
   - ❓ 精度の改善状況

3. **両ツールの最新機能**
   - API ドキュメントの CSS のみ取得
   - 実際の機能仕様は要追加調査

---

**このレポートは、2026年3月10日時点の公開情報に基づいています。**
**API の詳細な料金・制限については、各サービスに直接問い合わせることを推奨します。**

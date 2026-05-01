# ConditionDescriptors 検証レポート

**調査日**: 2026-05-02  
**対象カテゴリ**: 183454 (CCG Individual Cards)  
**ステータス**: ドキュメント調査完了 / API実テスト手順付き

---

## 結論

| 項目 | 結果 |
|------|------|
| ConditionID 2750 + ConditionDescriptors で出品可能か | **YES（公式仕様として確定）** |
| 実装 (PR #45) で進めるべきか | **YES（ただし Grader マップ拡充が必要）** |
| Grade の値形式 | **フリーテキスト文字列** ("10", "9.5") — 数値ID不要 |
| Grader の値形式 | **数値ID** (PSA=275010, BGS=275013, ...) |
| ConditionID 4000 で ConditionDescriptors は必要か | **NO（任意。今回の実装対象外）** |

---

## Task 1: 公式仕様

### 1-1. ConditionDescriptor Name ID 一覧

| Name ID | フィールド名 | 必須/任意 |
|---------|------------|---------|
| **27501** | Professional Grader | **必須**（2750 使用時） |
| **27502** | Grade | **必須**（2750 使用時） |
| **27503** | Certification Number | 任意 |

### 1-2. Professional Grader (27501) 有効 Value 一覧

| 略称 | 正式名 | Value ID |
|------|--------|---------|
| PSA | Professional Sports Authenticator | 275010 |
| BCCG | Beckett Collectors Club Grading | 275011 |
| BVG | Beckett Vintage Grading | 275012 |
| BGS | Beckett Grading Services | 275013 |
| CSG | Certified Sports Guaranty | 275014 |
| SGC | Sportscard Guaranty Corporation | 275016 |
| KSA | K Sportscard Authentication | 275017 |
| GMA | Gem Mint Authentication | 275018 |
| HGA | Hybrid Grading Approach | 275019 |
| ISA | International Sports Authentication | 2750110 |
| GSG | Gold Standard Grading | 2750112 |
| PGS | Platin Grading Service | 2750113 |
| MNT | MNT Grading | 2750114 |
| TAG | Technical Authentication & Grading | 2750115 |
| Rare | Rare Edition | 2750116 |
| RCG | Revolution Card Grading | 2750117 |
| CGA | Card Grading Australia | 2750120 |
| TCG | Trading Card Grading | 2750121 |
| Other | その他 | 2750123 |

> **注意**: CGC (Certified Guaranty Company) はリストに含まれていない。CGC グレードカードは `2750123` (Other) を使用。

### 1-3. Grade (27502) 有効 Value 一覧

**値形式: フリーテキスト文字列**（"10", "9.5", "1" 等）

| 表示値 | API Value | 表示値 | API Value |
|-------|----------|-------|----------|
| 10 | `"10"` | 5 | `"5"` |
| 9.5 | `"9.5"` | 4.5 | `"4.5"` |
| 9 | `"9"` | 4 | `"4"` |
| 8.5 | `"8.5"` | 3.5 | `"3.5"` |
| 8 | `"8"` | 3 | `"3"` |
| 7.5 | `"7.5"` | 2.5 | `"2.5"` |
| 7 | `"7"` | 2 | `"2"` |
| 6.5 | `"6.5"` | 1.5 | `"1.5"` |
| 6 | `"6"` | 1 | `"1"` |
| 5.5 | `"5.5"` | Authentic | `"Authentic"` |

> **補足**: shipscript.com の MIP 一括アップロードガイドには `(ID: 275020)` のような内部IDが示されているが、Trading API XML では文字列値をそのまま送信する（eBay 公式ドキュメントの XML サンプルより確認）。

### 1-4. Certification Number (27503) の形式

`<Value>` タグではなく `<AdditionalInfo>` タグを使用（最大30文字）:

```xml
<ConditionDescriptor>
  <Name>27503</Name>
  <AdditionalInfo>12345678</AdditionalInfo>
</ConditionDescriptor>
```

### 1-5. 確定した正確な XML 形式

```xml
<ConditionID>2750</ConditionID>
<ConditionDescriptors>
  <!-- 必須: Grader -->
  <ConditionDescriptor>
    <Name>27501</Name>
    <Value>275010</Value>  <!-- PSA -->
  </ConditionDescriptor>
  <!-- 必須: Grade -->
  <ConditionDescriptor>
    <Name>27502</Name>
    <Value>10</Value>
  </ConditionDescriptor>
  <!-- 任意: Certification Number -->
  <ConditionDescriptor>
    <Name>27503</Name>
    <AdditionalInfo>12345678</AdditionalInfo>
  </ConditionDescriptor>
</ConditionDescriptors>
```

---

## Task 2: GetCategoryFeatures 呼び出し

> **実施方法**: 以下の GAS 関数を GAS Script Editor に貼り付けて実行すること。

```javascript
/**
 * カテゴリ183454 の GetCategoryFeatures を呼び出して
 * ConditionDescriptorInfo を取得する
 */
function getConditionDescriptorInfo_183454() {
  const token  = getUserToken();
  const config = getEbayConfig();
  const apiUrl = getTradingApiUrl();

  const xml = '<?xml version="1.0" encoding="utf-8"?>' +
    '<GetCategoryFeaturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
    '<RequesterCredentials>' +
    '<eBayAuthToken>' + token + '</eBayAuthToken>' +
    '</RequesterCredentials>' +
    '<CategoryID>183454</CategoryID>' +
    '<FeatureID>ConditionValues</FeatureID>' +
    '<FeatureID>ConditionDescriptorInfo</FeatureID>' +
    '<DetailLevel>ReturnAll</DetailLevel>' +
    '</GetCategoryFeaturesRequest>';

  const options = {
    method: 'post',
    contentType: 'text/xml',
    headers: {
      'X-EBAY-API-SITEID':             '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-CALL-NAME':          'GetCategoryFeatures',
      'X-EBAY-API-IAF-TOKEN':          token
    },
    payload: xml,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  Logger.log(response.getContentText());
}
```

---

## Task 3: VerifyAddFixedPriceItem テスト

`VerifyAddFixedPriceItem` は **実際の出品を行わず検証のみ**を実施するため、本番環境でも安全に呼び出せる。

以下の GAS 関数を GAS Script Editor に貼り付けて各ケースを実行すること。

```javascript
/**
 * ConditionDescriptors 検証テスト
 * GAS Script Editor で testConditionDescriptors_() を直接実行する
 */
function testConditionDescriptors_() {
  const token  = getUserToken();
  const config = getEbayConfig();
  const apiUrl = getTradingApiUrl();

  const CATEGORY_ID = '183454'; // CCG Individual Cards

  // ── 共通ヘルパー ──
  function callVerify(label, conditionBlock) {
    const xml = '<?xml version="1.0" encoding="utf-8"?>' +
      '<VerifyAddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      '<RequesterCredentials>' +
      '<eBayAuthToken>' + token + '</eBayAuthToken>' +
      '</RequesterCredentials>' +
      '<ErrorLanguage>en_US</ErrorLanguage>' +
      '<WarningLevel>High</WarningLevel>' +
      '<Item>' +
      '<Title>CONDITION TEST - DO NOT LIST ' + label + '</Title>' +
      '<Description>Test item - verification only</Description>' +
      '<PrimaryCategory><CategoryID>' + CATEGORY_ID + '</CategoryID></PrimaryCategory>' +
      '<StartPrice>9.99</StartPrice>' +
      conditionBlock +
      '<Country>JP</Country>' +
      '<Currency>USD</Currency>' +
      '<DispatchTimeMax>3</DispatchTimeMax>' +
      '<ListingDuration>GTC</ListingDuration>' +
      '<ListingType>FixedPriceItem</ListingType>' +
      '<Location>' + config.itemLocation + '</Location>' +
      '<PictureDetails><PictureURL>https://i.ebayimg.com/images/g/default/s-l500.jpg</PictureURL></PictureDetails>' +
      '<PostalCode>100-0001</PostalCode>' +
      '<Quantity>1</Quantity>' +
      '<Site>US</Site>' +
      '<SellerProfiles>' +
      '<SellerShippingProfile><ShippingProfileName>' + config.shippingPolicyName + '</ShippingProfileName></SellerShippingProfile>' +
      '<SellerReturnProfile><ReturnProfileName>' + config.returnPolicyName + '</ReturnProfileName></SellerReturnProfile>' +
      '</SellerProfiles>' +
      '</Item>' +
      '</VerifyAddFixedPriceItemRequest>';

    const options = {
      method: 'post',
      contentType: 'text/xml',
      headers: {
        'X-EBAY-API-SITEID':             '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME':          'VerifyAddFixedPriceItem',
        'X-EBAY-API-IAF-TOKEN':          token
      },
      payload: xml,
      muteHttpExceptions: true
    };

    const res  = UrlFetchApp.fetch(apiUrl, options);
    const body = res.getContentText();

    // Ack と Errors を抽出
    const ackMatch  = body.match(/<Ack>([^<]+)<\/Ack>/);
    const errMatch  = body.match(/<ErrorCode>([^<]+)<\/ErrorCode>[\s\S]*?<ShortMessage>([^<]+)<\/ShortMessage>[\s\S]*?<LongMessage>([^<]+)<\/LongMessage>/);
    const ack       = ackMatch  ? ackMatch[1]  : 'UNKNOWN';
    const errCode   = errMatch  ? errMatch[1]  : '-';
    const shortMsg  = errMatch  ? errMatch[2]  : '-';

    Logger.log('── ' + label + ' ──');
    Logger.log('  Ack      : ' + ack);
    Logger.log('  ErrorCode: ' + errCode);
    Logger.log('  Message  : ' + shortMsg);
    Logger.log('  (Raw): ' + body.slice(0, 500));
    Logger.log('');

    return { label: label, ack: ack, errorCode: errCode, message: shortMsg };
  }

  const results = [];

  // ── テストケース1: 2750 単体 ──────────────────────────────────────────────
  results.push(callVerify(
    'Case1: 2750 のみ（ConditionDescriptors なし）',
    '<ConditionID>2750</ConditionID>'
  ));

  // ── テストケース2: 2750 + ConditionDescriptors (PSA 10) ──────────────────
  results.push(callVerify(
    'Case2: 2750 + ConditionDescriptors (PSA/10)',
    '<ConditionID>2750</ConditionID>' +
    '<ConditionDescriptors>' +
    '<ConditionDescriptor><Name>27501</Name><Value>275010</Value></ConditionDescriptor>' +
    '<ConditionDescriptor><Name>27502</Name><Value>10</Value></ConditionDescriptor>' +
    '</ConditionDescriptors>'
  ));

  // ── テストケース3: 4000 単体 ──────────────────────────────────────────────
  results.push(callVerify(
    'Case3: 4000（Ungraded）のみ',
    '<ConditionID>4000</ConditionID>'
  ));

  // ── テストケース4: 2750 + 不正グレード ─────────────────────────────────────
  results.push(callVerify(
    'Case4: 2750 + ConditionDescriptors (PSA/"PSA 10" 形式エラー確認)',
    '<ConditionID>2750</ConditionID>' +
    '<ConditionDescriptors>' +
    '<ConditionDescriptor><Name>27501</Name><Value>275010</Value></ConditionDescriptor>' +
    '<ConditionDescriptor><Name>27502</Name><Value>PSA 10</Value></ConditionDescriptor>' +
    '</ConditionDescriptors>'
  ));

  Logger.log('=== 結果サマリー ===');
  results.forEach(function(r) {
    Logger.log(r.label + ' → ' + r.ack + ' / ' + r.errorCode);
  });
}
```

---

## Task 4: 検証結果マトリックス（ドキュメント調査ベース）

| テストケース | 送信内容 | 予測結果 | 根拠 |
|---|---|---|---|
| 1 | ConditionID 2750 のみ | **失敗** | 27501/27502 が必須 |
| 2 | 2750 + ConditionDescriptors (PSA/10) | **成功** | 公式 XML 仕様と一致 |
| 3 | 4000 (Ungraded) | **成功** | ConditionDescriptors 不要 |
| 4 | 2750 + Grade "PSA 10"（不正形式） | **失敗** | Grade は数値文字列のみ有効 |

> **実際の API 結果**: 上記 GAS 関数を実行して `testConditionDescriptors_()` のログを確認すること。

---

## 実装への示唆

### PR #45 の実装評価

| 項目 | 実装状況 | 評価 |
|------|---------|------|
| `<ConditionID>2750</ConditionID>` | ✅ | 正しい |
| `<Name>27501</Name>` (Grader Name ID) | ✅ | 正しい |
| Grader Value: PSA → `275010` | ✅ | 正しい |
| `<Name>27502</Name>` (Grade Name ID) | ✅ | 正しい |
| Grade Value: `String(gradeValue).trim()` → `"10"` | ✅ | 正しい（フリーテキスト） |
| `<Name>27503</Name>` + `<AdditionalInfo>` | ✅ | 正しい |
| ConditionID 4000 に ConditionDescriptors を付けない | ✅ | 正しい（4000 は任意） |
| `_GRADER_VALUE_MAP_` の網羅性 | ⚠️ | 要拡充（4種のみ） |
| CGC の扱い | ⚠️ | Other(2750123) に落ちる（正しい動作） |

### 必要な修正: Grader マップの拡充

現在の `_GRADER_VALUE_MAP_` には PSA / BGS / BECKETT / SGC の4種のみ。  
以下を追加することで顧客の誤入力リスクを低減できる:

```javascript
var _GRADER_VALUE_MAP_ = {
  'PSA':     '275010',
  'BCCG':    '275011',
  'BVG':     '275012',
  'BGS':     '275013',
  'BECKETT': '275013',
  'CSG':     '275014',
  'SGC':     '275016',
  'KSA':     '275017',
  'GMA':     '275018',
  'HGA':     '275019',
  'ISA':     '2750110',
  'GSG':     '2750112',
  'PGS':     '2750113',
  'MNT':     '2750114',
  'TAG':     '2750115',
  'RARE':    '2750116',
  'RCG':     '2750117',
  'CGA':     '2750120',
  'TCG':     '2750121'
  // CGC は eBay の対応グレーダーリストに含まれていないため Other(2750123) にフォールバック
};
```

### 参考: ConditionID 4000 の任意 ConditionDescriptors

4000 (Ungraded) 使用時は ConditionDescriptors は不要だが、出品状態の詳細を追加したい場合:

| Name ID | 表示値 | Value ID |
|---------|--------|---------|
| 40001 | Near Mint or Better | 400010 |
| 40001 | Excellent | 400011 |
| 40001 | Very Good | 400012 |
| 40001 | Poor | 400013 |

→ 今回の実装スコープ外。要件があれば後日追加。

---

## 情報ソース

- [Condition Descriptor IDs for Trading Cards | eBay Developers Program](https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html)
- [ConditionDescriptorType - Trading API Reference](https://developer.ebay.com/DevZone/XML/docs/reference/ebay/types/ConditionDescriptorType.html)
- [AddFixedPriceItem - Trading API Reference](https://developer.ebay.com/devzone/xml/docs/reference/ebay/AddFixedPriceItem.html)
- [2024 Condition Descriptors for eBay Trading Cards - shipscript.com](https://shipscript.com/ebayhelp/sellerhub/example_card_revisions.htm)
- [eBay Connect 2023 PDF: Condition Grading - Trading Cards](https://developer.ebay.com/cms/files/connect-2023/condition_grading_trading_cards.pdf)

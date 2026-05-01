# eBayコンディションエラー (21920350) 調査レポート

**調査日**: 2026-05-01  
**報告クレーム**: 顧客の出品シート 83行目でエラー発生  
**エラー原文**: `ErrorCode: 21920350 / Condition information 3000 does not exists or is not a valid condition for category 183454`  
**ステータス**: 読み取り専用調査（コード変更なし）

---

## サマリー

| 項目 | 内容 |
|------|------|
| **根本原因** | eBay が 2023年にトレカカテゴリの ConditionID 3000 (Used) を廃止したが、bay-auto の同期に使う Metadata API は今も 3000 を有効として返す → API間の不整合 |
| **bay-auto 側の直接原因** | condition_ja_map group O に `"3000": "中古"` が残存 → ユーザーが「中古」を選択すると ConditionID 3000 を送信 → Trading API が拒否 |
| **影響範囲** | カテゴリ 183454/183050/261328（トレカ系全3カテゴリ）で「中古」を選択した全出品・更新 |
| **推奨即時対応** | 選択肢 A + E（顧客案内 + エラー翻訳追加） |
| **推奨中長期対応** | 選択肢 B（ConditionDescriptors 実装）→ 選択肢 C（ebay-db 連携強化） |
| **ebay-db 連携可能性** | 可能だが **Metadata API の不整合問題が先決**（後述） |

---

## Task 1: bay-auto のコンディション設定ロジック

### 1-1. データフロー全体図

```
出品シート「状態」列（日本語表示名）
  ↓  readListingDataFromSheet() [ListingManager.gs:414]
listingData.condition = "中古"
  ↓  resolveConditionIdFromMaster() [ListingManager.gs:643-735]
  │
  ├─ Step1: category_master_EBAY_US シートから
  │         categoryId → condition_group を取得  [行 669-691]
  │         例: 183454 → "O"
  │
  ├─ Step2: condition_ja_map シートから
  │         condition_group → ja_map_json を取得  [行 693-719]
  │         例: "O" → {"2750":"鑑定済み（Graded）","3000":"中古","4000":"未鑑定（Ungraded）"}
  │
  └─ Step3: ja_map_json を value→key で逆引き  [行 721-729]
            "中古" → "3000"
  ↓
conditionId = "3000"
  ↓  AddFixedPriceItem [行 1476 / 1492] または ReviseFixedPriceItem [行 1109 / 1124]
<ConditionID>3000</ConditionID>  ←── eBay Trading API が拒否 → エラー 21920350
```

### 1-2. 確認したコード箇所

| 箇所 | ファイル:行番号 | 内容 |
|------|--------------|------|
| 状態列の読み取り | `ListingManager.gs:414` | `condition: getValueByHeader(rowData, headerMapping, '状態')` |
| ID解決関数 | `ListingManager.gs:643` | `function resolveConditionIdFromMaster(conditionStr, config, categoryId)` |
| 新規出品でのID解決 | `ListingManager.gs:1476` | `conditionId = resolveConditionIdFromMaster(...)` |
| 更新でのID解決 | `ListingManager.gs:1109` | `const conditionId = resolveConditionIdFromMaster(...)` |
| XML送信（更新） | `ListingManager.gs:1124` | `'<ConditionID>' + conditionId + '</ConditionID>'` |
| XML送信（新規） | `ListingManager.gs:1492` | `'<ConditionID>' + conditionId + '</ConditionID>'` |

### 1-3. カテゴリ別分岐の有無

**設計: グループベース動的マッピング（Metadata API 経由）**

- カテゴリ別ハードコードは**なし**
- `category_master_EBAY_US` → `condition_group` → `condition_ja_map` の2段引きで動的に決定
- ただし「動的」とは月次 cron でのキャッシュ更新であり、リアルタイムではない

### 1-4. ConditionDescriptors の実装状況

```
grep 'ConditionDescriptor' ListingManager.gs → 結果ゼロ
```

**ConditionDescriptors（Grader名・Grade値）は一切実装されていない。**  
→ コンディション 2750（Graded）を選択しても、必須の `Professional Grader`・`Grade` が送信されない問題が別途存在する。

---

## Task 2: エラー発生の根本原因

### 確認した実際のデータ（2026-04-10 月次同期）

**category_master_EBAY_US の 183454 行:**
```
condition_group = "O"
conditions_json = [
  {"id": "2750", "name": "Graded"},
  {"id": "3000", "name": "Used"},     ← Metadata API はまだ 3000 を返している
  {"id": "4000", "name": "Ungraded"}
]
```

**condition_ja_map の group O 行:**
```
condition_ids_json = [2750, 3000, 4000]
ja_map_json = {
  "2750": "鑑定済み（Graded）",
  "3000": "中古",          ← ユーザーがこれを選択すると 3000 が送信される
  "4000": "未鑑定（Ungraded）"
}
```

### eBay API 間の重大な不整合

| API | 3000 の扱い | 根拠 |
|-----|------------|------|
| Metadata API (`getItemConditionPolicies`) | **有効として返す** | 2026-04-10 sync でも conditions_json に含まれる |
| Trading API (`AddFixedPriceItem` 等) | **無効として拒否** | エラー 21920350 |

→ **ebay-db の月次同期は正しく動作しているが、Metadata API 自体が古い情報を返している。**  
→ 月次同期を強化するだけでは根本解決にならない。

---

## Task 3: 「83行目のみ」のエラーである理由

83行目のみでエラーが発生し他のトレカ行が通っている理由として以下を推定:

| 仮説 | 可能性 |
|------|--------|
| 83行目だけ「状態」列が「中古」。他行は「鑑定済み（Graded）」または「未鑑定（Ungraded）」を選択している | **最有力** |
| 83行目が今日初めて新規出品を試みた（AddFixedPriceItem）。他行は既存アクティブ出品なので影響なし | 有力 |
| 83行目がカテゴリ 183454 系で唯一 ConditionID 3000 を持つ行 | 有力 |
| 他行も 3000 を持つが ReviseFixedPriceItem ではまだエラーが出ていない | 可能性あり（後述 Task 4） |

**重要**: 既存 Active 出品（ConditionID 3000）への影響は、次回 Revise 時に顕在化する。

---

## Task 4: 影響範囲の評価

### 影響カテゴリ一覧

eBay が条件変更を適用したトレカ 3 カテゴリすべてが condition_group O:

| カテゴリID | カテゴリ名 | eBay パス |
|-----------|-----------|-----------|
| **183454** | CCG Individual Cards | Toys & Hobbies > Collectible Card Games > CCG Individual Cards |
| **183050** | Trading Card Singles (非スポーツ) | Collectibles > Non-Sport Trading Cards > Trading Card Singles |
| **261328** | Trading Card Singles (スポーツ) | Sports Memorabilia > Sports Trading Cards > Trading Card Singles |

→ ポケモン・遊戯王・MTG・スポーツカードすべてが対象。

### 操作別の影響

| 操作 | ConditionID 3000 のまま | 影響 |
|-----|----------------------|------|
| AddFixedPriceItem（新規出品） | エラー 21920350 で即時失敗 | **ブロック** |
| ReviseFixedPriceItem（数量・価格のみ更新でも） | エラー 21920350 | **ブロック** ※bay-auto は常に ConditionID を含めて送信するため |
| RelistFixedPriceItem（終了→再出品） | エラー 21920350 | **ブロック** |
| Active 出品のまま放置 | 表示は継続（eBay はアクティブ出品を即時削除しない） | 低リスク |

### エラー翻訳の現状

`translateEbayError()` (`Validation.gs:119-248`) に **21920350 に対応するパターンはゼロ**。  
→ ユーザーには `・eBayエラー: ErrorCode: 21920350 / Condition information 3000 does not exists...` という生の英語が表示される。

---

## Task 5: 解決選択肢の評価

### 選択肢A: 83行目のみ手動修正

顧客に「状態を『未鑑定（Ungraded）』または『鑑定済み（Graded）』に変更してください」と案内。

| 観点 | 評価 |
|------|------|
| 即時対応 | ✅ 5分 |
| 再発防止 | ❌ |
| 工数 | ゼロ |
| 範囲 | 83行目のみ |

---

### 選択肢B: ConditionDescriptors 実装（Graded 対応）

ConditionID 2750 (Graded) 選択時に Grader・Grade 値を XML に含める機能を追加。

**実装内容**:
1. 出品シートに「グレーディング会社」「グレード値」「証明書番号」列を追加
2. `AddFixedPriceItem` / `ReviseFixedPriceItem` の XML に `<ConditionDescriptors>` ブロックを追加

**Trading API 送信形式**:
```xml
<ConditionID>2750</ConditionID>
<ConditionDescriptors>
  <ConditionDescriptor>
    <Name>27501</Name>   <!-- Professional Grader (必須) -->
    <Value>275010</Value> <!-- 275010=PSA, 275013=BGS, 275016=SGC, 2750123=Other -->
  </ConditionDescriptor>
  <ConditionDescriptor>
    <Name>27502</Name>   <!-- Grade (必須) -->
    <Value>10</Value>    <!-- 1〜10 または Authentic 等 -->
  </ConditionDescriptor>
  <ConditionDescriptor>
    <Name>27503</Name>   <!-- Certification Number (任意) -->
    <AdditionalInfo>A12345</AdditionalInfo>
  </ConditionDescriptor>
</ConditionDescriptors>
```

| 観点 | 評価 |
|------|------|
| 即時対応 | △ 2〜3日 |
| 再発防止 | ✅ Graded 出品の完全化 |
| 工数 | 中（3〜4日） |
| 範囲 | Graded 出品全体 |

---

### 選択肢C: ebay-db + Trading API 二重検証

月次同期に加え、Metadata API が返す条件を Trading API (`GetCategoryFeatures`) で二重チェックする仕組みを追加。

**問題点**: Trading API の `GetCategoryFeatures` は廃止予定。代替は Browse API + Taxonomy API の組み合わせが必要で実装が複雑。

**現実的な代替案**: 
- エラー 21920350 が発生した際に、該当カテゴリの condition_group から 3000 を自動除去する
- `sync_log` に記録し次回 monthly cron で確認

| 観点 | 評価 |
|------|------|
| 即時対応 | ❌ 3〜5日 |
| 再発防止 | ✅ 構造的 |
| 工数 | 大 |
| Metadata API 不整合への対応 | ✅ |

---

### 選択肢D: 出品前バリデーション（GetCategoryFeatures）

廃止予定のため非推奨。

---

### 選択肢E: エラー翻訳追加（translateEbayError 拡張）

`Validation.gs` の `translateEbayError()` にパターンを追加し、21920350 発生時に日本語で対応方法を表示。

**追加するパターン**:
```javascript
{
  pattern: /Condition information \d+ does not exists|21920350|is not a valid condition for category/i,
  handler: function(match) {
    return 'このカテゴリでは「中古（Used）」は使用できません。\n' +
           'eBayは2023年にトレカカテゴリのコンディション仕様を変更しました。\n' +
           '【グレード済みカードの場合】状態列を「鑑定済み（Graded）」に変更してください\n' +
           '【未グレードカードの場合】状態列を「未鑑定（Ungraded）」に変更してください\n' +
           '→ 状態列を修正して再出品してください';
  }
}
```

| 観点 | 評価 |
|------|------|
| 即時対応 | ✅ 数時間 |
| 再発防止 | △ エラー発生時に誘導するのみ |
| 工数 | 小（数時間） |
| 範囲 | 同エラー発生時すべて |

---

## Task 6: 推奨対応

### 即時対応（今日中）

**選択肢 A + E の組み合わせ**

1. **顧客への案内**（選択肢 A）: 83行目の「状態」列を「未鑑定（Ungraded）」に変更するよう案内 → 5分で解決
2. **PR 起票**（選択肢 E）: `translateEbayError()` に 21920350 パターンを追加 → 半日以内

### 短期対応（1週間以内）

**選択肢 B: ConditionDescriptors 実装**

Graded (2750) 選択時に必須項目（Grader・Grade）を入力できるようシートと XML を拡張。  
これにより「鑑定済み（Graded）」の出品が eBay の仕様を完全に満たすようになる。

工数: 3〜4日（シート列追加 + ListingManager.gs 修正 + テスト）

### 中期対応（1ヶ月以内）

**Metadata API 不整合の監視機構**

エラー 21920350 が発生した際に:
1. 該当カテゴリの condition_ja_map エントリを自動的にフラグ
2. 次回 monthly sync で Trading API 側の実際の動作をサンドボックス検証
3. Metadata API の返値と不整合があれば Discord 通知

工数: 5〜7日

---

## Task 7: ebay-db との整合性検討

### 現状

| シート | 構造 | コンディション情報 |
|--------|------|----------------|
| `category_master_EBAY_US` | 15列（categoryId, condition_group, conditions_json 等） | `conditions_json` + `condition_group` で持つ |
| `condition_ja_map` | 7列（condition_group, condition_ids_json, ja_map_json 等） | グループ単位で日本語マップ |

### 問題の本質

ebay-db の設計は正しい。問題は **Metadata API が Trading API と乖離した情報を返している**こと。

月次 cron (`getItemConditionPolicies`) → 2026-04-10 時点でも 3000 を有効として返している  
実際の出品 (`AddFixedPriceItem`) → 2023年10月以降 3000 を拒否

### 拡張提案: `known_invalid_conditions` 列の追加

category_master に `known_invalid_conditions` 列（JSON配列）を追加:

```
column 16: known_invalid_conditions
例: "[3000]"  ← Trading API がエラー返却した実績から自動または手動で記録
```

- 月次 cron は Metadata API の結果を使いつつ、この列でフィルタリング
- エラー 21920350 発生時に `ErrorHandler.gs` が自動更新
- 工数: 2〜3日

---

## Task 8: 顧客向け案内文書素案

```
件名: eBay出品エラーについて（コンディション仕様変更のご案内）

お世話になっております。
出品ツールの83行目でエラーが発生した件についてご連絡します。

━━━━━━━━━━━━━━━━━━━━━━
■ エラーの原因
━━━━━━━━━━━━━━━━━━━━━━
eBayは2023年にトレーディングカードカテゴリのコンディション仕様を変更しました。
従来の「中古（Used）」は使用できなくなり、以下の2つへの変更が必要です。

━━━━━━━━━━━━━━━━━━━━━━
■ 修正方法
━━━━━━━━━━━━━━━━━━━━━━

【グレード済みカード（PSA・BGS・SGC等）の場合】
  状態列: 「中古」→「鑑定済み（Graded）」に変更
  ※ 今後、グレーディング会社名とグレード値も入力できるよう
    ツールを更新予定です（現在は未対応）

【未グレードカードの場合】
  状態列: 「中古」→「未鑑定（Ungraded）」に変更

━━━━━━━━━━━━━━━━━━━━━━
■ 対象となるカテゴリ
━━━━━━━━━━━━━━━━━━━━━━
・ポケモン・遊戯王・MTGなどのカードゲーム個別カード
・スポーツトレーディングカード
・非スポーツ系トレーディングカード

上記カテゴリでは「中古」が使えなくなっています。
他の商品カテゴリ（家電・衣類等）には影響ありません。

ご不明な点があればいつでもご連絡ください。
```

---

## 推奨実装ステップ

```
今日中（2026-05-01）
  [A] 顧客に上記案内文書を送付
  [E] PR起票: translateEbayError() に 21920350 パターン追加

今週中（〜2026-05-08）
  [B] ConditionDescriptors 実装
      - 出品シートに「グレーディング会社」「グレード値」列追加
      - ListingManager.gs で <ConditionDescriptors> XML 構築
      - ConditionDropdown.gs でグレーディング会社のプルダウン設定

来月まで（〜2026-06-01）
  [C改] category_master に known_invalid_conditions 列追加
        Metadata API 不整合の自動検知機構
```

---

## 付録: eBay 仕様変更タイムライン

| 時期 | 内容 |
|------|------|
| 2023年7月 | 新コンディション体系発表・既存出品の自動マイグレーション開始 |
| 2023年10月23日 | API 経由の新規出品で 3000 (Used) が必須化廃止（新規出品不可） |
| 2024年1月22日 | 全アクティブ出品が新体系への更新必須化（未対応は強制終了リスク） |
| 2026-04-10 | bay-auto 月次同期 — Metadata API は依然 3000 を有効として返す |
| 2026-05-01 | 顧客クレーム受領 |

**参考**:
- [eBay Condition Descriptor IDs for Trading Cards](https://developer.ebay.com/api-docs/user-guides/static/mip-user-guide/mip-enum-condition-descriptor-ids-for-trading-cards.html)
- [Community Announcement: Revamp your trading card listings](https://community.ebay.com/t5/Announcements/Revamp-your-trading-card-listings-with-updated-conditions/ba-p/33878006)
- [Error 21920350 コミュニティスレッド](https://community.ebay.com/t5/Traditional-APIs-Selling/Error-Code-21920350-Condition-information-3000-is-not-valid-for/td-p/34307514)

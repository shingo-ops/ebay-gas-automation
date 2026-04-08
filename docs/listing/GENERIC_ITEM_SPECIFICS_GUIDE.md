# 汎用Item Specifics（項目/値ペア形式） - 使い方ガイド

## 概要

Item Specificsを汎用的な「項目1」「値1」「項目2」「値2」...の形式で展開することで、異なるカテゴリの商品が混在していても対応できるようになりました。

---

## 新しい形式

### 従来の形式（カテゴリ固定）

**ヘッダー**: カテゴリごとに固定
```
AD列: Set (必須)
AE列: Game (必須)
AF列: Features
AG列: Character
...
```

**問題点**:
- カテゴリごとにItem Specificsの項目が異なる
- 異なるカテゴリの商品を同じシートで扱えない

---

### 新しい形式（汎用ペア）

**ヘッダー**: 汎用的な項目/値ペア
```
AD列: 項目1
AE列: 値1
AF列: 項目2
AG列: 値2
AH列: 項目3
AI列: 値3
...
```

**メリット**:
- どのカテゴリの商品でも同じヘッダー構造
- 異なるカテゴリの商品を混在できる
- 行ごとに必要な数だけ項目/値ペアを書き込める

---

## データ例

### Pokemon商品（2行目）

| 項目1 | 値1 | 項目2 | 値2 | 項目3 | 値3 | 項目4 | 値4 |
|-------|-----|-------|-----|-------|-----|-------|-----|
| Game | Pokémon TCG | Set | M4 | Configuration | Pack | Character | Charizard, Dragonite, Gengar, Greninja |

→ 9ペアのItem Specifics

---

### Yahoo Auction商品（4行目）

| 項目1 | 値1 | 項目2 | 値2 | 項目3 | 値3 | ... |
|-------|-----|-------|-----|-------|-----|-----|
| Condition | New | Brand | Unbranded | Color | Black | ... |

→ 12ペアのItem Specifics

---

## 使い方

### ステップ1: ヘッダーを展開

**方法1**: メニューから実行
1. 「開発用」シートを開く
2. メニュー「eBay ツール」→「📊 Item Specificsヘッダーを展開」
3. 汎用ヘッダーが追加されます（最大30ペア = 60列）

**方法2**: 自動（初回のみ）
- 「📝 商品タイトルとItem Specificsを展開（選択行）」を2行目で実行すると、自動的にヘッダーが追加されます

---

### ステップ2: Item Specificsを取得

**方法1**: 商品タイトルと一緒に取得（推奨）
1. A列にeBay URLを入力（カテゴリID・カテゴリ名が自動取得される）
2. 対象の行を選択
3. メニュー「eBay ツール」→「📝 商品タイトルとItem Specificsを展開（選択行）」
4. 商品タイトルとItem Specificsが取得されます

**方法2**: Item Specificsのみ取得
1. A列にeBay URLが既に入力されている
2. 対象の行を選択
3. メニュー「eBay ツール」→「📝 Item Specificsを取得（選択行）」
4. Item Specificsのみが取得されます

---

## 技術仕様

### 実装された関数

#### addGenericItemSpecificsHeaders(maxPairs)
**用途**: 汎用Item Specificsヘッダーを追加

**パラメータ**:
- maxPairs: 最大ペア数（デフォルト30）

**戻り値**:
```javascript
{
  success: true,
  addedCount: 60,      // 追加列数（30ペア × 2）
  startColumn: 30,     // AD列
  maxPairs: 30
}
```

**動作**:
1. AD列（30列目）から開始
2. 「項目1」「値1」「項目2」「値2」...のヘッダーを追加
3. 最大30ペア（60列）まで展開

---

#### writeItemSpecificsToDevSheetGeneric(row, ebayData)
**用途**: 汎用形式でItem Specificsを書き込み

**パラメータ**:
- row: 行番号
- ebayData: eBay商品データ（getRawEbayResponseの戻り値）

**戻り値**:
```javascript
{
  success: true,
  writtenPairs: 9,     // 書き込んだペア数
  totalPairs: 9
}
```

**動作**:
1. ebayData.localizedAspectsから項目名と値を取得
2. AD列から順に、項目・値・項目・値...の順で書き込み
3. 例: AD列=Game, AE列=Pokémon TCG, AF列=Set, AG列=M4...

---

## データ構造

### eBay APIレスポンス（localizedAspects）

```javascript
{
  localizedAspects: [
    { name: 'Game', value: 'Pokémon TCG' },
    { name: 'Set', value: 'M4' },
    { name: 'Configuration', value: 'Pack' },
    { name: 'Character', value: 'Charizard, Dragonite, Gengar, Greninja' },
    ...
  ]
}
```

### スプレッドシート書き込み結果

| AD列 | AE列 | AF列 | AG列 | AH列 | AI列 | AJ列 | AK列 |
|------|------|------|------|------|------|------|------|
| 項目1 | 値1 | 項目2 | 値2 | 項目3 | 値3 | 項目4 | 値4 |
| Game | Pokémon TCG | Set | M4 | Configuration | Pack | Character | Charizard, Dragonite, Gengar, Greninja |

---

## テスト結果

### テスト1: 単一商品

```bash
clasp run testGenericItemSpecifics
```

**結果**:
```javascript
{
  success: true,
  headerResult: {
    maxPairs: 30,
    addedCount: 60,
    startColumn: 30
  },
  writeResult: {
    writtenPairs: 9
  },
  sampleData: [
    'Game', 'Pokémon TCG',
    'Set', 'M4',
    'Configuration', 'Pack',
    'Character', 'Charizard, Dragonite, Gengar, Greninja',
    'Language', 'Japanese'
  ]
}
```

---

### テスト2: 複数カテゴリ混在

```bash
clasp run testMultipleCategoriesWithGenericFormat
```

**結果**:
```javascript
{
  success: true,
  results: [
    { row: 2, success: true, pairCount: 9 },   // Pokemon商品
    { row: 3, success: true, pairCount: 9 },   // Pokemon商品
    { row: 4, success: true, pairCount: 12 }   // Yahoo Auction商品
  ]
}
```

→ 異なるカテゴリの商品が混在していても正しく動作 ✓

---

## よくある質問

### Q1: 最大何ペアまで対応できますか？

**A**: デフォルトは30ペア（60列）ですが、必要に応じて変更可能です。

```javascript
// 最大50ペアに変更
addGenericItemSpecificsHeaders(50);
```

---

### Q2: 空の項目/値はどうなりますか？

**A**: eBay商品に設定されているItem Specificsのみが書き込まれます。空のセルは空のままです。

例: 商品Aが5ペア、商品Bが10ペアの場合
- 商品A: AD～AL列まで埋まる（5ペア）
- 商品B: AD～AX列まで埋まる（10ペア）

---

### Q3: 従来の形式（カテゴリ固定）に戻せますか？

**A**: 可能ですが、推奨しません。従来の形式はカテゴリごとに異なるヘッダー構造のため、異なるカテゴリの商品を扱えません。

どうしても戻したい場合は、以下の関数を使用してください：
- `addItemSpecificsHeadersToDevSheet(categoryId)` - カテゴリ固定ヘッダー
- `writeItemSpecificsToDevSheet(row, categoryId, ebayData)` - カテゴリ固定書き込み

---

### Q4: ヘッダーを再生成したい

**A**: メニュー「📊 Item Specificsヘッダーを展開」を実行すると、既存のヘッダーをクリアして再生成します。

---

## 制限事項

1. **最大ペア数**: デフォルト30ペア（変更可能）
2. **開始列固定**: AD列（30列目）から固定
3. **1行につき1商品**: 複数商品のItem Specificsを1行に混在させることはできません

---

## 今後の拡張案

- [ ] 最大ペア数を設定シートから変更可能に
- [ ] Item Specificsの並び順をカスタマイズ可能に
- [ ] 項目名で検索・フィルター機能

---

**実装完了日**: 2026年3月21日
**新規関数**: 2つ（addGenericItemSpecificsHeaders, writeItemSpecificsToDevSheetGeneric）
**修正関数**: 3つ（fetchTitleAndSpecifics, expandItemSpecificsHeadersWithUI, fetchItemSpecificsForSelectedRowWithUI）

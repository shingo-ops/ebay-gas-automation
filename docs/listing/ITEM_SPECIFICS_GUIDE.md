# Item Specifics自動展開機能 - 使い方ガイド

## 概要

カテゴリマスタからItem Specificsを取得し、開発用シートに自動展開する機能です。

eBay商品URLから商品データを取得すると、その商品に設定されているItem Specificsが自動的に該当列に入力されます。

---

## 機能

### 1. カテゴリマスタからItem Specifics取得

カテゴリIDに対応するItem Specificsをカテゴリマスタから取得します。

- **必須項目（Required Aspects）**: 出品時に必ず入力が必要
- **推奨項目（Recommended Aspects）**: 入力推奨（検索性向上）
- **オプション項目**: 含めない（多すぎるため）

### 2. 開発用シートに動的ヘッダー追加

AD列（30列目）以降にItem Specificsのヘッダーが自動追加されます。

**ヘッダー例:**
```
AD列: Set (必須)
AE列: Game (必須)
AF列: Features
AG列: Character
AH列: Manufacturer
...
```

**必須項目**には `(必須)` が付き、背景が**黄色**になります。

### 3. eBay商品データから自動入力

eBay商品URLからデータ取得時、商品に設定されているItem Specificsが自動的に該当列に入力されます。

**入力例:**
| Set (必須) | Game (必須) | Features | Character | Language |
|-----------|-------------|----------|-----------|----------|
| M4 | Pokémon TCG | Booster | Charizard, Dragonite, Gengar, Greninja | Japanese |

---

## 使い方

### パターン1: eBay商品URLから自動取得（推奨）

**ステップ1**: 開発用シートのA列にeBay商品URLを入力

```
https://www.ebay.com/itm/358330727786
```

**ステップ2**: メニューから「商品データ一括取得」を実行

```
スプレッドシートのメニュー:
eBay ツール → 🚀 商品データ一括取得
```

**ステップ3**: 自動で展開される

- B～G列: 基本データ（タイトル、価格、カテゴリIDなど）
- AD列以降: Item Specificsヘッダー・値が自動追加

---

### パターン2: clasp runで実行

```bash
# 開発用シート2行目のURLからデータ取得
clasp run 'fetchAndFillRowData(sheet, 2, url)'

# または既存の関数を使用
clasp run writeItemDataToSheet
```

---

## 内部動作フロー

```
1. eBay URLからデータ取得
   └─ カテゴリID: 183456 (CCG Sealed Packs)
   └─ Item Specifics: 9件取得

2. カテゴリマスタからItem Specifics定義を取得
   └─ カテゴリID: 183456 で検索
   └─ requiredAspects: ["Set", "Game"]
   └─ recommendedAspects: ["Features", "Character", ...]

3. 開発用シートにヘッダー追加（初回のみ）
   └─ AD列: Set (必須)   ← 黄色背景
   └─ AE列: Game (必須)  ← 黄色背景
   └─ AF列: Features
   └─ AG列: Character
   └─ ...

4. eBayデータとマッピング
   └─ eBayのItem Specifics:
       { name: 'Set', value: 'M4' }
       { name: 'Game', value: 'Pokémon TCG' }
       { name: 'Features', value: 'Booster' }
       ...

5. 該当列に値を書き込み
   └─ AD列: M4
   └─ AE列: Pokémon TCG
   └─ AF列: Booster
   └─ ...
```

---

## Item Specifics定義の優先順位

Item Specificsは以下の優先順位で表示されます：

1. **必須項目（Required）** - 黄色背景
2. **推奨項目（Recommended）**
3. ~~オプション項目~~ - 表示しない（多すぎるため）

**理由**: オプション項目は30件以上になることがあり、シートが横に長くなりすぎるため。

---

## カテゴリが変わった場合

**自動更新**: 2行目（最初のデータ行）のカテゴリIDが変わると、ヘッダーが自動更新されます。

**例:**
```
1行目: Pokemon (183456) のItem Specificsで展開
  → Set (必須), Game (必須), Features, Character, ...

別の商品: Sports Cards (261328) に変更
  → 自動的にヘッダーが更新される
  → Player, Team, Year, Brand, ...
```

---

## API関数

### `getItemSpecificsFromCategoryMaster(categoryId)`

カテゴリマスタからItem Specificsを取得します。

**パラメータ:**
- `categoryId` (string): カテゴリID（例: "183456"）

**戻り値:**
```javascript
{
  success: true,
  aspects: [
    { name: 'Set', mode: 'FREE_TEXT', required: true, priority: 1 },
    { name: 'Game', mode: 'FREE_TEXT', required: true, priority: 1 },
    { name: 'Features', mode: 'FREE_TEXT', required: false, priority: 2 },
    ...
  ],
  categoryName: 'CCG Sealed Packs'
}
```

---

### `addItemSpecificsHeadersToDevSheet(categoryId)`

開発用シートにItem Specificsヘッダーを追加します。

**パラメータ:**
- `categoryId` (string): カテゴリID

**戻り値:**
```javascript
{
  success: true,
  addedCount: 13,
  startColumn: 30,  // AD列
  aspects: [...]
}
```

---

### `mapItemSpecificsValues(ebayData, aspects)`

eBay商品データからItem Specificsの値をマッピングします。

**パラメータ:**
- `ebayData` (Object): `getRawEbayResponse()` の戻り値
- `aspects` (Array): Item Specifics定義配列

**戻り値:**
```javascript
['M4', 'Pokémon TCG', 'Booster', 'Charizard, Dragonite, Gengar, Greninja', '', ...]
// aspects配列と同じ順序の値配列
```

---

### `writeItemSpecificsToDevSheet(row, categoryId, ebayData)`

開発用シートにItem Specificsの値を書き込みます。

**パラメータ:**
- `row` (number): 行番号
- `categoryId` (string): カテゴリID
- `ebayData` (Object): eBay商品データ

**戻り値:**
```javascript
{
  success: true,
  writtenCount: 8,   // 値が入った列数
  totalCount: 13     // 全Item Specifics列数
}
```

---

## カテゴリマスタのデータ構造

カテゴリマスタは以下の列で構成されています：

| 列名 | 内容 |
|------|------|
| categoryId | カテゴリID（例: 183456） |
| categoryName | カテゴリ名（例: Trading Card Singles） |
| requiredAspects | 必須Item Specifics（JSON配列） |
| recommendedAspects | 推奨Item Specifics（JSON配列） |
| optionalAspects | オプションItem Specifics（JSON配列） |
| aspectModes | 各アスペクトの入力モード（JSON） |
| aspectValues | 各アスペクトの選択肢（JSON） |
| multiValueAspects | 複数値可能なアスペクト（JSON配列） |

**JSON形式例:**
```json
{
  "requiredAspects": ["Set", "Game"],
  "recommendedAspects": ["Features", "Character", "Manufacturer"],
  "aspectModes": {
    "Set": "FREE_TEXT",
    "Game": "SELECTION_ONLY",
    "Features": "FREE_TEXT"
  }
}
```

---

## トラブルシューティング

### Q1: Item Specificsヘッダーが表示されない

**原因**: カテゴリIDが取得できていない、またはカテゴリマスタにデータがない

**解決法**:
1. F列（カテゴリID）に値が入っているか確認
2. カテゴリマスタシートにそのカテゴリIDが存在するか確認
3. ログを確認: `Logger.log()` の出力を確認

### Q2: 値が一部しか入力されない

**原因**: eBay商品に全てのItem Specificsが設定されていない

**解決法**:
- これは正常な動作です
- eBay商品に設定されているItem Specificsのみが入力されます
- 空の列は手動で入力できます

### Q3: カテゴリが変わってもヘッダーが更新されない

**原因**: 2行目以外のカテゴリIDが変わった場合、自動更新されません

**解決法**:
- 現在の実装では2行目のカテゴリIDのみでヘッダーを決定します
- 別カテゴリの商品を扱う場合は、別のシートを使用することを推奨

---

## 制限事項

1. **オプション項目は展開しない**: 多すぎるため、必須・推奨のみ
2. **複数カテゴリには未対応**: 1シート = 1カテゴリを想定
3. **ヘッダーは2行目基準**: 最初のデータ行のカテゴリIDでヘッダーを決定

---

## 今後の拡張案

- [ ] 複数カテゴリ対応（カテゴリごとにシート分け）
- [ ] オプション項目の表示/非表示切り替え
- [ ] Item Specifics選択肢のドロップダウン化
- [ ] カテゴリマスタの自動更新（最新のItem Specificsを取得）

---

**実装完了日**: 2026年3月21日
**モジュール**: ItemSpecificsManager.js

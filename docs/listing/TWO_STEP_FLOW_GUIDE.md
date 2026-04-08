# 2段階データ取得フロー - 使い方ガイド

## 概要

商品データ取得を2段階に分けることで、処理を軽量化し、ユーザーが必要な情報だけを取得できるようになりました。

---

## 新しい動作フロー

### ステップ1: URL入力時（自動）

**トリガー**: A列にeBay URLを入力

**処理内容**: カテゴリ情報のみを自動取得

**取得データ**:
- F列: カテゴリID
- G列: カテゴリ名（最終階層のみ）

**処理時間**: 約5-10秒（軽量）

**例**:
```
A列: https://www.ebay.com/itm/358330727786
→ 自動的に以下が入力される
F列: 183456
G列: CCG Sealed Packs
```

---

### ステップ2: ボタン押下時（手動）

**トリガー**: メニューから「📝 商品タイトルとItem Specificsを展開（選択行）」を実行

**処理内容**: 商品タイトルとItem Specificsを取得

**取得データ**:
- B列: 商品タイトル
- AD列以降: Item Specificsの値（ヘッダーも自動追加）

**処理時間**: 約10-20秒（詳細データ取得）

**例**:
```
選択行: 2行目
→ 以下が入力される
B列: 「US SELLER」 Pokemon - Ninja Spinner - Japanese Booster Pack - Sealed - M4
AD列: M4
AE列: Pokémon TCG
AF列: Booster
...
```

---

## 使い方

### パターン1: 基本的な使い方

1. **A列にeBay URLを入力**
   ```
   https://www.ebay.com/itm/358330727786
   ```
   → 自動的にカテゴリID、カテゴリ名が取得されます（F列、G列）

2. **必要な行でメニューから実行**
   - 対象の行を選択
   - メニュー「eBay ツール」→「📝 商品タイトルとItem Specificsを展開（選択行）」
   → 商品タイトルとItem Specificsが取得されます

---

### パターン2: カテゴリ確認だけしたい場合

1. A列にeBay URLを入力
2. F列、G列でカテゴリを確認
3. 不要な商品はスキップ（ステップ2を実行しない）

**メリット**: 不要な商品の詳細データを取得しないため、時間とAPIコール数を節約できます

---

### パターン3: 一括でタイトルとItem Specificsを取得

1. A列に複数のeBay URLを入力（各行）
   ```
   A2: https://www.ebay.com/itm/358330727786
   A3: https://www.ebay.com/itm/123456789012
   A4: https://www.ebay.com/itm/987654321098
   ```
   → 全行でカテゴリID、カテゴリ名が自動取得されます

2. 各行を選択して、メニューから実行
   - 2行目を選択 → メニュー実行
   - 3行目を選択 → メニュー実行
   - 4行目を選択 → メニュー実行

**注意**: 現在は一括実行機能はありません。将来的に追加予定です。

---

## 従来との違い

### 従来（1段階フロー）

```
A列にURL入力
↓
全データを一度に取得
- 商品タイトル ✓
- 価格 ✓
- 送料 ✓
- 配送方法 ✓
- カテゴリID ✓
- カテゴリ名 ✓
- Item Specifics ✓
↓
処理時間: 約20-30秒
```

### 新しい仕様（2段階フロー）

```
【ステップ1】A列にURL入力
↓
カテゴリ情報のみ取得
- カテゴリID ✓
- カテゴリ名 ✓
↓
処理時間: 約5-10秒（軽量！）

↓（必要な場合のみ実行）

【ステップ2】ボタン押下
↓
詳細データを取得
- 商品タイトル ✓
- Item Specifics ✓
↓
処理時間: 約10-20秒
```

---

## メリット

### 1. 処理の高速化

カテゴリ確認だけなら約5-10秒で完了（従来の1/4の時間）

### 2. APIコール数の削減

不要な商品の詳細データを取得しないため、eBay APIの制限に引っかかりにくくなります

### 3. 柔軟な運用

必要な商品だけ詳細データを取得できる

---

## トリガー設定

2段階フローを使用するには、トリガーを設定する必要があります。

### トリガー設定手順

1. スプレッドシートのメニュー「⚙️ 初期設定」→「🔧 トリガー設定（A列URL自動取得）」
2. 確認ダイアログで「はい」を選択
3. 権限の承認を求められた場合は承認してください

### トリガーの確認

メニュー「⚙️ 初期設定」→「📋 トリガー確認」で設定状態を確認できます

---

## よくある質問

### Q1: ステップ1でカテゴリ情報が取得されない

**原因**:
- トリガーが設定されていない
- eBay URLが間違っている
- ネットワークエラー

**対処法**:
1. トリガー確認: メニュー「⚙️ 初期設定」→「📋 トリガー確認」
2. URLを確認: `https://www.ebay.com/itm/` で始まるURLか確認
3. 手動で実行してみる（テスト用の関数を実行）

---

### Q2: ステップ2で「カテゴリIDがありません」エラー

**原因**: ステップ1が完了していない

**対処法**:
1. F列（カテゴリID）に値が入っているか確認
2. ステップ1が完了するまで待つ
3. もしくは手動でカテゴリIDを入力

---

### Q3: 従来の1段階フローに戻したい

**方法**:
1. コード.jsの`onEditInstallableWithSpecifics`関数を修正
2. `fetchCategoryInfoOnly`を`fetchAndFillRowDataWithSpecifics`に戻す

**または**:
- メニュー「🚀 商品データ一括取得」を使用（従来通りの一括取得）

---

## 技術仕様

### 実装された関数

#### fetchCategoryInfoOnly(sheet, row, url)
**用途**: カテゴリ情報のみを取得

**パラメータ**:
- sheet: シートオブジェクト
- row: 行番号
- url: eBay URL

**戻り値**:
```javascript
{
  success: true,
  categoryId: '183456',
  categoryName: 'CCG Sealed Packs'
}
```

---

#### fetchTitleAndSpecifics(sheet, row)
**用途**: 商品タイトルとItem Specificsを取得

**パラメータ**:
- sheet: シートオブジェクト
- row: 行番号

**戻り値**:
```javascript
{
  success: true,
  title: '「US SELLER」 Pokemon - Ninja Spinner...',
  specificsWritten: 8,
  specificsTotal: 13
}
```

---

#### fetchTitleAndSpecificsForSelectedRowWithUI()
**用途**: UI wrapper（メニューから実行）

**動作**:
1. 開発用シートかチェック
2. 選択行のカテゴリIDとURLを取得
3. `fetchTitleAndSpecifics`を呼び出し
4. 完了ダイアログを表示

---

### トリガー処理

#### onEditInstallableWithSpecifics(e)
**トリガー**: A列編集時

**動作**:
1. A列（col=1）が編集されたか確認
2. eBay URLか確認
3. `fetchCategoryInfoOnly`を呼び出し

---

## テスト方法

### テスト1: トリガーシミュレーション

```bash
clasp run testOnEditTriggerSimulation
```

**期待される結果**:
```javascript
{
  success: true,
  result: {
    success: true,
    categoryId: '183456',
    categoryName: 'CCG Sealed Packs'
  },
  verified: {
    categoryIdFilled: true,
    categoryNameFilled: true,
    titleEmpty: true  // ステップ1後は商品タイトルが空
  }
}
```

---

### テスト2: 2段階フロー全体

```bash
clasp run testTwoStepFlow
```

**期待される結果**:
```javascript
{
  success: true,
  step1: {
    categoryId: '183456',
    categoryName: 'CCG Sealed Packs'
  },
  step2: {
    title: '「US SELLER」 Pokemon - Ninja Spinner...',
    specificsWritten: 8,
    specificsTotal: 13
  },
  verification: {
    titleEmptyAfterStep1: true,   // ステップ1後は空
    titleFilledAfterStep2: true   // ステップ2後は入力済み
  }
}
```

---

## 今後の拡張案

- [ ] 複数行の一括処理（選択範囲のすべての行でステップ2を実行）
- [ ] カテゴリフィルター機能（特定のカテゴリのみステップ2を実行）
- [ ] 処理状況の可視化（プログレスバー表示）

---

**実装完了日**: 2026年3月21日
**新規関数**: 3つ（fetchCategoryInfoOnly, fetchTitleAndSpecifics, fetchTitleAndSpecificsForSelectedRowWithUI）
**修正関数**: 1つ（onEditInstallableWithSpecifics）

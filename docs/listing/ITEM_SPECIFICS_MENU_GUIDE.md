# Item Specifics メニュー機能 - 使い方ガイド

## 概要

Item Specificsを独立して実行できる2つのメニュー機能が追加されました。

---

## メニュー項目

### 📊 Item Specificsヘッダーを展開

**用途**: カテゴリマスタから現在のカテゴリIDに対応するItem Specificsのヘッダーを開発用シートに追加します。

**実行手順**:

1. 「開発用」シートを開く
2. メニューから「eBay ツール」→「📊 Item Specificsヘッダーを展開」を選択
3. 完了ダイアログが表示されます

**必要条件**:
- 「開発用」シートであること
- 2行目にカテゴリIDが入力されていること（先に商品データを取得する必要があります）

**結果**:
- AD列（30列目）以降にItem Specificsヘッダーが追加されます
- 必須項目には「(必須)」が付き、黄色背景になります
- 完了ダイアログに追加された列数と範囲が表示されます

**例**:
```
カテゴリID: 183456 (CCG Sealed Packs)
→ AD列: Set (必須)
→ AE列: Game (必須)
→ AF列: Features
→ AG列: Character
...
追加数: 13件
範囲: AD列 ～ AP列
```

---

### 📝 Item Specificsを取得（選択行）

**用途**: 選択した行のeBay URLから商品データを取得し、Item Specificsの値を該当列に書き込みます。

**実行手順**:

1. 「開発用」シートを開く
2. データを取得したい行を選択（A列にeBay URLが必要）
3. メニューから「eBay ツール」→「📝 Item Specificsを取得（選択行）」を選択
4. 処理中ダイアログが表示されます
5. 完了ダイアログに入力された値の数が表示されます

**必要条件**:
- 「開発用」シートであること
- ヘッダー行以外のデータ行を選択していること
- A列にeBay URLが入力されていること
- カテゴリIDが既に取得されていること（先に商品データを取得している必要があります）

**結果**:
- AD列以降にItem Specificsの値が入力されます
- eBay商品に設定されているItem Specificsのみが入力されます（空欄もあります）
- 完了ダイアログに入力済み/全体の件数が表示されます

**例**:
```
選択行: 2行目
eBay URL: https://www.ebay.com/itm/358330727786
→ AD列: M4
→ AE列: Pokémon TCG
→ AF列: Booster
→ AG列: Charizard, Dragonite, Gengar, Greninja
...
入力済み: 8/13件
```

---

## 使用シナリオ

### シナリオ1: 初めてItem Specificsを使う場合

1. 「🚀 商品データ一括取得」で基本データを取得
   - これによりカテゴリIDが自動取得されます
   - Item Specificsヘッダーも自動展開されます
   - Item Specificsの値も自動入力されます

**この場合、メニューから独立実行する必要はありません。**

---

### シナリオ2: ヘッダーだけを再展開したい場合

1. 「📊 Item Specificsヘッダーを展開」を実行
   - 例: カテゴリが変わった場合
   - 例: ヘッダーを間違って削除してしまった場合

---

### シナリオ3: 特定の行だけItem Specificsを取得したい場合

1. 対象の行を選択
2. 「📝 Item Specificsを取得（選択行）」を実行
   - 例: 既存データに後からItem Specificsを追加したい場合
   - 例: Item Specificsだけを再取得したい場合

---

### シナリオ4: Item Specificsなしで基本データのみ取得したい場合

1. ItemSpecificsManager.jsの該当部分をコメントアウト
2. または、コード.jsの`fetchAndFillRowData()`内のItem Specifics処理をコメントアウト

**ただし、通常はこのシナリオは不要です。**

---

## エラーメッセージと対処法

### 「開発用」シートでこの機能を実行してください

**原因**: 開発用シート以外で実行しています

**対処法**: 「開発用」シートタブをクリックしてから再実行してください

---

### カテゴリIDが見つかりません

**原因**: 2行目にカテゴリIDが入力されていません

**対処法**: 先に「🚀 商品データ一括取得」を実行するか、手動でカテゴリIDを入力してください

---

### ヘッダー行ではなく、データ行を選択してください

**原因**: 1行目（ヘッダー行）を選択しています

**対処法**: 2行目以降のデータ行を選択してください

---

### A列にeBay URLがありません

**原因**: 選択した行のA列にeBay URLが入力されていません

**対処法**: A列にeBay商品URLを入力してから再実行してください

---

### eBayデータの取得に失敗しました

**原因**:
- URLが間違っている
- ネットワークエラー
- eBay APIエラー

**対処法**:
1. URLが正しいか確認してください
2. インターネット接続を確認してください
3. しばらく待ってから再試行してください

---

## 内部動作フロー

### 📊 Item Specificsヘッダーを展開

```
1. 開発用シートかチェック
2. 2行目のカテゴリIDを取得
3. カテゴリマスタからItem Specifics定義を取得
4. AD列以降にヘッダーを書き込み
5. 必須項目に黄色背景を設定
6. 完了ダイアログを表示
```

### 📝 Item Specificsを取得（選択行）

```
1. 開発用シートかチェック
2. 選択行のカテゴリIDとeBay URLを取得
3. eBay APIから商品データを取得
4. localizedAspectsを抽出
5. カテゴリマスタのItem Specifics定義と照合
6. AD列以降に値を書き込み
7. 完了ダイアログを表示
```

---

## 技術仕様

### 関数定義

**columnToLetter(colNum)**
- 列番号をアルファベットに変換
- 例: 30 → "AD"

**expandItemSpecificsHeadersWithUI()**
- UI wrapper for `addItemSpecificsHeadersToDevSheet()`
- エラーハンドリングとダイアログ表示を追加

**fetchItemSpecificsForSelectedRowWithUI()**
- UI wrapper for `writeItemSpecificsToDevSheet()`
- エラーハンドリングとダイアログ表示を追加

### 依存関係

- Config.js: シート・列マッピング
- ItemSpecificsManager.js: Item Specifics処理ロジック
- コード.js: eBayデータ取得ロジック

---

## テスト方法

### clasp runでテスト

```bash
# UI機能のフローテスト
clasp run testItemSpecificsUIFlow

# 期待される結果:
# {
#   success: true,
#   categoryId: "183456",
#   aspectsCount: 13,
#   requiredCount: 2,
#   recommendedCount: 11,
#   headersExpanded: true,
#   lastColumn: 42
# }
```

### 手動テスト

1. スプレッドシートを開く
2. 「開発用」シートに移動
3. メニューから各機能を実行
4. 結果を確認

---

## まとめ

- **📊 Item Specificsヘッダーを展開**: カテゴリIDからヘッダーを生成
- **📝 Item Specificsを取得（選択行）**: eBay URLから値を取得

通常は「🚀 商品データ一括取得」ですべて自動実行されますが、独立して実行したい場合に便利です。

---

**実装完了日**: 2026年3月21日
**追加関数**: 3つ（columnToLetter, expandItemSpecificsHeadersWithUI, fetchItemSpecificsForSelectedRowWithUI）

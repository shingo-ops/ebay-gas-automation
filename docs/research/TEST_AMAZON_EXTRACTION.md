# Amazon画像抽出 - テスト実行ガイド

**作成日**: 2026年3月30日
**目的**: Amazon画像抽出機能の動作確認

---

## テスト方法

### 方法1: Apps Scriptエディタで実行（推奨）

#### 手順

1. **Google Spreadsheetを開く**
   - リサーチシートを含むスプレッドシートを開く

2. **Apps Scriptエディタを開く**
   - メニュー: `拡張機能` → `Apps Script`

3. **テスト関数を選択**
   - 関数ドロップダウンから `testAmazonImageExtraction` を選択

4. **実行**
   - ▶️ 実行ボタンをクリック

5. **結果確認**
   - アラートダイアログで簡易結果を表示
   - 詳細ログ: `表示` → `ログ` で確認

#### テストURL

テスト関数は以下の順でURLを探します：

1. **リサーチシートG11セル（画像URL）**
   - Amazon URLが入力されていれば使用

2. **リサーチシートF11セル（仕入元URL①）**
   - 画像URLが空の場合に使用

3. **デフォルトURL**
   - 上記がどちらも空またはAmazon URLでない場合

#### リサーチシートにAmazon URLを入力してテスト

```
1. リサーチシートを開く
2. G11セルにAmazon商品URLを入力
   例: https://www.amazon.co.jp/dp/B0BNBXYZ12
3. Apps Scriptエディタで testAmazonImageExtraction() を実行
```

---

### 方法2: カスタムURLで実行

特定のAmazon商品URLでテストしたい場合

#### 手順

1. **Apps Scriptエディタを開く**

2. **関数を選択**: `testAmazonImageExtractionWithUrl`

3. **パラメータを編集**
   - エディタ上部の「実行」の横にある「▼」をクリック
   - 「パラメータを編集」を選択
   - URLを入力: `https://www.amazon.co.jp/dp/XXXXXXX`

4. **実行**

#### または、スクリプトエディタで直接実行

Apps Scriptエディタの下部（実行ログエリア）に以下を入力して実行：

```javascript
testAmazonImageExtractionWithUrl('https://www.amazon.co.jp/dp/B0BNBXYZ12')
```

---

## テスト対象商品の例

### 日本のAmazon
```
https://www.amazon.co.jp/dp/B0BNBXYZ12
https://www.amazon.co.jp/dp/B09XYZ1234
```

### 米国のAmazon
```
https://www.amazon.com/dp/B09XYZ1234
```

**注意**: 実際に存在する商品URLを使用してください

---

## 期待される結果

### 成功時

#### アラートダイアログ
```
Amazon画像抽出テスト成功

抽出した画像数: 4枚

詳細はログを確認してください
（表示 > ログ）
```

#### ログ出力例
```
=== Amazon画像抽出テスト開始 ===

テスト対象URL: https://www.amazon.co.jp/dp/B0BNBXYZ12

📦 Amazon商品ページから画像を抽出中...
HTML取得完了: 234567 バイト
🔍 colorImages オブジェクトから画像を抽出中...
  ✓ 画像1: https://m.media-amazon.com/images/I/61X1xcYYFCL._AC_SL1088_.jpg
  ✓ 画像2: https://m.media-amazon.com/images/I/81-wqB4wYLL._AC_SL1500_.jpg
  ✓ 画像3: https://m.media-amazon.com/images/I/41bT6PttG0L._AC_.jpg
  ✓ 画像4: https://m.media-amazon.com/images/I/519gsqUIJIL._AC_.jpg
✅ colorImagesから 4枚の画像を検出

=== テスト結果 ===
抽出した画像数: 4枚

✅ 画像抽出成功

--- 取得した画像URL一覧 ---
画像1: https://m.media-amazon.com/images/I/61X1xcYYFCL._AC_SL1088_.jpg
画像2: https://m.media-amazon.com/images/I/81-wqB4wYLL._AC_SL1500_.jpg
画像3: https://m.media-amazon.com/images/I/41bT6PttG0L._AC_.jpg
画像4: https://m.media-amazon.com/images/I/519gsqUIJIL._AC_.jpg

=== テスト完了 ===
```

---

### 失敗時

#### アラートダイアログ
```
Amazon画像抽出テスト失敗

画像を抽出できませんでした

ログでエラー詳細を確認してください
（表示 > ログ）
```

#### ログ出力例
```
=== Amazon画像抽出テスト開始 ===

テスト対象URL: https://www.amazon.co.jp/dp/INVALID

📦 Amazon商品ページから画像を抽出中...
HTTP 404: ページ取得失敗

=== テスト結果 ===
抽出した画像数: 0枚

❌ 画像を抽出できませんでした

確認事項:
1. URLが正しいAmazon商品ページか確認
2. 商品ページが存在するか確認
3. ネットワーク接続を確認

=== テスト完了 ===
```

---

## トラブルシューティング

### 1. 画像が0枚の場合

#### 原因
- URLが無効
- 商品ページが存在しない
- Amazonのページ構造が変更された

#### 対処法
```
1. ブラウザでURLを開いて商品ページが表示されるか確認
2. 別のAmazon商品URLで試す
3. ログで詳細エラーを確認
```

### 2. HTTP 403エラー

#### 原因
- Amazonがボット判定している可能性

#### 対処法
```
1. しばらく待ってから再実行
2. User-Agentヘッダーが適切か確認（ProductImageFetcher.gs:198行目）
```

### 3. JSON解析エラー

#### 原因
- colorImagesデータの構造が想定と異なる

#### 対処法
```
1. ログでエラー詳細を確認
2. 他の抽出方法（data-a-dynamic-image、data-old-hires）にフォールバック
3. HTMLを直接確認して構造の変更をチェック
```

---

## 確認ポイント

### ✅ 正常動作の確認

- [ ] 画像が4枚以上取得できる
- [ ] 高解像度画像（1500px以上）が含まれる
- [ ] 画像URLがすべて `https://m.media-amazon.com/` で始まる
- [ ] アラートに成功メッセージが表示される

### ✅ 抽出方法の確認

ログで以下のいずれかが出力されていればOK：

- [ ] `✅ colorImagesから X枚の画像を検出`
- [ ] `✅ data-a-dynamic-imageから X枚の画像を検出`
- [ ] `✅ data-old-hiresから X枚の画像を検出`
- [ ] `✅ imgタグから X枚の画像を検出`

---

## 次のステップ

### テスト成功後

1. **実際の出品フローでテスト**
   - リサーチシートにAmazon URLを入力
   - 出品ボタンをクリック
   - 画像が自動的にGoogleドライブに保存されるか確認

2. **複数の商品でテスト**
   - 異なるカテゴリの商品
   - 画像枚数が異なる商品
   - 日本と米国のAmazon

3. **エラーハンドリングの確認**
   - 無効なURLでエラーが適切に処理されるか
   - ネットワークエラー時の挙動

---

**テスト実施者**: _____________
**テスト日**: _____________
**結果**: [ ] 成功 / [ ] 失敗
**備考**: _____________

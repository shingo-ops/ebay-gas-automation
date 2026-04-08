# Amazon画像自動取得 - Chrome拡張機能ガイド

**作成日**: 2026年4月1日
**目的**: スプレッドシートから完全自動でAmazon画像を取得
**方式**: Chrome拡張機能 + GAS連携

---

## なぜChrome拡張機能が必要か？

### AmazonのBot判定

| アクセス方法 | 取得できるHTML | 理由 |
|-------------|--------------|------|
| **ブラウザ** | 2,495 KB ✅ | 正常なユーザー |
| **GAS直接** | 6 KB ❌ | Bot判定される |

**原因**: AmazonはTLSフィンガープリントとJavaScript実行能力でBot検出を行います。
**解決策**: ブラウザ（Chrome拡張機能）経由で画像URLを取得し、GASに送信します。

---

## アーキテクチャ

```
スプレッドシート（URL一覧）
  ↓ メニュー「画像取得」→「Amazon画像自動取得」
GAS Sidebar（HtmlService）
  ↓ chrome.runtime.sendMessage
Chrome拡張機能（Background Script）
  ↓ chrome.tabs.create（バックグラウンドでAmazonページを開く）
Content Script（Amazonページに自動注入）
  ↓ 画像URL抽出（colorImages, data-a-dynamic-image, data-old-hires, imgタグ）
Background Script
  ↓ chrome.runtime.sendMessage
GAS Sidebar
  ↓ google.script.run
GAS本体
  ↓
Google Drive保存 ✅
```

---

## セットアップ手順

### ステップ1: Chrome拡張機能をインストール

#### 1-1. プロジェクトフォルダを確認

プロジェクトルートに `amazon-image-extractor-extension` フォルダがあることを確認：

```
02_apps/ebay-profit-calculator/
├── amazon-image-extractor-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── popup.js
├── AmazonSidebar.html
├── AmazonSidebarCode.gs
└── ...
```

#### 1-2. Chromeで拡張機能をロード

1. Chromeブラウザを開く
2. アドレスバーに `chrome://extensions/` と入力してEnter
3. 右上の「デベロッパーモード」をONにする
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
5. `amazon-image-extractor-extension` フォルダを選択
6. 「フォルダーの選択」をクリック

#### 1-3. 拡張機能が読み込まれたことを確認

- 拡張機能一覧に「Amazon Image Extractor for eBay Profit Calculator」が表示される
- 拡張機能のIDが表示される（例: `abcdefghijklmnopqrstuvwxyz123456`）

---

### ステップ2: 拡張機能IDをコピー

#### 2-1. ポップアップを開く

1. Chromeの拡張機能アイコン（パズルのアイコン）をクリック
2. 「Amazon Image Extractor」をクリック
3. ポップアップウィンドウが開く

#### 2-2. 拡張機能IDをコピー

1. ポップアップ内に「拡張機能ID」が表示されている
2. 「📋 IDをコピー」ボタンをクリック
3. クリップボードにコピーされる

---

### ステップ3: GASコードをデプロイ

#### 3-1. Apps Scriptエディタを開く

1. スプレッドシートを開く
2. メニュー: `拡張機能` → `Apps Script`

#### 3-2. ファイルの確認

左側のファイル一覧に以下が存在することを確認：
- `AmazonSidebarCode.gs`
- `AmazonSidebar.html`

#### 3-3. デプロイ

`clasp push` を実行してデプロイ：

```bash
clasp push
```

または、Apps Scriptエディタで手動でコードを追加してください。

---

### ステップ4: スプレッドシートで実行

#### 4-1. サイドバーを開く

1. スプレッドシートに戻る
2. メニュー: `画像取得` → `🖼️ Amazon画像自動取得`
3. サイドバーが右側に表示される

#### 4-2. 拡張機能IDを設定

1. サイドバーの「Chrome拡張機能ID」入力欄に、ステップ2でコピーしたIDを貼り付け
2. 担当者名を入力（オプション、ファイル名に使用されます）
3. 「🔌 拡張機能の接続テスト」ボタンをクリック
4. `✅ 接続成功！` と表示されることを確認

#### 4-3. 実行

1. リサーチシートの「仕入元URL①」または「画像URL」にAmazon URLが入力されていることを確認
2. 「▶ 実行開始」ボタンをクリック
3. 自動的に処理が開始される

---

## 使い方

### 日常の作業フロー

1. **リサーチシートにAmazon URLを入力**
   - 仕入元URL①（F列）または画像URL（G列）にAmazon商品URLを入力
   - 例: `https://www.amazon.co.jp/dp/B0BNBXYZ12`

2. **サイドバーを開く**
   - メニュー: `画像取得` → `🖼️ Amazon画像自動取得`

3. **実行開始**
   - 拡張機能IDが既に入力されていることを確認（初回のみ設定）
   - 「▶ 実行開始」ボタンをクリック

4. **処理の進行を確認**
   - サイドバーに進捗状況が表示される
   - 各URLの処理状況がログに表示される

5. **完了**
   - `🎉 完了！ X件処理しました` と表示される
   - Googleドライブの画像フォルダに画像が保存されている

---

## 動作の流れ（詳細）

### 1. URL取得
```
GAS → スプレッドシートのリサーチシートから Amazon URLを取得
```

### 2. 画像抽出（各URL毎）
```
GAS Sidebar → chrome.runtime.sendMessage → Chrome拡張機能
             ↓
Chrome拡張機能 → chrome.tabs.create（Amazonページを開く）
             ↓
Content Script → 画像URL抽出:
  ① colorImages JavaScriptオブジェクト
  ② data-a-dynamic-image属性
  ③ data-old-hires属性
  ④ imgタグ + 高解像度変換
             ↓
Background Script → GAS Sidebarに結果を返す
```

### 3. Drive保存
```
GAS Sidebar → google.script.run → GAS本体
           ↓
GAS本体 → UrlFetchApp.fetch（画像ダウンロード）
       ↓
       DriveApp（Googleドライブに保存）
```

---

## トラブルシューティング

### 1. 拡張機能が見つからない

**症状**: `chrome://extensions/` に表示されない

**対処法**:
1. 「デベロッパーモード」がONになっているか確認
2. 「パッケージ化されていない拡張機能を読み込む」で正しいフォルダを選択したか確認
3. `manifest.json` が存在するか確認

### 2. 接続テスト失敗

**症状**: `❌ 接続失敗: Could not establish connection`

**対処法**:
1. 拡張機能IDが正しくコピーされているか確認
2. 拡張機能が有効になっているか `chrome://extensions/` で確認
3. Chromeブラウザを再起動

### 3. 画像が取得できない

**症状**: `❌ 画像抽出失敗` または `⚠️ 画像が見つかりませんでした`

**対処法**:
1. Amazon URLが正しいか確認（商品ページであること）
2. ブラウザでAmazon URLを開いて、画像が表示されるか確認
3. Chrome拡張機能のコンソールでエラーを確認:
   - `chrome://extensions/` → 「Amazon Image Extractor」 → 「背景ページを検証」

### 4. Drive保存失敗

**症状**: `❌ Drive保存失敗`

**対処法**:
1. ツール設定シートの「画像フォルダURL」が正しいか確認
2. Googleドライブのアクセス権限を確認
3. Apps Scriptのログを確認: `表示` → `ログ`

### 5. タイムアウトエラー

**症状**: `Timeout: ページの読み込みに時間がかかりすぎています`

**対処法**:
1. インターネット接続を確認
2. Amazon側のサーバーが正常か確認
3. background.jsの `timeout` 値を増やす（デフォルト: 30秒）

---

## Chrome拡張機能のテスト

### ポップアップでのテスト

1. Amazon商品ページを開く
2. Chrome拡張機能のアイコンをクリック
3. 「🧪 現在のページで画像抽出テスト」ボタンをクリック
4. 抽出結果が表示される

### デベロッパーツールでのデバッグ

#### Content Scriptのデバッグ

1. Amazon商品ページを開く
2. F12キーでデベロッパーツールを開く
3. Console タブで `[Amazon Image Extractor]` のログを確認

#### Background Scriptのデバッグ

1. `chrome://extensions/` を開く
2. 「Amazon Image Extractor」の「背景ページを検証」をクリック
3. デベロッパーツールが開く
4. Console タブでログを確認

---

## 高度な設定

### manifest.jsonの編集

拡張機能の動作をカスタマイズする場合：

#### タイムアウト時間の変更

`background.js` の 82行目:

```javascript
const timeout = 30000; // 30秒 → 60000（60秒）に変更
```

#### 対象ドメインの追加

`manifest.json` の `host_permissions`:

```json
"host_permissions": [
  "https://*.amazon.co.jp/*",
  "https://*.amazon.com/*",
  "https://*.amazon.de/*",  // ドイツ追加
  "https://*.amazon.fr/*"   // フランス追加
]
```

---

## よくある質問

### Q1: Chrome以外のブラウザで使えますか？

**A**: いいえ、Chrome拡張機能はChromeブラウザ専用です。Edge（Chromiumベース）では動作する可能性がありますが、未検証です。

### Q2: 拡張機能は安全ですか？

**A**: はい。コードは公開されており、ローカルで動作します。外部サーバーにデータを送信することはありません。GAS（自分のGoogleアカウント）にのみデータを送信します。

### Q3: スマートフォンでも使えますか？

**A**: いいえ、Chrome拡張機能はPC専用です。

### Q4: 複数人で使う場合は？

**A**: 各ユーザーがそれぞれのChromeブラウザに拡張機能をインストールする必要があります。拡張機能IDは同じものを使用できます。

### Q5: 拡張機能を削除するには？

**A**: `chrome://extensions/` で「削除」ボタンをクリックしてください。

---

## まとめ

### メリット

✅ スプレッドシート完全連携（ボタン1クリックで全自動）
✅ AmazonのBot判定を回避（ブラウザ経由で取得）
✅ 複数URL対応（一括処理可能）
✅ Googleドライブに自動保存
✅ 進捗状況をリアルタイム表示

### デメリット

❌ Chrome拡張機能のインストールが必要（初回のみ）
❌ Chrome専用（他のブラウザでは動作しない）

---

**作成者**: Claude Sonnet 4.5
**最終更新**: 2026年4月1日
**バージョン**: 1.0.0


# Amazon画像取得 - ブックマークレット設定ガイド

**作成日**: 2026年3月30日
**目的**: ブラウザ側でAmazon画像URLを取得し、GASに自動送信

---

## なぜブックマークレットが必要か？

### GASから直接Amazonにアクセスできない理由

| 判定項目 | ブラウザ | GAS |
|---------|---------|-----|
| JavaScript実行 | ✅ 可能 | ❌ 不可能 |
| Cookieセッション | ✅ あり | ❌ なし |
| TLSフィンガープリント | ✅ Chrome固有 | ❌ Java/GAS固有 |
| **返るHTML** | **2,495 KB（正常）** | **6 KB（a-no-jsブロックページ）** |

**結論**: AmazonはTLSハンドシェイクとJS実行の有無でBotを判定するため、**ヘッダー偽装では回避不可能**

---

## 解決策: ブラウザ→GASの逆転アーキテクチャ

```
従来（失敗）: GAS → Amazon ❌
              └─ Bot判定される

新方式（成功）: ブラウザ → Amazon ✅（正常なHTMLを取得）
                └─ GAS ✅（画像をDriveに保存）
```

---

## セットアップ手順

### ステップ1: GAS WebAppをデプロイ

#### 1-1. Apps Scriptエディタを開く
- スプレッドシート → `拡張機能` → `Apps Script`

#### 1-2. AmazonWebApp.gsを確認
- 左側のファイル一覧に `AmazonWebApp.gs` があるか確認

#### 1-3. デプロイ
1. 右上の「デプロイ」→「新しいデプロイ」をクリック
2. 種類を選択: ⚙️ → 「ウェブアプリ」を選択
3. 設定:
   - **説明**: Amazon画像受信WebApp
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 全員
4. 「デプロイ」をクリック
5. **WebアプリのURLをコピー**（次のステップで使用）

#### 1-4. WebApp URLを取得
または、Apps Scriptエディタで以下を実行:
```javascript
getWebAppUrl()
```
アラートに表示されるURLをコピー

---

### ステップ2: ブックマークレットを作成

#### 2-1. 以下のコードをコピー

```javascript
javascript:(function(){
  // 画像URL収集
  const urls = [];

  // 方法1: scriptタグ内の"hiRes"キー
  const scripts = document.querySelectorAll('script:not([src])');
  scripts.forEach(s => {
    for(const m of s.textContent.matchAll(/"hiRes"\s*:\s*"(https?:[^"]+)"/g)) {
      if(!urls.includes(m[1])) urls.push(m[1]);
    }
  });

  // 方法2: data-old-hires属性
  document.querySelectorAll('img[data-old-hires]').forEach(img => {
    const u = img.getAttribute('data-old-hires');
    if(u && !urls.includes(u)) urls.push(u);
  });

  // 方法3: data-a-dynamic-image属性
  document.querySelectorAll('img[data-a-dynamic-image]').forEach(img => {
    const attrValue = img.getAttribute('data-a-dynamic-image');
    if(attrValue) {
      try {
        const obj = JSON.parse(attrValue);
        Object.keys(obj).forEach(url => {
          if(!urls.includes(url)) urls.push(url);
        });
      } catch(e) {}
    }
  });

  // ASIN取得
  const asin = (location.href.match(/\/dp\/([A-Z0-9]{10})/) || [])[1] || '';

  // 担当者名（リサーチシートから取得したい場合は要変更）
  const staffName = prompt('担当者名を入力してください:', '担当者名') || '担当者未設定';

  if(urls.length === 0) {
    alert('❌ 画像URLが見つかりませんでした');
    return;
  }

  // GAS WebAppに送信
  const GAS_URL = 'YOUR_GAS_WEBAPP_URL_HERE'; // ← ステップ1-3でコピーしたURLに変更

  alert('🔄 ' + urls.length + '枚の画像をGASに送信中...');

  fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ imageUrls: urls, asin: asin, staffName: staffName }),
    headers: {'Content-Type': 'application/json'},
    mode: 'no-cors'
  })
  .then(() => {
    alert('✅ 送信完了: ' + urls.length + '枚をGoogleドライブに保存しました\n\nASIN: ' + asin);
  })
  .catch(e => {
    alert('❌ エラー: ' + e.toString());
  });
})();
```

#### 2-2. WebApp URLを設定
**重要**: 上記コード内の `YOUR_GAS_WEBAPP_URL_HERE` を、ステップ1-3でコピーしたURLに置き換える

例:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/XXXXXX/exec';
```

#### 2-3. ブックマークを作成

**Chrome/Edgeの場合:**
1. ブックマークバーを表示: `Ctrl+Shift+B` (Windows) / `Cmd+Shift+B` (Mac)
2. ブックマークバーを右クリック → 「ページを追加」
3. 名前: `Amazon画像→GAS`
4. URL: 上記のコード（全体）を貼り付け
5. 保存

**Safari/Firefoxの場合:**
1. ブックマークメニュー → 「ブックマークを追加」
2. 名前: `Amazon画像→GAS`
3. URL: 上記のコード（全体）を貼り付け
4. 保存

---

## 使い方

### 日常の作業フロー

1. **Amazon商品ページを開く**
   - 例: https://www.amazon.co.jp/dp/B0BNBXYZ12

2. **ブックマークレットをクリック**
   - ブックマークバーの「Amazon画像→GAS」をクリック

3. **担当者名を入力**
   - プロンプトが表示されたら担当者名を入力
   - 例: `田中`

4. **完了を待つ**
   - `✅ 送信完了: 4枚をGoogleドライブに保存しました` と表示される

5. **確認**
   - Googleドライブの画像フォルダを確認
   - ファイル名: `2026-03-30_143052_Amazon_田中_01.jpg`

---

## 動作確認

### テスト商品

以下のAmazon商品ページで試してください:
```
https://www.amazon.co.jp/dp/B0BNBXYZ12
```

### 期待される結果

#### 成功時
```
🔄 4枚の画像をGASに送信中...

（数秒後）

✅ 送信完了: 4枚をGoogleドライブに保存しました

ASIN: B0BNBXYZ12
```

#### 失敗時
```
❌ 画像URLが見つかりませんでした
```
または
```
❌ エラー: NetworkError
```

---

## トラブルシューティング

### 1. 「画像URLが見つかりませんでした」

**原因**: Amazon商品ページではない、または画像が読み込まれていない

**対処法**:
- 商品ページを完全に読み込んでから実行
- メイン画像をクリックして拡大表示してから実行
- ページをリロードしてから再実行

### 2. 「送信完了」と出るが、Googleドライブに保存されない

**原因**: WebApp URLが間違っている

**対処法**:
1. Apps Scriptエディタで `getWebAppUrl()` を実行
2. 正しいURLを確認
3. ブックマークレットの `GAS_URL` を修正

### 3. 「エラー: NetworkError」

**原因**:
- WebAppが正しくデプロイされていない
- アクセス権限が「全員」に設定されていない

**対処法**:
1. Apps Scriptエディタ → デプロイ → デプロイを管理
2. 「アクセスできるユーザー」が「全員」になっているか確認
3. なっていない場合は編集して「全員」に変更

### 4. ブックマークレットをクリックしても何も起きない

**原因**: コードが正しく貼り付けられていない

**対処法**:
1. ブックマークを編集
2. URLフィールドが `javascript:(function(){...` で始まっているか確認
3. コード全体が1行になっているか確認（改行があるとエラー）

---

## ログの確認（GAS側）

### Apps Scriptエディタでログを確認

1. Apps Scriptエディタを開く
2. `表示` → `ログ` または `実行数`
3. 最近の実行を確認

### ログ例（成功時）

```
=== Amazon画像URL受信 ===
ASIN: B0BNBXYZ12
受信した画像URL数: 4
担当者: 田中
画像フォルダURL: https://drive.google.com/drive/folders/XXXXX
画像1/4をダウンロード中: https://m.media-amazon.com/images/I/xxx._AC_SL1088_.jpg
✅ 保存成功: https://drive.google.com/file/d/YYYY
画像2/4をダウンロード中: https://m.media-amazon.com/images/I/xxx._AC_SL1500_.jpg
✅ 保存成功: https://drive.google.com/file/d/ZZZZ
=== 保存完了 ===
成功: 4枚
失敗: 0枚
```

---

## 高度な使い方

### 担当者名を自動設定

プロンプト入力をスキップして、固定の担当者名を使用:

```javascript
// この行を変更
const staffName = prompt('担当者名を入力してください:', '担当者名') || '担当者未設定';

// ↓ 固定の担当者名に変更
const staffName = '田中';
```

### 複数人で使う場合

担当者ごとにブックマークレットを作成:

- `Amazon画像→GAS（田中）`: staffName = '田中'
- `Amazon画像→GAS（鈴木）`: staffName = '鈴木'

---

## 従来のGAS直接アクセス（非推奨）

~~`extractAmazonImageUrls()`関数は非推奨です。~~

**理由**: Bot判定により6KBのブロックページしか取得できない

**代替**: このブックマークレット方式を使用してください

---

## よくある質問

### Q1: ブックマークレットは安全ですか？

**A**: はい。コードは公開されており、自分のGAS WebAppにのみデータを送信します。第三者にデータが送られることはありません。

### Q2: Chrome拡張機能との違いは？

**A**: ブックマークレットの方が簡単で、インストール不要です。ただし、Chrome拡張機能の方が高機能です。

### Q3: スマートフォンでも使えますか？

**A**: ブックマークレット方式はPC専用です。スマートフォンではブラウザの制約により動作しません。

---

**作成者**: Claude Sonnet 4.5
**最終更新**: 2026年3月30日
**バージョン**: 1.0.0

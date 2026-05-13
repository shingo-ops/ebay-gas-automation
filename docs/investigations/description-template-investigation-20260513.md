# Description テンプレート「テンプレート1」調査レポート

**日付:** 2026-05-13  
**対象:** `gas/listing/standalone/ListingManager.gs` — `generateDescriptionFromTemplate`

---

## 現象

顧客の eBay 出品に Description として「テンプレート1」がそのままテキスト表示された。  
出品シートの Description 列には「テンプレート1」と入力されており、  
本来はその名前で `Description_テンプレ` シートを引いた HTML が展開されるはずだった。

---

## コード調査結果

`generateDescriptionFromTemplate()` に **5 箇所の silent fallback** が存在した。  
いずれも `return templateName` で失敗を無音で吸収し、テンプレート名がそのまま Description に入る。

| # | 条件 | 旧コード | 影響 |
|---|------|----------|------|
| A | `Description_テンプレ` シートが存在しない | `return templateName` | テンプレート名がそのまま出品される |
| B | シートに 2 行目以降のデータがない | `return templateName` | 同上 |
| C | `テンプレート名` 列ヘッダーがない | `return templateName` | 同上 |
| D | `テンプレート` 列ヘッダーがない | `return templateName` | 同上 |
| E | 指定テンプレート名に一致する行がない | `return templateName` | 同上（最頻出パターン） |

さらに関数全体を `try/catch` で包み、catch で `return templateName` していたため、  
上記 A〜E のいずれかで throw しても catch が吸収してしまう構造だった。

### 根本原因

顧客スプレッドシートで以下のいずれか（またはその組み合わせ）が未設定だった可能性が高い:

- Pattern A: `Description_テンプレ` シートが作成されていない  
- Pattern E: シートはあるが「テンプレート1」という名前の行が登録されていない

いずれの場合も、コードが silent fallback によってエラーを黙殺し、  
テンプレート名「テンプレート1」がそのままeBay APIに送信された。

---

## 修正内容

`generateDescriptionFromTemplate()` の全 silent fallback を `throw new Error(...)` に変更。  
try/catch を除去し、エラーが呼び出し元まで確実に伝播するようにした。

### 変更箇所

**`gas/listing/standalone/ListingManager.gs`**

| 条件 | 変更前 | 変更後 |
|------|--------|--------|
| シートなし | `return templateName` | `throw new Error('"Description_テンプレ"シートが見つかりません...')` |
| データなし | `return templateName` | `throw new Error('"Description_テンプレ"シートにデータがありません...')` |
| テンプレート名列なし | `return templateName` | `throw new Error('...「テンプレート名」列がありません...')` |
| テンプレート列なし | `return templateName` | `throw new Error('...「テンプレート」列がありません...')` |
| 行マッチなし | `return templateName` | `throw new Error('...テンプレートが見つかりません。登録済み: ...')` |
| catch block | `return templateName` | try/catch を除去（エラー伝播） |

エラーメッセージには登録済みテンプレート名の一覧を含め、顧客が自己解決できるよう設計した。

---

## 顧客対応テキスト

> 【Description テンプレート未設定について】  
>  
> ご指摘いただいた件を調査しました。出品シートの Description 列に「テンプレート1」と入力されていましたが、  
> 出品シートに紐づくスプレッドシートに「Description_テンプレ」シートが存在しないか、  
> そのシートに「テンプレート1」というテンプレートが登録されていなかったため、  
> テンプレート名がそのまま eBay に送信されてしまいました。  
>  
> 【修正済み】  
> テンプレートが見つからない場合にエラーで停止するよう修正しました。  
> 次回以降は出品時に「テンプレートが見つかりません」というエラーが表示されます。  
>  
> 【ご対応いただく内容】  
> 出品シートのスプレッドシートに「Description_テンプレ」シートを作成し、  
> 1 行目に「テンプレート名」「テンプレート」の列を追加してください。  
> 次に「テンプレート1」という名前の行にHTMLテンプレートを入力すると、  
> 正常に Description が生成されます。

---

## 関連ファイル

- `gas/listing/standalone/ListingManager.gs` — `generateDescriptionFromTemplate()` (L191〜)
- `02_apps/ebay-listing-manager/ListingManager.gs` — 同関数（apps コピー）

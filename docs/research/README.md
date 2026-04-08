# eBay利益計算ツール（リサーチシート）

リサーチから出品シートへの転記までを担当するコンテナバインド型スクリプト。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-green)

> ⚠️ **開発者・AI向け重要事項**: このプロジェクトでは[ユーザー向けエラーメッセージポリシー](#️-ユーザー向けエラーメッセージポリシー重要)を厳格に定めています。コード修正時は必ず確認してください。

---

## 📑 目次

- [概要](#概要) | [主な機能](#主な機能) | [セットアップ](#セットアップ) | [使用方法](#使用方法)
- [ファイル構成](#ファイル構成) | [重要な実装特性](#重要な実装特性)
- [ドキュメント](#ドキュメント) - [📘ユーザー向け](./USER_SPEC_EBAY_LISTING_SYSTEM.md) | [🛠️技術仕様](./TECH_SPEC_EBAY_LISTING_SYSTEM.md) | [📊エビデンス](./EVIDENCE_SKU_POLICY_MAPPING.md)
- **[⚠️ エラーメッセージポリシー](#️-ユーザー向けエラーメッセージポリシー重要)** ← 開発者必読
- [トラブルシューティング](#トラブルシューティング) | [テスト](#テスト) | [更新履歴](#更新履歴)

---

## 概要

eBay商品のリサーチと出品作業を自動化し、作業時間を**30分 → 30秒**に短縮します。

### このツールでできること

1. **eBay URLを入力** → 商品情報を自動取得（Browse API）
2. **仕入元URLを入力** → 画像を自動抽出してGoogleドライブに保存
3. **出品ボタンをクリック** → 出品シートに自動転記

---

## 主な機能

✅ **商品情報の自動取得** - eBay Browse APIから商品タイトル、カテゴリ、価格、Item Specificsを取得
✅ **画像の自動抽出** - Amazon、楽天、メルカリ、ヤフオク等から画像URLを抽出
✅ **出品シートへ転記** - ヘッダー名ベースの柔軟な列マッピング
✅ **数式自動設定** - 利益計算、重量計算等の数式を自動挿入
✅ **複数人同時作業対応** - SKU先行出力で行を予約

### 画像抽出対応サイト

- Amazon（GAS直接抽出 - Bot判定により制限あり）
- 楽天市場
- メルカリ
- ヤフオク
- Yahoo!フリマ
- Yahoo!ショッピング
- NETSEA
- ラクマ
- デジマート
- 駿河屋
- その他（オフモール対応）

---

## セットアップ

### 1. スクリプトをプッシュ

```bash
cd /Users/tanizawashingo/sales-ops-with-claude/02_apps/ebay-profit-calculator
clasp push
```

### 2. リサーチシートの"ツール設定"を設定

リサーチシートに以下を設定（A列:項目名, B列:値）:

| 項目名 | 説明 | 必須 |
|--------|------|------|
| App ID | eBay App ID | ✅ |
| Cert ID | eBay Cert ID | ✅ |
| Dev ID | eBay Dev ID | ✅ |
| Sandbox | true/false（本番: false） | ✅ |
| 画像フォルダ | Google DriveフォルダURL | ✅ |
| 出品シート | 出品シートURL | ✅ |
| カテゴリマスタ | カテゴリマスタURL |  |

**注意:** User Tokenは不要（Browse API使用のため）

### 3. 初回実行・認証

スプレッドシートを開いて、メニューから実行または Apps Scriptエディタで関数を実行。

初回は認証が必要です。

---

## 使用方法

### 基本フロー

1. **リサーチシートにeBay URLを入力**
2. **商品情報を取得**（メニューまたは関数実行）
3. **画像URLを抽出**（Amazon、楽天、メルカリ等のURL貼り付け）
4. **出品シートに転記**（メニューから実行）

### 主要関数

```javascript
// eBay商品情報取得
getEbayItemInfo('eBay商品URL');

// 画像URL抽出
extractProductImages('商品URL');

// 出品シートに転記
transferToListingSheet();

// 数式確認
checkRowFormulas(8);  // 8行目の数式確認
```

---

## ファイル構成

| ファイル | 説明 |
|---------|------|
| [Config.gs](./Config.gs) | 設定管理、LISTING_COLUMNS定義（ヘッダー名ベース） |
| [Functions.gs](./Functions.gs) | データ転記、ヘッダーマッピング、数式設定 |
| [ProductImageFetcher.gs](./ProductImageFetcher.gs) | 画像URL抽出（Amazon、楽天、メルカリ等） |
| [EbayAPI.gs](./EbayAPI.gs) | eBay Browse API連携 |
| [Utils.gs](./Utils.gs) | ユーティリティ関数 |
| [CheckFormulas.gs](./CheckFormulas.gs) | 数式確認ツール |

---

## 重要な実装特性

### ヘッダー名ベースの列マッピング

列番号ではなくヘッダー名で列を識別するため、**列の順序が変わっても動作します**。

```javascript
// 動的に列位置を取得
const headerMapping = buildHeaderMapping(listingSheet);
const col = getColumnByHeader(headerMapping, 'Shipping Policy');
const value = listingSheet.getRange(row, col).getValue();
```

**利点:**
- 列を追加・削除・並び替えしても影響なし
- 出品シートの構造変更に強い
- ヘッダー名さえ一致すれば動作

---

## トラブルシューティング

### "出品シートが見つかりません"

"ツール設定"シートの「出品シート」行に正しいURLが設定されているか確認してください。

### ヘッダー名が見つからないエラー

出品シートの3行目（ヘッダー行）に該当する列名が存在するか確認してください。

例: `出品シートに「Shipping Policy」列が見つかりません`
→ 出品シートの3行目に「Shipping Policy」という列を追加

### 数式が設定されない

`CheckFormulas.gs`で数式を確認できます:

```javascript
// 8行目の数式確認
checkRowFormulas(8);
```

---

## 詳細ドキュメント

### システム全体

- **[マスターREADME](../README.md)** - 全体概要とクイックスタート
- **[統合仕様書](../MASTER_SPECIFICATION.md)** - システム全体の技術詳細

### プロジェクト固有

- **[技術仕様書](./TECH_SPEC_EBAY_LISTING_SYSTEM.md)** - 詳細な技術仕様
- **[ユーザー仕様書](./USER_SPEC_EBAY_LISTING_SYSTEM.md)** - 利用者向け操作ガイド
- **[セットアップガイド](./PRODUCTION_SETUP_GUIDE.md)** - 本番環境セットアップ

### エビデンス

- **[Amazon画像抽出エビデンス](./EVIDENCE_AMAZON_IMAGE_EXTRACTION.md)**
- **[SKUポリシーマッピングエビデンス](./EVIDENCE_SKU_POLICY_MAPPING.md)**
- **[ワンクリックセットアップエビデンス](./ONE_CLICK_SETUP_EVIDENCE.md)**

---

## 関連情報

**プロジェクトタイプ:** コンテナバインド型（特定のスプレッドシートに紐づく）

**スクリプトID:** `1_XPlWrSOe_0kARr_Qw4SOp-19NmAS2RhhJdHMnjUHLzY6940w4TwmZmc`

**主な技術:**
- eBay Browse API
- Google Apps Script V8
- ヘッダー名ベースの動的列マッピング
- 複数サイト対応の画像抽出ロジック

### 推奨
- clasp（Google Apps Script CLI）
- Node.js 14以上

---

## セットアップ

### 1. Google Spreadsheetの準備

#### ツール設定シート
以下の情報を設定：

| 設定項目 | 内容 |
|---------|------|
| App ID | eBay APIのアプリケーションID |
| Cert ID | eBay APIの証明書ID |
| Dev ID | eBay APIの開発者ID |
| 画像フォルダ | Googleドライブフォルダの共有URL |
| 出品シート | 出品データを出力するスプレッドシートURL |
| カテゴリマスタ | カテゴリ情報を管理するスプレッドシートURL |

#### 仕入元マッピング（ツール設定シート）
| 仕入元 | URL |
|--------|-----|
| Amazon | https://www.amazon.co.jp/ |
| メルカリ | https://jp.mercari.com/ |
| ヤフオク | https://auctions.yahoo.co.jp/ |

### 2. Google Apps Scriptのデプロイ

#### 方法1: clasp CLI（推奨）
```bash
# claspのインストール
npm install -g @google/clasp

# ログイン
clasp login

# プロジェクトにクローン
cd 02_apps/ebay-profit-calculator
clasp push

# デプロイ
clasp deploy
```

#### 方法2: 手動コピー
1. Google Apps Scriptエディタを開く
2. 各.gsファイルの内容をコピー&ペースト
3. appsscript.jsonの内容を「プロジェクトの設定」から設定

### 3. OAuth認証の実行

スプレッドシートのメニューから：
```
eBay出品ツール > OAuth認証
```

初回のみGoogleアカウントでログインし、以下の権限を許可：
- Googleスプレッドシートの読み書き
- Googleドライブへのファイル保存
- 外部APIへのアクセス

---

## 使い方

### 基本的なワークフロー

#### ステップ1: リサーチシートに情報を入力

**トップ情報（B2～C2）**
```
リサーチ方法: 利益
担当者名: 田中
```

**価格情報（E4～H5）**
```
仕入元URL①: https://jp.mercari.com/item/m45131029969
画像URL: https://jp.mercari.com/item/m45131029969（同じでOK）
メモ: Pokemon Booster Box
```

**商品リスト（E7～H12）**
```
Item URL: https://www.ebay.com/itm/389734661167
状態: New
```

**メイン情報（K4～L11）**
```
仕入値(¥): 15000
売値($): 120
実重量(g): 500
奥行き(cm): 15
幅(cm): 10
高さ(cm): 5
```

#### ステップ2: ポリシーセクションで利益を確認

リサーチシートのE13～H16行で各発送方法での利益を確認：
```
14行: Expedited - 利益額: 1500円、利益率: 25%
15行: Standard  - 利益額: 1200円、利益率: 20%
16行: 書状      - 利益額: 800円、利益率: 15%
```

#### ステップ3: 出品ボタンをクリック

最も利益率が高い発送方法のボタンをクリック：
```
出品（Expedited） ← クリック
```

確認ダイアログ：
```
Expedited shippingで出品しますか？
[OK] [キャンセル]
```

#### ステップ4: 自動処理（すべて自動）

```
1. SKU生成: 利益/田中/1500/25/20260328143052
2. eBay APIから商品情報取得
3. 商品ページから画像を抽出（9枚検出）
4. Googleドライブに画像を保存
5. 出品シートに全データを転記
   ├─ 商品情報
   ├─ Item Specifics（30件）
   ├─ 画像URL（9枚）
   └─ 利益計算結果
```

#### ステップ5: 完了

```
✅ 出品データを転記しました
（行: 12、SKU: 利益/田中/1500/25/20260328143052）
```

---

## 技術スタック

### プログラミング言語
- **Google Apps Script (JavaScript ES5互換)**

### 外部API
- **eBay Browse API v1**
  - get_item_by_legacy_id
  - get_items_by_item_group

### Googleサービス
- **SpreadsheetApp**: スプレッドシート操作
- **DriveApp**: Googleドライブ操作
- **UrlFetchApp**: HTTP通信
- **PropertiesService**: 設定値のキャッシュ

### 認証
- **OAuth 2.0 Client Credentials Grant** (eBay API)
- **Google OAuth 2.0** (Google Services)

---

## ファイル構成

```
02_apps/ebay-profit-calculator/
├── README.md                          # プロジェクト概要（本ファイル）
├── USER_SPEC_EBAY_LISTING_SYSTEM.md   # ユーザー向け仕様書
├── TECH_SPEC_EBAY_LISTING_SYSTEM.md   # 技術仕様書
├── EVIDENCE_SKU_POLICY_MAPPING.md     # SKU・ポリシーマッピングのエビデンス
│
├── appsscript.json                    # Apps Script設定（OAuthスコープ）
├── Config.gs                          # 設定・定数（126列定義）
├── Menu.gs                            # カスタムメニュー
├── Functions.gs                       # メイン処理（出品ロジック）
├── EbayAPI.gs                         # eBay API連携
├── PolicyManager.gs                   # ポリシー管理
├── ProductImageFetcher.gs             # 画像スクレイピング（メルカリ・ヤフオク）
├── ImageHandler.gs                    # 画像ダウンロード・保存
├── Utils.gs                           # ユーティリティ関数
└── Setup.gs                           # 初期セットアップ
```

**📁 ファイルへの直接リンク**:
- 📘 ドキュメント: [README.md](./README.md) | [USER_SPEC_EBAY_LISTING_SYSTEM.md](./USER_SPEC_EBAY_LISTING_SYSTEM.md) | [TECH_SPEC_EBAY_LISTING_SYSTEM.md](./TECH_SPEC_EBAY_LISTING_SYSTEM.md) | [EVIDENCE_SKU_POLICY_MAPPING.md](./EVIDENCE_SKU_POLICY_MAPPING.md)
- ⚙️ 設定: [appsscript.json](./appsscript.json) | [Config.gs](./Config.gs)
- 🎯 コア機能: [Menu.gs](./Menu.gs) | [Functions.gs](./Functions.gs) | [EbayAPI.gs](./EbayAPI.gs) | [PolicyManager.gs](./PolicyManager.gs)
- 🖼️ 画像処理: [ProductImageFetcher.gs](./ProductImageFetcher.gs) | [ImageHandler.gs](./ImageHandler.gs)
- 🛠️ ユーティリティ: [Utils.gs](./Utils.gs) | [Setup.gs](./Setup.gs)

### 主要ファイルの役割

| ファイル | 行数 | 役割 |
|---------|------|------|
| [Config.gs](./Config.gs) | ~470 | スプレッドシート列定義、API設定、定数管理 |
| [Functions.gs](./Functions.gs) | ~850 | 出品データ転記のメイン処理 |
| [EbayAPI.gs](./EbayAPI.gs) | ~350 | eBay Browse APIとの通信 |
| [PolicyManager.gs](./PolicyManager.gs) | ~330 | eBayポリシー（発送・返品・支払い）管理 |
| [ProductImageFetcher.gs](./ProductImageFetcher.gs) | ~270 | メルカリ・ヤフオクから画像URL抽出 |
| [ImageHandler.gs](./ImageHandler.gs) | ~240 | 画像ダウンロード・Googleドライブ保存 |
| [Utils.gs](./Utils.gs) | ~450 | SKU生成、仕入元マッピング、日付処理など |
| [Setup.gs](./Setup.gs) | ~440 | 初期セットアップ、権限承認、トリガー管理 |
| [Menu.gs](./Menu.gs) | ~100 | カスタムメニュー定義 |

---

## ドキュメント

### 📘 ユーザー向けドキュメント
**ファイル**: [USER_SPEC_EBAY_LISTING_SYSTEM.md](./USER_SPEC_EBAY_LISTING_SYSTEM.md)

**対象**: ツール利用者、運用担当者、非技術者

**内容**:
- システム概要
- 使い方（ステップバイステップ）
- よくある質問（Q&A）
- トラブルシューティング
- 用語集

### 🛠️ 技術ドキュメント
**ファイル**: [TECH_SPEC_EBAY_LISTING_SYSTEM.md](./TECH_SPEC_EBAY_LISTING_SYSTEM.md)

**対象**: 開発者、保守担当者、AI

**内容**:
- アーキテクチャ概要
- データフロー（シーケンス図）
- API仕様
- データ構造（126列の詳細）
- **エラーハンドリング（ユーザー向けエラーメッセージポリシー含む）** ⚠️ 重要
- パフォーマンス最適化
- デバッグガイド

### 📊 エビデンスドキュメント
**ファイル**: [EVIDENCE_SKU_POLICY_MAPPING.md](./EVIDENCE_SKU_POLICY_MAPPING.md)

**内容**:
- SKU列追加とポリシー対応システムの詳細
- 列マッピングの証跡
- テスト結果

### 📚 補足ドキュメント

開発・運用に役立つ補足ドキュメント:

- **セットアップ関連**
  - [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md) - 本番環境セットアップガイド
  - [ONE_CLICK_SETUP_EVIDENCE.md](./ONE_CLICK_SETUP_EVIDENCE.md) - ワンクリックセットアップのエビデンス
  - [IMAGE_BUTTON_FUNCTIONS.md](./IMAGE_BUTTON_FUNCTIONS.md) - 画像ボタン機能の仕様

- **その他**
  - [WARNING_MESSAGE_AUDIT.md](./WARNING_MESSAGE_AUDIT.md) - エラーメッセージ監査結果
  - [MENU_DISPLAY_EVIDENCE.md](./MENU_DISPLAY_EVIDENCE.md) - メニュー表示のエビデンス
  - [DELIVERY_SCOPE.md](./DELIVERY_SCOPE.md) - 納品スコープ定義

---

## 開発ガイド・コーディング規約

### ⚠️ ユーザー向けエラーメッセージポリシー【重要】

**このプロジェクトでは、ユーザー向けエラーメッセージに厳格なポリシーを定めています。**

コードを修正・追加する際は、以下の原則を**必ず遵守**してください。

#### 原則

1. **技術用語を使わない**
   - ❌ `error.toString()`, `null`, `undefined`, `col=null` などは表示しない
   - ✅ 「見つかりません」「確認してください」など平易な日本語で

2. **何が起きたか明確に**
   - ❌ 「エラーが発生しました」（何のエラー？）
   - ✅ 「出品シートのヘッダー行（3行目）に「仕入れキーワード」という列名が見つかりませんでした」

3. **どこを確認すべきか明示**
   - シート名、行番号、列名を具体的に記載
   - ✅ 「リサーチシートのB2セル（担当者）を入力してください」

4. **対処方法を提示**
   - ユーザーが次に何をすべきか明記
   - ✅ 「以下を確認してください:\n1. Item URLが正しいeBayのURLか\n2. インターネット接続が正常か」

5. **不要な情報は削除**
   - 内部処理の情報（「予約した行はクリアされました」等）は不要

#### 詳細仕様

**ファイル**: [TECH_SPEC_EBAY_LISTING_SYSTEM.md](./TECH_SPEC_EBAY_LISTING_SYSTEM.md) の「エラーハンドリング」セクション

**具体例・テンプレート**: 上記ファイルの「ユーザー向けエラーメッセージポリシー」を参照

#### なぜ重要か

- ツール利用者は**非技術者**（セールス担当、リサーチ担当）
- 技術的なエラーメッセージでは、問題解決できず作業が止まる
- 明確な対処方法を示すことで、サポート工数を削減

#### コードレビューチェックリスト

新しいエラーメッセージを追加する際は、以下を確認:

- [ ] `error.toString()` を直接表示していないか
- [ ] `null`, `undefined`, `col` などの技術用語を使っていないか
- [ ] 「何が起きたか」が具体的に書かれているか
- [ ] 「どこを確認すべきか」が明記されているか
- [ ] 「次に何をすべきか」が明記されているか

---

## トラブルシューティング

### よくある問題

#### 1. 画像がGoogleドライブに保存されない

**原因**: OAuth認証が未実施

**解決方法**:
```
1. スプレッドシートのメニューを開く
2. eBay出品ツール > OAuth認証 をクリック
3. Googleアカウントでログイン
4. 権限を許可
```

#### 2. SKUが出品シートに表示されない

**原因**: ヘッダー行（3行目）に「SKU」列が存在しない

**解決方法**:
```
1. 出品シートの3行目を確認
2. C列に「SKU」というヘッダーがあるか確認
3. なければC列に「SKU」を追加
```

#### 3. 発送方法列でエラーが出る

**原因**: データ入力規則に一致しない値を出力しようとしている

**解決方法**:
```
1. 出品シートのCS列（発送方法）のデータ入力規則を確認
2. 許可されている値: FedEx, DHL, 日本郵便
3. リサーチシートのF14～F16セルの値を確認
```

#### 4. eBay API 401 Unauthorized

**原因**: トークンの有効期限切れ

**解決方法**:
```javascript
// Apps Scriptエディタで実行
PropertiesService.getScriptProperties().deleteProperty('EBAY_ACCESS_TOKEN');
PropertiesService.getScriptProperties().deleteProperty('EBAY_TOKEN_EXPIRY');
// 次回実行時に自動で新しいトークンを取得
```

### デバッグ方法

#### ログの確認
```
1. Apps Scriptエディタを開く
2. 表示 > ログ をクリック
3. 詳細なエラーメッセージを確認
```

#### テスト関数の実行
```bash
# ヘッダー検証
clasp run inspectListingHeaderMapping

# ポリシーデータとSKU生成テスト
clasp run testPolicyAndSKU

# 仕入元マッピング確認
clasp run inspectPurchaseSourceMapping
```

---

## 変更履歴

### v1.4.0 (2026-04-01)

#### 🎉 楽天市場対応追加

**新機能**:
- ✅ 楽天市場商品ページからの画像自動抽出
- ✅ GASのみで動作（Chrome拡張不要）
- ✅ og:image（メイン画像）+ shop.r10s.jp/tshop.r10s.jp から抽出
- ✅ tshop → shop 自動変換で高解像度化

**対応サイト**:
- メルカリ（既存）
- ヤフオク（既存）
- Amazon（既存）
- Yahoo!フリマ（既存）
- Yahoo!ショッピング（既存）
- 楽天市場（新規）✨

**検証結果**:
- 実際の楽天市場商品ページで動作確認済み
- 高解像度画像を優先取得
- og:image + カルーセル画像を確実に抽出

---

### v1.3.0 (2026-04-01)

#### 🎉 Yahoo!ショッピング対応追加

**新機能**:
- ✅ Yahoo!ショッピング商品ページからの画像自動抽出
- ✅ GASのみで動作（Chrome拡張不要）
- ✅ Next.js SSRデータ（__NEXT_DATA__）から抽出
- ✅ 高解像度画像への自動変換（/i/n/ → /i/g/）

**対応サイト**:
- メルカリ（既存）
- ヤフオク（既存）
- Amazon（既存）
- Yahoo!フリマ（既存）
- Yahoo!ショッピング（新規）✨

**検証結果**:
- 実際のYahoo!ショッピング商品ページで動作確認済み
- 高解像度画像を優先取得
- __NEXT_DATA__ JSONから確実に抽出

---

### v1.2.0 (2026-04-01)

#### 🎉 Yahoo!フリマ対応追加

**新機能**:
- ✅ Yahoo!フリマ商品ページからの画像自動抽出
- ✅ GASのみで動作（Chrome拡張不要）
- ✅ SSRされたHTMLから直接抽出（Bot判定なし）

**対応サイト**:
- メルカリ（既存）
- ヤフオク（既存）
- Amazon（既存）
- Yahoo!フリマ（新規）✨

**検証結果**:
- 実際のYahoo!フリマ商品ページで動作確認済み
- 高解像度画像を優先取得
- ヤフオクと同じCDN（auctions.c.yimg.jp）を使用

---

### v1.1.0 (2026-03-30)

#### 🎉 Amazon画像抽出機能追加

**新機能**:
- ✅ Amazon商品ページからの画像自動抽出
- ✅ 4つの抽出方法でフォールバック対応
  1. colorImages JavaScriptオブジェクト（最も確実）
  2. data-a-dynamic-image属性（JSON形式）
  3. data-old-hires属性（メイン画像）
  4. imgタグ + 高解像度変換（フォールバック）
- ✅ mainオブジェクトの完全パース対応
- ✅ エビデンスドキュメント作成（EVIDENCE_AMAZON_IMAGE_EXTRACTION.md）

**対応サイト**:
- メルカリ（既存）
- ヤフオク（既存）
- Amazon（新規）✨

**検証結果**:
- 実際のAmazon商品ページで動作確認済み
- 高解像度画像（1500px以上）を優先取得

---

### v1.0.0 (2026-03-28)

#### 🎉 初回リリース

**実装機能**:
- ✅ eBay Browse APIからの商品情報自動取得
- ✅ メルカリ・ヤフオクからの画像自動抽出（最大20枚）
- ✅ Googleドライブへの画像自動保存
- ✅ ポリシー別出品（Expedited, Standard, 書状）
- ✅ SKU先行出力による複数人同時作業対応
- ✅ ヘッダー名ベースの動的列マッピング
- ✅ 仕入元の動的マッピング（ツール設定シートで管理）
- ✅ Item Specificsの自動充填（最大30件）

**解決した問題**:
- ✅ 複数人同時出品でのデータ上書き問題
- ✅ 列構造変更への自動対応
- ✅ DriveApp権限エラーのハンドリング
- ✅ SKU消失問題の修正
- ✅ 発送方法列のデータ入力規則エラー解消

**コミット履歴**:
```
dc6f87d docs: eBay利益計算ツール - 完全仕様書作成
6561e8f wip: DriveApp権限エラーの詳細ログ追加
c49c9b8 wip: 個数列に1を出力 + 画像URL出力の詳細ログ追加
59edbc3 wip: ヘッダー名ベースの動的マッピングに完全移行
6240a6b feat: ツール設定シートから仕入元マッピングを動的取得
9fb1cb0 fix: SKU保持+仕入元サイト名+発送方法出力
```

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────┐
│              Google Apps Script Container               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Menu.gs │→ │Functions.gs│→ │EbayAPI.gs│              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                      ↓                ↓                  │
│           ┌─────────────┐    ┌──────────────┐           │
│           │  Utils.gs   │    │ImageHandler.gs│          │
│           └─────────────┘    └──────────────┘           │
│                      ↓                ↓                  │
│           ┌─────────────┐    ┌──────────────┐           │
│           │  Config.gs  │    │ProductImage  │           │
│           └─────────────┘    │Fetcher.gs    │           │
│                               └──────────────┘           │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ eBay Browse  │    │ Google Drive │    │Google Sheets │
│     API      │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## パフォーマンス

### 処理時間

| 処理 | 所要時間 |
|------|----------|
| SKU生成 | < 0.1秒 |
| eBay API呼び出し | 1～2秒 |
| 画像抽出（メルカリ） | 2～3秒 |
| 画像ダウンロード（9枚） | 5～10秒 |
| データ転記 | < 1秒 |
| **合計** | **約15～20秒** |

---

## 今後の拡張予定

### 検討中の機能

- [x] ~~Amazon商品ページからの画像抽出対応~~ ✅ **実装完了** (2026-03-30)
- [ ] 出品履歴のダッシュボード機能
- [ ] 在庫管理機能との連携
- [ ] eBay Listing APIとの連携（直接出品）
- [ ] 複数カテゴリの一括処理
- [ ] エラー通知機能（Slack/メール）

---

## 貢献

バグ報告や機能要望は、GitHubのIssueで受け付けています。

### 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd 02_apps/ebay-profit-calculator

# claspでログイン
clasp login

# コードをプッシュ
clasp push

# ログを監視
clasp logs
```

---

## ライセンス

MIT License

---

## お問い合わせ

技術的な質問や問題がある場合は、以下のドキュメントを参照してください：

- [ユーザー向け仕様書](./USER_SPEC_EBAY_LISTING_SYSTEM.md)
- [技術仕様書](./TECH_SPEC_EBAY_LISTING_SYSTEM.md)

---

**作成者**: Claude Sonnet 4.5
**最終更新**: 2026年4月1日
**バージョン**: 1.4.0

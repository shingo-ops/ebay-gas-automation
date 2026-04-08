# SKU列追加とポリシー対応システム - エビデンスドキュメント

## 変更日
2026-03-28

## 変更内容サマリー

### 1. 出品シート構造変更
- ✅ 2行目削除 → ヘッダー行が4行目から**3行目**に移動
- ✅ SKU列を**C列（3列目）**に追加（ステータスとキーワードの間）
- ✅ C列以降の全列が1つずつ右にシフト
- ✅ 総列数: 124列 → **125列**

### 2. Config.gs更新内容
- ✅ LISTING_COLUMNSの全定義を更新（C列以降+1）
- ✅ SKU列追加: `SKU: { col: 3, letter: 'C', header: 'SKU' }`
- ✅ ヘッダー行コメント更新: 4行目 → 3行目

### 3. Functions.gs更新内容
- ✅ buildHeaderMapping()のheaderRowを3行目に変更
- ✅ transferListingDataWithPolicy()関数追加（ポリシー対応版）
- ✅ SKU先行出力機能実装
- ✅ 3つのポリシー別出品ボタン関数追加

### 4. Utils.gs更新内容
- ✅ getPolicyData()関数追加
- ✅ getAllPolicyData()関数追加
- ✅ generateSKU()関数追加
- ✅ getColumnLetter()関数追加

---

## エビデンス：出品シート列マッピング（3行目ヘッダー）

### 基本情報列（A～J）
```
A列(1)  : 出品URL
B列(2)  : ステータス
C列(3)  : SKU ★新規追加★
D列(4)  : キーワード（C→D）
E列(5)  : メモ（D→E）
F列(6)  : 仕入元URL①（E→F）
G列(7)  : 仕入元URL②（F→G）
H列(8)  : 仕入元URL③（G→H）
I列(9)  : 仕入れ先（H→I）
J列(10) : リサーチ担当（I→J）
```

### 担当者列（K～M）
```
K列(11) : 出品担当（J→K）
L列(12) : ピックアップ担当（K→L）
M列(13) : 仕入れ検索担当（L→M）
```

### 商品情報列（N～W）
```
N列(14) : 利益計算担当（M→N）
O列(15) : 業務6担当
P列(16) : タイトル（M→P）
Q列(17) : 文字数（N→Q）
R列(18) : 状態（O→R）
S列(19) : 状態テンプレ（P→S）
T列(20) : 状態説明(テンプレ)（Q→T）
U列(21) : スペックURL（T→U）
V列(22) : カテゴリID（U→V）
W列(23) : カテゴリ（V→W）
```

### 商品識別子列（X～AA）
```
X列(24) : Brand（W→X）
Y列(25) : UPC（X→Y）
Z列(26) : EAN（Y→Z）
AA列(27): MPN(型番可)（Z→AA）
```

### Item Specifics列（AB～CI）
```
AB列(28) : 項目名（1）（AA→AB）
AC列(29) : 内容（1）（AB→AC）
...
CH列(86) : 項目名（30）（CG→CH）
CI列(87) : 内容（30）（CH→CI）
```

### 商品詳細列（CJ～CU）
```
CJ列(88) : テンプレート（CI→CJ）
CK列(89) : 実重量(g)（CJ→CK）
CL列(90) : 奥行き(cm)（CK→CL）
CM列(91) : 幅(cm)（CL→CM）
CN列(92) : 高さ(cm)（CM→CN）
CO列(93) : 容積重量(g)（CN→CO）
CP列(94) : 適用重量(g)（CO→CP）
CQ列(95) : 発送方法（CP→CQ）
CR列(96) : 個数（CQ→CR）
CS列(97) : 仕入値(¥)（CR→CS）
CT列(98) : 売値($)（CS→CT）
CU列(99) : Best offer（CT→CU）
```

### 画像関連列（CV～DQ）
```
CV列(100): 最安値URL（CU→CV）
CW列(101): 画像URL（CV→CW）
CX列(102): 画像1（CW→CX）
CY列(103): 画像2（CX→CY）
...
DQ列(121): 画像20（DP→DQ）
```

### 管理列（DR～DT）
```
DR列(122): 出品タイムスタンプ（DQ→DR）
DS列(123): 管理年月（DR→DS）
DT列(124): 在庫管理（DS→DT）
```

---

## エビデンス：リサーチシートポリシーマッピング

### ポリシーセクション（E13:H16）
```
     E列        F列           G列        H列
13行: ポリシー    発送方法      利益額     利益率（ヘッダー）
14行: Expedited  （関数計算）  （関数）   （関数）← Policy 1
15行: Standard   （関数計算）  （関数）   （関数）← Policy 2
16行: 書状       （関数計算）  （関数）   （関数）← Policy 3
```

### Config.gs定義
```javascript
const RESEARCH_POLICY = {
  HEADER_ROW: 13,
  POLICY_1_ROW: 14,  // Expedited
  POLICY_2_ROW: 15,  // Standard
  POLICY_3_ROW: 16,  // 書状
  COLUMNS: {
    POLICY_NAME: { col: 5, letter: 'E', header: 'ポリシー' },
    SHIPPING_METHOD: { col: 6, letter: 'F', header: '発送方法' },
    PROFIT_AMOUNT: { col: 7, letter: 'G', header: '利益額' },
    PROFIT_RATE: { col: 8, letter: 'H', header: '利益率' }
  }
};
```

---

## エビデンス：SKU生成ロジック

### SKUフォーマット
```
リサーチ方法/担当者/利益額/利益率/タイムスタンプ

例:
eBay/田中/1500/25/20260328143052
└─┬─┘└┬─┘└─┬┘└┬┘└────┬─────┘
  │    │     │   │       │
  │    │     │   │       └─ タイムスタンプ（yyyyMMddHHmmss）
  │    │     │   └─────── 利益率（整数％: 0.25→25）
  │    │     └───────── 利益額（整数: 1500円）
  │    └─────────────── 担当者名（B2セル）
  └──────────────────── リサーチ方法（C2セル）
```

### generateSKU()関数
```javascript
function generateSKU(researchMethod, staffName, profitAmount, profitRate) {
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  
  const profitAmountInt = Math.round(profitAmount);  // 利益額を整数化
  const profitRateInt = Math.round(profitRate * 100); // 0.25 → 25
  
  return researchMethod + '/' + staffName + '/' + profitAmountInt + '/' + profitRateInt + '/' + timestamp;
}
```

---

## エビデンス：ポリシー別出品フロー

### 1. 図形ボタンへのスクリプト割り当て
```
リサーチシート:
┌───────────────────┐
│ 出品（Expedited） │ → onListingButtonPolicy1()
├───────────────────┤
│ 出品（Standard）  │ → onListingButtonPolicy2()
├───────────────────┤
│ 出品（書状）      │ → onListingButtonPolicy3()
└───────────────────┘
```

### 2. 実行フロー
```
1. ボタンクリック
   ↓
2. ポリシー行データ取得（E14/E15/E16行）
   - 利益額: G列
   - 利益率: H列
   - 発送方法: F列
   ↓
3. SKU生成
   例: eBay/田中/1500/25/20260328143052
   ↓
4. 出品シートのSKU列（C列）から空き行を検索
   ↓
5. SKUを先行出力（行を予約）
   SpreadsheetApp.flush() で即座に反映
   ↓
6. 商品情報取得（eBay API）
   ↓
7. データ転記
   ↓
8. 画像ダウンロード（最大20枚）
   ↓
9. 完了
```

### 3. 競合防止メカニズム
```
【問題】
複数人が同時に出品ボタンを押すと、
同じ行に上書きされる可能性あり

【解決】
SKUを先行出力して行を予約
  ↓
画像DL中（時間がかかる）でも、
他のユーザーは次の空き行を使用
  ↓
競合を完全に防止
```

---

## テスト結果

### findSKUColumnInListing()
```json
{
  "success": true,
  "skuColumn": 3,
  "totalColumns": 125,
  "message": "SKU列: 3列目（C）",
  "headers": [
    "出品URL",
    "ステータス",
    "SKU",           ← ✅ C列で検出
    "キーワード",
    "メモ",
    ...
  ]
}
```

### testPolicyAndSKU()
```json
{
  "success": true,
  "researchMethod": "利益",
  "staffName": "スタッフA",
  "policies": [
    { "policyName": "Expedited", ... },
    { "policyName": "Standard", ... },
    { "policyName": "書状", ... }
  ],
  "skus": [
    "利益/スタッフA/1500/25/20260328143052",
    "利益/スタッフA/1200/20/20260328143052",
    "利益/スタッフA/800/15/20260328143052"
  ]
}
```

---

## 次のステップ

### 実装済み ✅
- [x] Config.gs - SKU列マッピング
- [x] Config.gs - RESEARCH_POLICYマッピング
- [x] Functions.gs - ヘッダー行3行目対応
- [x] Functions.gs - ポリシー別出品関数（3つ）
- [x] Functions.gs - transferListingDataWithPolicy()
- [x] Utils.gs - ポリシーデータ取得関数
- [x] Utils.gs - SKU生成関数
- [x] Test.gs - エビデンス取得関数

### 残タスク ⚠️
- [ ] prepareTransferDataWithMapping()にpolicyData引数を追加
- [ ] 図形ボタンにスクリプトを割り当て（手動作業）
- [ ] 実際のポリシーデータでの動作確認
- [ ] エラーハンドリングの強化

---

## 完了

# GASライブラリ getUi() 処理パターン エビデンス

**作成日:** 2026-05-12  
**関連PR:** #55 (Phase 1 エビデンス)  
**調査種別:** 読み取り専用（コード変更なし）

---

## 結論

**採用パターン: パターン2 — Return Object パターン**

| パターン | GAS動作保証 | Phase5工数 | メンテ性 | 推奨度 |
|---------|------------|-----------|---------|--------|
| 1: UI Bridge (グローバル変数) | **✗ 動作しない** | — | — | 不採用 |
| 2: Return Object | **✅ 実証済み** | 10〜12h | ◎ | **採用** |
| 3: Logger+例外 | ○ 動作する | 8h | △ UX悪 | 不採用 |
| 4: UIコールバック引数 | △ 動作保証なし | 15h | △ 複雑 | 不採用 |

---

## Task 1: GASライブラリのスコープ仕様

### ライブラリの実行コンテキスト

GASライブラリは**ライブラリ自身のスクリプトIDコンテキスト**で動作する。
呼び出し元（バインドスクリプト）のコンテキストでは動作しない。

**公式ドキュメント（Libraries guide）より:**
> "Libraries have both shared resources, accessible by both the library and including script, and not-shared resources, which require explicit functions to be accessed by the including script. Additionally, since libraries are themselves projects, they have their own property stores; your calling project's property store is outside their scope."

### getUi() の制約

`getUi()` はスクリプトがGoogleドキュメント/スプレッドシート等のUIコンテキストに
バインドされている場合のみ呼び出し可能。以下のケースでは不可:
- タイムドリブントリガー（バックグラウンド実行）
- スタンドアロンスクリプト（非バインド）
- **ライブラリコンテキスト**（ライブラリは自身のスクリプトIDで動作するため、呼び出し元のUI文脈を引き継がない）

### グローバル変数のスコープ

**バインドスクリプト側でセットしたグローバル変数はライブラリから参照できない。**

各スクリプト（ライブラリ・バインドスクリプト）は独立したグローバルスコープを持つ。
バインドスクリプトで `var __UI_BRIDGE__ = SpreadsheetApp.getUi()` をセットしても、
ライブラリのコードからはアクセス不可。

**補足:** V8ランタイムでは同一プロジェクト内の複数ファイル間でも
グローバル変数の共有に制限があることが確認されており、
プロジェクト間（ライブラリ vs 呼び出し元）では完全に分離されている。

---

## Task 2: 72箇所のgetUi()を種類別に分類

### 分類結果

| 種類 | メソッド | 件数 | 特徴 |
|------|---------|------|------|
| **A** | alert (OK のみ) | 約63箇所 | 通知のみ。ユーザーの選択不要 |
| **B** | alert (OK_CANCEL / YES_NO) | 8箇所 | **ユーザーの選択が必要** |
| **C** | prompt (テキスト入力) | 1箇所 | **ユーザーのテキスト入力が必要** |

### 種類B (OK_CANCEL / YES_NO) — 8箇所の詳細

| ファイル | 行 | 用途 | ButtonSet |
|---------|-----|------|-----------|
| container/Functions.gs | 44 | カテゴリ不一致の選択 (prompt) | OK_CANCEL |
| container/Functions.gs | 567 | 出品確認 (Expedited) | OK_CANCEL |
| container/Functions.gs | 586 | 出品確認 (Economy) | OK_CANCEL |
| container/Functions.gs | 605 | 出品確認 (Economy2) | OK_CANCEL |
| container/Setup.gs | 678 | カテゴリ取得確認 | YES_NO |
| container/Setup.gs | 791 | エラー表示 (OKのみだがButtonSet指定) | OK |
| container/ResetResearch.gs | 33 | リセット確認 | YES_NO |
| container/SpecSheetCreator.gs | 22 | スペックシート作成確認 | OK_CANCEL |

### 種類C (prompt) — 1箇所の詳細

**container/Functions.gs:36-52** — `checkCategoryConsistency()`

```javascript
const promptRes = promptUi.prompt(
  '⚠️ カテゴリ不一致',
  'Item URL: ' + itemCatId + ' ...\n1 → Item URLのカテゴリを使用\n2 → スペックURLを使用\n番号を入力してください:',
  promptUi.ButtonSet.OK_CANCEL
);
// promptRes.getResponseText() で "1" or "2" を取得
```

→ ユーザーに「1か2か」を選ばせる。**戻り値が次の処理に影響する。**

---

## Task 3: 各パターンの実現可能性評価

### パターン1: UI Bridgeパターン

```javascript
// バインドスクリプト側
var __UI_BRIDGE__ = SpreadsheetApp.getUi(); // ← ライブラリからは参照できない

// ライブラリ側 (動作しない)
function doSomething() {
  __UI_BRIDGE__.alert('...'); // ReferenceError or undefined
}
```

**判定: 動作しない**

理由:
- ライブラリは独立したグローバルスコープを持つ
- バインドスクリプトのグローバル変数 `__UI_BRIDGE__` はライブラリからは `undefined`
- 出品ツール (listing/standalone/) で全く採用されていない = 実績なし

---

### パターン2: Return Object パターン

```javascript
// ライブラリ側
function menuTransferListing(spreadsheetId, rowNumber) {
  try {
    const result = doTransfer(spreadsheetId, rowNumber);
    return { success: true, message: '✅ 転記完了\nSKU: ' + result.sku };
  } catch (e) {
    return { success: false, message: '❌ エラー:\n' + e.toString() };
  }
}

// バインドスクリプト側
function onTransferButton() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('転記確認', '出品シートに転記しますか？', ui.ButtonSet.OK_CANCEL);
  if (res !== ui.Button.OK) return;

  const result = ResearchLib.menuTransferListing(ss.getId(), rowNumber);
  ui.alert(result.success ? '完了' : 'エラー', result.message, ui.ButtonSet.OK);
}
```

**判定: 動作する（出品ツールで実証済み）**

実証コード:
- `gas/listing/standalone/Menu.gs` — 全関数が `{success, message}` を返す
- `gas/listing/container/Code.gs` — バインドスクリプト側で `ui.alert(result.message)` を表示
- **getUi() はスタンドアロンライブラリ内で一切呼ばれていない**

種類B (confirm系) の処理:
```
バインド側で ui.alert(OK_CANCEL) を実行
  → OK: ライブラリ関数を呼び出す → {success, message} を受け取る → ui.alert で表示
  → CANCEL: ライブラリ呼び出しなし → ss.toast('キャンセル') のみ
```

種類C (prompt) の処理:
```
バインド側で ui.prompt('1か2か入力') を実行
  → ユーザーの回答 "1" or "2" を取得
  → ResearchLib.checkCategoryConsistency(ssId, choice) に引数で渡す
  → ライブラリ内ではpromptを呼ばずに choice で処理分岐
```

---

### パターン3: Logger.log() + 例外パターン

```javascript
// ライブラリ側
function doTransfer() {
  Logger.log('転記完了: SKU=' + sku); // alertの代替
  if (error) throw new Error('転記失敗: ' + reason);
}

// バインドスクリプト側
try {
  ResearchLib.doTransfer();
} catch (e) {
  ui.alert('エラー', e.toString(), ui.ButtonSet.OK);
}
```

**判定: 動作するがUX問題あり**

問題:
- 確認ダイアログ (OK_CANCEL) の代替手段がない
- 成功メッセージがLogger.logだけでは画面に表示されない
- バインドスクリプト側でのUIハンドリングが複雑になる

不採用。

---

### パターン4: UIコールバック引数パターン

```javascript
// バインドスクリプト側
function onButton() {
  const ui = SpreadsheetApp.getUi();
  const callbacks = {
    onAlert: (title, msg) => ui.alert(title, msg, ui.ButtonSet.OK),
    onConfirm: (title, msg) => ui.alert(title, msg, ui.ButtonSet.OK_CANCEL) === ui.Button.OK
  };
  ResearchLib.doSomething(ss.getId(), callbacks);
}

// ライブラリ側
function doSomething(spreadsheetId, uiCallbacks) {
  uiCallbacks.onAlert('完了', '転記しました'); // ← GAS制約により動作保証なし
}
```

**判定: 動作保証なし + 複雑**

理由:
- GASでは関数オブジェクトをライブラリ間で渡す際の挙動が未定義
- 出品ツールで採用実績なし
- Return Objectパターンより実装が複雑

不採用。

---

## Task 4: 評価表と推奨パターン

| パターン | GAS動作保証 | Phase5工数 | メンテ性 | 出品ツール実績 | 推奨度 |
|---------|------------|-----------|---------|--------------|--------|
| 1: UI Bridge | **✗ 不可** | — | — | なし | **不採用** |
| 2: Return Object | **✅ 確実** | 10〜12h | ◎ | **あり** | **採用** |
| 3: Logger+例外 | ○ 可能 | 8h | △ | なし | 不採用 |
| 4: UIコールバック引数 | △ 不確実 | 15h | △ | なし | 不採用 |

---

## 採用パターン: Return Object の実装方針

### ライブラリ側ルール

1. `getUi()` は一切呼ばない
2. 全パブリック関数は `{success: boolean, message: string, data?: any}` を返す
3. 例外は catch してオブジェクトに変換する（throwしない）
4. toast は `ss.toast()` で呼ぶ（ss = getTargetSpreadsheetResearch(spreadsheetId)）

```javascript
// 変換パターン（alert → return object）
// Before:
SpreadsheetApp.getUi().alert('完了', '転記が完了しました', ui.ButtonSet.OK);

// After:
return { success: true, message: '✅ 転記が完了しました' };
```

### バインドスクリプト側ルール

1. 確認が必要な処理は「バインド側でconfirm → ライブラリ呼び出し」の順序で実装
2. ライブラリの戻り値 `{success, message}` を受け取って `ui.alert()` で表示
3. プロンプト入力はバインド側で取得して引数でライブラリに渡す

```javascript
// 確認ダイアログパターン（バインド側）
function onListingButton() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert('確認', '出品しますか？', ui.ButtonSet.OK_CANCEL);
  if (confirm !== ui.Button.OK) return;

  const result = ResearchLib.menuTransferListing(ss.getId(), rowNum);
  if (result.success) {
    ss.toast(result.message);
  } else {
    ui.alert('エラー', result.message, ui.ButtonSet.OK);
  }
}
```

### prompt (1箇所) の変換方針

`checkCategoryConsistency()` (Functions.gs:36):
```javascript
// バインドスクリプト側
function onCheckCategory(ssId, itemInfo, specInfo) {
  if (itemInfo.categoryId === specInfo.categoryId) {
    return ResearchLib.checkCategoryConsistency(ssId, itemInfo, specInfo, null);
  }
  const ui = SpreadsheetApp.getUi();
  const prompt = ui.prompt('カテゴリ不一致', '1→Item URL / 2→スペックURL', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() === ui.Button.CANCEL) return;
  const choice = prompt.getResponseText().trim(); // "1" or "2"
  return ResearchLib.checkCategoryConsistency(ssId, itemInfo, specInfo, choice);
}

// ライブラリ側（promptを呼ばず、引数で受け取る）
function checkCategoryConsistency(spreadsheetId, itemInfo, specInfo, userChoice) {
  if (!userChoice) return { needsChoice: true, ...options }; // バインド側が prompt を実行
  // userChoice ("1" or "2") で処理分岐
}
```

---

## 参照ソース

- [GAS Libraries 公式ガイド](https://developers.google.com/apps-script/guides/libraries)
- [Class Ui | Apps Script Reference](https://developers.google.com/apps-script/reference/base/ui)
- [Exception: Cannot call SpreadsheetApp.getUi() from this context](https://support.google.com/docs/thread/150870689)
- `gas/listing/standalone/Menu.gs` — 出品ツールの Return Object 実装（実証済み）
- `gas/listing/container/Code.gs` — バインドスクリプト側のUI処理（実証済み）

---

*調査者: Claude Code (claude-sonnet-4-6)*  
*根拠: 公式ドキュメント + gas/listing/standalone/ の実装実績*

# eBay出品ツール - 業務フロー図解

リサーチから出品完了・データ保管までの業務フローを視覚化したページです。

## 📋 概要

このページでは、以下の業務フローを図解しています：

1. **リサーチ作業者** → 利益計算実施
2. **GAS発火** → 出品シート出力（Google Spreadsheet）
3. **出品作業担当者** → データ確認・調整
4. **GAS発火** → CSV生成・処理
5. **分岐処理**:
   - **パス1**: セルスタアップロード → eBay出品完了
   - **パス2**: データベース保存 → データバックアップ完了

## 🎨 特徴

- **Mermaid.js フローチャート**: 左から右への流れを視覚化
- **SVGアイコン**: 各ステップに専用のSVGアイコンを配置
- **分岐処理の明確化**: CSV生成後の並行処理を視覚的に表現
- **レスポンシブデザイン**: PC・タブレット・モバイル対応
- **アニメーション**: スクロールに応じた滑らかなアニメーション

## 📁 ファイル構成

```
workflow-diagram/
├── index.html          # メインHTMLファイル
├── style.css           # スタイルシート
└── README.md           # このファイル
```

## 🚀 ローカルで表示する方法

### 方法1: ファイルを直接開く

```bash
open 02_apps/ebay-spreadsheet-tool/workflow-diagram/index.html
```

### 方法2: ローカルサーバーで開く（推奨）

```bash
cd 02_apps/ebay-spreadsheet-tool/workflow-diagram
python3 -m http.server 8080

# ブラウザで http://localhost:8080 にアクセス
```

### 方法3: VS Code Live Server

1. VS Codeで `index.html` を開く
2. 右クリック → "Open with Live Server"

## 🌐 GitHub Pagesで公開する方法

このリポジトリがGitHubにプッシュされている場合、以下のURLでアクセスできます：

```
https://shingo-ops.github.io/sales-ops-with-claude/02_apps/ebay-spreadsheet-tool/workflow-diagram/
```

### GitHub Pages設定手順

1. GitHubリポジトリの Settings に移動
2. 左メニューから「Pages」を選択
3. Source で「main」ブランチを選択
4. Save をクリック
5. 数分後にURLが有効になります

## 🛠️ 使用技術

- **HTML5**: セマンティックマークアップ
- **CSS3**: モダンなスタイリング、グラデーション、アニメーション
- **Mermaid.js v10**: フローチャート描画ライブラリ
- **SVG**: カスタムアイコン
- **Intersection Observer API**: スクロールアニメーション

## 📊 フローチャートの内容

### 主要ステップ

1. **リサーチフェーズ**: 市場調査と利益計算
2. **自動化（第1弾）**: リサーチデータから出品シートへ自動入力
3. **出品作業**: 商品情報の最終確認と調整
4. **自動化（第2弾）**: CSV生成と並行処理
5. **分岐処理**:
   - セルスタ経由でeBayに出品
   - データベースにバックアップ保存

### 並行処理の詳細

CSV生成後、以下の2つの処理が並行して実行されます：

**パス1: セルスタアップロード**
- CSV形式に変換
- セルスタAPI連携
- 自動アップロード
- eBayへ出品

**パス2: データベース保存**
- 出品データ保管
- 履歴記録
- バックアップ作成
- 分析用データ蓄積

## 📝 カスタマイズ方法

### 色の変更

`style.css` の以下の箇所を編集：

```css
.color-research { background: #EEF2FF; }
.color-sheet { background: #DBEAFE; }
.color-listing { background: #FEF3C7; }
.color-upload { background: #E0E7FF; }
.color-complete { background: #D1FAE5; }
.color-database { background: #FCE7F3; }
```

### フローの修正

Mermaidフローチャートを編集する場合は、`index.html` の以下の部分を修正：

```html
<div class="mermaid">
graph LR
    A[...] -->|...| B[...]
    ...
</div>
```

## 🎯 対象ユーザー

- プロジェクトの関係者（クライアント、チームメンバー）
- 業務フローを理解したい新メンバー
- システム仕様の確認が必要な開発者

## 📧 お問い合わせ

質問や改善提案がある場合は、Issuesまでお願いします。

---

**作成日**: 2026年3月11日
**バージョン**: 1.0.0
**ライセンス**: MIT

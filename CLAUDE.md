# ebay-gas-automation プロジェクト

## プロジェクト概要
eBay出品自動化のためのGoogle Apps Script（GAS）と
Pythonスクリプトを管理するリポジトリ。

## 技術スタック
- Google Apps Script（GAS）: スプレッドシート操作・eBay API連携
- Python: eBay APIからデータ一括取得
- eBay Metadata API: カテゴリ・コンディション情報取得
- eBay Trading API: 商品出品（AddFixedPriceItem）

## ファイル構成
- gas/: Google Apps Scriptファイル（.gs）
- python/: Pythonスクリプト
- docs/: ドキュメント・仕様書

## コーディングルール
- GASはES5互換で書く（letではなくvar）
- 関数名はキャメルケース（例: getConditionsByGroupId）
- コメントは日本語でOK
- エラーハンドリングは必ず入れる
- API認証情報はコードに直接書かない（Secretsを使う）

## eBay API仕様
- Trading API: XML/SOAP形式
- Metadata API: REST形式
- 認証: OAuth 2.0（Access Token・Refresh Token）
- Access Tokenの有効期限: 2時間（自動更新済み）

## スプレッドシートのシート名
- category_master: カテゴリIDマスター（group_id列あり）
- condition_master: コンディションIDマスター（16行）
- condition_group_map: グループ別conditions_json（26行）
- category_condition_map: カテゴリ×コンディションマッピング

## やってはいけないこと
- .envファイルをコミットしない
- APIキー・トークンをコードに直接書かない
- GASでletやconstを使わない（ES5非対応）
- category_masterを手動で削除しない

## デプロイ方法
- gas/standalone/ のファイルを変更してmainにマージ
  → スタンドアロンGASに自動でclasp pushされる
- gas/container/ のファイルを変更してmainにマージ
  → コンテナバインドGASに自動でclasp pushされる

## @claudeへの指示の出し方
- IssueまたはPRのコメントで @claude と書いて指示する
- 例: @claude getConditionsByGroupId関数を実装してください
- 日本語で指示してOK

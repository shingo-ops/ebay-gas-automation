/**
 * リサーチシート バインドスクリプト - ScriptProperties管理
 *
 * ライブラリの ScriptProperties はライブラリ全クライアント共通のため、
 * OAuthトークンなどの機密情報はバインドスクリプト側の ScriptProperties に保存する。
 * (ADR-008 設計決定 1)
 *
 * 使用パターン:
 *   const propsData = getPropsData_();
 *   const result = ResearchLib.someFunction(ssId, propsData);
 *   if (result.newProps) applyNewProps_(result.newProps);
 */

/**
 * バインドスクリプト側の ScriptProperties を全件取得してプレーンオブジェクトとして返す
 * ライブラリ関数に渡す際のデータ転送用
 * @returns {Object} ScriptProperties の全キーバリュー
 */
function getPropsData_() {
  return PropertiesService.getScriptProperties().getProperties();
}

/**
 * ライブラリ関数が返した newProps をバインドスクリプト側の ScriptProperties に適用する
 * @param {Object} newProps キーバリュー形式のプロパティオブジェクト
 */
function applyNewProps_(newProps) {
  if (!newProps || typeof newProps !== 'object') return;
  const scriptProps = PropertiesService.getScriptProperties();
  Object.keys(newProps).forEach(function(key) {
    if (newProps[key] === null) {
      scriptProps.deleteProperty(key);
    } else {
      scriptProps.setProperty(key, String(newProps[key]));
    }
  });
}

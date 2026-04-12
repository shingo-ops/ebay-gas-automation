/**
 * ItemCache.gs - _cache シート（非表示）によるAPI呼び出しキャッシュ
 *
 * スキーマ（常に1行のみ保持）:
 *   item_url        : eBay商品URL（最後に取得した商品URL）
 *   category_id     : カテゴリID
 *   category_name   : カテゴリ名
 *   item_specs_json : JSON.stringify(specifics) — {Brand:..., MPN:..., ...}
 *   title           : 商品タイトル
 *   fetched_at      : 取得日時（Asia/Tokyo, yyyy-MM-dd HH:mm:ss）
 *
 * 使い方:
 *   getProductInfoFromUrl() が内部で getCacheEntry / saveCacheEntry を呼ぶ。
 *   外部から直接呼び出す必要はない。
 *   saveCacheEntry は常に行2を上書き（複数行を保持しない）。
 */

const ITEM_CACHE_SHEET_NAME = '_cache';
const ITEM_CACHE_HEADERS    = ['item_url', 'category_id', 'category_name', 'item_specs_json', 'title', 'fetched_at'];

// キャッシュの列インデックス（0-based）
const CACHE_COL = {
  ITEM_URL:        0,
  CATEGORY_ID:     1,
  CATEGORY_NAME:   2,
  ITEM_SPECS_JSON: 3,
  TITLE:           4,
  FETCHED_AT:      5
};

/**
 * _cache シートを取得（なければ作成して非表示にする）
 *
 * @returns {Sheet}
 */
function getOrCreateCacheSheet() {
  let sheet = ss.getSheetByName(ITEM_CACHE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ITEM_CACHE_SHEET_NAME);
    sheet.hideSheet();
    Logger.log('[Cache] _cache シートを新規作成しました');
  }

  // ヘッダーを常に最新スキーマに同期（列追加・変更に対応）
  const headerRange = sheet.getRange(1, 1, 1, ITEM_CACHE_HEADERS.length);
  headerRange.setValues([ITEM_CACHE_HEADERS]);
  headerRange.setBackground('#424242')
             .setFontColor('#ffffff')
             .setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅調整
  sheet.setColumnWidth(1, 400); // item_url
  sheet.setColumnWidth(2, 100); // category_id
  sheet.setColumnWidth(3, 180); // category_name
  sheet.setColumnWidth(4, 500); // item_specs_json
  sheet.setColumnWidth(5, 300); // title
  sheet.setColumnWidth(6, 160); // fetched_at

  return sheet;
}

/**
 * URL を正規化（クエリパラメータ除去・小文字化・末尾スラッシュ除去）
 *
 * @param {string} url
 * @returns {string}
 */
function normalizeCacheUrl(url) {
  return String(url || '')
    .trim()
    .split('?')[0]
    .split('#')[0]
    .replace(/\/$/, '')
    .toLowerCase();
}

/**
 * _cache シートから item_url でエントリを検索（1行のみ保持）
 *
 * @param {string} url
 * @returns {{categoryId: string, categoryName: string, specifics: Object, title: string}|null}
 *          ヒットしない場合は null
 */
function getCacheEntry(url) {
  try {
    const sheet = getOrCreateCacheSheet();
    if (sheet.getLastRow() < 2) return null;

    // 常に行2のみ確認（1行保持のため）
    const row    = sheet.getRange(2, 1, 1, ITEM_CACHE_HEADERS.length).getValues()[0];
    const target = normalizeCacheUrl(url);

    if (normalizeCacheUrl(String(row[CACHE_COL.ITEM_URL])) !== target) {
      Logger.log('[Cache] ミス: ' + url);
      return null;
    }

    const specsJson = String(row[CACHE_COL.ITEM_SPECS_JSON] || '{}');
    let specifics = {};
    try {
      specifics = JSON.parse(specsJson);
    } catch (e) {
      Logger.log('[Cache] item_specs_json パースエラー: ' + e.toString());
    }

    Logger.log('[Cache] ヒット: ' + url);
    return {
      categoryId:   String(row[CACHE_COL.CATEGORY_ID]   || ''),
      categoryName: String(row[CACHE_COL.CATEGORY_NAME]  || ''),
      specifics:    specifics,
      title:        String(row[CACHE_COL.TITLE]           || '')
    };

  } catch (e) {
    Logger.log('[Cache] getCacheEntry エラー: ' + e.toString());
    return null;
  }
}

/**
 * _cache シートにエントリを保存（常に行2に上書き・1行のみ保持）
 *
 * @param {string} url
 * @param {Object} productInfo  getProductInfoFromUrl() の戻り値
 */
function saveCacheEntry(url, productInfo) {
  try {
    const sheet = getOrCreateCacheSheet();
    const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const specsJson = JSON.stringify(productInfo.specifics || {});

    const newRow = [
      url,
      (productInfo.category && productInfo.category.categoryId)   || '',
      (productInfo.category && productInfo.category.categoryName) || '',
      specsJson,
      productInfo.title || '',
      now
    ];

    // 既存データ行をすべて削除してから行2に書き込み（1行のみ保持）
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.deleteRows(2, lastRow - 1);
    }
    sheet.appendRow(newRow);
    Logger.log('[Cache] 保存（1行のみ）: ' + url);

  } catch (e) {
    // キャッシュ保存失敗はサイレントに（本体処理を止めない）
    Logger.log('[Cache] saveCacheEntry エラー（無視）: ' + e.toString());
  }
}

/**
 * _cache シートを全クリア（ヘッダーは残す）
 * デバッグ・テスト用
 */
function clearItemCache() {
  const sheet = getOrCreateCacheSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.deleteRows(2, lastRow - 1);
    Logger.log('[Cache] 全エントリを削除しました');
  } else {
    Logger.log('[Cache] キャッシュは空です');
  }
}

/**
 * 仕入元サイト名自動判定・更新機能
 *
 * ツール設定シートの D〜G列（仕入元マスタ）を参照し、
 * 仕入元URL①②③のドメインからサイト名を自動判定して仕入元①②③に書き込む。
 *
 * ツール設定シートの列構成（D〜G列）:
 *   D列: 仕入元（サイト名）
 *   E列: 仕入元URL（ベースURL）
 *   F列: 画像取得（"対応" の場合に対応）
 *   G列: CSV（"セルスタ" の場合にCSV出力対象）
 *
 * 出品シートの対応列:
 *   仕入元①  ← サイト名を書き込む
 *   仕入元URL① ← URLが入っている
 *   仕入元②  ← サイト名を書き込む
 *   仕入元URL②
 *   仕入元③  ← サイト名を書き込む
 *   仕入元URL③
 */

/**
 * ツール設定シートのD〜G列から { domain: サイト名 } マップを返す
 * @param {string} spreadsheetId
 * @returns {{ [domain: string]: string }}
 */
function getSiteNameMap(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;
    const ss = getTargetSpreadsheet(spreadsheetId);
    const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    if (!settingsSheet) return {};

    const data = settingsSheet.getDataRange().getValues();

    // D列(index=3)のヘッダー「仕入元」を探す
    const headerRowIdx = data.findIndex(function(row) {
      return String(row[3] || '').trim() === '仕入元';
    });
    if (headerRowIdx === -1) {
      Logger.log('⚠️ ツール設定シートに「仕入元」列(D列)ヘッダーが見つかりません');
      return {};
    }

    const map = {};
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const siteName = String(data[i][3] || '').trim(); // D列: サイト名
      const siteUrl  = String(data[i][4] || '').trim(); // E列: ベースURL
      if (!siteName || !siteUrl) continue;
      const domain = _extractDomain(siteUrl);
      if (domain) map[domain] = siteName;
    }
    Logger.log('仕入元マップ読み込み完了: ' + Object.keys(map).length + '件');
    return map;

  } catch(e) {
    Logger.log('getSiteNameMap エラー: ' + e.toString());
    return {};
  }
}

/**
 * URLからホスト部分（www.なし）を抽出
 * @param {string} url
 * @returns {string}
 */
function _extractDomain(url) {
  if (!url) return '';
  const match = String(url).match(/^https?:\/\/([^\/\?#]+)/);
  if (!match) return '';
  return match[1].replace(/^www\./, '');
}

/**
 * URLからサイト名を判定
 * @param {string} url
 * @param {{ [domain: string]: string }} siteNameMap
 * @returns {string} サイト名（不明の場合は空文字）
 */
function detectSiteNameFromUrl(url, siteNameMap) {
  if (!url) return '';
  const domain = _extractDomain(url);
  if (!domain) return '';

  // 完全一致
  if (siteNameMap[domain]) return siteNameMap[domain];

  // 部分一致（マスタのドメインが対象URLに含まれる）
  for (const d in siteNameMap) {
    if (domain === d || domain.indexOf(d) !== -1 || d.indexOf(domain) !== -1) {
      return siteNameMap[d];
    }
  }
  return '';
}

/**
 * 出品シートの1行分の仕入元URL①②③からサイト名を判定して仕入元①②③に書き込む
 * onEdit時・一括更新どちらからも呼び出せる
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 出品シート
 * @param {number} row 対象行（1-based）
 * @param {{ [headerName: string]: number }} headerMapping ヘッダー名→列番号マップ
 * @param {{ [domain: string]: string }} siteNameMap ドメイン→サイト名マップ
 */
function updateSiteNameForRow(sheet, row, headerMapping, siteNameMap) {
  const urlKeys  = ['仕入元URL①', '仕入元URL②', '仕入元URL③'];
  const nameKeys = ['仕入元①',    '仕入元②',    '仕入元③'];

  for (let i = 0; i < 3; i++) {
    const urlCol  = headerMapping[urlKeys[i]];
    const nameCol = headerMapping[nameKeys[i]];
    if (!urlCol || !nameCol) continue;

    const url = String(sheet.getRange(row, urlCol).getValue() || '').trim();
    if (!url) continue;

    const siteName = detectSiteNameFromUrl(url, siteNameMap);
    if (siteName) {
      sheet.getRange(row, nameCol).setValue(siteName);
    }
  }
}

/**
 * 出品シート全行の仕入元①②③を一括更新する
 * メニューから呼び出す用
 *
 * @param {string} spreadsheetId
 * @returns {{ success: boolean, message: string }}
 */
function updatePurchaseSiteNames(spreadsheetId) {
  try {
    if (spreadsheetId) CURRENT_SPREADSHEET_ID = spreadsheetId;

    const siteNameMap = getSiteNameMap(spreadsheetId);
    if (Object.keys(siteNameMap).length === 0) {
      return { success: false, message: 'ツール設定シートに仕入元マスタが見つかりません（D列「仕入元」ヘッダーを確認してください）' };
    }

    const ss = getTargetSpreadsheet(spreadsheetId);
    const sheet = ss.getSheetByName(SHEET_NAMES.LISTING);
    if (!sheet) return { success: false, message: '「出品」シートが見つかりません' };

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return { success: true, message: '対象行なし' };

    // ヘッダーマッピングを構築
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerMapping = {};
    headerRow.forEach(function(h, i) {
      const name = String(h || '').trim();
      if (name) headerMapping[name] = i + 1;
    });

    const urlKeys  = ['仕入元URL①', '仕入元URL②', '仕入元URL③'];
    const nameKeys = ['仕入元①',    '仕入元②',    '仕入元③'];

    let updatedCount = 0;
    for (let row = 2; row <= lastRow; row++) {
      for (let i = 0; i < 3; i++) {
        const urlCol  = headerMapping[urlKeys[i]];
        const nameCol = headerMapping[nameKeys[i]];
        if (!urlCol || !nameCol) continue;

        const url = String(sheet.getRange(row, urlCol).getValue() || '').trim();
        if (!url) continue;

        const siteName = detectSiteNameFromUrl(url, siteNameMap);
        if (siteName) {
          sheet.getRange(row, nameCol).setValue(siteName);
          updatedCount++;
        }
      }
    }

    Logger.log('✅ 仕入元一括更新完了: ' + updatedCount + '件');
    return { success: true, message: updatedCount + '件の仕入元名を更新しました' };

  } catch(e) {
    Logger.log('updatePurchaseSiteNames エラー: ' + e.toString());
    return { success: false, message: e.toString() };
  } finally {
    CURRENT_SPREADSHEET_ID = null;
  }
}

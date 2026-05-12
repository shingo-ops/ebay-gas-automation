/**
 * eBay from Japan 最安値検索ツール
 * Browse APIを使わず全てUrlFetchApp HTMLスクレイピングで実現
 *
 * シート構成:
 *   設定 (LP_SHEET.SETTINGS) : A列=キーワード、C1=フォールバック("ON"で有効)
 *   結果 (LP_SHEET.RESULTS)  : 検索結果出力先
 *   ログ (LP_SHEET.LOG)      : 実行ログ
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 定数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LP_SHEET = {
  SETTINGS: '設定',
  RESULTS:  '結果',
  LOG:      'ログ',
};

const LP_CONDITIONS = [
  { id: '1000', label: '新品/未使用',        group: '新品' },
  { id: '2750', label: 'ほぼ新品',            group: '中古' },
  { id: '2990', label: '目立った傷や汚れなし', group: '中古' },
  { id: '3000', label: '目立った傷や汚れなし', group: '中古' },
  { id: '3010', label: '傷や汚れあり',         group: '中古' },
  { id: '4000', label: 'やや傷や汚れあり',     group: '中古' },
  { id: '5000', label: '傷や汚れあり',         group: '中古' },
  { id: '6000', label: '全体的に状態が悪い',   group: '中古' },
  { id: '7000', label: 'ジャンク品',           group: '中古' },
];

// 結果シート列インデックス（1-based）
const LP_COL = {
  DATETIME:   1,
  KEYWORD:    2,
  GROUP:      3,
  COND_ID:    4,
  COND_JA:    5,
  TITLE:      6,
  PRICE_USD:  7,
  SHIP_USD:   8,
  TOTAL_USD:  9,
  TOTAL_JPY: 10,
  EBAY_COND: 11,
  DESC_EN:   12,
  DESC_JA:   13,
  DIFF:      14,
  ITEM_LINK: 15,
  SEARCH_URL:16,
};

const LP_RESULTS_HEADER = [
  '取得日時', 'キーワード', '種別', 'Condition ID', 'Condition(日本語)',
  '商品タイトル', '本体(USD)', '送料(USD)', '合計(USD)', '合計(JPY)',
  'eBay表示状態', '状態説明(英語)', '状態説明(日本語)', '前回差分',
  '商品リンク', '検索URL',
];

const LP_MAX_DAILY_REQUESTS  = 100;
const LP_MAX_KEYWORDS_PER_RUN = 6;
const LP_TIMEOUT_MS           = 330 * 1000; // 330秒

const LP_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.81',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36 SamsungBrowser/24.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

const LP_CONDITION_KEYWORDS = [
  /mint\s*condition/i, /near\s*mint/i, /like\s*new/i,
  /excellent/i, /very\s*good/i, /good\s*condition/i,
  /fair/i, /poor/i, /damaged/i, /junk/i,
  /美品/, /未使用/, /良品/, /難あり/, /傷あり/, /汚れあり/,
  /Box:.*?/i, /Figure:.*?/i, /Accessories:.*?/i,
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// カスタムメニュー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('eBay最安値検索')
    .addItem('▶ 今すぐ実行（全キーワード）', 'runAllLowestPrice')
    .addItem('⏰ 毎日9時に自動実行', 'setupDailyLowestPriceTrigger')
    .addItem('🗑 自動実行を解除', 'removeDailyLowestPriceTrigger')
    .addToUi();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// トリガー管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * handleEditLowestPriceをインストール可能onEditトリガーとして登録
 * completeInitialSetup（Setup.gs）の setupOnEditTrigger() から呼ばれる
 */
function setupLowestPriceTrigger(spreadsheetId) {
  const spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  // 既存の handleEditLowestPrice トリガーを削除
  ScriptApp.getUserTriggers(spreadsheet).forEach(function(t) {
    if (t.getHandlerFunction() === 'handleEditLowestPrice') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('handleEditLowestPrice')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  writeLog('handleEditLowestPriceトリガー登録完了');
}

/**
 * 毎日9時の自動実行トリガーを設定
 */
function setupDailyLowestPriceTrigger(spreadsheetId) {
  const spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  ScriptApp.getUserTriggers(spreadsheet).forEach(function(t) {
    if (t.getHandlerFunction() === 'runAllLowestPrice' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('runAllLowestPrice')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  SpreadsheetApp.getUi().alert('✅ 毎日9時の自動実行を設定しました');
  writeLog('毎日9時の自動実行トリガー登録');
}

/**
 * 毎日自動実行トリガーを解除
 */
function removeDailyLowestPriceTrigger(spreadsheetId) {
  const spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  let removed = 0;
  ScriptApp.getUserTriggers(spreadsheet).forEach(function(t) {
    if (t.getHandlerFunction() === 'runAllLowestPrice' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  SpreadsheetApp.getUi().alert(removed > 0 ? '✅ 自動実行を解除しました' : '⚠️ 自動実行が設定されていません');
  writeLog('毎日9時の自動実行トリガー削除: ' + removed + '件');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// onEditトリガー（インストール可能）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 設定シートのA列（キーワード）に入力された時に発火
 * 関数名をonEditにしない（handleEditとの二重発火防止）
 */
function handleEditLowestPrice(e) {
  if (!e) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('他の処理が実行中のためスキップ (handleEditLowestPrice)');
    return;
  }
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== LP_SHEET.SETTINGS) return;

    const editedCol = e.range.getColumn();
    const editedRow = e.range.getRow();

    // A列（キーワード列）、2行目以降のみ対象
    if (editedCol !== 1 || editedRow < 2) return;

    const keyword = String(e.range.getValue()).trim();
    if (!keyword) return;

    writeLog('onEdit発火: "' + keyword + '" (行' + editedRow + ')');
    lpSearchKeyword(keyword, Date.now());

  } catch (err) {
    writeLog('handleEditLowestPrice エラー: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 全キーワードに対して最安値検索を実行（メニューから呼ぶ）
 */
function runAllLowestPrice() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    SpreadsheetApp.getUi().alert('⚠️ 他の処理が実行中です。しばらく待ってから再実行してください。');
    return;
  }
  try {
    lpInitSheets();

    const settingsSheet = ss.getSheetByName(LP_SHEET.SETTINGS);
    if (!settingsSheet) {
      SpreadsheetApp.getUi().alert('「設定」シートが見つかりません');
      return;
    }

    const lastRow = settingsSheet.getLastRow();
    if (lastRow < 2) {
      SpreadsheetApp.getUi().alert('設定シートのA2以降にキーワードを入力してください');
      return;
    }

    const allKeywords = settingsSheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues()
      .map(function(r) { return String(r[0]).trim(); })
      .filter(function(k) { return k !== ''; });

    if (allKeywords.length === 0) {
      SpreadsheetApp.getUi().alert('有効なキーワードがありません');
      return;
    }

    // バッチ進捗を取得（前回中断分の続き）
    const props = PropertiesService.getScriptProperties();
    let startIndex = 0;
    const saved = props.getProperty('LP_BATCH_PROGRESS');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        if (progress.totalCount === allKeywords.length) {
          startIndex = progress.completedCount || 0;
        }
      } catch (e_) { /* 無視 */ }
    }
    if (startIndex >= allKeywords.length) startIndex = 0;

    const startTime = Date.now();
    const totalCount = allKeywords.length;
    let completedCount = startIndex;

    writeLog('実行開始: ' + totalCount + '件のキーワード（' + startIndex + '件目から）');

    for (let i = startIndex; i < allKeywords.length; i++) {
      // タイムアウトチェック
      if (Date.now() - startTime > LP_TIMEOUT_MS) {
        props.setProperty('LP_BATCH_PROGRESS', JSON.stringify({ totalCount: totalCount, completedCount: completedCount }));
        writeLog('タイムアウト間近: ' + completedCount + '/' + totalCount + '件完了で打ち切り');
        SpreadsheetApp.getUi().alert(
          'タイムアウト',
          completedCount + '/' + totalCount + '件完了。\n残りはメニューから再実行してください。',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      // バッチ上限チェック（1バッチあたり最大6キーワード）
      if (i - startIndex >= LP_MAX_KEYWORDS_PER_RUN) {
        props.setProperty('LP_BATCH_PROGRESS', JSON.stringify({ totalCount: totalCount, completedCount: completedCount }));
        writeLog('バッチ上限(' + LP_MAX_KEYWORDS_PER_RUN + '件)到達。続きは再実行してください。');
        SpreadsheetApp.getUi().alert(
          'バッチ完了',
          completedCount + '/' + totalCount + '件完了（' + LP_MAX_KEYWORDS_PER_RUN + '件/バッチ上限）。\n残りはメニューから再実行してください。',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      const keyword = allKeywords[i];
      writeLog('検索開始: "' + keyword + '" (' + (i + 1) + '/' + totalCount + ')');
      try {
        lpSearchKeyword(keyword, startTime);
      } catch (err) {
        writeLog('キーワードエラー "' + keyword + '": ' + err.toString());
      }
      completedCount++;
    }

    props.deleteProperty('LP_BATCH_PROGRESS');
    writeLog('全件完了: ' + completedCount + '/' + totalCount + '件');
    SpreadsheetApp.getUi().alert('✅ 完了: ' + completedCount + '件のキーワードを処理しました');

  } finally {
    lock.releaseLock();
  }
}

/**
 * 1キーワードに対して全コンディションの最安値を検索
 * @param {string} keyword キーワードまたはeBay検索URL
 * @param {number} startTime 実行開始時刻 (Date.now())
 */
function lpSearchKeyword(keyword, startTime) {
  const exchangeRate = lpGetExchangeRate();
  const isFallbackEnabled = lpIsFallbackEnabled();
  const rows = [];

  for (let i = 0; i < LP_CONDITIONS.length; i++) {
    const cond = LP_CONDITIONS[i];

    // タイムアウトチェック
    if (startTime && Date.now() - startTime > LP_TIMEOUT_MS) {
      writeLog('lpSearchKeyword: タイムアウトにより中断 (cond=' + cond.id + ')');
      break;
    }

    const searchUrl = lpBuildUrl(keyword, cond.id);

    // 日次リクエスト上限チェック
    if (!lpCheckRequestLimit()) {
      writeLog('日次リクエスト上限（' + LP_MAX_DAILY_REQUESTS + '回）到達。処理停止。');
      SpreadsheetApp.getUi().alert(
        'リクエスト上限',
        '本日のリクエスト上限（' + LP_MAX_DAILY_REQUESTS + '回）に達しました。\n明日再実行してください。',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      break;
    }

    let html = lpFetchWithRetry(searchUrl, 3, isFallbackEnabled ? cond.id : null, keyword);
    lpIncrementRequestCount();

    if (html === null) {
      writeLog('取得失敗（全リトライ失敗）: cond=' + cond.id + ' keyword=' + keyword);
      rows.push({ cond: cond, status: 'FETCH_FAILED', searchUrl: searchUrl });
      Utilities.sleep(2000 + Math.random() * 2000);
      continue;
    }

    const items = lpParseItems(html);

    if (items === null) {
      // パーサー破損
      writeLog('パーサー破損の可能性：HTMLにs-itemが存在するがパース結果0件 [cond=' + cond.id + ']');
      rows.push({ cond: cond, status: 'PARSE_FAILED', searchUrl: searchUrl });
      Utilities.sleep(2000 + Math.random() * 2000);
      continue;
    }

    if (items.length === 0) {
      rows.push({ cond: cond, status: 'NO_RESULTS', searchUrl: searchUrl });
      Utilities.sleep(2000 + Math.random() * 2000);
      continue;
    }

    const lowestItem = lpGetLowestItem(items, exchangeRate);
    if (!lowestItem) {
      rows.push({ cond: cond, status: 'NO_RESULTS', searchUrl: searchUrl });
      Utilities.sleep(2000 + Math.random() * 2000);
      continue;
    }

    // 商品ページからコンディション詳細を取得
    let descEn = lowestItem.conditionText || '';
    let descJa  = '';
    if (lowestItem.url) {
      Utilities.sleep(1500 + Math.random() * 1000);
      const itemHtml = lpFetchItemPage(lowestItem.url);
      if (itemHtml) {
        const detail = lpExtractItemCondition(itemHtml);
        if (detail) {
          descEn = detail;
          descJa = lpTranslate(detail);
        } else {
          writeLog('説明文取得不可（iframe）: ' + lowestItem.url);
        }
      } else {
        writeLog('商品ページ取得失敗: ' + lowestItem.url);
      }
    }

    const shipUsd    = lowestItem.shippingUsd;
    const totalUsd   = lowestItem.priceUsd + (shipUsd !== null ? shipUsd : 0);
    const totalJpy   = shipUsd !== null ? Math.round(totalUsd * exchangeRate) : null;

    rows.push({
      cond: cond,
      status: 'OK',
      item: lowestItem,
      totalUsd: totalUsd,
      totalJpy: totalJpy,
      descEn: descEn,
      descJa: descJa,
      searchUrl: searchUrl,
    });

    // リクエスト間隔: 2〜4秒
    Utilities.sleep(2000 + Math.random() * 2000);
  }

  lpWriteResults(keyword, rows, exchangeRate);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL構築
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * eBay検索URLを構築（from Japan固定）
 */
function lpBuildUrl(keyword, conditionId) {
  // 既存のeBay URLが渡された場合はconditionIdだけ差し替える
  if (keyword.indexOf('ebay.com') !== -1) {
    let url = keyword;
    if (/LH_ItemCondition=\d+/.test(url)) {
      url = url.replace(/LH_ItemCondition=\d+/, 'LH_ItemCondition=' + conditionId);
    } else {
      url += '&LH_ItemCondition=' + conditionId;
    }
    return url;
  }
  const params = [
    '_nkw='            + encodeURIComponent(keyword),
    '_sacat=0',
    'LH_BIN=1',
    'LH_ItemCondition=' + conditionId,
    '_sop=15',
    '_salic=104',
    'LH_LocatedIn=1',
  ].join('&');
  return 'https://www.ebay.com/sch/i.html?' + params;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// フェッチ（Bot回避 + リトライ）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpGetRandomUA() {
  return LP_USER_AGENTS[Math.floor(Math.random() * LP_USER_AGENTS.length)];
}

function lpGetRequestHeaders() {
  return {
    'User-Agent':                lpGetRandomUA(),
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':           'en-US,en;q=0.9',
    'Accept-Encoding':           'gzip, deflate, br',
    'Cache-Control':             'no-cache',
    'Pragma':                    'no-cache',
    'Referer':                   'https://www.ebay.com/',
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'same-origin',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * eBayページをフェッチ（成功時は1時間キャッシュ）
 * @returns {string|null}
 */
function lpFetchEbayPage(url) {
  const cache    = CacheService.getScriptCache();
  const cacheKey = 'LP_PAGE_' + Utilities.base64Encode(url).substring(0, 200);

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: lpGetRequestHeaders(),
      muteHttpExceptions: true,
      followRedirects: true,
    });
    const code = response.getResponseCode();

    if (code === 200) {
      const html = response.getContentText();
      try { cache.put(cacheKey, html.substring(0, 100000), 3600); } catch (e_) { /* キャッシュサイズ超過は無視 */ }
      return html;
    }

    if (code === 503 || code === 403 || code === 429) {
      const cached = cache.get(cacheKey);
      if (cached) {
        writeLog('キャッシュデータ使用 (HTTP ' + code + '): ' + url.substring(0, 80));
        return cached;
      }
      writeLog('HTTP ' + code + ': ' + url.substring(0, 80));
      return null;
    }

    writeLog('HTTP ' + code + ' (予期しないコード): ' + url.substring(0, 80));
    return null;

  } catch (err) {
    writeLog('フェッチエラー: ' + err.toString());
    return null;
  }
}

/**
 * 指数バックオフリトライ付きフェッチ
 * @param {string} url
 * @param {number} maxRetries
 * @param {string|null} conditionId フォールバック用（null=無効）
 * @param {string|null} keyword     フォールバック用
 * @returns {string|null}
 */
function lpFetchWithRetry(url, maxRetries, conditionId, keyword) {
  let consecutiveFails = 0;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const html = lpFetchEbayPage(url);
    if (html !== null) return html;

    consecutiveFails++;

    // 503が3回連続 → Browse APIフォールバック
    if (consecutiveFails >= 3 && conditionId && keyword) {
      writeLog('503が3回連続 → Browse APIフォールバックを試みます');
      return lpBrowseFallback(keyword, conditionId);
    }

    const waitSec = Math.pow(2, attempt) * 2 + Math.random() * 2;
    writeLog('リトライ ' + (attempt + 1) + '/' + maxRetries + '（' + Math.round(waitSec) + '秒後）');
    Utilities.sleep(waitSec * 1000);
  }
  return null;
}

/**
 * 商品個別ページをフェッチ（コンディション詳細取得用）
 * @returns {string|null}
 */
function lpFetchItemPage(itemUrl) {
  try {
    const response = UrlFetchApp.fetch(itemUrl, {
      method: 'get',
      headers: lpGetRequestHeaders(),
      muteHttpExceptions: true,
      followRedirects: true,
    });
    return response.getResponseCode() === 200 ? response.getContentText() : null;
  } catch (err) {
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTMLパーサー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * eBay検索結果HTMLからアイテムリストをパース
 * @returns {Array|null} アイテム配列。パーサー破損時はnull
 */
function lpParseItems(html) {
  const hasSItem = html.indexOf('s-item') !== -1;
  const itemPattern = /<li[^>]+class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  const items = [];
  let match;

  while ((match = itemPattern.exec(html)) !== null) {
    const item = lpParseItemBlock(match[1]);
    if (item) items.push(item);
  }

  // パーサー破損チェック: s-itemが存在するがパース0件
  if (items.length === 0 && hasSItem) return null;
  return items;
}

/**
 * s-itemブロック1件をパース
 * @returns {Object|null}
 */
function lpParseItemBlock(block) {
  // 無効行（ショッピング誘導等）を除外
  if (block.indexOf('Shop on eBay') !== -1 ||
      block.indexOf('s-item__placeholder') !== -1) return null;

  // タイトル
  const titleMatch = block.match(/class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
  if (!titleMatch) return null;
  const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
  if (!title || title.length < 3) return null;

  // URL (/itm/ を含む href、絶対URLと相対URL両方に対応)
  const urlMatch = block.match(/href="(https?:\/\/www\.ebay\.com\/itm\/[^"?&"]+)/) ||
                   block.match(/href="(\/itm\/[^"?&"]+)/);
  if (!urlMatch) return null;
  const url = urlMatch[1].startsWith('/')
    ? 'https://www.ebay.com' + urlMatch[1]
    : urlMatch[1];

  // 本体価格（最初の $X.XX を取得）
  const priceMatch = block.match(/\$([0-9,]+\.?[0-9]*)/);
  if (!priceMatch) return null;
  const priceUsd = parseFloat(priceMatch[1].replace(/,/g, ''));
  if (isNaN(priceUsd) || priceUsd <= 0) return null;

  // 送料テキスト
  let shippingText = '';
  const shipMatch = block.match(/class="[^"]*s-item__shipping[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
  if (shipMatch) shippingText = shipMatch[1].replace(/<[^>]+>/g, '').trim();

  // コンディション表示（SECONDARY_INFO）
  let conditionText = '';
  const condMatch = block.match(/class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
  if (condMatch) conditionText = condMatch[1].replace(/<[^>]+>/g, '').trim();

  // from Japan 二重チェック
  let isFromJapan = false;
  const locMatch = block.match(/class="[^"]*s-item__location[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
  if (locMatch)                              isFromJapan = locMatch[1].indexOf('Japan') !== -1;
  if (!isFromJapan && shippingText.indexOf('Japan') !== -1) isFromJapan = true;
  if (!isFromJapan && block.indexOf('from Japan') !== -1)   isFromJapan = true;

  // 明示的に他国の場合は除外（日本表示がなければスキップ）
  if (!isFromJapan &&
      (block.indexOf('from United States') !== -1 ||
       block.indexOf('from China') !== -1 ||
       block.indexOf('from Hong Kong') !== -1)) return null;

  return {
    title: title,
    url: url,
    priceUsd: priceUsd,
    shippingText: shippingText,
    conditionText: conditionText,
    isFromJapan: isFromJapan,
    shippingUsd: null, // lpGetLowestItem で設定
  };
}

/**
 * 最安値アイテムを選定（shippingUsd を解決して返す）
 * @returns {Object|null}
 */
function lpGetLowestItem(items, exchangeRate) {
  let lowestItem  = null;
  let lowestTotal = Infinity;

  for (let i = 0; i < items.length; i++) {
    const item   = items[i];
    const ship   = lpNormalizeShipping(item.shippingText, exchangeRate);
    item.shippingUsd = ship;
    const total  = item.priceUsd + (ship !== null ? ship : 0);
    if (total < lowestTotal) { lowestTotal = total; lowestItem = item; }
  }
  return lowestItem;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 送料正規化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 送料テキストをUSDに正規化
 * @returns {number|null} USD送料（不明はnull）
 */
function lpNormalizeShipping(text, exchangeRate) {
  if (!text) return null;
  const t = text.trim();

  if (/free\s*shipping/i.test(t) || /free\s*international/i.test(t)) return 0;

  const usdMatch = t.match(/\+?\$([0-9,]+\.?[0-9]*)/);
  if (usdMatch) return parseFloat(usdMatch[1].replace(/,/g, ''));

  const jpyMatch = t.match(/JPY\s*([0-9,]+)/i);
  if (jpyMatch) {
    const jpy = parseFloat(jpyMatch[1].replace(/,/g, ''));
    return Math.round((jpy / exchangeRate) * 100) / 100;
  }

  return null; // 送料不明
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 為替レート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * USD/JPY為替レートを取得（open.er-api.com、1時間キャッシュ）
 * フォールバック150はキャッシュに書き込まない
 */
function lpGetExchangeRate() {
  const cache    = CacheService.getScriptCache();
  const cacheKey = 'LP_EXCHANGE_RATE';

  const cached = cache.get(cacheKey);
  if (cached) return parseFloat(cached);

  try {
    const response = UrlFetchApp.fetch('https://open.er-api.com/v6/latest/USD', { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      const rate = data.rates && data.rates.JPY;
      if (rate && !isNaN(rate)) {
        cache.put(cacheKey, String(rate), 3600);
        writeLog('為替レート取得: 1USD = ' + rate + ' JPY');
        return rate;
      }
    }
  } catch (err) {
    writeLog('為替レート取得エラー: ' + err.toString());
  }

  writeLog('為替フォールバック使用：150');
  return 150; // フォールバック値はキャッシュに書き込まない
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// コンディション詳細取得
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 商品ページHTMLからCondition DescriptionとSeller Notesを抽出
 * iframe内の説明文は取得しない（取得不可でも正常動作）
 * @returns {string|null}
 */
function lpExtractItemCondition(html) {
  const condPatterns = [
    /class="[^"]*x-item-condition-text[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/,
    /class="[^"]*conditionDescription[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/,
    /"conditionDescription"\s*:\s*"([^"]+)"/,
    /Condition:<\/[^>]+>[\s\S]{0,50}<[^>]+>([\s\S]*?)<\/[^>]+>/,
  ];

  for (let i = 0; i < condPatterns.length; i++) {
    const m = html.match(condPatterns[i]);
    if (m && m[1]) {
      const text = m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .trim();
      if (text.length > 5 && text.indexOf('iframe') === -1) return text;
    }
  }

  // Seller Notes フォールバック
  const snMatch = html.match(/seller.{0,20}notes?[\s\S]{0,200}<[^>]+>([\s\S]*?)<\/[^>]+>/i);
  if (snMatch) {
    const text = snMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 5 && text.indexOf('iframe') === -1) return text;
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 翻訳
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * テキストを日本語に翻訳（最大500文字、LanguageApp失敗時はgtx APIへフォールバック）
 */
function lpTranslate(text) {
  if (!text || !text.trim()) return '';

  // 翻訳テキストを最大500文字に制限
  let target = text;
  if (text.length > 500) {
    let found = false;
    for (let i = 0; i < LP_CONDITION_KEYWORDS.length; i++) {
      const m = text.match(LP_CONDITION_KEYWORDS[i]);
      if (m) {
        const start = Math.max(0, m.index - 100);
        const end   = Math.min(text.length, m.index + m[0].length + 100);
        target = text.substring(start, end);
        found  = true;
        break;
      }
    }
    if (!found) target = text.substring(0, 500);
  }

  try {
    return LanguageApp.translate(target, 'en', 'ja');
  } catch (err) {
    // フォールバック: Google Translate gtx
    try {
      const url      = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=' + encodeURIComponent(target);
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const result = JSON.parse(response.getContentText());
        if (result && result[0] && result[0][0]) return result[0][0][0] || '';
      }
    } catch (fbErr) {
      writeLog('翻訳フォールバックエラー: ' + fbErr.toString());
    }
    return '';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 結果書き込み
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 結果シートに書き込む
 */
function lpWriteResults(keyword, rows, exchangeRate) {
  const sheet = lpGetOrCreateSheet(LP_SHEET.RESULTS);
  lpEnsureResultsHeader(sheet);

  const now     = new Date();
  const startRow = sheet.getLastRow() + 1;

  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const cond = r.cond;
    const rowNum = startRow + i;

    if (r.status === 'FETCH_FAILED') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[
        now, keyword, cond.group, cond.id, cond.label,
        '取得失敗', '', '', '', '', '', '', '', '-', '', r.searchUrl,
      ]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#FF9999');
      continue;
    }

    if (r.status === 'PARSE_FAILED') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[
        now, keyword, cond.group, cond.id, cond.label,
        '取得失敗（パーサー要確認）', '', '', '', '', '', '', '', '-', '', r.searchUrl,
      ]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#FF9999');
      continue;
    }

    if (r.status === 'NO_RESULTS') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[
        now, keyword, cond.group, cond.id, cond.label,
        '該当なし', '', '', '', '', '', '', '', '-', '', r.searchUrl,
      ]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#CCCCCC');
      continue;
    }

    // 通常データ
    const item = r.item;
    const prev = lpGetPreviousPrice(keyword, cond.id, sheet, rowNum);
    const diff = lpFormatDiff(r.totalUsd, prev);
    const shipDisplay = item.shippingUsd !== null ? item.shippingUsd : '不明';
    const jpyDisplay  = r.totalJpy !== null ? r.totalJpy : '';

    sheet.getRange(rowNum, 1, 1, 16).setValues([[
      now, keyword, cond.group, cond.id, cond.label,
      item.title || '',
      item.priceUsd || '',
      shipDisplay,
      r.totalUsd || '',
      jpyDisplay,
      item.conditionText || '',
      r.descEn || '',
      r.descJa || '',
      diff.text,
      item.url || '',
      r.searchUrl || '',
    ]]);

    // 数値書式
    sheet.getRange(rowNum, LP_COL.PRICE_USD).setNumberFormat('#,##0.00');
    if (item.shippingUsd !== null) sheet.getRange(rowNum, LP_COL.SHIP_USD).setNumberFormat('#,##0.00');
    sheet.getRange(rowNum, LP_COL.TOTAL_USD).setNumberFormat('#,##0.00');
    if (r.totalJpy !== null) sheet.getRange(rowNum, LP_COL.TOTAL_JPY).setNumberFormat('#,##0');

    // URL列をHYPERLINKに
    if (item.url) {
      sheet.getRange(rowNum, LP_COL.ITEM_LINK)
           .setFormula('=HYPERLINK("' + item.url.replace(/"/g, '') + '","商品ページ")');
    }
    if (r.searchUrl) {
      sheet.getRange(rowNum, LP_COL.SEARCH_URL)
           .setFormula('=HYPERLINK("' + r.searchUrl.replace(/"/g, '') + '","検索結果")');
    }

    // 差分の文字色
    if (diff.color) {
      sheet.getRange(rowNum, LP_COL.DIFF).setFontColor(diff.color);
    }
  }

  SpreadsheetApp.flush();
}

/**
 * 前回の合計価格を取得（同一キーワード+conditionId の直近行）
 * @returns {number|null}
 */
function lpGetPreviousPrice(keyword, conditionId, sheet, currentRow) {
  if (currentRow <= 2) return null;
  const lastData = currentRow - 2; // 1-based → 行数
  if (lastData < 1) return null;

  const data = sheet.getRange(2, 1, lastData, LP_COL.TOTAL_USD).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][LP_COL.KEYWORD - 1])  === keyword &&
        String(data[i][LP_COL.COND_ID - 1])  === conditionId) {
      const v = data[i][LP_COL.TOTAL_USD - 1];
      return (v !== '' && !isNaN(v)) ? parseFloat(v) : null;
    }
  }
  return null;
}

/**
 * 差分テキストと色を生成
 */
function lpFormatDiff(current, previous) {
  if (previous === null || previous === undefined) return { text: '-', color: null };
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return { text: '→', color: null };
  if (diff < 0) return { text: '↓$' + Math.abs(diff).toFixed(2), color: '#006600' };
  return { text: '↑$' + diff.toFixed(2), color: '#CC0000' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 日次リクエスト管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpTodayKey() {
  const d = new Date();
  return 'LP_REQ_' + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

function lpCheckRequestLimit() {
  const count = parseInt(PropertiesService.getScriptProperties().getProperty(lpTodayKey()) || '0');
  return count < LP_MAX_DAILY_REQUESTS;
}

function lpIncrementRequestCount() {
  const props = PropertiesService.getScriptProperties();
  const key   = lpTodayKey();
  props.setProperty(key, String(parseInt(props.getProperty(key) || '0') + 1));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// シート管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpInitSheets() {
  lpGetOrCreateSheet(LP_SHEET.SETTINGS);
  lpEnsureResultsHeader(lpGetOrCreateSheet(LP_SHEET.RESULTS));
  lpGetOrCreateSheet(LP_SHEET.LOG);
}

function lpGetOrCreateSheet(name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function lpEnsureResultsHeader(sheet) {
  const first = sheet.getRange(1, 1).getValue();
  if (first === LP_RESULTS_HEADER[0]) return;
  const headerRange = sheet.getRange(1, 1, 1, LP_RESULTS_HEADER.length);
  headerRange.setValues([LP_RESULTS_HEADER]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1E56A0');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ログ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function writeLog(message) {
  Logger.log(message);
  try {
    const logSheet = ss.getSheetByName(LP_SHEET.LOG);
    if (logSheet) logSheet.appendRow([new Date(), message]);
  } catch (err) {
    Logger.log('writeLog失敗: ' + err.toString());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Browse API フォールバック（デフォルト無効）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 設定シートのC1が "ON" の場合のみフォールバックを有効化
 */
function lpIsFallbackEnabled() {
  try {
    const sheet = ss.getSheetByName(LP_SHEET.SETTINGS);
    if (!sheet) return false;
    return String(sheet.getRange('C1').getValue()).trim() === 'ON';
  } catch (err) {
    return false;
  }
}

/**
 * Browse API による検索フォールバック
 * ※デフォルト無効。設定シートC1="ON"かつ503が3回連続した場合のみ実行
 * @returns {string|null} パーサーが処理可能なモックHTML or null
 */
function lpBrowseFallback(keyword, conditionId) {
  if (!lpIsFallbackEnabled()) return null;

  writeLog('Browse APIフォールバック実行: ' + keyword + ' / ' + conditionId);

  try {
    const config    = getEbayConfig();  // Config.gs
    const token     = getOAuthToken();  // Config.gs
    const searchUrl = config.getBrowseApiUrl() + '/item_summary/search?' + [
      'q='     + encodeURIComponent(keyword),
      'filter=conditionIds:{' + conditionId + '}',
      'filter=itemLocationCountry:JP',
      'filter=buyingOptions:{FIXED_PRICE}',
      'sort=price',
      'limit=10',
    ].join('&');

    const response = UrlFetchApp.fetch(searchUrl, {
      method: 'get',
      headers: {
        'Authorization':             'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID':   'EBAY_US',
        'Content-Type':              'application/json',
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      writeLog('Browse APIフォールバック失敗: HTTP ' + response.getResponseCode());
      return null;
    }

    const data = JSON.parse(response.getContentText());
    if (!data.itemSummaries || data.itemSummaries.length === 0) return null;

    // lpParseItems が処理できるモックHTMLを生成
    let mockHtml = '';
    data.itemSummaries.forEach(function(item) {
      const itemId   = (item.itemId || '').replace('v1|', '').split('|')[0];
      const price    = item.price ? item.price.value : '0';
      const shipping = (item.shippingOptions && item.shippingOptions[0] && item.shippingOptions[0].shippingCost)
        ? '+$' + item.shippingOptions[0].shippingCost.value + ' shipping'
        : 'Free shipping';
      mockHtml += '<li class="s-item">' +
        '<h3 class="s-item__title">'   + (item.title || '').replace(/</g, '&lt;') + '</h3>' +
        '<a href="https://www.ebay.com/itm/' + itemId + '"></a>' +
        '<span class="s-item__price">$' + price + '</span>' +
        '<span class="s-item__shipping">' + shipping + '</span>' +
        '<span class="SECONDARY_INFO">'  + (item.condition || '') + '</span>' +
        '<span class="s-item__location">from Japan</span>' +
        '</li>';
    });

    writeLog('Browse APIフォールバック成功: ' + data.itemSummaries.length + '件取得');
    return mockHtml;

  } catch (err) {
    writeLog('Browse APIフォールバックエラー: ' + err.toString());
    return null;
  }
}

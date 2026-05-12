/**
 * eBay from Japan 最安値検索ツール（スタンドアロン版）
 * Browse APIを使わず全てUrlFetchApp HTMLスクレイピングで実現
 *
 * シート構成:
 *   設定 : A列=キーワードまたはeBay検索URL（A1ヘッダー、A2以降データ）
 *           B1=eBay App ID（Browse APIフォールバック用・任意）
 *           B2=eBay Cert ID（Browse APIフォールバック用・任意）
 *           C1="ON" にするとBrowse APIフォールバックを有効化
 *   結果 : 検索結果出力先
 *   ログ : 実行ログ
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// スプレッドシート取得ヘルパー（Phase 4: グローバルss除去）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * LP 機能用スプレッドシート取得
 * CURRENT_SPREADSHEET_ID (Config.gs で管理) を使用する
 */
function lpGetSpreadsheet_() {
  return getTargetSpreadsheetResearch(CURRENT_SPREADSHEET_ID);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 定数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LP_SHEET = {
  SETTINGS: '設定',
  RESULTS:  '結果',
  LOG:      'ログ',
};

const LP_CONDITIONS = [
  { id: '1000', label: '新品/未使用',         group: '新品' },
  { id: '2750', label: 'ほぼ新品',             group: '中古' },
  { id: '2990', label: '目立った傷や汚れなし', group: '中古' },
  { id: '3000', label: '目立った傷や汚れなし', group: '中古' },
  { id: '3010', label: '傷や汚れあり',          group: '中古' },
  { id: '4000', label: 'やや傷や汚れあり',      group: '中古' },
  { id: '5000', label: '傷や汚れあり',          group: '中古' },
  { id: '6000', label: '全体的に状態が悪い',    group: '中古' },
  { id: '7000', label: 'ジャンク品',            group: '中古' },
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

const LP_MAX_DAILY_REQUESTS   = 100;
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
    .addSeparator()
    .addItem('⏰ 毎日9時に自動実行', 'setupDailyLowestPriceTrigger')
    .addItem('🗑 自動実行を解除',     'removeDailyLowestPriceTrigger')
    .addSeparator()
    .addItem('⚙ 初回設定（トリガー登録）', 'setupLowestPriceTrigger')
    .addToUi();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// トリガー管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * handleEditLowestPrice をインストール可能 onEdit トリガーとして登録
 * メニュー「⚙ 初回設定」から実行する
 */
function setupLowestPriceTrigger(spreadsheetId) {
  const spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  ScriptApp.getUserTriggers(spreadsheet).forEach(function(t) {
    if (t.getHandlerFunction() === 'handleEditLowestPrice') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('handleEditLowestPrice')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  writeLog('handleEditLowestPriceトリガー登録完了');
  SpreadsheetApp.getUi().alert('✅ onEditトリガーを登録しました');
}

/**
 * 毎日9時の自動実行トリガーを設定
 */
function setupDailyLowestPriceTrigger(spreadsheetId) {
  const spreadsheet = getTargetSpreadsheetResearch(spreadsheetId);
  ScriptApp.getUserTriggers(spreadsheet).forEach(function(t) {
    if (t.getHandlerFunction() === 'runAllLowestPrice' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) ScriptApp.deleteTrigger(t);
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
        t.getEventType() === ScriptApp.EventType.CLOCK) { ScriptApp.deleteTrigger(t); removed++; }
  });
  SpreadsheetApp.getUi().alert(removed > 0 ? '✅ 自動実行を解除しました' : '⚠️ 自動実行が設定されていません');
  writeLog('毎日9時の自動実行トリガー削除: ' + removed + '件');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// onEditトリガー（インストール可能）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 設定シートのA列にキーワード/URLが入力された時に発火
 * 関数名を onEdit にしない（二重発火防止）
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
    if (editedCol !== 1 || editedRow < 2) return;

    const input = String(e.range.getValue()).trim();
    if (!input) return;

    writeLog('onEdit発火: "' + input.substring(0, 80) + '" (行' + editedRow + ')');
    lpSearchKeyword(input, Date.now());

  } catch (err) {
    writeLog('handleEditLowestPrice エラー: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 入力値パース（URL or キーワード）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * A列の入力値を解析してキーワード・カテゴリを取得
 *
 * キーワード直接入力例: "pokemon booster box"
 *   → { keyword: "pokemon booster box", sacat: "0", displayName: "pokemon booster box" }
 *
 * eBay検索URL入力例:
 *   "https://www.ebay.com/sch/i.html?_nkw=pokemon+booster+box&_sacat=2536&LH_BIN=1&..."
 *   → { keyword: "pokemon booster box", sacat: "2536", displayName: "pokemon booster box (cat:2536)" }
 *
 * @param {string} input A列の値
 * @returns {{keyword: string, sacat: string, displayName: string}}
 */
function lpParseInput(input) {
  const trimmed = input.trim();

  // eBay URLでなければキーワード直接入力
  if (trimmed.indexOf('ebay.com') === -1) {
    return { keyword: trimmed, sacat: '0', displayName: trimmed };
  }

  // _nkw パラメータを抽出（+ は空白に変換、%xx はデコード）
  const nkwMatch = trimmed.match(/[?&]_nkw=([^&]+)/);
  const keyword  = nkwMatch
    ? decodeURIComponent(nkwMatch[1].replace(/\+/g, ' '))
    : '';

  // _sacat パラメータを抽出
  const sacatMatch = trimmed.match(/[?&]_sacat=([^&]+)/);
  const sacat      = sacatMatch ? sacatMatch[1] : '0';

  // 表示名: "キーワード (cat:カテゴリID)" 形式（カテゴリが 0 でなければ付記）
  const base        = keyword || trimmed.substring(0, 60);
  const displayName = (sacat && sacat !== '0')
    ? base + ' (cat:' + sacat + ')'
    : base;

  return { keyword: base, sacat: sacat, displayName: displayName };
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

    const settingsSheet = lpGetSpreadsheet_().getSheetByName(LP_SHEET.SETTINGS);
    if (!settingsSheet) { SpreadsheetApp.getUi().alert('「設定」シートが見つかりません'); return; }

    const lastRow = settingsSheet.getLastRow();
    if (lastRow < 2) { SpreadsheetApp.getUi().alert('設定シートのA2以降にキーワードを入力してください'); return; }

    const allInputs = settingsSheet
      .getRange(2, 1, lastRow - 1, 1)
      .getValues()
      .map(function(r) { return String(r[0]).trim(); })
      .filter(function(k) { return k !== ''; });

    if (allInputs.length === 0) { SpreadsheetApp.getUi().alert('有効なキーワードがありません'); return; }

    // バッチ進捗（前回中断分の続き）
    const props = PropertiesService.getScriptProperties();
    let startIndex = 0;
    const saved = props.getProperty('LP_BATCH_PROGRESS');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.totalCount === allInputs.length) startIndex = p.completedCount || 0;
      } catch (e_) { /* 無視 */ }
    }
    if (startIndex >= allInputs.length) startIndex = 0;

    const startTime    = Date.now();
    const totalCount   = allInputs.length;
    let completedCount = startIndex;

    writeLog('実行開始: ' + totalCount + '件（' + startIndex + '件目から）');

    for (let i = startIndex; i < allInputs.length; i++) {
      // タイムアウトチェック（330秒）
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

      // バッチ上限チェック
      if (i - startIndex >= LP_MAX_KEYWORDS_PER_RUN) {
        props.setProperty('LP_BATCH_PROGRESS', JSON.stringify({ totalCount: totalCount, completedCount: completedCount }));
        writeLog('バッチ上限(' + LP_MAX_KEYWORDS_PER_RUN + '件)到達');
        SpreadsheetApp.getUi().alert(
          'バッチ完了',
          completedCount + '/' + totalCount + '件完了（' + LP_MAX_KEYWORDS_PER_RUN + '件/バッチ上限）。\n残りはメニューから再実行してください。',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      const input = allInputs[i];
      writeLog('検索開始: "' + input.substring(0, 60) + '" (' + (i + 1) + '/' + totalCount + ')');
      try {
        lpSearchKeyword(input, startTime);
      } catch (err) {
        writeLog('キーワードエラー: ' + err.toString());
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
 * 1件のキーワード/URLに対して全コンディションの最安値を検索
 * @param {string} input A列の値（キーワードまたはeBay検索URL）
 * @param {number} startTime 実行開始時刻 (Date.now())
 */
function lpSearchKeyword(input, startTime) {
  const parsed      = lpParseInput(input);
  const keyword     = parsed.keyword;
  const sacat       = parsed.sacat;
  const displayName = parsed.displayName;

  writeLog('解析結果: keyword="' + keyword + '" sacat=' + sacat + ' display="' + displayName + '"');

  const exchangeRate      = lpGetExchangeRate();
  const isFallbackEnabled = lpIsFallbackEnabled();
  const rows              = [];

  for (let i = 0; i < LP_CONDITIONS.length; i++) {
    const cond = LP_CONDITIONS[i];

    // タイムアウトチェック
    if (startTime && Date.now() - startTime > LP_TIMEOUT_MS) {
      writeLog('タイムアウトにより中断 (cond=' + cond.id + ')');
      break;
    }

    const searchUrl = lpBuildUrl(keyword, cond.id, sacat);

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
      writeLog('取得失敗（全リトライ失敗）: cond=' + cond.id);
      rows.push({ cond: cond, status: 'FETCH_FAILED', searchUrl: searchUrl });
      Utilities.sleep(2000 + Math.random() * 2000);
      continue;
    }

    const items = lpParseItems(html);

    if (items === null) {
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

    const shipUsd  = lowestItem.shippingUsd;
    const totalUsd = lowestItem.priceUsd + (shipUsd !== null ? shipUsd : 0);
    const totalJpy = shipUsd !== null ? Math.round(totalUsd * exchangeRate) : null;

    rows.push({
      cond: cond, status: 'OK',
      item: lowestItem,
      totalUsd: totalUsd, totalJpy: totalJpy,
      descEn: descEn, descJa: descJa,
      searchUrl: searchUrl,
    });

    Utilities.sleep(2000 + Math.random() * 2000);
  }

  lpWriteResults(displayName, rows, exchangeRate);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL構築
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * eBay検索URLを構築（from Japan固定）
 * @param {string} keyword  検索キーワード
 * @param {string} conditionId コンディションID
 * @param {string} sacat    カテゴリID（"0" = 全カテゴリ）
 */
function lpBuildUrl(keyword, conditionId, sacat) {
  const params = [
    '_nkw='             + encodeURIComponent(keyword),
    '_sacat='           + (sacat || '0'),
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
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language':           'en-US,en;q=0.9',
    'Accept-Encoding':           'gzip, deflate, br',
    'Cache-Control':             'no-cache',
    'Pragma':                    'no-cache',
    'Referer':                   'https://www.ebay.com/',
    'sec-ch-ua':                 '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile':          '?0',
    'sec-ch-ua-platform':        '"Windows"',
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'same-origin',
    'Sec-Fetch-User':            '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * eBayページをフェッチ（成功時は1時間キャッシュ）
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
      try { cache.put(cacheKey, html.substring(0, 100000), 3600); } catch (e_) { /* サイズ超過は無視 */ }
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
 */
function lpFetchWithRetry(url, maxRetries, conditionId, keyword) {
  let consecutiveFails = 0;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const html = lpFetchEbayPage(url);
    if (html !== null) return html;

    consecutiveFails++;
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
  // ── 構造フラグ確認 ──
  const hasSItem     = html.indexOf('s-item') !== -1;
  const hasSCard     = html.indexOf('s-card') !== -1;
  const hasVertical  = html.indexOf('s-card--vertical') !== -1;
  const hasSrp       = html.indexOf('srp-results') !== -1;
  const hasListingId = html.indexOf('data-listingid') !== -1;
  Logger.log('[lpParseItems] 構造フラグ: s-item=' + hasSItem +
    ' s-card=' + hasSCard + ' s-card--vertical=' + hasVertical +
    ' srp-results=' + hasSrp + ' data-listingid=' + hasListingId);

  // ── ブロック分割（優先順: s-card--vertical > s-card > s-item） ──
  const MARKERS = [
    'class="s-card s-card--vertical"',  // 現行構造（2026年4月）
    "class='s-card s-card--vertical'",  // シングルクォート変形
    'class="s-card"',                   // 中間構造
    'class="s-item"',                   // 旧構造
  ];

  let liPositions = [];
  for (let m = 0; m < MARKERS.length; m++) {
    const marker = MARKERS[m];
    let pos = 0;
    const tmp = [];
    while (true) {
      const idx = html.indexOf(marker, pos);
      if (idx < 0) break;
      const liIdx = html.lastIndexOf('<li', idx);
      if (liIdx >= 0) tmp.push(liIdx);
      pos = idx + marker.length;
    }
    if (tmp.length > 0) {
      // 重複除去
      liPositions = tmp.filter(function(v, i, a) { return a.indexOf(v) === i; });
      Logger.log('[lpParseItems] マーカー="' + marker + '" → 分割件数: ' + liPositions.length);
      break;
    }
  }

  if (liPositions.length === 0) {
    Logger.log('[lpParseItems] 商品ブロックが見つかりません。HTMLの構造が変わった可能性あり。');
    if (hasSItem) return null; // パーサー破損の可能性
    return [];
  }

  // ── 各ブロックをパース ──
  const items = [];
  for (let i = 0; i < liPositions.length; i++) {
    const start = liPositions[i];
    const end   = (i + 1 < liPositions.length) ? liPositions[i + 1] : html.length;
    const item  = lpParseItemBlock(html.substring(start, end));
    if (item) items.push(item);
  }

  Logger.log('[lpParseItems] 有効件数: ' + items.length + ' / 分割件数: ' + liPositions.length);
  return items;
}

/**
 * 商品ブロック1件をパース（新DOM構造 s-card--vertical 対応）
 *
 * 返却フィールド:
 *   title, url, itemId,
 *   priceText, priceUsd, priceJpy,
 *   shipping: { type: 'FREE'|'USD'|'JPY'|'UNKNOWN', amount: number|null },
 *   conditionText, isFromJapan,
 *   shippingUsd: null （lpGetLowestItem で解決）
 */
function lpParseItemBlock(block) {

  // ── 1. Shop on eBay 除外（listingid 固定値）──
  if (block.indexOf('2500219655424533') >= 0 ||
      block.indexOf('2500219655424563') >= 0 ||
      block.indexOf('s-item__placeholder') >= 0) return null;

  // ── 2. URL / itemId ──
  // 新構造: href="https://www.ebay.com/itm/ITEMID" または href=https://...（クォートなし）
  const urlMatch = block.match(/href="(https?:\/\/www\.ebay\.com\/itm\/(\d+))/) ||
                   block.match(/href=(https?:\/\/www\.ebay\.com\/itm\/(\d+))/)  ||
                   block.match(/href="(\/itm\/(\d+))/);
  if (!urlMatch) return null;
  const url    = urlMatch[1].startsWith('/') ? 'https://www.ebay.com' + urlMatch[1] : urlMatch[1];
  const itemId = urlMatch[2];

  // ── 3. タイトル ──
  // 新構造: <div class="s-card__title"><span class="...primary default">TITLE</span>
  // 旧構造: <h3 class="s-item__title">TITLE</h3>
  let title = '';
  const titleNew = block.match(/<div[^>]*s-card__title[^>]*>\s*<span[^>]*primary[^>]*default[^>]*>([^<]+)/);
  if (titleNew) {
    title = titleNew[1].trim();
  } else {
    const titleOld = block.match(/<(?:h3|span)[^>]*s-item__title[^>]*>([\s\S]*?)<\/(?:h3|span)>/);
    if (titleOld) title = titleOld[1].replace(/<[^>]+>/g, '').trim();
  }
  if (!title || title.length < 3 || title === 'Shop on eBay') return null;

  // ── 4. 価格 ──
  // 新構造: <span class="...s-card__price">$XX.XX or XX,XXX 円</span>
  // 旧構造: <span class="s-item__price">$XX.XX</span>
  let priceText = '', priceUsd = null, priceJpy = null;
  const priceNew = block.match(/<span[^>]*s-card__price[^>]*>([^<]+)/);
  if (priceNew) {
    priceText = priceNew[1].trim();
  } else {
    const priceOld = block.match(/<span[^>]*s-item__price[^>]*>([^<]+)/);
    if (priceOld) priceText = priceOld[1].trim();
  }
  if (priceText) {
    const usdM = priceText.match(/\$\s*([\d,]+\.?\d*)/);
    const jpyM = priceText.match(/([\d,]+)\s*円/);
    if (usdM)      priceUsd = parseFloat(usdM[1].replace(/,/g, ''));
    else if (jpyM) priceJpy = parseInt(jpyM[1].replace(/,/g, ''), 10);
  }
  if (priceUsd === null && priceJpy === null) return null;

  // ── 5. 送料（{ type, amount }） ──
  let shipping = { type: 'UNKNOWN', amount: null };
  if (/free\s*shipping/i.test(block) || /送料無料/.test(block) || /free\s*international/i.test(block)) {
    shipping = { type: 'FREE', amount: 0 };
  } else {
    const jpyShipM = block.match(/[＋+]送料\s*([\d,]+)\s*円/);
    if (jpyShipM) {
      shipping = { type: 'JPY', amount: parseInt(jpyShipM[1].replace(/,/g, ''), 10) };
    } else {
      const usdShipM = block.match(/\+?\$\s*([\d,]+\.?\d*)\s*shipping/i);
      if (usdShipM) shipping = { type: 'USD', amount: parseFloat(usdShipM[1].replace(/,/g, '')) };
    }
  }

  // ── 6. コンディション ──
  // 新構造: <div class="s-card__subtitle"><span ...>COND</span>
  // 旧構造: <span class="SECONDARY_INFO">COND</span>
  let conditionText = '';
  const condNew = block.match(/<div[^>]*s-card__subtitle[^>]*>\s*<span[^>]*>([^<]+)/);
  if (condNew) {
    conditionText = condNew[1].trim();
  } else {
    const condOld = block.match(/class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    if (condOld) conditionText = condOld[1].replace(/<[^>]+>/g, '').trim();
  }

  // ── 7. ロケーション / isFromJapan ──
  // 新構造: 発送元 XX テキスト
  // 旧構造: <span class="s-item__location">from Japan</span>
  let isFromJapan = false;
  const locNew = block.match(/発送元\s*([^\s<"&]{1,20})/);
  if (locNew) {
    const loc = locNew[1].trim();
    isFromJapan = (loc === '日本' || loc === 'Japan');
  }
  if (!isFromJapan) {
    const locOld = block.match(/class="[^"]*s-item__location[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/);
    if (locOld && locOld[1].indexOf('Japan') >= 0) isFromJapan = true;
  }
  if (!isFromJapan && block.indexOf('from Japan') >= 0) isFromJapan = true;

  return {
    title, url, itemId,
    priceText, priceUsd, priceJpy,
    shipping,
    conditionText,
    isFromJapan,
    shippingUsd: null,
  };
}

/**
 * 最安値アイテムを選定（shippingUsd を解決して返す）
 */
function lpGetLowestItem(items, exchangeRate) {
  let lowestItem = null, lowestTotal = Infinity;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // priceUsd: JPYのみの場合は為替換算
    let priceUsd = item.priceUsd;
    if ((priceUsd === null || priceUsd === undefined) && item.priceJpy) {
      priceUsd = Math.round((item.priceJpy / exchangeRate) * 100) / 100;
      item.priceUsd = priceUsd;
    }
    if (!priceUsd || priceUsd <= 0) continue;

    // shippingUsd: shipping { type, amount } から解決
    let shippingUsd = null;
    const ship = item.shipping;
    if (ship) {
      if (ship.type === 'FREE') {
        shippingUsd = 0;
      } else if (ship.type === 'USD' && ship.amount !== null) {
        shippingUsd = ship.amount;
      } else if (ship.type === 'JPY' && ship.amount !== null) {
        shippingUsd = Math.round((ship.amount / exchangeRate) * 100) / 100;
      }
    }
    // 後方互換: 旧 shippingText 形式（Browse APIフォールバックのモックHTMLなど）
    if (shippingUsd === null && item.shippingText) {
      shippingUsd = lpNormalizeShipping(item.shippingText, exchangeRate);
    }
    item.shippingUsd = shippingUsd;

    const total = priceUsd + (shippingUsd !== null ? shippingUsd : 0);
    if (total < lowestTotal) { lowestTotal = total; lowestItem = item; }
  }

  return lowestItem;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 送料正規化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpNormalizeShipping(text, exchangeRate) {
  if (!text) return null;
  const t = text.trim();
  if (/free\s*shipping/i.test(t) || /free\s*international/i.test(t)) return 0;
  const usdMatch = t.match(/\+?\$([0-9,]+\.?[0-9]*)/);
  if (usdMatch) return parseFloat(usdMatch[1].replace(/,/g, ''));
  const jpyMatch = t.match(/JPY\s*([0-9,]+)/i);
  if (jpyMatch) return Math.round((parseFloat(jpyMatch[1].replace(/,/g, '')) / exchangeRate) * 100) / 100;
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 為替レート
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * USD/JPY為替レート取得（open.er-api.com、1時間キャッシュ）
 * フォールバック150はキャッシュに書き込まない
 */
function lpGetExchangeRate() {
  const cache    = CacheService.getScriptCache();
  const cacheKey = 'LP_EXCHANGE_RATE';
  const cached   = cache.get(cacheKey);
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
  return 150;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// コンディション詳細取得
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      const text = m[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
      if (text.length > 5 && text.indexOf('iframe') === -1) return text;
    }
  }
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

function lpTranslate(text) {
  if (!text || !text.trim()) return '';
  let target = text;
  if (text.length > 500) {
    let found = false;
    for (let i = 0; i < LP_CONDITION_KEYWORDS.length; i++) {
      const m = text.match(LP_CONDITION_KEYWORDS[i]);
      if (m) {
        target = text.substring(Math.max(0, m.index - 100), Math.min(text.length, m.index + m[0].length + 100));
        found  = true;
        break;
      }
    }
    if (!found) target = text.substring(0, 500);
  }
  try {
    return LanguageApp.translate(target, 'en', 'ja');
  } catch (err) {
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

function lpWriteResults(displayName, rows, exchangeRate) {
  const sheet    = lpGetOrCreateSheet(LP_SHEET.RESULTS);
  lpEnsureResultsHeader(sheet);
  const now      = new Date();
  const startRow = sheet.getLastRow() + 1;

  for (let i = 0; i < rows.length; i++) {
    const r      = rows[i];
    const cond   = r.cond;
    const rowNum = startRow + i;

    if (r.status === 'FETCH_FAILED') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[now, displayName, cond.group, cond.id, cond.label, '取得失敗', '', '', '', '', '', '', '', '-', '', r.searchUrl]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#FF9999');
      continue;
    }
    if (r.status === 'PARSE_FAILED') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[now, displayName, cond.group, cond.id, cond.label, '取得失敗（パーサー要確認）', '', '', '', '', '', '', '', '-', '', r.searchUrl]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#FF9999');
      continue;
    }
    if (r.status === 'NO_RESULTS') {
      sheet.getRange(rowNum, 1, 1, 16).setValues([[now, displayName, cond.group, cond.id, cond.label, '該当なし', '', '', '', '', '', '', '', '-', '', r.searchUrl]]);
      sheet.getRange(rowNum, 1, 1, 16).setBackground('#CCCCCC');
      continue;
    }

    const item        = r.item;
    const prev        = lpGetPreviousPrice(displayName, cond.id, sheet, rowNum);
    const diff        = lpFormatDiff(r.totalUsd, prev);
    const shipDisplay = item.shippingUsd !== null ? item.shippingUsd : '不明';
    const jpyDisplay  = r.totalJpy !== null ? r.totalJpy : '';

    sheet.getRange(rowNum, 1, 1, 16).setValues([[
      now, displayName, cond.group, cond.id, cond.label,
      item.title || '', item.priceUsd || '', shipDisplay, r.totalUsd || '', jpyDisplay,
      item.conditionText || '', r.descEn || '', r.descJa || '', diff.text,
      item.url || '', r.searchUrl || '',
    ]]);

    // 数値書式
    sheet.getRange(rowNum, LP_COL.PRICE_USD).setNumberFormat('#,##0.00');
    if (item.shippingUsd !== null) sheet.getRange(rowNum, LP_COL.SHIP_USD).setNumberFormat('#,##0.00');
    sheet.getRange(rowNum, LP_COL.TOTAL_USD).setNumberFormat('#,##0.00');
    if (r.totalJpy !== null) sheet.getRange(rowNum, LP_COL.TOTAL_JPY).setNumberFormat('#,##0');

    // URL列をHYPERLINKに
    if (item.url) {
      sheet.getRange(rowNum, LP_COL.ITEM_LINK).setFormula('=HYPERLINK("' + item.url.replace(/"/g, '') + '","商品ページ")');
    }
    if (r.searchUrl) {
      sheet.getRange(rowNum, LP_COL.SEARCH_URL).setFormula('=HYPERLINK("' + r.searchUrl.replace(/"/g, '') + '","検索結果")');
    }

    // 差分の文字色
    if (diff.color) sheet.getRange(rowNum, LP_COL.DIFF).setFontColor(diff.color);
  }

  SpreadsheetApp.flush();
}

function lpGetPreviousPrice(displayName, conditionId, sheet, currentRow) {
  if (currentRow <= 2) return null;
  const lastData = currentRow - 2;
  if (lastData < 1) return null;
  const data = sheet.getRange(2, 1, lastData, LP_COL.TOTAL_USD).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][LP_COL.KEYWORD - 1]) === displayName &&
        String(data[i][LP_COL.COND_ID - 1]) === conditionId) {
      const v = data[i][LP_COL.TOTAL_USD - 1];
      return (v !== '' && !isNaN(v)) ? parseFloat(v) : null;
    }
  }
  return null;
}

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
  return 'LP_REQ_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function lpCheckRequestLimit() {
  return parseInt(PropertiesService.getScriptProperties().getProperty(lpTodayKey()) || '0') < LP_MAX_DAILY_REQUESTS;
}

function lpIncrementRequestCount() {
  const props = PropertiesService.getScriptProperties(), key = lpTodayKey();
  props.setProperty(key, String(parseInt(props.getProperty(key) || '0') + 1));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// シート管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpInitSheets() {
  const settingsSheet = lpGetOrCreateSheet(LP_SHEET.SETTINGS);
  // 設定シートのA1ヘッダー初期化
  if (!settingsSheet.getRange('A1').getValue()) {
    settingsSheet.getRange('A1').setValue('キーワード / eBay検索URL');
    settingsSheet.getRange('A1').setFontWeight('bold');
  }
  lpEnsureResultsHeader(lpGetOrCreateSheet(LP_SHEET.RESULTS));
  lpGetOrCreateSheet(LP_SHEET.LOG);
}

function lpGetOrCreateSheet(name) {
  return lpGetSpreadsheet_().getSheetByName(name) || lpGetSpreadsheet_().insertSheet(name);
}

function lpEnsureResultsHeader(sheet) {
  if (sheet.getRange(1, 1).getValue() === LP_RESULTS_HEADER[0]) return;
  const r = sheet.getRange(1, 1, 1, LP_RESULTS_HEADER.length);
  r.setValues([LP_RESULTS_HEADER]);
  r.setFontWeight('bold');
  r.setBackground('#1E56A0');
  r.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ログ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function writeLog(message) {
  Logger.log(message);
  try {
    const logSheet = lpGetSpreadsheet_().getSheetByName(LP_SHEET.LOG);
    if (logSheet) logSheet.appendRow([new Date(), message]);
  } catch (err) {
    Logger.log('writeLog失敗: ' + err.toString());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Browse API フォールバック（デフォルト無効）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function lpIsFallbackEnabled() {
  try {
    const sheet = lpGetSpreadsheet_().getSheetByName(LP_SHEET.SETTINGS);
    if (!sheet) return false;
    return String(sheet.getRange('C1').getValue()).trim() === 'ON';
  } catch (err) { return false; }
}

/**
 * Browse API フォールバック（設定シートC1="ON"かつ503が3回連続した時のみ実行）
 * スタンドアロン版: 設定シートB1=App ID、B2=Cert IDから認証
 */
function lpBrowseFallback(keyword, conditionId) {
  if (!lpIsFallbackEnabled()) return null;

  writeLog('Browse APIフォールバック実行: ' + keyword + ' / ' + conditionId);

  try {
    const settingsSheet = lpGetSpreadsheet_().getSheetByName(LP_SHEET.SETTINGS);
    if (!settingsSheet) return null;

    const appId  = String(settingsSheet.getRange('B1').getValue()).trim();
    const certId = String(settingsSheet.getRange('B2').getValue()).trim();
    if (!appId || !certId) {
      writeLog('Browse APIフォールバック: 設定シートB1(App ID)・B2(Cert ID)が未設定');
      return null;
    }

    // OAuth トークン取得
    const tokenResp = UrlFetchApp.fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(appId + ':' + certId),
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      payload: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      muteHttpExceptions: true,
    });
    if (tokenResp.getResponseCode() !== 200) {
      writeLog('Browse APIフォールバック: トークン取得失敗 HTTP ' + tokenResp.getResponseCode());
      return null;
    }
    const token = JSON.parse(tokenResp.getContentText()).access_token;

    // Browse API 検索
    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search?' + [
      'q='     + encodeURIComponent(keyword),
      'filter=conditionIds:{' + conditionId + '}',
      'filter=itemLocationCountry:JP',
      'filter=buyingOptions:{FIXED_PRICE}',
      'sort=price',
      'limit=10',
    ].join('&');

    const response = UrlFetchApp.fetch(searchUrl, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
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
      mockHtml += '<li data-listingid="' + itemId + '" class="s-card s-card--vertical">' +
        '<div class="s-card__title"><span class="su-styled-text primary default">' +
        (item.title || '').replace(/</g, '&lt;') + '</span></div>' +
        '<a href="https://www.ebay.com/itm/' + itemId + '"></a>' +
        '<span class="su-styled-text primary bold large-1 s-card__price">$' + price + '</span>' +
        '<div class="s-card__subtitle"><span class="su-styled-text secondary default">' +
        (item.condition || '') + '</span></div>' +
        '<span class="ship-info">' + shipping + '</span>' +
        '<span class="loc-info">from Japan</span>' +
        '</li>';
    });

    writeLog('Browse APIフォールバック成功: ' + data.itemSummaries.length + '件取得');
    return mockHtml;

  } catch (err) {
    writeLog('Browse APIフォールバックエラー: ' + err.toString());
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// テスト用（clasp run専用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * lpParseItems / lpParseItemBlock の動作確認（clasp run testLpParser）
 *
 * ログ出力内容:
 *   1. 構造フラグ確認（s-item / s-card / srp-results / data-listingid）
 *   2. 分割件数・有効件数
 *   3. 最初の3件の全フィールド
 */
function testLpParser() {
  const TEST_URL =
    'https://www.ebay.com/sch/i.html' +
    '?_nkw=pokemon+booster+box&_sacat=0&LH_BIN=1&LH_ItemCondition=2750' +
    '&_sop=15&_salic=104&LH_LocatedIn=1';

  Logger.log('========================================');
  Logger.log('testLpParser 開始');
  Logger.log('URL: ' + TEST_URL);
  Logger.log('========================================');

  const html = lpFetchEbayPage(TEST_URL);
  if (!html) {
    Logger.log('ERROR: HTMLの取得に失敗しました');
    return;
  }
  Logger.log('HTML取得完了: ' + html.length + ' bytes');
  Logger.log('[HTML先頭1000文字]\n' + html.substring(0, 1000));

  // ── 構造フラグ（lpParseItems内でも出力されるが先行確認） ──
  Logger.log('--- 構造フラグ ---');
  Logger.log('s-item        : ' + (html.indexOf('s-item') !== -1));
  Logger.log('s-card        : ' + (html.indexOf('s-card') !== -1));
  Logger.log('s-card--vert  : ' + (html.indexOf('s-card--vertical') !== -1));
  Logger.log('srp-results   : ' + (html.indexOf('srp-results') !== -1));
  Logger.log('data-listingid: ' + (html.indexOf('data-listingid') !== -1));

  const items = lpParseItems(html);

  if (items === null) {
    Logger.log('RESULT: パーサー破損 (s-item あり / 有効件数0)');
    return;
  }

  Logger.log('--- 結果サマリー ---');
  Logger.log('有効件数: ' + items.length);

  if (items.length === 0) {
    Logger.log('RESULT: 有効商品なし');
    return;
  }

  Logger.log('--- 上位3件（全フィールド） ---');
  const limit = Math.min(3, items.length);
  for (let i = 0; i < limit; i++) {
    const it = items[i];
    Logger.log('[' + (i + 1) + '] title       : ' + it.title);
    Logger.log('[' + (i + 1) + '] url         : ' + it.url);
    Logger.log('[' + (i + 1) + '] itemId      : ' + it.itemId);
    Logger.log('[' + (i + 1) + '] priceText   : ' + it.priceText);
    Logger.log('[' + (i + 1) + '] priceUsd    : ' + it.priceUsd);
    Logger.log('[' + (i + 1) + '] priceJpy    : ' + it.priceJpy);
    Logger.log('[' + (i + 1) + '] shipping    : ' + JSON.stringify(it.shipping));
    Logger.log('[' + (i + 1) + '] conditionText: ' + it.conditionText);
    Logger.log('[' + (i + 1) + '] isFromJapan : ' + it.isFromJapan);
    Logger.log('');
  }

  Logger.log('========================================');
  Logger.log('testLpParser 完了');
  Logger.log('========================================');
}

function checkLowestPriceResults() {
  const logSheet     = lpGetSpreadsheet_().getSheetByName(LP_SHEET.LOG);
  const resultsSheet = lpGetSpreadsheet_().getSheetByName(LP_SHEET.RESULTS);
  const out          = { logs: [], results: [], resultCount: 0 };

  if (logSheet && logSheet.getLastRow() > 1) {
    out.logs = logSheet.getRange(2, 1, Math.min(logSheet.getLastRow() - 1, 60), 2)
      .getValues().map(function(r) { return r[1]; });
  }
  if (resultsSheet && resultsSheet.getLastRow() > 1) {
    const data = resultsSheet.getRange(2, 1, resultsSheet.getLastRow() - 1, 16).getValues();
    out.resultCount = data.length;
    out.results = data.map(function(r) {
      return {
        keyword: r[1], condId: r[3], condJa: r[4],
        title:   String(r[5]).substring(0, 60),
        priceUsd: r[6], shipUsd: r[7], totalUsd: r[8], totalJpy: r[9], diff: r[13],
      };
    });
  }
  return JSON.stringify(out);
}

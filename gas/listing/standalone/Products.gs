/**
 * 商品関連機能
 *
 * eBay の商品検索、取得、管理機能を提供します
 */

/**
 * 商品をスプレッドシートに書き込む
 *
 * @param {Array<Object>} items - 商品データの配列
 */
function writeProductsToSheet(items) {
  const config = getConfig();
  const sheetName = config.SHEET_NAMES.PRODUCTS;

  const headers = [
    'Item ID',
    'タイトル',
    '価格',
    '通貨',
    'カテゴリ',
    'コンディション',
    '在庫状況',
    'URL',
    '画像URL',
    '更新日時'
  ];

  const keys = [
    'itemId',
    'title',
    'price',
    'currency',
    'category',
    'condition',
    'availability',
    'itemWebUrl',
    'imageUrl',
    'updatedAt'
  ];

  // 商品データを整形
  const products = items.map(item => ({
    itemId: item.itemId || '',
    title: item.title || '',
    price: item.price ? item.price.value : '',
    currency: item.price ? item.price.currency : '',
    category: item.categories && item.categories.length > 0 ? item.categories[0].categoryName : '',
    condition: item.condition || '',
    availability: item.itemEndDate ? '終了' : '販売中',
    itemWebUrl: item.itemWebUrl || '',
    imageUrl: item.image ? item.image.imageUrl : '',
    updatedAt: formatDate(new Date())
  }));

  writeObjectsToSheet(sheetName, products, headers, keys);
  logToSheet('INFO', '商品データ書き込み', products.length + '件の商品を書き込みました');
}

/**
 * キーワードで商品を検索してシートに書き込む
 *
 * @param {string} keyword - 検索キーワード
 * @param {Object} options - 検索オプション
 */
function searchAndWriteProducts(keyword, options) {
  try {
    logToSheet('INFO', '商品検索開始', 'キーワード: ' + keyword);

    // 商品を検索
    const result = searchItems(keyword, options);

    if (!result || !result.itemSummaries || result.itemSummaries.length === 0) {
      showError('検索結果なし', new Error('該当する商品が見つかりませんでした'));
      return;
    }

    // スプレッドシートに書き込み
    writeProductsToSheet(result.itemSummaries);

    showSuccess(
      '商品検索完了',
      '検索結果: ' + result.total + ' 件\n' +
      '取得件数: ' + result.itemSummaries.length + ' 件'
    );
  } catch (error) {
    showError('商品検索エラー', error);
  }
}

/**
 * 複数の商品詳細を取得してシートに書き込む
 *
 * @param {Array<string>} itemIds - 商品IDの配列
 */
function getMultipleProductDetails(itemIds) {
  try {
    logToSheet('INFO', '商品詳細取得開始', itemIds.length + '件');

    const items = [];

    itemIds.forEach((itemId, index) => {
      try {
        Logger.log('商品取得中: ' + (index + 1) + '/' + itemIds.length);
        const item = getItem(itemId);
        items.push(item);

        // レート制限対策
        const config = getConfig();
        if (config.RATE_LIMIT_DELAY) {
          Utilities.sleep(config.RATE_LIMIT_DELAY);
        }
      } catch (error) {
        Logger.log('商品取得エラー (' + itemId + '): ' + error.toString());
        logToSheet('WARNING', '商品取得エラー', 'Item ID: ' + itemId + ', エラー: ' + error.message);
      }
    });

    if (items.length > 0) {
      writeProductsToSheet(items);
      showSuccess('商品詳細取得完了', items.length + '件の商品詳細を取得しました');
    } else {
      showError('取得失敗', new Error('商品詳細を取得できませんでした'));
    }
  } catch (error) {
    showError('商品詳細取得エラー', error);
  }
}

/**
 * シートから商品IDを読み取って詳細を取得
 */
function fetchProductDetailsFromSheet() {
  try {
    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.PRODUCTS, { startRow: 2 });

    if (data.length === 0) {
      showError('データなし', new Error('商品マスタシートにデータがありません'));
      return;
    }

    // 最初の列（Item ID）を取得
    const itemIds = data.map(row => row[0]).filter(id => id !== '');

    if (itemIds.length === 0) {
      showError('Item ID なし', new Error('有効な Item ID が見つかりません'));
      return;
    }

    // 確認ダイアログ
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      '商品詳細取得',
      itemIds.length + '件の商品詳細を取得します。よろしいですか？',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      getMultipleProductDetails(itemIds);
    }
  } catch (error) {
    showError('商品詳細取得エラー', error);
  }
}

/**
 * カテゴリ別に商品を検索
 *
 * @param {string} categoryId - カテゴリID
 * @param {Object} options - 検索オプション
 */
function searchProductsByCategory(categoryId, options) {
  options = options || {};
  options.filter = 'categoryIds:{' + categoryId + '}';

  try {
    logToSheet('INFO', 'カテゴリ別商品検索', 'カテゴリID: ' + categoryId);

    const result = searchItems('*', options);

    if (!result || !result.itemSummaries || result.itemSummaries.length === 0) {
      showError('検索結果なし', new Error('該当する商品が見つかりませんでした'));
      return;
    }

    writeProductsToSheet(result.itemSummaries);

    showSuccess(
      'カテゴリ別商品検索完了',
      'カテゴリID: ' + categoryId + '\n' +
      '検索結果: ' + result.total + ' 件\n' +
      '取得件数: ' + result.itemSummaries.length + ' 件'
    );
  } catch (error) {
    showError('カテゴリ別商品検索エラー', error);
  }
}

/**
 * 商品データをエクスポート（CSV）
 */
function exportProductsToCSV() {
  try {
    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.PRODUCTS);

    if (data.length === 0) {
      showError('データなし', new Error('エクスポートするデータがありません'));
      return;
    }

    // CSV 形式に変換
    const csv = data.map(row => {
      return row.map(cell => {
        // カンマやダブルクォートを含む場合はエスケープ
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',');
    }).join('\n');

    // Blob を作成してダウンロード可能にする
    const blob = Utilities.newBlob(csv, 'text/csv', 'ebay_products_' + formatDate(new Date(), 'yyyyMMdd_HHmmss') + '.csv');

    // ドライブに保存（または他の方法でダウンロード）
    // const file = DriveApp.createFile(blob);
    // Logger.log('CSV ファイルを作成しました: ' + file.getUrl());

    showSuccess('エクスポート完了', 'CSV データを生成しました\n行数: ' + data.length);
  } catch (error) {
    showError('エクスポートエラー', error);
  }
}

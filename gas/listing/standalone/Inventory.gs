/**
 * 在庫関連機能
 *
 * eBay の在庫管理機能を提供します
 */

/**
 * eBay から在庫情報を同期
 *
 * @returns {Object} 同期結果 { count: number, errors: number }
 */
function syncInventoryFromEbay() {
  try {
    logToSheet('INFO', '在庫同期開始', 'eBay から在庫情報を取得します');

    // TODO: 実際の在庫取得ロジックを実装
    // ここでは仮のデータを返す
    const result = {
      count: 0,
      errors: 0
    };

    // シートから SKU リストを取得
    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.INVENTORY, { startRow: 2 });

    if (data.length === 0) {
      Logger.log('在庫シートにデータがありません');
      return result;
    }

    // SKU ごとに在庫情報を取得
    data.forEach((row, index) => {
      const sku = row[0];

      if (!sku) {
        return;
      }

      try {
        Logger.log('在庫取得中: ' + (index + 1) + '/' + data.length + ' (SKU: ' + sku + ')');

        // 在庫アイテムを取得
        const inventoryItem = getInventoryItem(sku);

        if (inventoryItem) {
          // シートを更新
          updateInventoryInSheet(sku, inventoryItem);
          result.count++;
        }

        // レート制限対策
        if (config.RATE_LIMIT_DELAY) {
          Utilities.sleep(config.RATE_LIMIT_DELAY);
        }
      } catch (error) {
        Logger.log('在庫取得エラー (' + sku + '): ' + error.toString());
        logToSheet('WARNING', '在庫取得エラー', 'SKU: ' + sku + ', エラー: ' + error.message);
        result.errors++;
      }
    });

    logToSheet('INFO', '在庫同期完了', '成功: ' + result.count + '件, エラー: ' + result.errors + '件');
    return result;
  } catch (error) {
    logToSheet('ERROR', '在庫同期エラー', error.message);
    throw error;
  }
}

/**
 * シートの在庫情報を更新
 *
 * @param {string} sku - SKU
 * @param {Object} inventoryItem - 在庫アイテムデータ
 */
function updateInventoryInSheet(sku, inventoryItem) {
  const config = getConfig();
  const sheet = getOrCreateSheet(config.SHEET_NAMES.INVENTORY);

  // ヘッダーがない場合は追加
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:F1').setValues([[
      'SKU',
      '商品名',
      '在庫数',
      'ロケーション',
      'ステータス',
      '更新日時'
    ]]);
    sheet.getRange('A1:F1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  }

  // SKU で行を検索
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sku) {
      rowIndex = i + 1; // シートの行番号（1始まり）
      break;
    }
  }

  // データを準備
  const availability = inventoryItem.availability || {};
  const shipToLocationAvailability = availability.shipToLocationAvailability || {};
  const quantity = shipToLocationAvailability.quantity || 0;

  const product = inventoryItem.product || {};
  const title = product.title || '';

  const rowData = [
    sku,
    title,
    quantity,
    '', // ロケーション（必要に応じて実装）
    inventoryItem.condition || '',
    formatDate(new Date())
  ];

  // 行が見つかった場合は更新、見つからない場合は追加
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  Logger.log('在庫を更新しました: ' + sku);
}

/**
 * 在庫を一括更新（スプレッドシートから eBay へ）
 */
function updateInventoryToEbay() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      '在庫一括更新',
      'スプレッドシートの在庫情報を eBay に反映します。よろしいですか？',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    logToSheet('INFO', '在庫一括更新開始', 'eBay に在庫情報を送信します');

    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.INVENTORY, { startRow: 2 });

    if (data.length === 0) {
      showError('データなし', new Error('更新する在庫データがありません'));
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    data.forEach((row, index) => {
      const sku = row[0];
      const quantity = row[2];

      if (!sku) {
        return;
      }

      try {
        Logger.log('在庫更新中: ' + (index + 1) + '/' + data.length + ' (SKU: ' + sku + ')');

        // 在庫アイテムデータを構築
        const inventoryItem = {
          availability: {
            shipToLocationAvailability: {
              quantity: parseInt(quantity) || 0
            }
          }
        };

        // 在庫を更新
        createOrUpdateInventoryItem(sku, inventoryItem);
        successCount++;

        // レート制限対策
        if (config.RATE_LIMIT_DELAY) {
          Utilities.sleep(config.RATE_LIMIT_DELAY);
        }
      } catch (error) {
        Logger.log('在庫更新エラー (' + sku + '): ' + error.toString());
        logToSheet('WARNING', '在庫更新エラー', 'SKU: ' + sku + ', エラー: ' + error.message);
        errorCount++;
      }
    });

    showSuccess(
      '在庫一括更新完了',
      '成功: ' + successCount + '件\n' +
      'エラー: ' + errorCount + '件'
    );

    logToSheet('INFO', '在庫一括更新完了', '成功: ' + successCount + '件, エラー: ' + errorCount + '件');
  } catch (error) {
    showError('在庫一括更新エラー', error);
  }
}

/**
 * 在庫アラートをチェック
 * 在庫数が指定の閾値を下回った場合に警告
 *
 * @param {number} threshold - 閾値（デフォルト: 10）
 */
function checkInventoryAlerts(threshold) {
  threshold = threshold || 10;

  try {
    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.INVENTORY, { startRow: 2 });

    if (data.length === 0) {
      return;
    }

    const lowStockItems = [];

    data.forEach(row => {
      const sku = row[0];
      const title = row[1];
      const quantity = parseInt(row[2]) || 0;

      if (quantity < threshold) {
        lowStockItems.push({
          sku: sku,
          title: title,
          quantity: quantity
        });
      }
    });

    if (lowStockItems.length > 0) {
      const message = '以下の商品の在庫が少なくなっています:\n\n' +
        lowStockItems.map(item =>
          '- ' + item.title + ' (SKU: ' + item.sku + ') : ' + item.quantity + '個'
        ).join('\n');

      logToSheet('WARNING', '在庫アラート', lowStockItems.length + '件の商品が閾値以下');

      const ui = SpreadsheetApp.getUi();
      ui.alert('在庫アラート', message, ui.ButtonSet.OK);
    } else {
      Logger.log('在庫アラート: 該当なし');
    }
  } catch (error) {
    showError('在庫アラートチェックエラー', error);
  }
}

/**
 * 在庫レポートを生成
 */
function generateInventoryReport() {
  try {
    const config = getConfig();
    const data = readDataFromSheet(config.SHEET_NAMES.INVENTORY, { startRow: 2 });

    if (data.length === 0) {
      showError('データなし', new Error('在庫データがありません'));
      return;
    }

    // 統計を計算
    let totalItems = 0;
    let totalQuantity = 0;
    let lowStockCount = 0;
    const threshold = 10;

    data.forEach(row => {
      const quantity = parseInt(row[2]) || 0;
      totalItems++;
      totalQuantity += quantity;

      if (quantity < threshold) {
        lowStockCount++;
      }
    });

    const avgQuantity = totalItems > 0 ? (totalQuantity / totalItems).toFixed(2) : 0;

    // レポートを表示
    const report =
      '=== 在庫レポート ===\n\n' +
      '総商品数: ' + totalItems + '件\n' +
      '総在庫数: ' + totalQuantity + '個\n' +
      '平均在庫数: ' + avgQuantity + '個\n' +
      '低在庫商品: ' + lowStockCount + '件 (閾値: ' + threshold + '個)';

    const ui = SpreadsheetApp.getUi();
    ui.alert('在庫レポート', report, ui.ButtonSet.OK);

    logToSheet('INFO', '在庫レポート生成', report);
  } catch (error) {
    showError('在庫レポート生成エラー', error);
  }
}

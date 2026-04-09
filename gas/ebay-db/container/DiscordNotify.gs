/**
 * DiscordNotify.gs - Discord Webhook 通知
 * ebay-db 原本ブック専用
 */

/**
 * Discord に通知を送信
 * @param {string} message - 送信するメッセージ本文
 */
function notifyDiscord(message) {
  var config = getConfig();
  var webhook = config['DISCORD_WEBHOOK_EBAYDB'];

  if (!webhook) {
    Logger.log('⚠️ DISCORD_WEBHOOK_EBAYDB が未設定のため通知をスキップ');
    return;
  }

  var payload = JSON.stringify({ content: message });
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(webhook, options);
    if (response.getResponseCode() !== 204) {
      Logger.log('Discord通知エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
    } else {
      Logger.log('Discord通知 送信完了');
    }
  } catch (e) {
    Logger.log('Discord通知 例外: ' + e.toString());
  }
}

/**
 * 差分サマリー通知を生成して送信
 * @param {Object} diffResult - 差分検出結果
 * @param {Object} checkResult - 整合性チェック結果
 * @param {boolean} transferred - 転記実行フラグ
 */
function notifySyncResult(diffResult, checkResult, transferred) {
  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  var lines = [];

  if (transferred) {
    lines.push('✅ **ebay-db 月次同期 完了** — ' + now);
  } else {
    lines.push('⚠️ **ebay-db 月次同期 FAIL** — ' + now);
  }

  // 差分サマリー
  lines.push('');
  lines.push('**📊 差分サマリー**');
  lines.push('category_master: +' + diffResult.categoryAdded + ' / -' + diffResult.categoryRemoved + ' / ~' + diffResult.categoryChanged);
  lines.push('condition_ja_map: +' + diffResult.conditionAdded + ' / -' + diffResult.conditionRemoved);

  // 整合性チェック結果
  lines.push('');
  lines.push('**🔍 整合性チェック**');
  if (checkResult.passed) {
    lines.push('✅ 全チェック PASS → サービス提供用ブックへ転記しました');
  } else {
    lines.push('❌ チェック FAIL → 転記はブロックされました');
    if (checkResult.missingConditionIds && checkResult.missingConditionIds.length > 0) {
      lines.push('- condition_ja_map 未登録 condition_id: ' + checkResult.missingConditionIds.join(', '));
    }
    if (checkResult.emptyJaDisplay && checkResult.emptyJaDisplay.length > 0) {
      lines.push('- ja_display 空欄: ' + checkResult.emptyJaDisplay.length + '件');
      checkResult.emptyJaDisplay.slice(0, 5).forEach(function(row) {
        lines.push('  → condition_id ' + row.condition_id + ' (' + row.condition_name + ')');
      });
    }
    if (checkResult.invalidFvf && checkResult.invalidFvf.length > 0) {
      lines.push('- FVFレート範囲外: ' + checkResult.invalidFvf.length + '件');
    }
    lines.push('- 原本ブックで確認後、GASメニューから再実行してください');
  }

  notifyDiscord(lines.join('\n'));
}

/**
 * エラー通知
 * @param {string} errorMessage - エラー内容
 */
function notifyError(errorMessage) {
  var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  var message = '🚨 **ebay-db 同期エラー** — ' + now + '\n' + errorMessage;
  notifyDiscord(message);
}

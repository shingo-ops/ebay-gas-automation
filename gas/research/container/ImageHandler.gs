/**
 * 画像処理ハンドラー
 * 画像URLから画像をダウンロードしてGoogleドライブに保存
 */

/**
 * 画像URLから画像をダウンロードしてGoogleドライブに保存
 *
 * @param {string} imageUrl 画像URL
 * @param {string} folderUrl Googleドライブフォルダ URL
 * @param {string} fileName ファイル名（省略可、省略時は自動生成）
 * @returns {Object} {success: boolean, driveUrl: string, message: string}
 */
function downloadAndSaveImage(imageUrl, folderUrl, fileName) {
  try {
    if (!imageUrl || imageUrl.toString().trim() === '') {
      return {
        success: false,
        driveUrl: '',
        message: '画像URLが空です'
      };
    }

    if (!folderUrl || folderUrl.toString().trim() === '') {
      return {
        success: false,
        driveUrl: '',
        message: 'フォルダURLが設定されていません'
      };
    }

    // フォルダIDを抽出
    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return {
        success: false,
        driveUrl: '',
        message: 'フォルダURLからIDを抽出できませんでした'
      };
    }

    // フォルダを取得
    Logger.log('フォルダIDでフォルダを取得中: ' + folderId);
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
      Logger.log('✅ フォルダ取得成功: ' + folder.getName());
    } catch (folderError) {
      Logger.log('❌ フォルダ取得失敗: ' + folderError.toString());
      return {
        success: false,
        driveUrl: '',
        message: 'フォルダへのアクセスに失敗しました: ' + folderError.toString()
      };
    }

    // 画像をダウンロード
    Logger.log('画像ダウンロード中: ' + imageUrl);
    const response = UrlFetchApp.fetch(imageUrl.toString(), {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return {
        success: false,
        driveUrl: '',
        message: '画像のダウンロードに失敗しました（HTTP ' + response.getResponseCode() + '）'
      };
    }

    // Blob取得
    const blob = response.getBlob();

    // Content-Typeから拡張子を取得
    const contentType = blob.getContentType();
    const extension = getExtensionFromContentType(contentType);

    // ファイル名を生成
    let finalFileName;
    if (fileName) {
      // ファイル名が渡された場合、拡張子を付ける
      // 既に拡張子が付いている場合は何もしない
      if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
        finalFileName = fileName;
      } else {
        finalFileName = fileName + extension;
      }
    } else {
      // ファイル名が省略された場合はタイムスタンプ + 拡張子
      finalFileName = 'image_' + new Date().getTime() + extension;
    }

    // Googleドライブに保存（MIMEタイプを明示的に設定）
    Logger.log('Googleドライブに保存中: ' + finalFileName + ' (MIME: ' + contentType + ')');

    // BlobにMIMEタイプとファイル名を設定
    const imageBlob = blob.setContentType(contentType).setName(finalFileName);

    // ファイルを作成
    Logger.log('フォルダにファイルを作成中...');
    let file;
    try {
      file = folder.createFile(imageBlob);
      Logger.log('✅ ファイル作成成功: ' + file.getName());
    } catch (createError) {
      Logger.log('❌ ファイル作成失敗: ' + createError.toString());
      return {
        success: false,
        driveUrl: '',
        message: 'ファイルの作成に失敗しました: ' + createError.toString()
      };
    }

    // 共有設定を変更（リンクを知っている全員が閲覧可能）
    // 注意: setSharing()は権限エラーが発生する場合があるため、try-catchで保護
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log('共有設定を変更しました');
    } catch (sharingError) {
      Logger.log('⚠️ 共有設定の変更に失敗（スキップ）: ' + sharingError.toString());
      // 共有設定に失敗しても画像保存は成功としてそのまま続行
    }

    // ファイルのURLを取得
    const driveUrl = file.getUrl();

    Logger.log('画像保存完了: ' + driveUrl);

    return {
      success: true,
      driveUrl: driveUrl,
      message: '画像を保存しました'
    };

  } catch (error) {
    Logger.log('downloadAndSaveImageエラー: ' + error.toString());
    return {
      success: false,
      driveUrl: '',
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * 複数の画像URLから画像をダウンロードして保存
 *
 * @param {Array<string>} imageUrls 画像URLの配列
 * @param {string} folderUrl Googleドライブフォルダ URL
 * @param {string} baseFileName ベースファイル名（省略可）
 * @returns {Array<Object>} 各画像の処理結果配列
 */
function downloadMultipleImages(imageUrls, folderUrl, baseFileName) {
  const results = [];

  imageUrls.forEach(function(imageUrl, index) {
    if (imageUrl && imageUrl.toString().trim() !== '') {
      const fileName = baseFileName ? baseFileName + '_' + (index + 1) : null;
      const result = downloadAndSaveImage(imageUrl, folderUrl, fileName);
      results.push(result);
    } else {
      results.push({
        success: false,
        driveUrl: '',
        message: '画像URLが空です'
      });
    }
  });

  return results;
}

/**
 * GoogleドライブフォルダURLからフォルダIDを抽出
 *
 * @param {string} folderUrl フォルダURL
 * @returns {string|null} フォルダID
 */
function extractFolderId(folderUrl) {
  try {
    const urlString = folderUrl.toString();

    // パターン1: https://drive.google.com/drive/folders/{FOLDER_ID}
    let match = urlString.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }

    // パターン2: https://drive.google.com/drive/u/0/folders/{FOLDER_ID}
    match = urlString.match(/\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }

    // パターン3: フォルダIDそのまま
    if (/^[a-zA-Z0-9_-]+$/.test(urlString)) {
      return urlString;
    }

    return null;

  } catch (error) {
    Logger.log('extractFolderIdエラー: ' + error.toString());
    return null;
  }
}

/**
 * Content-Typeから拡張子を取得
 *
 * @param {string} contentType Content-Type
 * @returns {string} 拡張子（.付き）
 */
function getExtensionFromContentType(contentType) {
  const typeMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg'
  };

  return typeMap[contentType] || '.jpg'; // デフォルトは.jpg
}

/**
 * 画像URLから画像情報を取得（サイズ、Content-Typeなど）
 *
 * @param {string} imageUrl 画像URL
 * @returns {Object} {success: boolean, contentType: string, size: number, message: string}
 */
function getImageInfo(imageUrl) {
  try {
    const response = UrlFetchApp.fetch(imageUrl.toString(), {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return {
        success: false,
        contentType: '',
        size: 0,
        message: 'HTTP ' + response.getResponseCode()
      };
    }

    const blob = response.getBlob();
    const contentType = blob.getContentType();
    const size = blob.getBytes().length;

    return {
      success: true,
      contentType: contentType,
      size: size,
      message: 'OK'
    };

  } catch (error) {
    return {
      success: false,
      contentType: '',
      size: 0,
      message: 'エラー: ' + error.toString()
    };
  }
}

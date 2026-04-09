"""
upload_to_drive.py
category_master.csv と condition_ja_map.csv を Google Drive に アップロード
既存ファイルがあれば上書き（同名ファイルを削除してから新規作成）
"""

import os
import json
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", ".")
CSV_FILES = ["category_master.csv", "condition_ja_map.csv"]


def get_drive_service():
    """サービスアカウントキーから Drive API クライアントを生成"""
    key_json = os.environ["GCP_SERVICE_ACCOUNT_KEY"]
    key_dict = json.loads(key_json)

    credentials = service_account.Credentials.from_service_account_info(
        key_dict,
        scopes=["https://www.googleapis.com/auth/drive"],
    )
    return build("drive", "v3", credentials=credentials)


def delete_existing_file(service, folder_id: str, filename: str) -> None:
    """フォルダ内の同名ファイルを削除"""
    query = (
        f"name='{filename}' and '{folder_id}' in parents "
        "and mimeType='text/csv' and trashed=false"
    )
    results = service.files().list(q=query, fields="files(id, name)").execute()
    for f in results.get("files", []):
        service.files().delete(fileId=f["id"]).execute()
        print(f"  削除: {f['name']} (id={f['id']})")


def upload_file(service, folder_id: str, filename: str) -> str:
    """CSVファイルをGoogle Driveにアップロード"""
    local_path = f"{OUTPUT_DIR}/{filename}"

    file_metadata = {
        "name": filename,
        "parents": [folder_id],
        "mimeType": "text/csv",
    }
    media = MediaFileUpload(local_path, mimetype="text/csv", resumable=True)

    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id, name, size",
    ).execute()

    print(f"  アップロード完了: {file['name']} (id={file['id']}, size={file.get('size')}bytes)")
    return file["id"]


def main():
    print("=== upload_to_drive.py 開始 ===")

    folder_id = os.environ["DRIVE_CSV_FOLDER_ID"]
    service = get_drive_service()

    for filename in CSV_FILES:
        local_path = f"{OUTPUT_DIR}/{filename}"
        if not os.path.exists(local_path):
            print(f"⚠️ {filename} が見つかりません。スキップ")
            continue

        print(f"アップロード中: {filename}")
        delete_existing_file(service, folder_id, filename)
        upload_file(service, folder_id, filename)

    print("=== 完了 ===")


if __name__ == "__main__":
    main()

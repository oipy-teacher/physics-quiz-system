# Firebase Storage CORS設定修正手順

## 問題
ブラウザからFirebase Storageのファイルをダウンロードする際にCORSエラーが発生しています。

## 解決方法

### 1. Google Cloud Shellにアクセス
https://console.cloud.google.com/cloudshell

### 2. プロジェクトを設定
```bash
gcloud config set project physics-quiz-app
```

### 3. CORS設定ファイルを作成
```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Access-Control-Allow-Methods"]
  }
]
EOF
```

### 4. CORS設定を適用
```bash
gsutil cors set cors.json gs://physics-quiz-app.firebasestorage.app
```

### 5. 設定確認
```bash
gsutil cors get gs://physics-quiz-app.firebasestorage.app
```

## 設定完了後
- ブラウザから直接ファイルダウンロードが可能になります
- ZIPダウンロード機能が正常に動作するはずです

## 注意
- 設定反映には数分かかる場合があります
- ブラウザキャッシュをクリアしてからテストしてください 
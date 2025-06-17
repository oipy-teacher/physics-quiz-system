# 🚀 Firebase 15分設定ガイド

## 📋 **目標**: 学生のタブレット → 教員のPCで手書き画像共有

### **ステップ1: Firebaseプロジェクト作成** (5分)

1. **Firebase Console** にアクセス:  
   👉 https://console.firebase.google.com/

2. **"プロジェクトを追加"** をクリック

3. **プロジェクト名** を入力:  
   例: `physics-quiz-app` または `物理テスト`

4. **Google Analytics**: 無効でOK

5. **"プロジェクトを作成"** をクリック

### **ステップ2: Storage有効化** (3分)

1. 左メニューから **"Storage"** をクリック

2. **"使ってみる"** をクリック

3. セキュリティルール: **"テストモードで開始"** を選択

4. ロケーション: **asia-northeast1** (東京)を選択

5. **"完了"** をクリック

### **ステップ3: Webアプリ設定** (5分)

1. プロジェクト設定（⚙️）→ **"全般"** タブ

2. **"</> Web"** アイコンをクリック

3. アプリ名: `physics-quiz-web` など

4. **"アプリを登録"** をクリック

5. **設定情報をコピー** （次のような形式）:
```javascript
const firebaseConfig = {
  apiKey: "AIza-実際のキー",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:実際のID"
};
```

### **ステップ4: アプリ設定更新** (2分)

1. **app.js** の**6行目付近**を開く

2. **空の設定**:
```javascript
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    // ...
};
```

3. **実際の設定に置き換え**:
```javascript
const firebaseConfig = {
    apiKey: "AIza-実際のキー",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:実際のID"
};
```

4. **保存**

## ✅ **完了テスト**

1. **学生として解答提出**  
   → "Firebase Storageに画像もアップロードしました！" 表示

2. **教員として🔥ボタンクリック**  
   → ZIPファイルダウンロード成功

## 🎯 **これで実現できること**

- ✅ 学生のタブレットで手書き解答
- ✅ 自動でFirebase Storageにアップロード  
- ✅ 教員のPCで一括画像ダウンロード
- ✅ 完全なクロスデバイス対応
- ✅ 無料1GB（約20,000枚の画像）

設定は**たった15分**で完了します！ 
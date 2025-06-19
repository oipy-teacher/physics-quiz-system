// グローバル変数
let currentScreen = 'login';
let currentQuestionIndex = 0;
let startTime = null;
let timerInterval = null;
let violationCount = 0;
let studentId = '';
let testData = {
    answers: [],
    violations: []
};

// 新しいテストシステム用の変数
let currentStudentId = '';
let currentTestCode = '';
let currentTestData = null;
let testStartTime = null;
let userAnswers = [];
let isTabSwitched = false;
let isDevToolsOpen = false;

// 問題データ
let questions = [];
let answerExamples = []; // 解答例画像データ
let testEnabled = false;

// Canvas関連の変数
let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'pen';
let penSize = 3;
let canvasData = [];
let inputMethod = 'canvas'; // 'canvas' または 'text'

// 採点関連の変数
let ocrResults = [];
let gradingResults = [];

// 管理者パスワード（実際の運用では環境変数やサーバー側で管理）
const ADMIN_PASSWORD = 'physics2024';

// Firebase設定（一時的に無効化）
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// Firebase初期化
let firebaseApp = null;
let firebaseStorage = null;
let db = null; // 🔥 Firestore データベース
let isFirebaseAvailable = false;

function initFirebase() {
    try {
        // Firebase設定が空の場合はスキップ
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            console.log('Firebase config is empty - Firebase features disabled');
            isFirebaseAvailable = false;
            return;
        }
        
        if (typeof firebase !== 'undefined') {
            console.log('🔥 Firebase初期化を開始...');
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseStorage = firebase.storage();
            // 🔥 Firestore データベースを初期化
            db = firebase.firestore();
            
            // Firebase設定をテスト（簡素化）
            isFirebaseAvailable = true;
            console.log('🔥 Firebase & Firestore initialized successfully');
        } else {
            console.warn('Firebase SDK not loaded');
            isFirebaseAvailable = false;
        }
    } catch (error) {
        console.warn('Firebase initialization failed:', error);
        console.log('⚠️ Firebase初期化エラーのため、ローカル動作モードに切り替えます');
        isFirebaseAvailable = false;
        db = null;
        firebaseApp = null;
        firebaseStorage = null;
    }
}

// 初期化
window.onload = function() {
    // URLパラメータを確認して、学生アクセス可能かどうかを判定
    const urlParams = new URLSearchParams(window.location.search);
    const hasData = urlParams.has('data');
    const hasCode = urlParams.has('code');
    
    // パラメータがない場合（メインURL直接アクセス）は教員専用モードにする
    if (!hasData && !hasCode) {
        console.log('Direct access to main URL - Admin mode only');
        enableAdminOnlyMode();
        
        // 教員ログイン状態をチェック
        checkAdminLoginStatus();
    }
    
    // ローカルストレージから問題データを読み込む
    loadSavedQuestions();
    
    // 学籍番号入力フィールドのイベント設定
    const studentIdInput = document.getElementById('studentId');
    if (studentIdInput) {
        studentIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                studentLogin();
            }
        });
    }

    // 管理者パスワード入力フィールドのイベント設定
    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }

    // Canvas初期化
    initCanvas();

    // 不正検知イベントの設定
    setupViolationDetection();
    
    // ドラッグ＆ドロップ設定
    setupDragAndDrop();
    
    // Firebase初期化
    initFirebase();
};

// 教員ログイン状態をチェック
function checkAdminLoginStatus() {
    const isLoggedIn = localStorage.getItem('physicsQuizAdminLoggedIn');
    const loginTime = localStorage.getItem('physicsQuizAdminLoginTime');
    
    if (isLoggedIn === 'true' && loginTime) {
        const loginTimestamp = parseInt(loginTime);
        const now = Date.now();
        const hoursPassed = (now - loginTimestamp) / (1000 * 60 * 60);
        
        // 24時間以内なら自動ログイン
        if (hoursPassed < 24) {
            console.log('Auto-login: Admin session still valid');
            setTimeout(() => {
                showScreen('admin');
                loadSavedQuestions();
                renderAnswerExampleList();
            }, 100);
            return;
        } else {
            // 期限切れの場合はログイン状態をクリア
            localStorage.removeItem('physicsQuizAdminLoggedIn');
            localStorage.removeItem('physicsQuizAdminLoginTime');
        }
    }
    
    // ログインしていない場合はログイン画面を表示
    showScreen('login');
}

// 教員専用モードを有効化
function enableAdminOnlyMode() {
    // 学生ログイン要素を非表示にする
    const studentLoginDiv = document.getElementById('studentLoginDiv');
    const testCodeButton = document.querySelector('.test-code-button');
    
    if (studentLoginDiv) {
        studentLoginDiv.style.display = 'none';
    }
    if (testCodeButton) {
        testCodeButton.style.display = 'none';
    }
    
    // タイトルを教員専用に変更
    const title = document.querySelector('#loginScreen h1');
    if (title) {
        title.innerHTML = '物理小テスト<br><small style="font-size: 14px; color: #666;">教員専用管理システム</small>';
    }
    
    // 教員ログインボタンを目立たせる
    const adminButton = document.querySelector('.admin-login-button');
    if (adminButton) {
        adminButton.style.background = '#007aff';
        adminButton.style.fontSize = '18px';
        adminButton.style.padding = '15px 30px';
        adminButton.textContent = '📝 管理画面にログイン';
    }
    
    // メッセージを追加
    const loginContainer = document.querySelector('.login-container');
    if (loginContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
            font-size: 14px;
            color: #1976d2;
        `;
        messageDiv.innerHTML = `
            <strong>📚 教員専用システム</strong><br>
            学生の皆様は、授業で配布されたQRコードをスキャンしてアクセスしてください。
        `;
        loginContainer.insertBefore(messageDiv, adminButton);
    }
}

// ログイン切り替え
function showAdminLogin() {
    document.getElementById('studentLoginDiv').style.display = 'none';
    document.getElementById('adminLoginDiv').style.display = 'block';
    document.getElementById('adminPassword').focus();
}

function showStudentLogin() {
    document.getElementById('adminLoginDiv').style.display = 'none';
    document.getElementById('testCodeLoginDiv').style.display = 'none';
    document.getElementById('studentLoginDiv').style.display = 'block';
    document.getElementById('studentId').focus();
}

function showTestCodeLogin() {
    document.getElementById('studentLoginDiv').style.display = 'none';
    document.getElementById('testCodeLoginDiv').style.display = 'block';
    document.getElementById('adminLoginDiv').style.display = 'none';
    document.getElementById('testCodeInput').focus();
}

async function testCodeLogin() {
    const testCode = document.getElementById('testCodeInput').value.trim().toUpperCase();
    const studentIdInput = document.getElementById('studentIdForCode').value.trim();
    const errorDiv = document.getElementById('loginError');

    // バリデーション
    if (!/^[A-Z0-9]{6}$/.test(testCode)) {
        errorDiv.textContent = 'テストコードは6桁の英数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    if (!/^\d{4}$/.test(studentIdInput)) {
        errorDiv.textContent = '学籍番号は4桁の数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    // テストコードからデータを読み込み
    errorDiv.textContent = 'テストデータを読み込み中...';
    errorDiv.style.display = 'block';

    try {
        let data = null;
        
        // まずローカルストレージから確認（同一端末の場合）
        const testKey = `testCode_${testCode}`;
        const localData = localStorage.getItem(testKey);
        
        if (localData) {
            const parsedLocal = JSON.parse(localData);
            
            if (parsedLocal.questions && parsedLocal.questions.length > 0) {
                // 完全なテストデータがローカルにある場合
                data = parsedLocal;
                console.log('Complete test data loaded from local storage:', data);
            } else if (parsedLocal.dataUrl) {
                // データURLがある場合は、そのURLにリダイレクト（推奨方法）
                console.log('Redirecting to data URL for cross-device compatibility...');
                errorDiv.textContent = 'クロスデバイス対応URLにリダイレクト中...';
                window.location.href = parsedLocal.dataUrl;
                return;
            } else {
                console.log('Local data exists but incomplete:', parsedLocal);
            }
        }
        
        // ローカルにない場合は、Firebaseから取得を試行
        if (!data && db) {
            console.log('Local data not found, trying Firebase...');
            errorDiv.textContent = 'クラウドからテストデータを取得中...';
            
            try {
                const doc = await db.collection('testCodes').doc(testCode).get();
                if (doc.exists) {
                    const firebaseData = doc.data();
                    console.log('Test data loaded from Firebase:', firebaseData);
                    
                    // 期限チェック
                    if (firebaseData.expiresAt && new Date(firebaseData.expiresAt) < new Date()) {
                        throw new Error('Test data has expired');
                    }
                    
                    data = firebaseData;
                    
                    // ローカルストレージにもキャッシュ
                    localStorage.setItem(testKey, JSON.stringify(data));
                } else {
                    console.log('Test code not found in Firebase');
                }
            } catch (firebaseError) {
                console.warn('Firebase読み込みエラー:', firebaseError);
            }
        }
        
        // データが見つからない場合の対処
        if (!data) {
            errorDiv.innerHTML = `
                <div style="text-align: left;">
                    <strong>テストコード「${testCode}」が見つかりません。</strong><br><br>
                    <strong>確認事項：</strong><br>
                    1. テストコードの入力間違いがないか<br>
                    2. テストの有効期限が切れていないか<br>
                    3. ネットワーク接続が正常か<br><br>
                    <strong>推奨方法：</strong><br>
                    教員から受け取ったQRコードをスキャンしてください
                </div>
            `;
            errorDiv.style.display = 'block';
            return;
        }
        
        if (!data.questions || data.questions.length === 0) {
            errorDiv.textContent = 'テストデータが無効です。教員に確認してください。';
            errorDiv.style.display = 'block';
            return;
        }

        // データを設定
        questions = data.questions;
        answerExamples = data.answerExamples || [];
        testEnabled = data.testEnabled || false;
        
        // 新しい変数にも設定
        currentStudentId = studentIdInput;
        currentTestCode = testCode;
        currentTestData = data;
        studentId = studentIdInput; // 後方互換性のため

        errorDiv.style.display = 'none';
        showScreen('test');
        startTest();
    } catch (error) {
        console.error('Test code login error:', error);
        errorDiv.textContent = 'テストデータの読み込みに失敗しました。ネットワーク接続を確認してください。';
        errorDiv.style.display = 'block';
    }
}

// 学生ログイン
async function studentLogin() {
    const inputId = document.getElementById('studentId').value;
    const errorDiv = document.getElementById('loginError');
    
    // URLパラメータチェック（セキュリティ強化）
    const urlParams = new URLSearchParams(window.location.search);
    const hasData = urlParams.has('data');
    const hasCode = urlParams.has('code');
    
    if (!hasData && !hasCode) {
        errorDiv.innerHTML = `
            <div style="text-align: left; color: #d32f2f;">
                <strong>⚠️ アクセス制限</strong><br><br>
                このURLは教員専用です。<br>
                学生の皆様は、授業で配布されたQRコードをスキャンしてアクセスしてください。
            </div>
        `;
        errorDiv.style.display = 'block';
        return;
    }

    // バリデーション
    if (!/^\d{4}$/.test(inputId)) {
        errorDiv.textContent = '学籍番号は4桁の数字で入力してください';
        errorDiv.style.display = 'block';
        return;
    }

    // データを再読み込み
    errorDiv.textContent = 'テストデータを読み込み中...';
    errorDiv.style.display = 'block';

    try {
        await loadSavedQuestions();
        
        // テストが設定されているかチェック
        if (!testEnabled || questions.length === 0) {
            errorDiv.innerHTML = `
                <div style="text-align: left;">
                    <strong>テストが設定されていません。</strong><br><br>
                    <strong>学生の方へ：</strong><br>
                    1. 教員から配布されたQRコードをスキャンしてください<br>
                    2. または、教員から受け取った完全なURLにアクセスしてください<br><br>
                    <em>※ 学籍番号のみでの受験は、教員が同一端末でテストを設定した場合のみ可能です</em>
                </div>
            `;
            errorDiv.style.display = 'block';
            return;
        }

        // URLパラメータからテストコードを取得
        let activeTestCode = null;
        
        // URLパラメータからcodeを取得（QRコードアクセスの場合）
        if (hasCode) {
            activeTestCode = urlParams.get('code');
            console.log('Using test code from URL parameter:', activeTestCode);
        } else {
            // 同一端末でのテスト実行（管理者が設定済み）
            console.log('Local test execution - same device as admin setup');

            // アクティブなテストコードを取得（最新のもの）
            const allKeys = Object.keys(localStorage);
            console.log('All localStorage keys:', allKeys);
            
            const testCodeKeys = allKeys.filter(key => key.startsWith('testCode_'));
            console.log('Found testCode keys:', testCodeKeys);
            
            if (testCodeKeys.length > 0) {
                // 最新のテストコードを取得
                const testCodes = testCodeKeys.map(key => {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        console.log(`Data for ${key}:`, data);
                        return { 
                            code: key.replace('testCode_', ''), 
                            lastUpdated: data.lastUpdated || data.created,
                            created: data.created
                        };
                    } catch (e) {
                        console.error(`Error parsing ${key}:`, e);
                        return null;
                    }
                }).filter(item => item);
                
                console.log('Valid test codes:', testCodes);
                
                if (testCodes.length > 0) {
                    // 最新のテストコードを使用
                    testCodes.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
                    activeTestCode = testCodes[0].code;
                    console.log('Selected active test code:', activeTestCode);
                    console.log('Full test code data:', testCodes[0]);
                } else {
                    console.log('No valid test codes found');
                }
            } else {
                console.log('No testCode_ keys found in localStorage');
            }
        }
        
        // テストコードが見つからない場合は新しく生成
        if (!activeTestCode) {
            activeTestCode = generateShortId();
            console.log('Generated new test code for student session:', activeTestCode);
        }

        // 新しい変数に設定
        currentStudentId = inputId;
        currentTestCode = activeTestCode;
        currentTestData = { questions: questions, answerExamples: answerExamples };
        studentId = inputId; // 後方互換性のため
        
        errorDiv.style.display = 'none';

        // テスト画面に遷移
        showScreen('test');
        startTest();
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'テストデータの読み込みに失敗しました。ページを再読み込みしてください。';
        errorDiv.style.display = 'block';
    }
}

// 管理者ログイン
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (password === ADMIN_PASSWORD) {
        // 教員ログイン状態を保存（24時間有効）
        localStorage.setItem('physicsQuizAdminLoggedIn', 'true');
        localStorage.setItem('physicsQuizAdminLoginTime', Date.now().toString());
        
        showScreen('admin');
        loadSavedQuestions();
        // 管理画面移行後に解答例リストを確実に表示
        setTimeout(() => {
            renderAnswerExampleList();
        }, 100);
    } else {
        showAdminError('パスワードが正しくありません。');
    }
}

// 画面切り替え
function showScreen(screen) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminScreen').style.display = 'none';
    document.getElementById('testScreen').style.display = 'none';
    document.getElementById('resultScreen').style.display = 'none';

    switch(screen) {
        case 'login':
            document.getElementById('loginScreen').style.display = 'flex';
            break;
        case 'admin':
            document.getElementById('adminScreen').style.display = 'block';
            updateFirebaseStatus();
            // 管理画面表示時に解答例リストも表示
            renderAnswerExampleList();
            break;
        case 'test':
            document.getElementById('testScreen').style.display = 'flex';
            // テスト画面表示時にCanvas初期化を確実に実行
            setTimeout(() => {
                console.log('Test screen displayed, initializing canvas...');
                initCanvas();
                setInputMethod('canvas');
            }, 200);
            break;
        case 'result':
            document.getElementById('resultScreen').style.display = 'flex';
            break;
    }
    currentScreen = screen;
}

// Firebase設定状況を表示
function updateFirebaseStatus() {
    const statusElement = document.getElementById('firebaseStatus');
    if (statusElement) {
        if (!isFirebaseAvailable) {
            statusElement.style.display = 'block';
        } else {
            statusElement.style.display = 'none';
        }
    }
}

// ========== 教員用機能 ==========

// ドラッグ＆ドロップ設定
function setupDragAndDrop() {
    // 問題画像のドラッグ＆ドロップ
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    // 解答例画像のドラッグ＆ドロップ
    const answerUploadArea = document.getElementById('answerUploadArea');
    if (answerUploadArea) {
        answerUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            answerUploadArea.classList.add('dragover');
        });

        answerUploadArea.addEventListener('dragleave', () => {
            answerUploadArea.classList.remove('dragover');
        });

        answerUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            answerUploadArea.classList.remove('dragover');
            handleAnswerFiles(e.dataTransfer.files);
        });
    }
}

// ファイル選択
function selectFile() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileSelect(event) {
    handleFiles(event.target.files);
}

// 解答例ファイル選択
function selectAnswerFile() {
    const fileInput = document.getElementById('answerFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleAnswerFileSelect(event) {
    handleAnswerFiles(event.target.files);
}

// ファイル処理
function handleFiles(files) {
    if (files.length === 0) return;

    for (let file of files) {
        if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
            showAdminError('JPG、PNG形式の画像ファイルをアップロードしてください。');
            continue;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            addQuestion(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// 解答例ファイル処理
function handleAnswerFiles(files) {
    if (files.length === 0) return;

    for (let file of files) {
        if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
            showAdminError('JPG、PNG形式の画像ファイルをアップロードしてください。');
            continue;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            addAnswerExample(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// 問題追加
function addQuestion(imageData) {
    const questionId = `q${questions.length + 1}`;
    const question = {
        id: questionId,
        number: questions.length + 1,
        image: imageData
    };

    questions.push(question);
    
    // ローカルストレージに保存
    localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
    
    // 統合データも更新
    try {
        const savedData = localStorage.getItem('physicsQuizData');
        if (savedData) {
            const data = JSON.parse(savedData);
            data.questions = questions;
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem('physicsQuizData', JSON.stringify(data));
        }
    } catch (error) {
        console.warn('Failed to update integrated data:', error);
    }
    
    renderQuestionList();
    showAdminSuccess('問題を追加しました。');
}

// 解答例追加
function addAnswerExample(imageData) {
    const answerExample = {
        id: Date.now(),
        image: imageData,
        questionIndex: answerExamples.length // 問題の順番に対応
    };
    
    answerExamples.push(answerExample);
    
    // ローカルストレージに保存
    localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
    
    // 統合データも更新
    try {
        const savedData = localStorage.getItem('physicsQuizData');
        if (savedData) {
            const data = JSON.parse(savedData);
            data.answerExamples = answerExamples;
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem('physicsQuizData', JSON.stringify(data));
        }
    } catch (error) {
        console.warn('Failed to update integrated data:', error);
    }
    
    renderAnswerExampleList();
    showAdminSuccess('解答例画像を追加しました。');
}

// 解答例リスト表示
function renderAnswerExampleList() {
    // 既存の解答例表示エリアがあれば更新、なければ作成
    let container = document.getElementById('answerExampleList');
    if (!container) {
        container = document.createElement('div');
        container.id = 'answerExampleList';
        container.className = 'answer-example-list';
        
        const answerUploadArea = document.getElementById('answerUploadArea');
        if (answerUploadArea && answerUploadArea.parentNode) {
            answerUploadArea.parentNode.insertBefore(container, answerUploadArea.nextSibling);
        }
    }
    
    if (answerExamples.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <h3>アップロード済み解答例</h3>
        <div class="answer-example-grid">
            ${answerExamples.map((example, index) => `
                <div class="answer-example-item">
                    <div class="example-number">解答例 ${index + 1}</div>
                    <img src="${example.image}" class="example-image" alt="解答例${index + 1}">
                    <button onclick="removeAnswerExample(${index})" class="remove-example-btn">削除</button>
                </div>
            `).join('')}
        </div>
    `;
}

// 解答例削除
function removeAnswerExample(index) {
    if (confirm('この解答例を削除しますか？')) {
        answerExamples.splice(index, 1);
        
        // ローカルストレージも更新
        localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
        
        // 統合データも更新
        try {
            const savedData = localStorage.getItem('physicsQuizData');
            if (savedData) {
                const data = JSON.parse(savedData);
                data.answerExamples = answerExamples;
                data.lastUpdated = new Date().toISOString();
                localStorage.setItem('physicsQuizData', JSON.stringify(data));
            }
        } catch (error) {
            console.warn('Failed to update integrated data:', error);
        }
        
        renderAnswerExampleList();
        showAdminSuccess('解答例を削除しました。');
    }
}

// 問題リスト表示
function renderQuestionList() {
    const container = document.getElementById('questionList');
    if (!container) return;
    
    container.innerHTML = '';

    questions.forEach((question, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <div class="question-number">${question.number}</div>
            <div class="question-content">
                <img src="${question.image}" class="question-image" alt="問題${question.number}">
                <div class="question-info">
                    <p style="color: #666; margin: 10px 0;">採点は別システムで行います</p>
                </div>
                <button onclick="removeQuestion(${index})" style="background-color: #ff3b30; color: white; padding: 10px; border: none; border-radius: 8px; margin-top: 10px;">この問題を削除</button>
            </div>
        `;
        container.appendChild(item);
    });
}

// 正解パターン機能は採点システムに移行済み

// 問題削除
function removeQuestion(index) {
    if (confirm('この問題を削除しますか？')) {
        questions.splice(index, 1);
        // 問題番号を再設定
        questions.forEach((q, i) => {
            q.number = i + 1;
            q.id = `q${i + 1}`;
        });
        
        // ローカルストレージも更新
        localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
        
        // 統合データも更新
        try {
            const savedData = localStorage.getItem('physicsQuizData');
            if (savedData) {
                const data = JSON.parse(savedData);
                data.questions = questions;
                data.lastUpdated = new Date().toISOString();
                localStorage.setItem('physicsQuizData', JSON.stringify(data));
            }
        } catch (error) {
            console.warn('Failed to update integrated data:', error);
        }
        
        renderQuestionList();
        updateTestStatus();
        showAdminSuccess('問題を削除しました。');
    }
}

// 問題設定保存（教員側ローカル動作のみ）
async function saveQuestions() {
    if (questions.length === 0) {
        showAdminError('問題が設定されていません。');
        return;
    }

    // 教員側は完全にローカル動作のみ（Firebase送信なし）
    console.log('📚 教員側ローカル動作モード: 問題設定を保存中...');

    // データを準備
    const dataToSave = {
        questions: questions,
        answerExamples: answerExamples,
        testEnabled: true,
        lastUpdated: new Date().toISOString(),
        teacherId: Date.now() // 教員セッションID
    };

    // テストコード生成
    const testCode = generateShortId();
    console.log(`📝 生成されたテストコード: ${testCode}`);
    
    // 教員データは常にローカルストレージのみに保存
    localStorage.setItem(`testCode_${testCode}`, JSON.stringify({
        ...dataToSave,
        testCode: testCode,
        created: new Date().toISOString(),
        cloudSaved: false // 教員側は常にローカルのみ
    }));
    
    localStorage.setItem('physicsQuizEnabled', 'true');
    localStorage.setItem('physicsQuizActiveTestCode', testCode);
    testEnabled = true;
    
    // 成功メッセージ表示
    showAdminSuccess(`✅ 問題設定完了！テストコード: ${testCode}\n📱 QRコードで配信可能です\n💡 学生回答はFirebase Storageに自動保存されます`);
    
    // QRコード生成オプションを表示
    showShareOptions(dataToSave, { testCode: testCode, cloudSaved: false });
    
    updateTestStatus();
}

// Firebase完全版では不要（削除済み）
// 従来のgenerateShareUrl関数は saveQuestions で直接 Firebase 保存を行うため削除

// 短いID生成
function generateShortId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// QR生成直前の容量確保（スマート削除）
function ensureStorageSpaceForQR(newData) {
    try {
        // 新しいデータのサイズを推定
        const newDataSize = JSON.stringify(newData).length;
        const currentUsage = getCurrentStorageUsage();
        const estimatedTotal = currentUsage + newDataSize;
        
        console.log(`📊 容量確認: 現在${Math.round(currentUsage/1024)}KB + 新規${Math.round(newDataSize/1024)}KB = 推定${Math.round(estimatedTotal/1024)}KB`);
        
        // 8MB制限を超える場合のみ古いデータを削除
        if (estimatedTotal > 8 * 1024 * 1024) {
            console.log('🚨 容量不足が予想されるため、古いデータを削除します');
            
            // 古いテストコードを取得
            const testCodes = Object.keys(localStorage)
                .filter(key => key.startsWith('testCode_'))
                .map(key => {
                    const testCode = key.replace('testCode_', '');
                    const data = localStorage.getItem(key);
                    let created = null;
                    try {
                        const parsed = JSON.parse(data);
                        created = new Date(parsed.created);
                    } catch (e) {
                        created = new Date(0); // 無効なデータは古い扱い
                    }
                    return { key, testCode, created, size: data.length };
                })
                .sort((a, b) => a.created - b.created); // 古い順にソート
            
            // 容量が十分になるまで古いデータを削除
            let freedSpace = 0;
            for (const codeData of testCodes) {
                if (estimatedTotal - freedSpace <= 7 * 1024 * 1024) {
                    break; // 7MB以下になったら停止
                }
                
                localStorage.removeItem(codeData.key);
                freedSpace += codeData.size;
                console.log(`🗑️ 古いテストコード削除: ${codeData.testCode} (${Math.round(codeData.size/1024)}KB解放)`);
            }
            
            console.log(`✅ 容量確保完了: ${Math.round(freedSpace/1024)}KB解放`);
        } else {
            console.log('✅ 容量に問題なし、削除不要');
        }
    } catch (error) {
        console.warn('容量確保処理でエラー:', error);
    }
}

// 現在のストレージ使用量を取得
function getCurrentStorageUsage() {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        totalSize += key.length + value.length;
    }
    return totalSize;
}

// テストデータをFirebaseに保存（クロスデバイス対応）
async function saveTestDataToFirebase(testCode, testData) {
    try {
        if (!db) {
            console.log('Firebase not available, skipping cloud save');
            return;
        }
        
        console.log(`☁️ Firebaseにテストデータを保存中: ${testCode}`);
        
        const docRef = await db.collection('testCodes').doc(testCode).set({
            ...testData,
            testCode: testCode,
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7日後に期限切れ
        });
        
        console.log(`✅ Firebaseに保存成功: ${testCode}`);
        
        // ローカルストレージにもクラウド保存済みマークを追加
        const localKey = `testCode_${testCode}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
            const parsed = JSON.parse(localData);
            parsed.cloudSaved = true;
            localStorage.setItem(localKey, JSON.stringify(parsed));
        }
        
    } catch (error) {
        console.warn('Firebase保存に失敗:', error);
    }
}

// 既存のテストコードをチェック
function checkExistingTestCode(dataToSave) {
    // ローカルストレージから既存のテストコードを検索
    const existingCodes = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('testCode_')) {
            const testCode = key.replace('testCode_', '');
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsedData = JSON.parse(data);
                    // 有効なテストデータかチェック
                    if (parsedData.questions || parsedData.cloudSaved) {
                        existingCodes.push({
                            testCode: testCode,
                            data: parsedData,
                            hasCloud: !!parsedData.cloudSaved
                        });
                    }
                } catch (e) {
                    console.error('Invalid test code data:', key);
                }
            }
        }
    }
    
    if (existingCodes.length > 0) {
        // 既存のコードがある場合は選択肢を表示
        showTestCodeOptions(dataToSave, existingCodes);
            } else {
            // 既存のコードがない場合は新規作成
            generateShareUrl(dataToSave).then(shareResult => {
                showShareOptions(dataToSave, shareResult);
            }).catch(error => {
                console.error('Share generation error:', error);
                showShareOptions(dataToSave, { testCode: generateShortId(), cloudSaved: false });
            });
        }
}

// テストコード選択肢を表示
function showTestCodeOptions(dataToSave, existingCodes) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const existingCodesHtml = existingCodes.map(code => `
        <div style="border: 2px solid #007aff; border-radius: 10px; padding: 15px; margin: 10px 0; cursor: pointer; transition: background-color 0.3s;" 
             onclick="useExistingTestCode('${code.testCode}', ${JSON.stringify(dataToSave).replace(/"/g, '&quot;')})">
            <div style="font-size: 20px; font-weight: bold; color: #007aff;">${code.testCode}</div>
            <div style="font-size: 12px; color: #666;">
                ${code.hasCloud ? '☁️ クラウド保存済み' : '💾 ローカル保存のみ'}
            </div>
        </div>
    `).join('');
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; max-height: 80%; overflow: auto; text-align: center;">
            <h3>🔢 テストコード管理</h3>
            <p>既存のテストコードが見つかりました。どちらを使用しますか？</p>
            
            <div style="margin: 20px 0;">
                <h4>既存のテストコード：</h4>
                ${existingCodesHtml}
            </div>
            
            <div style="margin-top: 30px;">
                <button onclick="createNewTestCode(${JSON.stringify(dataToSave).replace(/"/g, '&quot;')})" 
                        style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                    🆕 新しいコードを作成
                </button>
                <button onclick="closeTestCodeModal()" 
                        style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                    キャンセル
                </button>
            </div>
        </div>
    `;
    
    modal.id = 'testCodeModal';
    document.body.appendChild(modal);
}

// 既存のテストコードを使用
function useExistingTestCode(testCode, dataToSave) {
    closeTestCodeModal();
    
    // 既存のコードのデータを更新
    const testKey = `testCode_${testCode}`;
    const existingData = localStorage.getItem(testKey);
    
    if (existingData) {
        try {
            const parsedData = JSON.parse(existingData);
            
            if (parsedData.cloudSaved) {
                // クラウド保存がある場合は更新（実際はローカル更新）
                localStorage.setItem(testKey, JSON.stringify({
                    ...dataToSave,
                    cloudSaved: true,
                    testCode: testCode,
                    updated: new Date().toISOString()
                }));
                showShareOptions(dataToSave, { testCode: testCode, cloudSaved: true });
            } else {
                // ローカルのみの場合はローカル更新
                localStorage.setItem(testKey, JSON.stringify(dataToSave));
                showShareOptions(dataToSave, { testCode: testCode, cloudSaved: false });
            }
        } catch (error) {
            console.error('Error using existing test code:', error);
            // エラーの場合は新規作成
            createNewTestCode(dataToSave);
        }
    } else {
        // データが見つからない場合は新規作成
        createNewTestCode(dataToSave);
    }
}

// 新しいテストコードを作成
function createNewTestCode(dataToSave) {
    closeTestCodeModal();
    
    generateShareUrl(dataToSave).then(shareResult => {
        showShareOptions(dataToSave, shareResult);
    }).catch(error => {
        console.error('Share generation error:', error);
        showShareOptions(dataToSave, { testCode: generateShortId(), cloudSaved: false });
    });
}

// データを更新（シンプルなローカル保存）
function updateLocalData(dataToSave, testCode) {
    try {
        localStorage.setItem(`testCode_${testCode}`, JSON.stringify({
            ...dataToSave,
            cloudSaved: true,
            testCode: testCode,
            updated: new Date().toISOString()
        }));
        
        showShareOptions(dataToSave, { testCode: testCode, cloudSaved: true });
    } catch (error) {
        console.error('Local update error:', error);
        showShareOptions(dataToSave, { testCode: testCode, cloudSaved: false });
    }
}

// テストコードモーダルを閉じる
function closeTestCodeModal() {
    const modal = document.getElementById('testCodeModal');
    if (modal) {
        modal.remove();
    }
}

// 共有オプション表示
function showShareOptions(data, shareResult) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const testCode = shareResult.testCode;
    const isCloudBased = shareResult.cloudSaved === true;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 90%; max-height: 80%; overflow: auto; text-align: center;">
            <h3>🎉 テスト設定完了！</h3>
            
            <div style="margin: 30px 0;">
                <h4>📱 生徒への共有方法</h4>
                <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
                    
                    <!-- テストコード方式 -->
                    <div style="border: 2px solid #007aff; border-radius: 15px; padding: 20px; min-width: 250px;">
                        <h5 style="color: #007aff; margin-top: 0;">🔢 テストコード</h5>
                        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <div style="font-size: 24px; font-weight: bold; color: #007aff; letter-spacing: 3px;">${testCode}</div>
                        </div>
                        <button onclick="copyTestCode('${testCode}')" style="background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 8px; width: 100%;">コードをコピー</button>
                        <div style="font-size: 12px; color: #666; margin-top: 10px;">
                            生徒は同じURLにアクセスして<br>このコードを入力
                        </div>
                    </div>
                    
                    <!-- QRコード方式 -->
                    <div style="border: 2px solid #28a745; border-radius: 15px; padding: 20px; min-width: 250px;">
                        <h5 style="color: #28a745; margin-top: 0;">📱 QRコード</h5>
                        <div id="qrcode" style="margin: 15px 0; display: flex; justify-content: center;"></div>
                        <button onclick="downloadQR()" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 8px; width: 100%;">QRコードを保存</button>
                        <div style="font-size: 12px; color: #666; margin-top: 10px;">
                            生徒はQRコードをスキャン
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: #e8f4fd; border-radius: 8px; font-size: 14px; text-align: left;">
                <strong>📋 使い方：</strong><br>
                <strong>🎯 推奨方法（QRコード）：</strong><br>
                1. QRコードを保存して生徒に共有<br>
                2. 生徒はスマホでQRコードをスキャン<br>
                3. 自動的にテストページが開く<br>
                <em>※ どの端末からでもアクセス可能</em><br><br>
                
                <strong>⚠️ テストコード方式の制限：</strong><br>
                • テストコードは同一端末でのみ有効<br>
                • 別端末からはQRコードまたは完全URLが必要<br>
                • クロスデバイス利用にはQRコードを推奨<br><br>
                
                ${isCloudBased ? 
                    '<strong>✅ クラウド保存：</strong> テストデータはクラウドに保存されているので、どの端末からでもアクセス可能です。' : 
                    '<strong>⚠️ ローカル保存：</strong> ネットワークエラーのため、この端末でのみアクセス可能です。'
                }
            </div>
            
            <div style="margin-top: 20px;">
                <button onclick="closeShareModal()" style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px;">閉じる</button>
            </div>
        </div>
    `;
    
    modal.id = 'shareModal';
    document.body.appendChild(modal);
    
    // QRコードを生成
    generateQRCode(testCode);
}

function copyTestCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        alert(`テストコード「${code}」をクリップボードにコピーしました！\n生徒にこのコードを伝えてください。`);
    }).catch(() => {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert(`テストコード「${code}」をクリップボードにコピーしました！\n生徒にこのコードを伝えてください。`);
    });
}

// テストコード詳細表示
function showTestCodeDetails(testCode) {
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (!testData) {
        alert('テストデータが見つかりません。');
        return;
    }
    
    try {
        const parsedData = JSON.parse(testData);
        const submissionKey = `submissions_${testCode}`;
        const submissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; max-height: 80%; overflow: auto;">
                <h3>📝 テストコード詳細: ${testCode}</h3>
                <div style="margin: 20px 0;">
                    <p><strong>問題数:</strong> ${parsedData.questions ? parsedData.questions.length : 0}問</p>
                    <p><strong>作成日時:</strong> ${parsedData.created ? new Date(parsedData.created).toLocaleString('ja-JP') : '不明'}</p>
                    <p><strong>提出数:</strong> ${submissions.length}件</p>
                    <p><strong>データ保存:</strong> ${parsedData.cloudSaved ? '☁️ クラウド' : '💾 ローカル'}</p>
                </div>
                
                ${submissions.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h4>提出済み学生:</h4>
                        <div style="max-height: 200px; overflow: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                            ${submissions.map(sub => `
                                <div style="padding: 5px 0; border-bottom: 1px solid #eee;">
                                    学籍番号: ${sub.studentId} - 提出時刻: ${new Date(sub.timestamp).toLocaleString('ja-JP')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 30px; text-align: center;">
                    <button onclick="showQRForTestCode('${testCode}'); closeTestCodeModal()" 
                            style="background: #007aff; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        📱 QRコードを表示
                    </button>
                    <button onclick="copyTestCode('${testCode}')" 
                            style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        📋 コードをコピー
                    </button>
                    <button onclick="closeTestCodeModal()" 
                            style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; margin: 5px; cursor: pointer;">
                        閉じる
                    </button>
                </div>
            </div>
        `;
        
        modal.id = 'testCodeDetailModal';
        modal.onclick = (e) => {
            if (e.target === modal) closeTestCodeModal();
        };
        document.body.appendChild(modal);
        
    } catch (e) {
        console.error('Error showing test code details:', e);
        alert('テストデータの読み込みに失敗しました。');
    }
}

// テストコード削除
function deleteTestCode(testCode) {
    if (!confirm(`テストコード「${testCode}」を削除しますか？\n\n注意: 関連する提出データもすべて削除されます。`)) {
        return;
    }
    
    try {
        // テストコードデータを削除
        const testKey = `testCode_${testCode}`;
        localStorage.removeItem(testKey);
        
        // 関連する提出データを削除
        const submissionKey = `submissions_${testCode}`;
        localStorage.removeItem(submissionKey);
        
        // 個別提出データも削除
        const allKeys = Object.keys(localStorage);
        const relatedKeys = allKeys.filter(key => key.includes(testCode));
        relatedKeys.forEach(key => localStorage.removeItem(key));
        
        alert(`テストコード「${testCode}」とその関連データを削除しました。`);
        
        // 表示を更新
        showExistingTestCodes();
        
    } catch (e) {
        console.error('Error deleting test code:', e);
        alert('削除に失敗しました。');
    }
}

// QRコード表示
function showQRForTestCode(testCode) {
    // 既存のQRコード生成関数を使用
    generateQRCode(testCode);
    
    // 共有モーダルを表示
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    if (testData) {
        try {
            const parsedData = JSON.parse(testData);
            showShareOptions(parsedData, { testCode: testCode, cloudSaved: parsedData.cloudSaved });
        } catch (e) {
            console.error('Error showing QR:', e);
            alert('QRコードの表示に失敗しました。');
        }
    }
}

function closeTestCodeModal() {
    const modal = document.getElementById('testCodeDetailModal');
    if (modal) {
        modal.remove();
    }
}

// QRコード生成（データ埋め込み版）
function generateQRCode(testCode) {
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;
    
    console.log('=== generateQRCode called ===');
    console.log('testCode:', testCode);
    
    // ローカルストレージからテストデータを取得
    const testKey = `testCode_${testCode}`;
    const testData = localStorage.getItem(testKey);
    
    console.log('testKey:', testKey);
    console.log('testData found:', !!testData);
    
    let qrUrl;
    let targetUrl;
    let urlType = 'code'; // デフォルトはテストコード方式
    
    if (testData) {
        try {
            const parsedData = JSON.parse(testData);
            console.log('Parsed test data keys:', Object.keys(parsedData));
            
            // 【シンプル方式】テストコード方式を優先（短URL）
                targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
            urlType = 'code';
            console.log('Using test code URL (short and clean)');
            
            // クロスデバイス対応のためFirebaseにもデータを保存（一時的に無効化）
            // if (parsedData.questions && parsedData.questions.length > 0) {
            //     saveTestDataToFirebase(testCode, parsedData);
            // }
            console.log('☁️ Firebase保存は一時的に無効化されています（安定性確保のため）');
        } catch (e) {
            console.error('Error parsing test data:', e);
            // エラーの場合はテストコード方式
            targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
            urlType = 'code';
        }
    } else {
        // データが見つからない場合はテストコード方式
        targetUrl = `${window.location.origin}${window.location.pathname}?code=${testCode}`;
        urlType = 'code';
        console.log('No test data found, using test code URL');
    }
    
    console.log('Final target URL:', targetUrl);
    console.log('URL length:', targetUrl.length);
    console.log('URL type:', urlType);
    
    // 【クロスデバイス優先】URL長さ制限を撤廃してデータ埋め込み方式を優先
    if (targetUrl.length > 10000) {
        console.warn(`Very large URL (${targetUrl.length} chars), but maintaining cross-device compatibility`);
    }
    
    // QRコード画像URLを生成
    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;
    
    // QRコード表示
    qrContainer.innerHTML = `
        <div style="text-align: center;">
            <img src="${qrUrl}" alt="QRコード" style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px;" 
                 onload="console.log('QR code loaded successfully')"
                 onerror="console.error('QR code failed to load'); this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; padding: 20px; background: #ffe6e6; border: 1px solid #ff9999; border-radius: 8px; color: #cc0000;">
                QRコード生成エラー<br>
                <small>テストコード「${testCode}」を直接入力してください</small>
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                テストコード: <strong>${testCode}</strong>
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 5px;">
                ${urlType === 'data' ? '📱 データ埋め込み (クロスデバイス対応)' : '💾 テストコード方式 (同一デバイス推奨)'}
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 2px; word-break: break-all;">
                ${targetUrl.length > 60 ? targetUrl.substring(0, 60) + '...' : targetUrl}
            </div>
        </div>
    `;
}

// QRコードダウンロード
function downloadQR() {
    const qrImg = document.querySelector('#qrcode img');
    if (qrImg) {
        const link = document.createElement('a');
        link.href = qrImg.src;
        link.download = 'physics-test-qr.png';
        link.click();
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.remove();
    }
}



// テスト状態更新
function updateTestStatus() {
    const statusBadge = document.getElementById('testStatusBadge');
    const statusMessage = document.getElementById('testStatusMessage');
    
    if (!statusBadge || !statusMessage) return;

    if (testEnabled && questions.length > 0) {
        statusBadge.textContent = '受験可能';
        statusBadge.className = 'status-badge status-active';
        statusMessage.textContent = `${questions.length}問のテストが設定されています`;
        
        // 既存のテストコードを表示
        showExistingTestCodes();
    } else {
        statusBadge.textContent = '未設定';
        statusBadge.className = 'status-badge status-inactive';
        statusMessage.textContent = '問題が設定されていません';
        
        // テストコード表示をクリア
        const testCodeDisplay = document.getElementById('testCodeDisplay');
        if (testCodeDisplay) {
            testCodeDisplay.style.display = 'none';
        }
    }
}

// 既存のテストコードを表示
function showExistingTestCodes() {
    // 既存の表示エリアを取得または作成
    let testCodeDisplay = document.getElementById('testCodeDisplay');
    if (!testCodeDisplay) {
        testCodeDisplay = document.createElement('div');
        testCodeDisplay.id = 'testCodeDisplay';
        testCodeDisplay.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border: 1px solid #e9ecef;
        `;
        
        const testStatusSection = document.querySelector('.test-status').parentElement;
        testStatusSection.appendChild(testCodeDisplay);
    }
    
    // 既存のテストコードを検索
    const existingCodes = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('testCode_')) {
            const testCode = key.replace('testCode_', '');
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.questions || parsedData.gistId) {
                        existingCodes.push({
                            testCode: testCode,
                            hasCloud: !!parsedData.cloudSaved,
                            created: parsedData.created || '不明'
                        });
                    }
                } catch (e) {
                    // 無効なデータは無視
                }
            }
        }
    }
    
    if (existingCodes.length > 0) {
        const codesHtml = existingCodes.map(code => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin: 5px 0; background: white; border-radius: 8px; border: 1px solid #dee2e6;">
                <div onclick="showTestCodeDetails('${code.testCode}')" style="cursor: pointer; flex: 1;">
                    <span style="font-size: 18px; font-weight: bold; color: #007aff;">${code.testCode}</span>
                    <span style="margin-left: 10px; font-size: 12px; color: #666;">
                        ${code.hasCloud ? '☁️ クラウド' : '💾 ローカル'}
                    </span>
                    <div style="font-size: 10px; color: #999; margin-top: 2px;">クリックで詳細表示</div>
                </div>
                <div style="display: flex; gap: 5px;">
                <button onclick="copyTestCode('${code.testCode}')" style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        📋 コピー
                    </button>
                    <button onclick="showQRForTestCode('${code.testCode}')" style="background: #007aff; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        📱 QR表示
                    </button>
                    <button onclick="deleteTestCode('${code.testCode}')" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                        🗑️ 削除
                </button>
                </div>
            </div>
        `).join('');
        
        testCodeDisplay.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333;">📱 利用可能なテストコード</h4>
            ${codesHtml}
            <div style="margin-top: 15px; font-size: 12px; color: #666;">
                💡 生徒はこれらのコードを使ってテストにアクセスできます
            </div>
        `;
        testCodeDisplay.style.display = 'block';
    } else {
        testCodeDisplay.style.display = 'none';
    }
}

// 保存された問題データを読み込み（Firebase優先版）
async function loadSavedQuestions() {
    try {
        console.log('🔥 Firebase優先でデータ読み込み開始...');
        
        // 1. URLパラメータからデータを読み込み
        const urlLoaded = await loadQuestionsFromUrl();
        
        if (!urlLoaded) {
            // 2. URLデータがない場合はFirebaseから読み込み
            const firebaseLoaded = await loadQuestionsFromFirebase();
            
            if (!firebaseLoaded) {
                // 3. Firebaseデータもない場合はローカルキャッシュから読み込み
                console.log('Firebase데이터 없음, 로컬 캐시에서 읽기 시도...');
                loadQuestionsFromLocalStorage();
            }
        }
        
        updateTestStatus();
    } catch (error) {
        console.error('Load error:', error);
        // エラーの場合はローカルストレージから読み込み
        loadQuestionsFromLocalStorage();
        updateTestStatus();
    }
}

// Firebaseからデータを読み込み（新規追加）
async function loadQuestionsFromFirebase() {
    try {
        // Firebase初期化を待つ
        if (!db) {
            console.log('🔥 Firebase初期化待ち...');
            // 最大3秒待機
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (db) {
                    console.log('✅ Firebase初期化完了');
                    break;
                }
            }
        }
        
        if (!db) {
            console.log('Firebase not available after waiting');
            return false;
        }
        
        // アクティブなテストコードを取得
        const activeTestCode = localStorage.getItem('physicsQuizActiveTestCode');
        if (!activeTestCode) {
            console.log('No active test code found');
            return false;
        }
        
        console.log(`🔥 Firebaseからデータ読み込み: ${activeTestCode}`);
        
        const doc = await db.collection('testCodes').doc(activeTestCode).get();
        if (doc.exists) {
            const data = doc.data();
            console.log('✅ Firebase读取成功:', data);
            
            // 期限チェック
            if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
                console.warn('Test data has expired');
                return false;
            }
            
            questions = data.questions || [];
            answerExamples = data.answerExamples || [];
            testEnabled = data.testEnabled || false;
            
            console.log(`📚 Questions loaded from Firebase: ${questions.length}`);
            console.log(`📝 Answer examples loaded from Firebase: ${answerExamples.length}`);
            
            // 管理画面の場合は表示を更新
            if (document.getElementById('questionList')) {
                renderQuestionList();
            }
            if (currentScreen === 'admin' || document.getElementById('adminScreen').style.display === 'block') {
                renderAnswerExampleList();
            }
            
            // ローカルストレージにキャッシュ
            localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
            localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
            localStorage.setItem('physicsQuizEnabled', testEnabled.toString());
            
            return true;
        } else {
            console.log('Test code not found in Firebase');
            return false;
        }
    } catch (error) {
        console.warn('Firebase読み込みエラー:', error);
        return false;
    }
}

// URLパラメータからデータを読み込み（真のクロスデバイス対応）
async function loadQuestionsFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const testCode = urlParams.get('code');
        const shareId = urlParams.get('id');
        const dataParam = urlParams.get('data'); // データ埋め込み形式
        
        let data = null;
        
        if (dataParam) {
            // 最新形式：データ埋め込み（真のクロスデバイス）
            try {
                const decodedData = decodeURIComponent(atob(dataParam));
                data = JSON.parse(decodedData);
                
                // 軽量化無効化のため復元処理をスキップ
                console.log('データ復元処理をスキップ（軽量化無効化のため）');
                
                console.log('Data loaded from URL parameter (cross-device):', data);
            } catch (decodeError) {
                console.error('Failed to decode URL data:', decodeError);
            }
        } else if (testCode) {
            // テストコード：まずFirebaseから読み込み、次にローカルストレージ
            console.log('Attempting to load test code:', testCode);
            
            // まずFirebaseから試す（クロスデバイス対応）
            // Firebase初期化を待つ
            if (!db) {
                console.log('🔥 Firebase初期化待ち（URL）...');
                // 最大3秒待機
                for (let i = 0; i < 30; i++) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (db) {
                        console.log('✅ Firebase初期化完了（URL）');
                        break;
                    }
                }
            }
            
            if (isFirebaseAvailable && db) {
                try {
                    console.log('🔥 Firebaseからテストコードを読み込み中:', testCode);
                    const doc = await db.collection('testCodes').doc(testCode).get();
                    if (doc.exists) {
                        data = doc.data();
                        console.log('✅ Firebase からテストコードを読み込み成功:', testCode);
                        
                        // アクティブテストコードとして設定
                        localStorage.setItem('physicsQuizActiveTestCode', testCode);
                    } else {
                        console.log('Firebase にテストコードが見つかりません:', testCode);
                    }
                } catch (error) {
                    console.warn('Firebase読み込みエラー:', error);
                }
            }
            
            // Firebaseで見つからない場合はローカルストレージを確認
            if (!data) {
                const testKey = `testCode_${testCode}`;
                const testData = localStorage.getItem(testKey);
                if (testData) {
                    data = JSON.parse(testData);
                    console.log('Data loaded from localStorage (same device):', data);
                } else {
                    // ローカルストレージにもない場合
                    console.warn('Test code not found in both Firebase and localStorage:', testCode);
                    
                    // エラーメッセージを表示
                    setTimeout(() => {
                        if (window.confirm('このテストコードではアクセスできません。\n\n・テストコードが期限切れの可能性があります\n・教員から配布されたQRコードを再度スキャンしてください\n\n「OK」を押すと教員用URLに戻ります。')) {
                            window.location.href = window.location.origin + window.location.pathname;
                        }
                    }, 1000);
                    return false;
                }
            }
        } else if (shareId) {
            // 旧形式：短縮ID
            const shareKey = `physicsQuizShare_${shareId}`;
            const shareData = localStorage.getItem(shareKey);
            if (shareData) {
                data = JSON.parse(shareData);
            }
        }
        
        if (data && data.questions && data.questions.length > 0) {
            questions = data.questions;
            answerExamples = data.answerExamples || [];
            testEnabled = data.testEnabled || false;
            
            console.log('Questions loaded from URL:', questions.length);
            
            // 管理画面の場合は表示を更新
            if (document.getElementById('questionList')) {
                renderQuestionList();
            }
            // 解答例リストは管理画面が表示されている場合のみ更新
            if (currentScreen === 'admin' || document.getElementById('adminScreen').style.display === 'block') {
                renderAnswerExampleList();
            }
            
            // URLからロードした場合は、ローカルストレージにも保存
            localStorage.setItem('physicsQuizQuestions', JSON.stringify(questions));
            localStorage.setItem('physicsQuizAnswerExamples', JSON.stringify(answerExamples));
            localStorage.setItem('physicsQuizEnabled', testEnabled.toString());
            
            // URLから直接テスト画面に遷移する場合のCanvas初期化
            if (window.location.hash === '#test' || document.getElementById('testScreen')) {
                setTimeout(() => {
                    initCanvas();
                    setInputMethod('canvas');
                }, 200);
            }
            
            return true;
        }
    } catch (error) {
        console.log('URL data not available or invalid:', error);
    }
    return false;
}

// サーバーからデータを読み込み
async function loadQuestionsFromServer() {
    try {
        const response = await fetch('./data.json');
        if (response.ok) {
            const data = await response.json();
            
            if (data.questions && data.questions.length > 0) {
                questions = data.questions;
                answerExamples = data.answerExamples || [];
                testEnabled = data.testEnabled || false;
                
                console.log('Questions loaded from server:', questions.length);
                
                // 管理画面の場合は表示を更新
                if (document.getElementById('questionList')) {
                    renderQuestionList();
                }
                // 解答例リストは管理画面が表示されている場合のみ更新
                if (currentScreen === 'admin' || document.getElementById('adminScreen').style.display === 'block') {
                    renderAnswerExampleList();
                }
                
                return true;
            }
        }
    } catch (error) {
        console.log('Server data not available, falling back to localStorage');
    }
    return false;
}

// ローカルストレージからデータを読み込み
function loadQuestionsFromLocalStorage() {
    try {
        const savedQuestions = localStorage.getItem('physicsQuizQuestions');
        const savedAnswerExamples = localStorage.getItem('physicsQuizAnswerExamples');
        const savedEnabled = localStorage.getItem('physicsQuizEnabled');
        
        if (savedQuestions) {
            questions = JSON.parse(savedQuestions);
            if (document.getElementById('questionList')) {
                renderQuestionList();
            }
        }
        
        if (savedAnswerExamples) {
            answerExamples = JSON.parse(savedAnswerExamples);
            console.log('Answer examples loaded from localStorage:', answerExamples.length);
            // 解答例リストは管理画面が表示されている場合のみ更新
            if (currentScreen === 'admin' || document.getElementById('adminScreen').style.display === 'block') {
                renderAnswerExampleList();
            }
        } else {
            console.log('No answer examples found in localStorage');
        }
        
        if (savedEnabled === 'true') {
            testEnabled = true;
        }
        
        console.log('Questions loaded from localStorage:', questions.length);
    } catch (error) {
        console.error('LocalStorage load error:', error);
    }
}

// 管理画面メッセージ表示
function showAdminSuccess(message) {
    const successDiv = document.getElementById('adminSuccessMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

function showAdminError(message) {
    const errorDiv = document.getElementById('adminErrorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// ログイン画面に戻る
function backToLogin() {
    // 教員ログイン状態をクリア
    localStorage.removeItem('physicsQuizAdminLoggedIn');
    localStorage.removeItem('physicsQuizAdminLoginTime');
    
    showScreen('login');
    // フォームをリセット
    const studentIdInput = document.getElementById('studentId');
    const adminPasswordInput = document.getElementById('adminPassword');
    const loginError = document.getElementById('loginError');
    
    if (studentIdInput) studentIdInput.value = '';
    if (adminPasswordInput) adminPasswordInput.value = '';
    if (loginError) loginError.style.display = 'none';
}

// ========== テスト機能 ==========

// Canvas初期化
function initCanvas() {
    console.log('Initializing canvas...');
    
    canvas = document.getElementById('answerCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        // 少し待ってから再試行
        setTimeout(() => {
            canvas = document.getElementById('answerCanvas');
            if (canvas) {
                console.log('Canvas found on retry');
                initCanvasElements();
            }
        }, 500);
        return;
    }
    
    initCanvasElements();
}

function initCanvasElements() {
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not available');
        return;
    }
    
    console.log('Canvas context initialized, canvas size:', canvas.width, 'x', canvas.height);
    
    // 既存のイベントリスナーを削除（重複防止）
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);
    canvas.removeEventListener('touchstart', handleTouch);
    canvas.removeEventListener('touchmove', handleTouch);
    canvas.removeEventListener('touchend', stopDrawing);
    
    // Canvas サイズ設定
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 描画イベント設定
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // タッチイベント設定（iPad対応）
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });
    
    console.log('Canvas initialized successfully with touch events');
    
    // テスト描画で動作確認
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, 10, 10);
    setTimeout(() => {
        ctx.clearRect(0, 0, 10, 10);
    }, 1000);
}

function resizeCanvas() {
    if (!canvas || !ctx) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // コンテナサイズを取得（最小サイズを保証）
    const containerWidth = Math.max(container.clientWidth, 300);
    const containerHeight = Math.max(container.clientHeight, 400);
    
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    console.log('Canvas resized to:', containerWidth, 'x', containerHeight);
    
    // Canvas設定
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = penSize || 3;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
}

function handleTouch(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!e.touches || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    
    if (e.type === 'touchstart') {
        startDrawing({offsetX: x, offsetY: y});
    } else if (e.type === 'touchmove') {
        draw({offsetX: x, offsetY: y});
    }
}

function startDrawing(e) {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
    if (!isDrawing) return;
    
    if (currentTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#000000';
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    }
    
    ctx.lineWidth = penSize;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function updatePenSize() {
    const penSizeInput = document.getElementById('penSize');
    const penSizeValue = document.getElementById('penSizeValue');
    
    if (penSizeInput && penSizeValue) {
        penSize = penSizeInput.value;
        penSizeValue.textContent = penSize;
    }
}

function clearCanvas() {
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// 入力方法切り替え
function setInputMethod(method) {
    inputMethod = method;
    
    // ボタンのアクティブ状態を更新
    document.getElementById('canvasMethodBtn').classList.toggle('active', method === 'canvas');
    document.getElementById('textMethodBtn').classList.toggle('active', method === 'text');
    
    // 入力エリアの表示切り替え
    document.getElementById('canvasInputArea').style.display = method === 'canvas' ? 'block' : 'none';
    document.getElementById('textInputArea').style.display = method === 'text' ? 'block' : 'none';
}

// テスト開始
function startTest() {
    currentQuestionIndex = 0;
    startTime = new Date();
    testStartTime = new Date(); // 新しい変数にも設定
    violationCount = 0;
    testData = { answers: [], violations: [] };
    userAnswers = []; // 新しい回答配列を初期化
    canvasData = [];
    ocrResults = [];
    gradingResults = [];
    
    // 問題数表示更新
    const totalQuestionsElement = document.getElementById('totalQuestions');
    if (totalQuestionsElement) {
        totalQuestionsElement.textContent = questions.length;
    }
    
    // 違反カウンターリセット
    const violationCountElement = document.getElementById('violationCount');
    if (violationCountElement) {
        violationCountElement.textContent = '0';
    }
    
    // キャンバス初期化
    setTimeout(() => {
        initCanvas();
        setInputMethod('canvas'); // デフォルトで手書き入力を選択
    }, 100);
    
    // タイマー開始
    timerInterval = setInterval(updateTimer, 1000);
    
    // 最初の問題を表示
    showQuestion(0);
}

function updateTimer() {
    if (!startTime) return;
    
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const elapsedTimeElement = document.getElementById('elapsedTime');
    if (elapsedTimeElement) {
        elapsedTimeElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    
    // 現在の回答データを保存
    if (currentQuestionIndex !== index) {
        saveCurrentAnswer();
    }
    
    currentQuestionIndex = index;
    
    // 問題表示
    const currentQuestionElement = document.getElementById('currentQuestion');
    const questionImageElement = document.getElementById('questionImage');
    
    if (currentQuestionElement) {
        currentQuestionElement.textContent = index + 1;
    }
    
    if (questionImageElement) {
        questionImageElement.src = questions[index].image;
    }
    
    // 回答データ復元
    restoreAnswer(index);
    
    // ナビゲーションボタン更新
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const submitButton = document.getElementById('submitButton');
    
    if (prevButton) {
        prevButton.disabled = (index === 0);
    }
    
    if (nextButton) {
        nextButton.style.display = (index === questions.length - 1) ? 'none' : 'inline-block';
    }
    
    if (submitButton) {
        submitButton.style.display = (index === questions.length - 1) ? 'inline-block' : 'none';
    }
}

// 現在の回答を保存
function saveCurrentAnswer() {
    // testDataとuserAnswersの両方を更新
    if (!testData.answers[currentQuestionIndex]) {
        testData.answers[currentQuestionIndex] = {};
    }
    if (!userAnswers[currentQuestionIndex]) {
        userAnswers[currentQuestionIndex] = {};
    }
    
    const answerData = { method: inputMethod };
    
    if (inputMethod === 'canvas' && canvas) {
        const canvasDataUrl = canvas.toDataURL();
        answerData.canvas = canvasDataUrl;
        testData.answers[currentQuestionIndex].canvas = canvasDataUrl;
        userAnswers[currentQuestionIndex].canvas = canvasDataUrl;
        canvasData[currentQuestionIndex] = canvasDataUrl;
    } else if (inputMethod === 'text') {
        const textAnswer = document.getElementById('textAnswer').value;
        answerData.text = textAnswer;
        testData.answers[currentQuestionIndex].text = textAnswer;
        userAnswers[currentQuestionIndex].text = textAnswer;
    }
    
    testData.answers[currentQuestionIndex].method = inputMethod;
    userAnswers[currentQuestionIndex].method = inputMethod;
    
    console.log(`Answer saved for question ${currentQuestionIndex}:`, answerData);
}

// 回答を復元
function restoreAnswer(index) {
    const answer = testData.answers[index];
    
    if (answer) {
        // 入力方法を復元
        if (answer.method) {
            setInputMethod(answer.method);
        }
        
        // Canvas回答を復元
        if (answer.canvas && inputMethod === 'canvas') {
            const img = new Image();
            img.onload = function() {
                if (ctx) {
                    clearCanvas();
                    ctx.drawImage(img, 0, 0);
                }
            };
            img.src = answer.canvas;
        } else if (inputMethod === 'canvas') {
            clearCanvas();
        }
        
        // テキスト回答を復元
        if (answer.text && inputMethod === 'text') {
            document.getElementById('textAnswer').value = answer.text;
        } else if (inputMethod === 'text') {
            document.getElementById('textAnswer').value = '';
        }
    } else {
        // 新しい問題の場合は初期化
        if (inputMethod === 'canvas') {
            clearCanvas();
        } else {
            document.getElementById('textAnswer').value = '';
        }
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    }
}

async function submitTest() {
    if (confirm('テストを提出しますか？提出後は修正できません。')) {
        // 最後の回答を保存
        saveCurrentAnswer();
        
        // タイマー停止
        clearInterval(timerInterval);
        
        // 解答を保存（統一された保存関数を使用）
        saveSubmissionResult();
        
        // 完了画面表示
        showScreen('result');
        showSubmissionComplete();
    }
}

// ========== 解答回収機能 ==========

// 重複関数削除 - saveSubmissionResultに統一

// 提出完了画面を表示
function showSubmissionComplete() {
    const resultContainer = document.querySelector('#resultScreen .result-container');
    const finalStudentId = currentStudentId || studentId;
    const finalAnswers = userAnswers || (testData ? testData.answers : []);
    
    // 実際に回答された問題数を正確にカウント
    const answersCount = finalAnswers.filter(answer => {
        if (!answer) return false;
        return (answer.method === 'text' && answer.text && answer.text.trim() !== '') ||
               (answer.method === 'canvas' && answer.canvas && answer.canvas !== 'data:image/png;base64,');
    }).length;
    
    console.log('=== showSubmissionComplete called ===');
    console.log('finalStudentId:', finalStudentId);
    console.log('answersCount:', answersCount);
    console.log('violationCount:', violationCount);
    
    // 保存された提出データを確認
    const savedSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
    const mySubmission = savedSubmissions.find(s => s.studentId === finalStudentId);
    
    // 解答例表示部分を生成
    const answerExamplesHtml = generateAnswerExamplesDisplay();
    
    resultContainer.innerHTML = `
        <h2>✅ 提出完了</h2>
        <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; color: #28a745; margin-bottom: 20px;">
                📝 解答が正常に提出されました
                </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>学籍番号:</strong> ${finalStudentId}</p>
                <p><strong>提出時刻:</strong> ${new Date().toLocaleString('ja-JP')}</p>
                <p><strong>回答数:</strong> ${answersCount} 問</p>
                <p><strong>違反回数:</strong> ${violationCount || 0} 回</p>
                ${mySubmission ? '<p style="color: #28a745;"><strong>✓ データ保存確認済み</strong></p>' : '<p style="color: #dc3545;"><strong>⚠ データ保存を確認できません</strong></p>'}
            </div>
            <div style="color: #6c757d; font-size: 14px; margin: 20px 0;">
                解答は教員によって手動で採点されます。<br>
                結果については後日お知らせいたします。
        </div>
            ${mySubmission ? '' : `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
                    <p style="color: #856404; margin: 0; font-size: 14px;">
                        ⚠ 提出データの保存に問題がある可能性があります。<br>
                        念のため、教員に提出完了を口頭で報告してください。
                    </p>
                </div>
            `}
        </div>
        
        ${answerExamplesHtml}
        
        <button class="nav-button" onclick="backToLogin()">終了</button>
    `;
}

// 解答例表示部分を生成
function generateAnswerExamplesDisplay() {
    // 現在のテストデータから解答例を取得
    const currentAnswerExamples = currentTestData ? currentTestData.answerExamples : answerExamples;
    const currentQuestions = currentTestData ? currentTestData.questions : questions;
    
    console.log('=== 解答例表示デバッグ ===');
    console.log('currentTestData:', currentTestData);
    console.log('answerExamples (global):', answerExamples);
    console.log('currentAnswerExamples:', currentAnswerExamples);
    console.log('currentQuestions:', currentQuestions);
    
    // 解答例がない場合の詳細チェック
    if (!currentAnswerExamples || currentAnswerExamples.length === 0) {
        console.log('解答例が見つかりません');
        
        // LocalStorageから直接解答例を確認
        const savedAnswerExamples = localStorage.getItem('physicsQuizAnswerExamples');
        console.log('LocalStorage解答例:', savedAnswerExamples);
        
        if (savedAnswerExamples) {
            try {
                const parsedExamples = JSON.parse(savedAnswerExamples);
                console.log('解析済み解答例:', parsedExamples);
                if (parsedExamples && parsedExamples.length > 0) {
                    // LocalStorageから直接取得した解答例を使用
                    return generateExamplesFromData(parsedExamples, currentQuestions);
                }
            } catch (e) {
                console.error('解答例データの解析エラー:', e);
            }
        }
        
        return ''; // 解答例がない場合は何も表示しない
    }
    
    return generateExamplesFromData(currentAnswerExamples, currentQuestions);
}

// 解答例データから表示HTMLを生成
function generateExamplesFromData(answerExamplesData, questionsData) {
    console.log('=== 解答例HTML生成 ===');
    console.log('answerExamplesData:', answerExamplesData);
    console.log('questionsData:', questionsData);
    
    let examplesHtml = '';
    
    // 問題ごとに解答例を表示
    questionsData.forEach((question, questionIndex) => {
        // この問題に対応する解答例を探す（複数の方法で検索）
        let relatedExamples = answerExamplesData.filter(example => 
            example.questionIndex === questionIndex
        );
        
        // questionIndexが一致しない場合、順番で対応させる
        if (relatedExamples.length === 0 && answerExamplesData.length > questionIndex) {
            relatedExamples = [answerExamplesData[questionIndex]];
            console.log(`問題${questionIndex + 1}: questionIndexで見つからないため、順番で対応`);
        }
        
        console.log(`問題${questionIndex + 1}の解答例:`, relatedExamples);
        
        if (relatedExamples.length > 0) {
            examplesHtml += `
                <div style="margin: 30px 0; text-align: left;">
                    <h3 style="color: #007aff; margin-bottom: 15px;">📖 問題${questionIndex + 1}の解答例</h3>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border: 2px solid #e9ecef;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                            ${relatedExamples.map((example, exampleIndex) => `
                                <div style="text-align: center;">
                                    <h4 style="color: #666; margin-bottom: 10px;">解答例 ${exampleIndex + 1}</h4>
                                    <img src="${example.image}" 
                                         style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" 
                                         alt="問題${questionIndex + 1}の解答例${exampleIndex + 1}"
                                         onerror="console.error('解答例画像の読み込みエラー:', this.src)">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    // 解答例が問題と対応しない場合、全ての解答例を表示
    if (!examplesHtml && answerExamplesData.length > 0) {
        console.log('問題との対応が取れないため、全解答例を表示');
        examplesHtml = `
            <div style="margin: 30px 0; text-align: left;">
                <h3 style="color: #007aff; margin-bottom: 15px;">📖 解答例</h3>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border: 2px solid #e9ecef;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                        ${answerExamplesData.map((example, index) => `
                            <div style="text-align: center;">
                                <h4 style="color: #666; margin-bottom: 10px;">解答例 ${index + 1}</h4>
                                <img src="${example.image}" 
                                     style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" 
                                     alt="解答例${index + 1}"
                                     onerror="console.error('解答例画像の読み込みエラー:', this.src)">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    if (examplesHtml) {
        return `
            <div style="margin: 40px 0; border-top: 2px solid #e9ecef; padding-top: 30px;">
                <h2 style="color: #007aff; text-align: center; margin-bottom: 20px;">📚 解答例</h2>
                <p style="text-align: center; color: #666; margin-bottom: 30px;">
                    参考として解答例をご確認ください。自分の解答と比較して学習に役立ててください。
                </p>
                ${examplesHtml}
            </div>
        `;
    }
    
    console.log('解答例HTMLが生成されませんでした');
    return '';
}

// ========== 不正検知設定 ==========

// 違反検知設定
function setupViolationDetection() {
    // タブ切り替え検知
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && currentScreen === 'test') {
            violationCount++;
            isTabSwitched = true;
            showWarning();
            console.log('Tab switch detected. Violation count:', violationCount);
        }
    });
    
    // 右クリック禁止
    document.addEventListener('contextmenu', function(e) {
        if (currentScreen === 'test') {
            e.preventDefault();
            violationCount++;
            showWarning();
            console.log('Right click detected. Violation count:', violationCount);
        }
    });
    
    // キーボードショートカット禁止
    document.addEventListener('keydown', function(e) {
        if (currentScreen === 'test') {
            // F12, Ctrl+Shift+I, Ctrl+U等の開発者ツール系キー
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C')) {
                e.preventDefault();
                violationCount++;
                isDevToolsOpen = true;
                showWarning();
                console.log('Developer tools key detected. Violation count:', violationCount);
            }
        }
    });
}

// 警告表示
function showWarning() {
    const modal = document.getElementById('warningModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // 違反の種類に応じてメッセージを変更
        const message = document.getElementById('warningMessage');
        if (message) {
            if (isTabSwitched) {
                message.textContent = '画面を切り替えることは禁止されています。';
                isTabSwitched = false;
            } else if (isDevToolsOpen) {
                message.textContent = '開発者ツールの使用は禁止されています。';
                isDevToolsOpen = false;
                } else {
                message.textContent = '不正な操作が検知されました。';
            }
        }
        
        // 5秒後に自動で閉じる
        setTimeout(() => {
            closeWarning();
        }, 5000);
    }
}

// 警告を閉じる
function closeWarning() {
    const modal = document.getElementById('warningModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========== 結果保存・表示 ==========

// 学生の解答を保存（統一版）
async function saveSubmissionResult() {
    try {
        console.log('=== saveSubmissionResult called ===');
        console.log('currentStudentId:', currentStudentId);
        console.log('studentId:', typeof studentId !== 'undefined' ? studentId : 'undefined');
        console.log('currentTestCode:', currentTestCode);
        console.log('currentTestCode type:', typeof currentTestCode);
        console.log('userAnswers:', userAnswers);
        console.log('currentTestData:', currentTestData);
        
        // 🚨 デバッグ: currentTestCodeの値を詳細確認
        if (!currentTestCode || currentTestCode === 'LOCAL') {
            console.error('🚨 PROBLEM: currentTestCode is invalid!');
            console.error('currentTestCode value:', currentTestCode);
            console.error('All localStorage keys:', Object.keys(localStorage));
        }
        
        const finalStudentId = currentStudentId || studentId;
        const finalTestCode = currentTestCode || generateShortId();
        const finalAnswers = userAnswers || (testData ? testData.answers : []);
        const finalQuestions = currentTestData ? currentTestData.questions : questions;
        const finalStartTime = testStartTime || startTime || new Date();
        
        if (!finalStudentId) {
            console.error('No student ID available');
            alert('学籍番号が取得できませんでした。再度ログインしてください。');
            return;
        }
        
        const submissionData = {
            studentId: finalStudentId,
            testCode: finalTestCode,
            timestamp: new Date().toISOString(),
            startTime: finalStartTime,
            endTime: new Date(),
            totalTime: Math.floor((new Date() - finalStartTime) / 1000),
            answers: finalAnswers,
            questions: finalQuestions.map(q => ({
                id: q.id,
                image: q.image,
                patterns: q.patterns
            })),
            violationCount: violationCount || 0,
            violations: testData ? testData.violations : [],
            isCompleted: true
        };
        
        console.log('Prepared submission data:', submissionData);
        
        // Firebase保存時はローカル保存を最小化（メタデータのみ）
        if (isFirebaseAvailable) {
            // Firebase利用時：軽量メタデータのみローカル保存
            const lightSubmission = {
                studentId: finalStudentId,
                testCode: finalTestCode,
                timestamp: submissionData.timestamp,
                firebaseSaved: true,
                questionCount: finalAnswers.length
            };
            
            const submissionKey = `submissions_${finalTestCode}`;
            const existingSubmissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
            const filteredSubmissions = existingSubmissions.filter(sub => sub.studentId !== finalStudentId);
            filteredSubmissions.push(lightSubmission);
            localStorage.setItem(submissionKey, JSON.stringify(filteredSubmissions));
            console.log('Light metadata saved to localStorage (Firebase mode)');
        } else {
            // Firebase未使用時：フル保存
            const submissionKey = `submissions_${finalTestCode}`;
            const existingSubmissions = JSON.parse(localStorage.getItem(submissionKey) || '[]');
            const filteredSubmissions = existingSubmissions.filter(sub => sub.studentId !== finalStudentId);
            filteredSubmissions.push(submissionData);
            localStorage.setItem(submissionKey, JSON.stringify(filteredSubmissions));
            
            const allSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
            const allFiltered = allSubmissions.filter(sub => sub.studentId !== finalStudentId || sub.testCode !== finalTestCode);
            allFiltered.push(submissionData);
            localStorage.setItem('studentSubmissions', JSON.stringify(allFiltered));
            console.log('Full submission saved to localStorage (offline mode)');
        }
        
        // Firebase利用時は重複ローカル保存を削除
        if (!isFirebaseAvailable && finalTestCode && finalTestCode.length > 0) {
            console.log('Offline mode: attempting cloud-style save...');
            
            const cloudKey = `submission_${finalTestCode}_${finalStudentId}`;
            const cloudData = {
                ...submissionData,
                cloudSaved: false,
                cloudTimestamp: new Date().toISOString()
            };
            
            try {
                localStorage.setItem(cloudKey, JSON.stringify(cloudData));
                console.log('Cloud-style save completed:', cloudKey);
            } catch (e) {
                console.warn('Cloud-style save failed:', e);
            }
        }
        
        // 保存確認（Firebase利用時は軽量表示）
        if (isFirebaseAvailable) {
            console.log('Firebase mode: Data saved to cloud storage');
        } else {
            const savedSubmissions = JSON.parse(localStorage.getItem('studentSubmissions') || '[]');
            console.log('Offline mode - submissions after save:', savedSubmissions);
        }
        
        // Firebase Storageに画像をアップロード（一時的に無効化）
        let firebaseMessage = '';
        if (false) { // isFirebaseAvailable を一時的に無効化
            try {
                await uploadImagesToFirebase(finalStudentId, finalTestCode, finalAnswers);
                firebaseMessage = '\n\n✅ Firebase Storageに画像もアップロードしました！\n📱→🖥️ 教員は別デバイスからダウンロード可能';
    } catch (error) {
                console.error('Firebase upload failed:', error);
                firebaseMessage = '\n\n⚠️ Firebase Storageへのアップロードに失敗\nローカル保存は完了しています';
            }
        } else {
            firebaseMessage = '\n\n📝 ローカルに保存しました\n（Firebase機能は一時的に無効化中）';
        }
        
        alert(`🎉 提出完了！\n学籍番号: ${finalStudentId}${firebaseMessage}`);
        
    } catch (error) {
        console.error('Failed to save submission:', error);
        alert('解答の保存に失敗しました: ' + error.message);
    }
}

// Firebase Storageに画像をアップロード
async function uploadImagesToFirebase(studentId, testCode, answers) {
    if (!isFirebaseAvailable || !firebaseStorage) {
        console.log('Firebase not available, skipping image upload');
        return;
    }
    
    try {
        console.log('=== Firebase Upload Debug ===');
        console.log('Starting Firebase image upload for student:', studentId);
        console.log('Test code for upload:', testCode);
        console.log('Test code type:', typeof testCode);
        console.log('Test code length:', testCode ? testCode.length : 'null/undefined');
        console.log('Answers count:', answers.length);
        
        // 🚨 デバッグ: testCodeがLOCALになっていないか確認
        if (testCode === 'LOCAL') {
            console.error('🚨 ERROR: testCode is still LOCAL!');
            console.error('studentId:', studentId);
            console.error('currentTestCode:', currentTestCode);
            console.error('currentStudentId:', currentStudentId);
        }
        
        for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            if (answer && answer.method === 'canvas' && answer.canvas) {
                // Canvas画像をBlobに変換
                const response = await fetch(answer.canvas);
                const blob = await response.blob();
                
                // Firebaseのパス: submissions/テストコード/学籍番号/問題番号.png
                const imagePath = `submissions/${testCode}/${studentId}/question${i + 1}.png`;
                const storageRef = firebaseStorage.ref(imagePath);
                
                console.log(`Uploading image: ${imagePath}`);
                await storageRef.put(blob);
                console.log(`Successfully uploaded: ${imagePath}`);
            }
        }
        
        // 詳細なメタデータを保存（採点用データ含む）
        const metadata = {
            studentId: studentId,
            testCode: testCode,
            timestamp: new Date().toISOString(),
            uploadedAt: new Date().toLocaleString('ja-JP'),
            questionCount: answers.length,
            answers: answers.map((answer, index) => ({
                questionNumber: index + 1,
                method: answer.method,
                textAnswer: answer.method === 'text' ? answer.text : null,
                hasHandwriting: answer.method === 'canvas' && answer.canvas ? true : false,
                imageFileName: answer.method === 'canvas' && answer.canvas ? `question${index + 1}.png` : null
            })),
            testInfo: {
                totalTime: window.totalTestTime || 0,
                violations: window.violationCount || 0,
                browser: navigator.userAgent,
                deviceInfo: {
                    platform: navigator.platform,
                    language: navigator.language,
                    screen: `${screen.width}x${screen.height}`
                }
            }
        };
        
        const metadataPath = `submissions/${testCode}/${studentId}/metadata.json`;
        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
        await firebaseStorage.ref(metadataPath).put(metadataBlob);
        
        console.log('Firebase image upload completed successfully');
        
    } catch (error) {
        console.error('Firebase upload error:', error);
        // アップロードエラーでも解答提出は継続（ローカル保存は成功しているため）
    }
}

// CORS設定案内機能

// CORS設定案内機能
function showCorsInstructions() {
    const instructions = `
🚨 CORS設定が必要です！

【現在の問題】
Firebase StorageからのファイルダウンロードがCORSエラーでブロックされています。

【解決手順】
1. Google Cloud Shell にアクセス: https://console.cloud.google.com/cloudshell

2. 以下のコマンドを順番に実行:

gcloud config set project physics-quiz-app

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

gsutil cors set cors.json gs://physics-quiz-app.firebasestorage.app

3. 設定確認:
gsutil cors get gs://physics-quiz-app.firebasestorage.app

【設定完了後】
- 数分待ってからブラウザのキャッシュをクリア
- 再度「手書き画像ダウンロード」を試してください

このメッセージをコピーして手順に従ってください！
    `;
    
    alert(instructions);
    
    // コンソールにも出力
    console.log("=".repeat(50));
    console.log("CORS設定手順:");
    console.log("=".repeat(50));
    console.log(instructions);
    console.log("=".repeat(50));
}

async function downloadFirebaseImages() {
    if (!isFirebaseAvailable || !firebaseStorage) {
        showAdminError('Firebase Storageが利用できません。\n\n📋 設定手順:\n1. Firebase Consoleでプロジェクト作成\n2. Storage有効化\n3. app.jsのfirebaseConfig更新\n\n詳細: FIREBASE_SETUP.mdを参照');
        return;
    }
    
    try {
        showAdminSuccess('Firebase上の提出データを確認中...');
        
        const submissionsRef = firebaseStorage.ref('submissions');
        
        // すべてのテストコードフォルダを取得
        const testCodes = await submissionsRef.listAll();
        
        if (testCodes.prefixes.length === 0) {
            showAdminError('Firebase上に提出画像が見つかりません。学生がまだ提出していない可能性があります。');
            return;
        }
        
        // テストコード選択UI表示
        showTestCodeSelectionModal(testCodes.prefixes);
        
    } catch (error) {
        console.error('Firebase check error:', error);
        showAdminError('Firebase接続エラー: ' + error.message);
    }
}

// テストコード選択モーダル表示
async function showTestCodeSelectionModal(testCodeRefs) {
    // テストコード情報を収集
    let testCodeData = [];
    
    for (const testCodeRef of testCodeRefs) {
        const testCode = testCodeRef.name;
        const students = await testCodeRef.listAll();
        let totalFiles = 0;
        
        for (const studentRef of students.prefixes) {
            const files = await studentRef.listAll();
            totalFiles += files.items.length;
        }
        
        testCodeData.push({
            code: testCode,
            studentCount: students.prefixes.length,
            fileCount: totalFiles,
            ref: testCodeRef
        });
    }
    
    // モーダル表示
    const modalHtml = `
        <div id="testCodeSelectionModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
            <div class="modal-content" style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto;">
                <h2 style="margin-top: 0; color: #007aff;">📁 テストコード選択</h2>
                <p>ダウンロードするテストコードを選択してください：</p>
                
                <div class="test-code-list" style="margin: 20px 0;">
                    ${testCodeData.map(data => `
                        <div class="test-code-item" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; margin: 10px 0; cursor: pointer; transition: all 0.3s;" 
                             onclick="selectTestCodeForDownload('${data.code}')" 
                             onmouseover="this.style.borderColor='#007aff'; this.style.backgroundColor='#f0f8ff';"
                             onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='white';">
                            <h3 style="margin: 0 0 10px 0; color: #007aff;">📝 ${data.code}</h3>
                            <p style="margin: 5px 0; color: #666;">
                                👥 ${data.studentCount}名の学生 | 📄 ${data.fileCount}個のファイル
                            </p>
                            <small style="color: #999;">クリックしてZIPダウンロード</small>
                </div>
                    `).join('')}
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="closeTestCodeSelectionModal()" style="background: #666; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                        キャンセル
                    </button>
                    </div>
                    </div>
                    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// テストコード選択でダウンロード実行
async function selectTestCodeForDownload(testCode) {
    closeTestCodeSelectionModal();
    
    try {
        showAdminSuccess(`${testCode} のデータをダウンロード中...`);
        
        // JSZipライブラリを動的読み込み
        if (typeof JSZip === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        const zip = new JSZip();
        const testCodeFolder = zip.folder(testCode);
        
        const testCodeRef = firebaseStorage.ref(`submissions/${testCode}`);
        const students = await testCodeRef.listAll();
        
        let processedFiles = 0;
        let totalFiles = 0;
        
        // 総ファイル数を計算
        for (const studentRef of students.prefixes) {
            const files = await studentRef.listAll();
            totalFiles += files.items.length;
        }
        
        // 各学生のファイルをダウンロードしてZIPに追加
        for (const studentRef of students.prefixes) {
            const studentId = studentRef.name;
            const studentFolder = testCodeFolder.folder(`学籍番号_${studentId}`);
            
            const files = await studentRef.listAll();
            
            for (const fileRef of files.items) {
                                try {
                    console.log(`Downloading: ${fileRef.fullPath}`);
                    
                    // Firebase Storage の getDownloadURL() を使って実際のファイルをダウンロード
                    const downloadURL = await fileRef.getDownloadURL();
                    console.log(`Got download URL for ${fileRef.name}: ${downloadURL}`);
                    
                    // XMLHttpRequest を使用してCORS問題を回避
                    const blob = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', downloadURL);
                        xhr.responseType = 'blob';
                        xhr.timeout = 30000; // 30秒タイムアウト
                        
                        xhr.onload = function() {
                            if (xhr.status === 200) {
                                console.log(`Successfully downloaded: ${fileRef.name} (${xhr.response.size} bytes)`);
                                resolve(xhr.response);
                } else {
                                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                            }
                        };
                        
                        xhr.onerror = function() {
                            reject(new Error('Network error'));
                        };
                        
                        xhr.ontimeout = function() {
                            reject(new Error('Download timeout'));
                        };
                        
                        xhr.onprogress = function(event) {
                            if (event.lengthComputable) {
                                const percent = Math.round((event.loaded / event.total) * 100);
                                console.log(`Downloading ${fileRef.name}: ${percent}%`);
                            }
                        };
                        
                        xhr.send();
                    });
                    
                    // ファイルサイズチェック
                    if (!blob || blob.size === 0) {
                        throw new Error('Downloaded file is empty');
                    }
                    
                    // MIME type チェック
                    console.log(`File ${fileRef.name}: size=${blob.size}, type=${blob.type}`);
                    
                    // ZIPに追加
                    studentFolder.file(fileRef.name, blob);
                    processedFiles++;
                    
                    console.log(`Successfully added to ZIP: ${fileRef.name} (${blob.size} bytes, ${blob.type})`);
                    
                    // 進捗表示
                    if (processedFiles % 2 === 0 || processedFiles === totalFiles) {
                        showAdminSuccess(`ダウンロード中... ${processedFiles}/${totalFiles} ファイル (${Math.round(processedFiles/totalFiles*100)}%)`);
                    }
                    
    } catch (error) {
                    console.error(`Failed to download ${fileRef.fullPath}:`, error);
                    
                    // エラー時も詳細情報を含める
                    try {
                        const downloadURL = await fileRef.getDownloadURL();
                        const errorInfo = `【ダウンロードエラー】\n\nファイル: ${fileRef.name}\nパス: ${fileRef.fullPath}\nエラー: ${error.message}\n\n【手動ダウンロード用URL】\n${downloadURL}\n\n【手順】\n1. 上記URLをコピー\n2. 新しいタブに貼り付けて開く\n3. 画像/ファイルが表示されたら右クリック → 名前を付けて保存\n4. ファイル名を "${fileRef.name}" にして保存\n\n時刻: ${new Date().toLocaleString()}\n\n【重要】このファイルは手動でダウンロードしてください！`;
                        studentFolder.file(`${fileRef.name}_手動ダウンロード必要.txt`, errorInfo);
                        console.log(`Created manual download info for: ${fileRef.name}`);
                    } catch (urlError) {
                        const errorInfo = `【重大エラー】\n\nファイル: ${fileRef.name}\nダウンロードエラー: ${error.message}\nURL取得エラー: ${urlError.message}\n\nFirebase Console から手動でダウンロードしてください:\nhttps://console.firebase.google.com/project/physics-quiz-app/storage\n\n時刻: ${new Date().toLocaleString()}`;
                        studentFolder.file(`${fileRef.name}_CRITICAL_ERROR.txt`, errorInfo);
                        console.error(`Critical error for ${fileRef.name}:`, error, urlError);
                    }
                    processedFiles++;
                }
            }
        }
        
        if (processedFiles === 0) {
            showAdminError('ダウンロード可能なファイルがありませんでした。');
            return;
        }
    
        // ZIPファイル生成・ダウンロード
        showAdminSuccess('ZIPファイルを生成中...');
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const now = new Date();
        const filename = `${testCode}_提出画像_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.zip`;
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = filename;
        link.click();
        
        showAdminSuccess(`✅ ダウンロード完了！\n📁 ${filename}\n📊 ${processedFiles}ファイルを取得しました`);
        
    } catch (error) {
        console.error('Download error:', error);
        showAdminError('ダウンロードに失敗しました: ' + error.message);
    }
}

// テストコード選択モーダルを閉じる
function closeTestCodeSelectionModal() {
    const modal = document.getElementById('testCodeSelectionModal');
    if (modal) {
        modal.remove();
    }
}

// 全解答データをクリア（LocalStorage + Firebase Storage対応）
async function clearAllResults() {
    const confirmMessage = `🚨 全ての解答データを削除しますか？

【削除対象】
✅ ローカル解答データ（即座に削除）
✅ Firebase Storage画像（可能な範囲で削除）

【注意】
⚠️ この操作は取り消せません
⚠️ Firebase削除にはネットワーク接続が必要
⚠️ 一部のFirebaseデータは手動削除が必要な場合があります

本当に削除しますか？`;

    if (confirm(confirmMessage)) {
        try {
            showAdminSuccess('データ削除を開始しています...');
            
            // 1. LocalStorageデータを削除
            let deletedLocalCount = 0;
            const keysToDelete = [];
            
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('submissions_') || 
                    key.startsWith('studentSubmissions') ||
                    key.startsWith('answers_')) {
                    keysToDelete.push(key);
                }
            });
            
            keysToDelete.forEach(key => {
                localStorage.removeItem(key);
                deletedLocalCount++;
            });
            
            // 2. Firebase Storage削除を試行
            let firebaseDeletedCount = 0;
            let firebaseErrorCount = 0;
            
            if (typeof firebase !== 'undefined' && firebase.storage) {
                try {
                    const storageRef = firebase.storage().ref('submissions');
                    const submissionsList = await storageRef.listAll();
                    
                    showAdminSuccess(`Firebase削除中... ${submissionsList.prefixes.length}個のテストコードを確認`);
                    
                    // 各テストコードフォルダを削除
                    for (const testCodeRef of submissionsList.prefixes) {
                        try {
                            const students = await testCodeRef.listAll();
                            
                            // 各学生フォルダの画像を削除
                            for (const studentRef of students.prefixes) {
                                const files = await studentRef.listAll();
                                
                                for (const fileRef of files.items) {
                                    try {
                                        await fileRef.delete();
                                        firebaseDeletedCount++;
                                    } catch (deleteError) {
                                        console.error(`Failed to delete ${fileRef.fullPath}:`, deleteError);
                                        firebaseErrorCount++;
                                    }
                                }
                            }
    } catch (error) {
                            console.error(`Failed to process test code ${testCodeRef.name}:`, error);
                            firebaseErrorCount++;
                        }
                    }
                } catch (firebaseError) {
                    console.error('Firebase deletion error:', firebaseError);
                    firebaseErrorCount++;
                }
            }
            
            // 3. UI更新
    const container = document.getElementById('submissionResultsContainer');
            if (container) {
                container.style.display = 'none';
            }
            
            // 4. 結果表示
            let resultMessage = `✅ データ削除完了\n\n📊 削除結果:\n• ローカルデータ: ${deletedLocalCount}件`;
            
            if (firebaseDeletedCount > 0) {
                resultMessage += `\n• Firebase画像: ${firebaseDeletedCount}件`;
            }
            
            if (firebaseErrorCount > 0) {
                resultMessage += `\n\n⚠️ Firebase削除エラー: ${firebaseErrorCount}件\n手動削除が必要な場合があります`;
            }
            
            if (firebaseDeletedCount === 0 && firebaseErrorCount === 0) {
                resultMessage += `\n\n💡 Firebase削除は実行されませんでした\n（接続エラーまたはデータなし）`;
            }
            
            showAdminSuccess(resultMessage);
        
    } catch (error) {
            console.error('Failed to clear data:', error);
            showAdminError(`データ削除に失敗しました: ${error.message}\n\nFirebase Consoleから手動削除してください:\nhttps://console.firebase.google.com/project/physics-quiz-app/storage`);
        }
    }
}

// 🚨 緊急: LocalStorage容量管理機能
function checkStorageQuota() {
    try {
        const used = JSON.stringify(localStorage).length;
        const usedMB = (used / (1024 * 1024)).toFixed(2);
        
        // ログ出力を制限（1分に1回のみ）
        const lastLogTime = localStorage.getItem('lastStorageLog');
        const now = Date.now();
        const shouldLog = !lastLogTime || (now - parseInt(lastLogTime)) > 60000;
        
        if (shouldLog) {
            console.log(`📊 LocalStorage使用量: ${usedMB}MB / ~8MB推奨制限`);
            localStorage.setItem('lastStorageLog', now.toString());
        }
        
        if (used > 7 * 1024 * 1024) { // 7MB以上で緊急クリーニング（制限を大幅緩和）
            if (shouldLog) {
                console.warn(`🚨 Storage capacity critical (${usedMB}MB), performing emergency cleanup...`);
            }
            emergencyCleanStorage();
            return false; // クリーニング後は再チェックが必要
        } else if (used > 5 * 1024 * 1024) { // 5MB以上で警告
            if (shouldLog) {
            console.warn(`⚠️ Storage使用量注意: ${usedMB}MB`);
            }
        }
        return true;
    } catch (error) {
        console.error('Storage quota check failed:', error);
        return false;
    }
}

// 🧹 安全な自動クリーニング: 複数人受験対応版
function clearOldTestDataAutomatically() {
    console.log('🧹 安全自動クリーニング開始: 複数人受験対応');
    
    let deletedCount = 0;
    const keysToDelete = [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    // 安全な削除：3日以上古いデータのみ削除（複数人受験を保護）
    Object.keys(localStorage).forEach(key => {
        try {
            // 3日以上古いテストコードのみ削除
            if (key.startsWith('testCode_')) {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsedData = JSON.parse(data);
                    const created = new Date(parsedData.created || parsedData.lastUpdated || 0);
                    if (created < threeDaysAgo) {
            keysToDelete.push(key);
                        console.log(`Marking old test code for deletion: ${key} (${created.toLocaleDateString()})`);
                    }
                }
            }
            
            // 古い学生データのみ削除（3日以上前）
            if (key.startsWith('submissions_') || key.startsWith('answers_') || key.startsWith('studentSubmissions')) {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsedData = JSON.parse(data);
                    const timestamp = new Date(parsedData.timestamp || parsedData.created || 0);
                    if (timestamp < threeDaysAgo) {
            keysToDelete.push(key);
        }
                }
            }
        } catch (error) {
            // 破損データのみ削除
            if (key.startsWith('testCode_') || key.startsWith('submissions_') || key.startsWith('answers_')) {
            keysToDelete.push(key);
                console.log(`Marking corrupted data for deletion: ${key}`);
            }
        }
    });
    
    // 削除実行
    keysToDelete.forEach(key => {
        try {
        localStorage.removeItem(key);
        deletedCount++;
        console.log(`🗑️ Auto-deleted: ${key}`);
        } catch (error) {
            console.error(`Failed to delete ${key}:`, error);
        }
    });
    
    if (deletedCount > 0) {
        const usedMB = (JSON.stringify(localStorage).length / (1024 * 1024)).toFixed(2);
        console.log(`🧹 安全クリーニング完了: ${deletedCount}件削除 (3日以上古いデータのみ), 現在${usedMB}MB使用中`);
    } else {
        console.log('🧹 クリーニング不要: 削除対象なし (アクティブなテストデータを保護)');
    }
}

// 現在のテストコードを取得
function getCurrentTestCode() {
    try {
    // 最新のテストコードを取得
        const testCodes = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('testCode_')) {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsedData = JSON.parse(data);
                        testCodes.push({
                    code: key.replace('testCode_', ''),
                            created: new Date(parsedData.created || parsedData.lastUpdated || 0)
                        });
                    }
                } catch (error) {
                    // 破損したデータは無視
                    console.warn(`Skipping corrupted test code: ${key}`);
                }
            }
        }
        
        // 日付順でソート（新しい順）
        testCodes.sort((a, b) => b.created - a.created);
    
    return testCodes.length > 0 ? testCodes[0].code : null;
    } catch (error) {
        console.error('Error getting current test code:', error);
        return null;
    }
}

function emergencyCleanStorage() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7日前に変更（アクティブテスト保護）
    let deletedCount = 0;
    let deletedSizeMB = 0;
    
    console.log('🚨 緊急ストレージクリーニング開始 (アクティブテストコード保護モード)...');
    
    // アクティブなテストコードを取得（保護対象）
    const activeTestCode = localStorage.getItem('physicsQuizActiveTestCode');
    console.log(`🛡️ アクティブテストコード保護: ${activeTestCode}`);
    
    // 安全にキー一覧を取得
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) keys.push(key);
        }
    } catch (error) {
        console.error('Error getting localStorage keys:', error);
        return;
    }
    
    keys.forEach(key => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return;
            
            const itemSize = item.length;
            let shouldDelete = false;
            
            // テストコードの削除判定（アクティブテスト保護）
            if (key.startsWith('testCode_')) {
                const testCode = key.replace('testCode_', '');
                
                // アクティブなテストコードは絶対に削除しない
                if (activeTestCode && testCode === activeTestCode) {
                    console.log(`🛡️ アクティブテストコード保護: ${testCode} (削除スキップ)`);
                    return; // 削除しない
                }
                
                try {
                    const data = JSON.parse(item);
                    const lastUpdated = new Date(data.lastUpdated || data.created || 0);
                    
                    // 7日以上古いテストコードのみ削除
                    if (lastUpdated < sevenDaysAgo) {
                        shouldDelete = true;
                        console.log(`🗑️ 古いテストコード削除予定: ${testCode} (${lastUpdated.toLocaleDateString()})`);
                    }
                } catch (error) {
                    // JSON解析エラー = 破損データなので削除（アクティブでない場合のみ）
                    shouldDelete = true;
                    console.log(`🗑️ 破損テストコード削除予定: ${testCode}`);
                }
            }
            
            // 古い学生データを削除（7日以上前のもののみ）
            if (key.startsWith('submissions_') || key.startsWith('answers_')) {
                try {
                    const data = JSON.parse(item);
                    if (data.timestamp) {
                        const submissionDate = new Date(data.timestamp);
                        if (submissionDate < sevenDaysAgo) {
                            shouldDelete = true;
                        }
                    } else {
                        // タイムスタンプがないデータは削除
                        shouldDelete = true;
                    }
                } catch (error) {
                    // JSON解析エラー = 破損データなので削除
                    shouldDelete = true;
                }
            }
            
            // 破損したデータやサイズが大きすぎるデータ
            if (itemSize > 1024 * 1024) { // 1MB以上のアイテム
                console.warn(`Large item found: ${key} (${(itemSize/1024/1024).toFixed(2)}MB)`);
                if (key.startsWith('testCode_') || key.startsWith('submissions_')) {
                    shouldDelete = true;
                }
        }
        
            // ログ管理用の一時データ
            if (key === 'lastStorageLog') {
                // このキーは残す
                return;
        }
        
        if (shouldDelete) {
            localStorage.removeItem(key);
            deletedCount++;
            deletedSizeMB += itemSize / (1024 * 1024);
            console.log(`🗑️ Deleted: ${key}`);
            }
        } catch (error) {
            console.error(`Error processing key ${key}:`, error);
        }
    });
    
    const newUsed = JSON.stringify(localStorage).length;
    const newUsedMB = (newUsed / (1024 * 1024)).toFixed(2);
    const freedMB = deletedSizeMB.toFixed(2);
    
    showAdminSuccess(`🚨 緊急ストレージクリーニング完了\n\n📊 削除項目: ${deletedCount}件 (7日以上古いデータのみ)\n💾 解放容量: ${freedMB}MB\n📊 現在使用量: ${newUsedMB}MB\n🛡️ アクティブテストコード: ${activeTestCode || '未設定'}\n\n✅ アクティブなテストデータは保護されました`);
    
    // ページリロードで反映
    setTimeout(() => {
        location.reload();
    }, 3000);
}



// ========== 初期化処理 ==========

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Physics Quiz System initialized - Version 2.3 (Optimized storage)');
    
    // 🧹 ストレージ容量管理（軽量版 - 初回のみ）
    try {
        checkStorageQuota();
    } catch (error) {
        console.error('Storage check failed:', error);
    }
    
    // 管理画面の初期化
    setupDragAndDrop();
    await loadSavedQuestions();
    updateTestStatus();
    setupViolationDetection();
    
    // キャンバス初期化（テスト画面表示時に実行）
    const testScreen = document.getElementById('testScreen');
    if (testScreen) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.id === 'testScreen' && target.style.display !== 'none') {
                        // テスト画面が表示されたときにキャンバスを初期化
                        setTimeout(initCanvas, 100);
                    }
                }
            });
        });
        
        observer.observe(testScreen, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
    
    // 初期画面設定
    showScreen('login');
});



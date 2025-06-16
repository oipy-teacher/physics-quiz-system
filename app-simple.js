// ========== 物理クイズシステム（Claude API専用・シンプル版） ==========

// 設定
const ADMIN_PASSWORD = 'physics2024';
const CLAUDE_API_KEY = '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';

// グローバル変数
let questions = [];
let currentQuestionIndex = 0;
let studentId = '';
let canvas, ctx;
let isDrawing = false;

// 初期化
window.onload = function() {
    console.log('🚀 物理クイズシステム開始（Claude専用）');
    loadQuestions();
    initCanvas();
    setupDragAndDrop();
};

// ========== ログイン機能 ==========

function studentLogin() {
    const inputId = document.getElementById('studentId').value;
    if (!/^\d{4}$/.test(inputId)) {
        alert('学籍番号は4桁の数字で入力してください');
        return;
    }
    
    if (questions.length === 0) {
        alert('テストがまだ設定されていません');
        return;
    }
    
    studentId = inputId;
    showScreen('test');
    startTest();
}

function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    if (password !== ADMIN_PASSWORD) {
        alert('パスワードが正しくありません');
        return;
    }
    showScreen('admin');
}

function showAdminLogin() {
    document.getElementById('studentLoginDiv').style.display = 'none';
    document.getElementById('adminLoginDiv').style.display = 'block';
}

function showStudentLogin() {
    document.getElementById('adminLoginDiv').style.display = 'none';
    document.getElementById('studentLoginDiv').style.display = 'block';
}

// ========== 画面切り替え ==========

function showScreen(screen) {
    const screens = ['loginScreen', 'adminScreen', 'testScreen', 'resultScreen'];
    screens.forEach(s => document.getElementById(s).style.display = 'none');
    document.getElementById(screen + 'Screen').style.display = 'block';
}

function backToLogin() {
    showScreen('login');
    document.getElementById('studentId').value = '';
    document.getElementById('adminPassword').value = '';
}

// ========== 管理者機能 ==========

function selectFile() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const files = event.target.files;
    for (let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            addQuestion(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// ドラッグ&ドロップ機能
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.backgroundColor = '#f0f0f0';
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.style.backgroundColor = '';
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        for (let file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    addQuestion(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
    });
}

function addQuestion(imageData) {
    const question = {
        id: Date.now(),
        image: imageData,
        correctPatterns: ['']
    };
    questions.push(question);
    renderQuestionList();
}

function renderQuestionList() {
    const container = document.getElementById('questionList');
    if (!container) return;
    
    container.innerHTML = questions.map((q, index) => `
        <div class="question-item">
            <h3>問題 ${index + 1}</h3>
            <img src="${q.image}" style="max-width: 200px;">
            <div>
                <label>正解パターン:</label>
                <input type="text" value="${q.correctPatterns[0]}" 
                       onchange="updatePattern(${index}, this.value)"
                       placeholder="例: 4.9,9.8">
            </div>
            <button onclick="removeQuestion(${index})">削除</button>
        </div>
    `).join('');
}

function updatePattern(index, value) {
    questions[index].correctPatterns[0] = value;
}

function removeQuestion(index) {
    questions.splice(index, 1);
    renderQuestionList();
}

function saveQuestions() {
    localStorage.setItem('physics_questions', JSON.stringify(questions));
    alert('問題を保存しました！');
}

function loadQuestions() {
    const saved = localStorage.getItem('physics_questions');
    if (saved) {
        questions = JSON.parse(saved);
        renderQuestionList();
    }
}

// ========== Canvas機能 ==========

function initCanvas() {
    canvas = document.getElementById('answerCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;
    
    // 描画イベント
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    
    // Canvas設定
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
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
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ========== テスト機能 ==========

function startTest() {
    currentQuestionIndex = 0;
    showQuestion(0);
}

function showQuestion(index) {
    if (index >= questions.length) return;
    
    document.getElementById('currentQuestion').textContent = index + 1;
    document.getElementById('totalQuestions').textContent = questions.length;
    document.getElementById('questionImage').src = questions[index].image;
    
    clearCanvas();
    
    // ナビゲーションボタン
    document.getElementById('prevButton').disabled = index === 0;
    document.getElementById('nextButton').style.display = index === questions.length - 1 ? 'none' : 'block';
    document.getElementById('submitButton').style.display = index === questions.length - 1 ? 'block' : 'none';
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion(currentQuestionIndex);
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        showQuestion(currentQuestionIndex);
    }
}

async function submitTest() {
    console.log('🚀 Claude APIで採点開始！');
    
    // Canvas画像を取得
    const imageDataUrl = canvas.toDataURL('image/png');
    
    try {
        // Claude APIで手書き認識
        const result = await claudeOCR(imageDataUrl);
        console.log('✅ Claude認識結果:', result);
        
        // 採点
        const correctPattern = questions[currentQuestionIndex].correctPatterns[0];
        const isCorrect = result.includes(correctPattern.replace(',', '')) || 
                         result.replace(/\s/g, '') === correctPattern.replace(/,/g, '');
        
        // 結果表示
        showResult(result, correctPattern, isCorrect);
        
    } catch (error) {
        console.error('❌ Claude API エラー:', error);
        alert('認識に失敗しました: ' + error.message);
    }
}

// ========== Claude API ==========

async function claudeOCR(imageDataUrl) {
    console.log('🔍 Claude API 開始...');
    
    const base64Image = imageDataUrl.split(',')[1];
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '画像の手書き数字を読み取って、カンマ区切りで返してください。例: 4.9,9.8'
                    },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/png',
                            data: base64Image
                        }
                    }
                ]
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Claude API エラー: ${response.status}`);
    }
    
    const result = await response.json();
    return result.content[0].text.trim();
}

// ========== 結果表示 ==========

function showResult(recognized, correct, isCorrect) {
    showScreen('result');
    
    document.getElementById('correctCount').textContent = isCorrect ? '1' : '0';
    document.getElementById('totalCount').textContent = '1';
    
    document.getElementById('resultDetails').innerHTML = `
        <div class="result-item">
            <h3>問題 1</h3>
            <div class="result-status ${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '正解' : '不正解'}
            </div>
            <div>認識された文字: ${recognized}</div>
            <div>正解パターン: ${correct}</div>
            <div>※ Claude API（最高精度）で読み取り</div>
        </div>
    `;
} 
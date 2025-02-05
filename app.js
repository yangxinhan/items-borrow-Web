// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyBU4XZ7nqnvkP3F31S9X4Ip2Gd9JrXjf6c",
    authDomain: "items-49542.firebaseapp.com",
    databaseURL: "https://items-49542-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "items-49542",
    storageBucket: "items-49542.appspot.com",
    messagingSenderId: "547160536391",
    appId: "1:547160536391:web:e919ce9507c250d8434862",
    measurementId: "G-4MMDL3BGB6"
};

// 初始化 Firebase - 添加錯誤處理
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase 初始化成功');
} catch (error) {
    console.error('Firebase 初始化失敗:', error);
}

// 確保 firebase.database() 和 firebase.auth() 在 Firebase 初始化後調用
const database = firebase.database();
const auth = firebase.auth();

// 設定 Google 登入提供者
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
    prompt: 'select_account'
});

// 認證相關狀態變數
let currentUser = null;
let authInitialized = false;
let loginInProgress = false;  // 添加登入狀態追蹤變數

// 其他狀態變數
const privilegedUsers = ['teacher', 'yang', 'test']; //管理員
let scannerMode = false;
let currentDeviceId = null;
let returnScannerMode = false;

// 新增分類常數
const CATEGORIES = {
    PHONE: { id: 'phone', name: '手機設備', pattern: /^SAM\d{3}$/ },
    CAMERA: { id: 'camera', name: '攝影設備', pattern: /^(SONY|JVC|INSTA|OBSBOT)\d{3}$/ },
    AUDIO: { id: 'audio', name: '音響設備', pattern: /^(SHURE|RODE|BOYA|SARAMONIC|ALCTRON)\d{3}$/ },
    DRONE: { id: 'drone', name: '空拍設備', pattern: /^TELLO\d{3}$/ },
    MISC: { id: 'misc', name: '其他設備', pattern: /^(MISC|ULANZI|ANKER|GIN|CABLE|PEN|NITECORE|AKG|BELL|AVER)\d{3}$/ }
};

let currentCategory = 'all';

// 將所有 DOM 相關的初始化移到 DOMContentLoaded 事件中
document.addEventListener('DOMContentLoaded', function() {
    // 事件監聽器設置
    document.getElementById('scanButton').addEventListener('click', toggleScanner);
    document.getElementById('barcodeInput').addEventListener('keypress', handleBarcodeScan);
    document.getElementById('returnBarcodeInput').addEventListener('keypress', handleReturnBarcodeScan);
    
    // 分類按鈕監聽器
    document.querySelectorAll('.category-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentCategory = button.dataset.category;
            updateDevices();
        });
    });

    // 登入相關按鈕
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // 關閉按鈕和點擊外部關閉功能
    document.querySelector('.close-button').addEventListener('click', () => {
        document.getElementById('itemDetailModal').style.display = 'none';
    });

    // 模態框外部點擊關閉
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('itemDetailModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 初始化夜間模式
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
    darkModeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
        darkModeToggle.style.transform = 'scale(1.1)';
        setTimeout(() => {
            darkModeToggle.style.transform = 'scale(1)';
        }, 200);
    });

    // 初始顯示主頁面
    showApp();
});

// 替換原有的夜間模式初始化代碼
const darkModeToggle = document.getElementById('darkModeToggle');
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// 初始化夜間模式狀態
if (isDarkMode) {
    document.body.classList.add('dark-mode');
}

// 切換夜間模式
darkModeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    // 可選：添加動畫效果
    darkModeToggle.style.transform = 'scale(1.1)';
    setTimeout(() => {
        darkModeToggle.style.transform = 'scale(1)';
    }, 200);
});

function toggleScanner() {
    scannerMode = !scannerMode;
    document.getElementById('scannerSection').style.display = scannerMode ? 'block' : 'none';
    document.getElementById('returnScannerSection').style.display = 'none'; // 確保歸還區域關閉
    document.getElementById('scanButton').textContent = scannerMode ? '關閉掃描' : '掃描借用';
    if (scannerMode) {
        resetScannerState();
    }
}

function resetScannerState() {
    currentDeviceId = null;
    document.getElementById('deviceScanStep').style.display = 'block';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('barcodeInput').focus();
}

function handleBarcodeScan(event) {
    if (event.key === 'Enter') {
        const barcode = event.target.value;
        if (!currentDeviceId) {
            processDeviceBarcode(barcode);
        }
        event.target.value = '';
    }
}

function processDeviceBarcode(barcode) {
    // 確認用戶已登入
    if (!currentUser) {
        alert('請先登入');
        return;
    }

    const deviceRef = database.ref('devices');
    deviceRef.orderByChild('borrowId').equalTo(barcode).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const deviceId = Object.keys(snapshot.val())[0];
            const device = snapshot.val()[deviceId];
            
            if (device.borrowed) {
                returnDevice(deviceId);
                resetScannerState();
                closeScanners();
            } else {
                // 直接使用 Google 帳號資訊進行借用
                borrowDevice(deviceId, currentUser.email);
                resetScannerState();
                closeScanners();
                updateDevices();
            }
        } else {
            alert('找不到此條碼對應的設備');
            resetScannerState();
        }
    });
}

// 移除 processStudentId 函數，因為不再需要

function showApp() {
    document.getElementById('appSection').style.display = 'block';
    document.getElementById('historySection').style.display = 'none';
    updateDevices();
}

function borrowDevice(deviceId, borrower) {
    const now = new Date();
    const borrowTime = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    updateDevice(deviceId, {
        borrowed: true,
        borrowClass: borrower,
        borrowTime: borrowTime
    });
    addBorrowRecord(deviceId, borrower, borrowTime);
}

function logout() {
    currentUser = null;
    showLogin();
    updateCurrentUserDisplay(); // 更新當前用戶顯示
}

function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display = 'none';
}

function showHistory() {
    document.getElementById('appSection').style.display = 'none';
    document.getElementById('historySection').style.display = 'block';
    setupLiveHistoryUpdates();
}

function setupLiveHistoryUpdates() {
    const historyTable = document.getElementById('historyTable');
    const recordsRef = database.ref('borrowRecords');
    
    recordsRef.orderByChild('borrowTime').on('value', (snapshot) => {
        while (historyTable.rows.length > 1) {
            historyTable.deleteRow(1);
        }

        const records = [];
        snapshot.forEach((childSnapshot) => {
            records.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        records.reverse();

        const devicePromises = records.map(record => 
            database.ref(`devices/${record.deviceId}`).once('value')
        );

        Promise.all(devicePromises).then(deviceSnapshots => {
            const deviceCache = {};
            deviceSnapshots.forEach((snapshot, index) => {
                const device = snapshot.val();
                if (device) {
                    deviceCache[records[index].deviceId] = `${device.borrowId} - ${device.name}`;
                }
            });

            records.forEach(record => {
                const row = historyTable.insertRow();
                const deviceName = deviceCache[record.deviceId] || record.deviceId;
                row.insertCell(0).textContent = deviceName;
                row.insertCell(1).textContent = record.borrower;
                
                // 直接使用 Firebase 中的時間
                row.insertCell(2).textContent = record.borrowTime;
                
                const returnTimeCell = row.insertCell(3);
                if (record.returnTime) {
                    returnTimeCell.textContent = record.returnTime;
                } else {
                    returnTimeCell.textContent = '尚未歸還';
                    returnTimeCell.className = 'status-borrowed';
                }
            });
        });
    });
}

// 更新當前用戶顯示的函數
function updateCurrentUserDisplay() {
    const userDisplayElement = document.getElementById('currentUserDisplay');
    if (currentUser) {
        userDisplayElement.textContent = `使用者: ${currentUser}`;
    } else {
        userDisplayElement.textContent = '';
    }
}

// 初始顯示主頁面
showApp();

// 修改 updateDevices 函數以支援分類
function updateDevices() {
    const devicesRef = database.ref('devices');
    devicesRef.once('value', (snapshot) => {
        const devices = snapshot.val();
        const table = document.getElementById('deviceTable');
        
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
        
        const sortedDevices = Object.entries(devices)
            .map(([id, device]) => ({id, ...device}))
            .filter(device => {
                if (currentCategory === 'all') return true;
                return getCategoryById(device.borrowId) === currentCategory;
            })
            .sort((a, b) => a.borrowId.localeCompare(b.borrowId));

        sortedDevices.forEach(device => {
            const row = table.insertRow();
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => showItemDetails(device.id));
            row.insertCell(0).textContent = `${device.borrowId} - ${device.name}`;
            
            const statusCell = row.insertCell(1);
            statusCell.textContent = device.borrowed ? '已借出' : '可借用';
            statusCell.className = device.borrowed ? 'status-borrowed' : 'status-available';
            
            row.insertCell(2).textContent = device.borrowClass || '';
            row.insertCell(3).textContent = device.borrowTime || '';
            row.insertCell(4).textContent = device.note || '';
        });
    });
}

// 根據借閱ID判斷分類
function getCategoryById(borrowId) {
    for (const category of Object.values(CATEGORIES)) {
        if (category.pattern.test(borrowId)) {
            return category.id;
        }
    }
    return 'misc';
}

function returnDevice(deviceId) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.once('value').then((snapshot) => {
        const device = snapshot.val();
        const returnTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        
        Promise.all([
            updateDevice(deviceId, {
                borrowed: false, 
                borrowClass: '',
                borrowTime: ''
            }),
            updateBorrowRecord(deviceId, device.borrowClass, device.borrowTime, returnTime)
        ]).then(() => {
            alert('設備歸還成功！');
            // 立即更新所有相關畫面
            updateDevices();
            if (document.getElementById('historySection').style.display !== 'none') {
                setupLiveHistoryUpdates();
            }
        });
    });
}

function updateDevice(deviceId, data) {
    return new Promise((resolve, reject) => {
        const deviceRef = database.ref(`devices/${deviceId}`);
        deviceRef.update(data)
            .then(resolve)
            .catch(reject);
    });
}

function addNote(deviceId) {
    const note = prompt("請輸入備註：");
    if (note !== null) {
        updateDevice(deviceId, { note: note });
    }
}

// 添加新的借閱記錄
function addBorrowRecord(deviceId, borrower, borrowTime) {
    const recordRef = database.ref('borrowRecords').push();
    recordRef.set({
        deviceId: deviceId,
        borrower: borrower,
        borrowTime: borrowTime,
        returnTime: ''
    });
}

// 更新借閱記錄的歸還時間
function updateBorrowRecord(deviceId, borrower, borrowTime, returnTime) {
    return new Promise((resolve, reject) => {
        const recordsRef = database.ref('borrowRecords');
        recordsRef.orderByChild('deviceId').equalTo(deviceId).once('value', (snapshot) => {
            const updates = {};
            snapshot.forEach((childSnapshot) => {
                const record = childSnapshot.val();
                if (record.borrower === borrower && record.borrowTime === borrowTime && record.returnTime === '') {
                    updates[`${childSnapshot.key}/returnTime`] = returnTime;
                }
            });
            if (Object.keys(updates).length > 0) {
                recordsRef.update(updates)
                    .then(resolve)
                    .catch(reject);
            } else {
                resolve();
            }
        });
    });
}

function toggleReturnScanner() {
    returnScannerMode = !returnScannerMode;
    const scannerSection = document.getElementById('returnScannerSection');
    scannerSection.style.display = returnScannerMode ? 'block' : 'none';
    document.getElementById('scannerSection').style.display = 'none'; // 確保借用區域關閉
    if (returnScannerMode) {
        document.getElementById('returnBarcodeInput').value = '';
        document.getElementById('returnBarcodeInput').focus();
    }
}

function handleReturnBarcodeScan(event) {
    if (event.key === 'Enter') {
        const barcode = event.target.value;
        processDeviceBarcode(barcode); // 使用相同的處理函數
        event.target.value = '';
    }
}

function closeScanners() {
    // 關閉所有掃描區域
    document.getElementById('scannerSection').style.display = 'none';
    document.getElementById('returnScannerSection').style.display = 'none';
    document.getElementById('scanButton').textContent = '掃描借用';
    scannerMode = false;
    returnScannerMode = false;
}

// 新增顯示物品詳情的相關函數
function showItemDetails(deviceId) {
    const modal = document.getElementById('itemDetailModal');
    const deviceRef = database.ref(`devices/${deviceId}`);
    
    // 移除之前的 "無圖片" 提示
    const existingPlaceholder = document.querySelector('.no-image-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }
    
    deviceRef.once('value', (snapshot) => {
        const device = snapshot.val();
        if (device) {
            // 更新基本資訊
            document.getElementById('modalItemName').textContent = `${device.name}`;
            document.getElementById('modalItemId').textContent = device.borrowId;
            document.getElementById('modalItemSpecs').textContent = device.specs || '暫無規格說明';
            document.getElementById('modalItemInstructions').textContent = device.instructions || '暫無使用說明';
            document.getElementById('modalItemStatus').textContent = device.borrowed ? '已借出' : '可借用';
            document.getElementById('modalItemStatus').className = device.borrowed ? 'status-borrowed' : 'status-available';
            
            // 處理圖片顯示
            const imageElement = document.getElementById('modalItemImage');
            const imageParent = imageElement.parentElement;
            
            // 清除舊的錯誤提示
            const existingNoImage = imageParent.querySelector('.no-image-placeholder');
            if (existingNoImage) {
                existingNoImage.remove();
            }

            // 解析設備ID來獲取類型和編號
            const match = device.borrowId.match(/([A-Za-z]+)(\d+)/);
            if (match) {
                const [, deviceType, deviceNumber] = match;
                const type = deviceType.toLowerCase();
                const paddedNumber = deviceNumber.padStart(3, '0');
                
                // 嘗試不同的圖片路徑
                const paths = [
                    `./images/${type}/${paddedNumber}.jpg`,
                    `./images/${type}/${paddedNumber}.png`,
                    `./images/${type}/${type}${paddedNumber}.jpg`,
                    `./images/${type}/${type}${paddedNumber}.png`,
                    `./images/${type}/default.jpg`,
                    `./images/${type}/default.png`
                ];

                // 遞迴嘗試載入圖片
                function tryLoadImage(index) {
                    if (index >= paths.length) {
                        // 所有路徑都嘗試過了，顯示無圖片提示
                        console.log('找不到圖片：', device.borrowId);
                        imageElement.style.display = 'none';
                        addNoImagePlaceholder(imageParent);
                        return;
                    }

                    imageElement.src = paths[index];
                    imageElement.style.display = 'block';
                    
                    imageElement.onerror = () => {
                        // 當前路徑失敗，嘗試下一個
                        tryLoadImage(index + 1);
                    };
                }

                // 開始嘗試第一個路徑
                tryLoadImage(0);
            } else {
                // 如果設備ID格式不符合預期
                console.log('無效的設備ID格式：', device.borrowId);
                imageElement.style.display = 'none';
                addNoImagePlaceholder(imageParent);
            }
            
            modal.style.display = 'block';
        }
    });
}

// 新增一個輔助函數來處理無圖片的情況
function addNoImagePlaceholder(container) {
    const noImageDiv = document.createElement('div');
    noImageDiv.className = 'no-image-placeholder';
    noImageDiv.textContent = '暫無圖片';
    container.appendChild(noImageDiv);
}

// 修改 updateDevices 函數中的表格生成部分
function updateDevices() {
    const devicesRef = database.ref('devices');
    devicesRef.once('value', (snapshot) => {
        const devices = snapshot.val();
        const table = document.getElementById('deviceTable');
        
        while (table.rows.length > 1) {
            table.deleteRow(1);
        }
        
        const sortedDevices = Object.entries(devices)
            .map(([id, device]) => ({id, ...device}))
            .filter(device => {
                if (currentCategory === 'all') return true;
                return getCategoryById(device.borrowId) === currentCategory;
            })
            .sort((a, b) => a.borrowId.localeCompare(b.borrowId));

        sortedDevices.forEach(device => {
            const row = table.insertRow();
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => showItemDetails(device.id));
            row.insertCell(0).textContent = `${device.borrowId} - ${device.name}`;
            
            const statusCell = row.insertCell(1);
            statusCell.textContent = device.borrowed ? '已借出' : '可借用';
            statusCell.className = device.borrowed ? 'status-borrowed' : 'status-available';
            
            row.insertCell(2).textContent = device.borrowClass || '';
            row.insertCell(3).textContent = device.borrowTime || '';
            row.insertCell(4).textContent = device.note || '';
        });
    });
}

// 登入相關函數
async function handleLogin() {
    if (loginInProgress) {
        console.log('登入程序進行中，請稍候...');
        return;
    }

    try {
        loginInProgress = true;
        console.log('開始登入流程');
        const result = await auth.signInWithPopup(provider);
        console.log('Google 登入成功', result.user.email);
        currentUser = result.user;
        hideLoginButton();
        showLoggedInButtons();
        updateCurrentUserDisplay();
    } catch (error) {
        console.error('登入過程發生錯誤:', error);
        // 只有在真正登入失敗時才顯示錯誤
        if (!currentUser) {
            alert('登入失敗：' + error.message);
        }
    } finally {
        loginInProgress = false;
    }
}

// 修改登出函數
async function handleLogout() {
    try {
        console.log('開始登出流程');
        await auth.signOut();
        console.log('登出成功');
        currentUser = null;
        showLoginButton();
        hideLoggedInButtons();
        updateCurrentUserDisplay();
        // 可選：重新載入頁面
        // window.location.reload();
    } catch (error) {
        console.error('登出失敗:', error);
        alert('登出失敗：' + error.message);
    }
}

// 修改授權狀態監聽器
auth.onAuthStateChanged(user => {
    if (!authInitialized) {
        authInitialized = true;
        console.log('首次初始化 Auth 狀態');
    }

    console.log('Auth 狀態變更:', user?.email || '未登入');
    
    if (user) {
        currentUser = user;
        hideLoginButton();
        showLoggedInButtons();
        updateCurrentUserDisplay();
    } else {
        currentUser = null;
        showLoginButton();
        hideLoggedInButtons();
        updateCurrentUserDisplay();
    }
});

// 移除重複的事件監聽器註冊
document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    /* ...其他 DOMContentLoaded 的初始化代碼... */
});

// 更新使用者顯示函數
function updateCurrentUserDisplay() {
    const userDisplayElement = document.getElementById('currentUserDisplay');
    if (!userDisplayElement) return;
    
    if (currentUser) {
        userDisplayElement.textContent = `使用者: ${currentUser.email}`;
    } else {
        userDisplayElement.textContent = '';
    }
}


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

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;
const privilegedUsers = ['teacher', 'yang', 'test']; //管理員

let scannerMode = false;
let currentDeviceId = null;

let returnScannerMode = false;

document.getElementById('scanButton').addEventListener('click', toggleScanner);
document.getElementById('barcodeInput').addEventListener('keypress', handleBarcodeScan);
document.getElementById('studentInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        const studentId = event.target.value;
        processStudentId(studentId);
        event.target.value = '';
    }
});
// 移除手動輸入按鈕的監聽器
// document.getElementById('manualInputBtn').addEventListener('click', function() {...});

// 新增歸還掃描器相關事件監聽
document.getElementById('returnBarcodeInput').addEventListener('keypress', handleReturnBarcodeScan);

// 新增分類常數
const CATEGORIES = {
    PHONE: { id: 'phone', name: '手機設備', pattern: /^SAM\d{3}$/ },
    CAMERA: { id: 'camera', name: '攝影設備', pattern: /^(SONY|JVC|INSTA|OBSBOT)\d{3}$/ },
    AUDIO: { id: 'audio', name: '音響設備', pattern: /^(SHURE|RODE|BOYA|SARAMONIC|ALCTRON)\d{3}$/ },
    DRONE: { id: 'drone', name: '空拍設備', pattern: /^TELLO\d{3}$/ },
    MISC: { id: 'misc', name: '其他設備', pattern: /^(MISC|ULANZI|ANKER|GIN|CABLE|PEN|NITECORE|AKG|BELL|AVER)\d{3}$/ }
};

let currentCategory = 'all';

// 添加分類按鈕事件監聽
document.querySelectorAll('.category-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentCategory = button.dataset.category;
        updateDevices();
    });
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
    document.getElementById('studentScanStep').style.display = 'none';
    document.getElementById('barcodeInput').value = '';
    document.getElementById('studentInput').value = '';
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
    const deviceRef = database.ref('devices');
    deviceRef.orderByChild('borrowId').equalTo(barcode).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const deviceId = Object.keys(snapshot.val())[0];
            const device = snapshot.val()[deviceId];
            
            if (device.borrowed) {
                returnDevice(deviceId);
                resetScannerState();
                closeScanners(); // 使用新函數關閉所有掃描區域
            } else {
                currentDeviceId = deviceId;
                document.getElementById('deviceScanStep').style.display = 'none';
                document.getElementById('studentScanStep').style.display = 'block';
                document.getElementById('studentInput').focus();
            }
        } else {
            alert('找不到此條碼對應的設備');
            resetScannerState();
        }
    });
}

function processStudentId(studentId) {
    if (!currentDeviceId) {
        alert('請先掃描裝置條碼');
        return;
    }

    // 驗證學號格式
    if (studentId.length < 5) {
        alert('請輸入有效的學號');
        return;
    }

    // 直接使用學號作為借用者資訊
    borrowDevice(currentDeviceId, studentId);
    resetScannerState();
    closeScanners(); // 使用新函數關閉所有掃描區域
    setTimeout(() => {
        location.reload(); // 借用成功後重整頁面
    }, 1000);
}

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
        updateDevice(deviceId, {
            borrowed: false, 
            borrowClass: '',
            borrowTime: ''
        });
        // 更新借閱記錄的歸還時間
        updateBorrowRecord(deviceId, device.borrowClass, device.borrowTime, returnTime);
        alert('設備歸還成功！');
        setTimeout(() => {
            location.reload(); // 歸還成功後重整頁面
        }, 1000);
    });
}

function updateDevice(deviceId, data) {
    const deviceRef = database.ref(`devices/${deviceId}`);
    deviceRef.update(data);
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
    const recordsRef = database.ref('borrowRecords');
    recordsRef.orderByChild('deviceId').equalTo(deviceId).once('value', (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const record = childSnapshot.val();
            if (record.borrower === borrower && record.borrowTime === borrowTime && record.returnTime === '') {
                childSnapshot.ref.update({ returnTime: returnTime });
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

// 添加分類按鈕事件監聽
document.querySelectorAll('.category-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentCategory = button.dataset.category;
        updateDevices();
    });
});


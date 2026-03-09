function doGet() {
    return ContentService.createTextOutput(getDataFromSheet())
        .setMimeType(ContentService.MimeType.JSON);
}

// 開課學校對應表 (課程名稱 → 主辦學校名稱)
var HOST_SCHOOL_MAP = {
    '智慧製造執行系統': '國立成功大學',
    '大型語言模型與資訊安全系統': '國立臺灣科技大學',
    '生成式AI應用系統與工程': '國立成功大學',
    '機率與統計': '國立臺灣大學',
    '深度學習': '國立陽明交通大學',
    '人工智慧倫理': '東海大學',
    '機器導航與探索': '國立清華大學',
    '生成式AI的人文導論': '國立臺灣大學'
};

// 允許的 URL 域名白名單
var ALLOWED_DOMAINS = [
    'docs.google.com',
    'drive.google.com',
    'cool.ntu.edu.tw',
    'sheets.google.com'
];

// 去除不可見字元、做 NFKC 正規化（處理 CJK 相容表意字元如 U+F96A），再 trim
function normalizeText(str) {
    if (!str) return '';
    var s = str.toString().replace(/[\u200B\uFEFF\u3000\u00A0\u200C\u200D]/g, '').trim();
    if (s.normalize) s = s.normalize('NFKC'); // 將相容字元統一成標準 Unicode
    return s;
}

function isValidUrl(url) {
    if (!url) return false;
    const urlStr = url.toString().trim();
    if (!urlStr.startsWith('http')) return false;
    return ALLOWED_DOMAINS.some(function(domain) { return urlStr.includes(domain); });
}

function getDataFromSheet() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('courseData');
    if (cached) return cached;

    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheets = ss.getSheets();
        var courses = [];
        var generalLinks = [];

        sheets.forEach(function(sheet) {
            var sheetName = sheet.getName();

            // 讀取常用資源工作表
            if (sheetName === '常用資源') {
                try {
                    var lastRow = sheet.getLastRow();
                    if (lastRow >= 2) {
                        var data = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
                        data.forEach(function(row) {
                            var name = normalizeText(row[0]);
                            var url = normalizeText(row[1]);
                            if (name && url) {
                                generalLinks.push({
                                    name: name,
                                    url: url,
                                    icon: row[2] ? row[2].trim() : 'fa-solid fa-link',
                                    color: row[3] ? row[3].trim() : 'text-gray-500'
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.error('讀取常用資源工作表失敗: ' + e.message);
                }
                return;
            }

            // 忽略不符合命名規則的工作表
            if (sheetName === '工作表9' || !sheetName.includes('_')) return;

            try {
                var parts = sheetName.split('_');
                var typeCode = normalizeText(parts[0]); // 鏡, 衛, 混
                var courseName = normalizeText(parts.slice(1).join('_')); // 去除工作表名稱多餘空白

                var typeLabel = '其他';
                if (typeCode === '鏡') typeLabel = '鏡像課程';
                if (typeCode === '衛') typeLabel = '衛星課程';
                if (typeCode === '混') typeLabel = '混合課程';

                var hostSchoolName = HOST_SCHOOL_MAP[courseName] || '';

                // 讀取全域連結 (Row 1 & 2)
                var topData = sheet.getRange(1, 1, 2, 2).getValues();
                var globalLinks = [
                    { name: topData[0][0] || '名單總表', url: topData[0][1] },
                    { name: topData[1][0] || 'COOL 主導課程', url: topData[1][1] }
                ].filter(function(link) { return isValidUrl(link.url); });

                // 讀取學校資料 (從第 5 列開始)
                var lastRow = sheet.getLastRow();
                if (lastRow < 5) return;

                var dataRange = sheet.getRange(5, 1, lastRow - 4, sheet.getLastColumn());
                var values = dataRange.getDisplayValues();
                var schoolData = [];

                // ── 人工智慧倫理：雙階段加課特殊處理 ──
                if (courseName === '人工智慧倫理') {
                    if (lastRow < 6) return;
                    var aiRange = sheet.getRange(6, 1, lastRow - 5, sheet.getLastColumn());
                    var aiValues = aiRange.getDisplayValues();
                    var leftGroupRaw = [], rightGroupRaw = [];
                    var tsingHuaCool = '';
                    var mainCoolUrl = '';
                    globalLinks.forEach(function(gl) {
                        if (!mainCoolUrl && isValidUrl(gl.url)) mainCoolUrl = gl.url;
                        if (gl.name && gl.name.includes('主導') && isValidUrl(gl.url)) mainCoolUrl = gl.url;
                    });

                    aiValues.forEach(function(row) {
                        var leftSchool = normalizeText(row[0]);
                        if (leftSchool) {
                            leftGroupRaw.push({ school: leftSchool, folder: normalizeText(row[1]), sheet: normalizeText(row[2]) });
                        }
                        var col3 = normalizeText(row[3]);
                        var rightSchool, rightCool, rightFolder, rightSheet;
                        if (col3 && !col3.startsWith('http')) {
                            rightSchool = col3; rightCool = normalizeText(row[4]);
                            rightFolder = normalizeText(row[5]); rightSheet = normalizeText(row[6]);
                        } else {
                            rightSchool = normalizeText(row[4]); rightCool = normalizeText(row[5]);
                            rightFolder = normalizeText(row[6]); rightSheet = normalizeText(row[7]);
                        }
                        if (rightSchool && !rightSchool.startsWith('http')) {
                            if ((rightSchool.includes('清華') || rightSchool.includes('清大')) && isValidUrl(rightCool)) {
                                tsingHuaCool = rightCool;
                            }
                            rightGroupRaw.push({ school: rightSchool, coolUrl: rightCool, folder: rightFolder, sheet: rightSheet });
                        }
                    });

                    leftGroupRaw.forEach(function(r) {
                        schoolData.push({
                            school: r.school, role: '清大組', isHost: false,
                            links: [
                                { type: 'cool_main', label: '主導課程（旁聽生）', disabled: !isValidUrl(mainCoolUrl), url: mainCoolUrl || '' },
                                { type: 'cool_student', label: '清大課程頁面（學生）', disabled: !isValidUrl(tsingHuaCool), url: tsingHuaCool || '' },
                                { type: 'folder', label: '名單資料夾', disabled: !isValidUrl(r.folder), url: r.folder || '' },
                                { type: 'sheet', label: '分頁連結', disabled: !isValidUrl(r.sheet), url: r.sheet || '' }
                            ]
                        });
                    });
                    rightGroupRaw.forEach(function(r) {
                        var isHostR = r.school === hostSchoolName;
                        var coolDisabled = isHostR || !isValidUrl(r.coolUrl);
                        schoolData.push({
                            school: r.school, role: '各校組', isHost: isHostR,
                            links: [
                                { type: 'cool_main', label: '主導課程（旁聽生）', disabled: !isValidUrl(mainCoolUrl), url: mainCoolUrl || '' },
                                { type: 'cool_student', label: '本校課程頁面（學生）', disabled: coolDisabled, url: coolDisabled ? '' : r.coolUrl },
                                { type: 'folder', label: '名單資料夾', disabled: !isValidUrl(r.folder), url: r.folder || '' },
                                { type: 'sheet', label: '分頁連結', disabled: !isValidUrl(r.sheet), url: r.sheet || '' }
                            ]
                        });
                    });

                    courses.push({ id: sheetName, type: typeLabel, name: courseName, twoStep: true, globalLinks: globalLinks, schools: schoolData });
                    return;
                }

                values.forEach(function(row) {
                    if (typeCode === '鏡') {
                        var schoolName = normalizeText(row[0]);
                        if (schoolName) {
                            schoolData.push({
                                school: schoolName,
                                role: '鏡像',
                                isHost: schoolName === hostSchoolName,
                                links: [
                                    { type: 'folder', url: row[1], label: '名單資料夾' },
                                    { type: 'sheet', url: row[2], label: '分頁連結' }
                                ]
                            });
                        }
                    } else if (typeCode === '衛') {
                        var schoolName = normalizeText(row[0]);
                        if (schoolName) {
                            var isHost = schoolName === hostSchoolName;
                            var isNTU = schoolName === '國立臺灣大學';
                            schoolData.push({
                                school: schoolName,
                                role: '衛星',
                                isHost: isHost,
                                links: [
                                    { type: 'cool', url: row[1], label: 'COOL 衛星課程', disabled: isHost || isNTU },
                                    { type: 'folder', url: row[2], label: '名單資料夾' },
                                    { type: 'sheet', url: row[3], label: '分頁連結' }
                                ]
                            });
                        }
                    } else if (typeCode === '混') {
                        var mirrorSchool = normalizeText(row[0]);
                        if (mirrorSchool) {
                            schoolData.push({
                                school: mirrorSchool,
                                role: '鏡像',
                                isHost: mirrorSchool === hostSchoolName,
                                links: [
                                    { type: 'folder', url: row[1], label: '名單資料夾' },
                                    { type: 'sheet', url: row[2], label: '分頁連結' }
                                ]
                            });
                        }
                        var satSchool = normalizeText(row[4]);
                        if (satSchool) {
                            var isHost = satSchool === hostSchoolName;
                            var isNTU = satSchool === '國立臺灣大學';
                            schoolData.push({
                                school: satSchool,
                                role: '衛星',
                                isHost: isHost,
                                links: [
                                    { type: 'cool', url: row[5], label: 'COOL 衛星課程', disabled: isHost || isNTU },
                                    { type: 'folder', url: row[6], label: '名單資料夾' },
                                    { type: 'sheet', url: row[7], label: '分頁連結' }
                                ]
                            });
                        }
                    }
                });

                courses.push({
                    id: sheetName,
                    type: typeLabel,
                    name: courseName,
                    globalLinks: globalLinks,
                    schools: schoolData
                });

            } catch (e) {
                console.error('處理工作表「' + sheetName + '」時發生錯誤: ' + e.message);
            }
        });

        var output = JSON.stringify({ courses: courses, generalLinks: generalLinks });
        try {
            cache.put('courseData', output, 1800); // 快取 30 分鐘 (上限 100 KB)
        } catch (e) {
            console.error('快取儲存失敗（資料超過 100 KB 上限），略過快取: ' + e.message);
        }
        return output;

    } catch (e) {
        console.error('getDataFromSheet 發生嚴重錯誤: ' + e.message);
        throw e;
    }
}

// ── 診斷函式：在 GAS 編輯器直接執行，然後查看「執行記錄」 ──
function diagnoseHostSchool() {
    var sheetName = '衛_機器導航與探索';
    var expectedHost = HOST_SCHOOL_MAP['機器導航與探索'];
    Logger.log('=== 開課學校診斷 ===');
    Logger.log('Map 查詢結果 (HOST_SCHOOL_MAP["機器導航與探索"]): [' + expectedHost + ']');
    Logger.log('Map 字元碼: ' + charCodes(expectedHost));

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        Logger.log('❌ 找不到工作表: ' + sheetName);
        Logger.log('現有工作表: ' + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
        return;
    }
    Logger.log('✅ 找到工作表: ' + sheetName);

    var lastRow = sheet.getLastRow();
    if (lastRow < 5) { Logger.log('❌ 資料列數不足（lastRow=' + lastRow + '）'); return; }

    var values = sheet.getRange(5, 1, lastRow - 4, 1).getDisplayValues();
    Logger.log('--- 每列 A 欄比對 ---');
    values.forEach(function(row, i) {
        var raw = row[0];
        var normalized = normalizeText(raw);
        var match = normalized === expectedHost;
        Logger.log('Row ' + (5 + i) + ': raw=[' + raw + '] chars=' + charCodes(raw) + ' normalized=[' + normalized + '] isHost=' + match);
    });
}

function charCodes(str) {
    if (!str) return '(empty)';
    var codes = [];
    for (var i = 0; i < str.length; i++) codes.push(str.charCodeAt(i));
    return codes.join(',');
}

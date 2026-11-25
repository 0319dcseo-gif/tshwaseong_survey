/**
 * 화성교통안전체험교육센터 고객만족도 조사 - Google Apps Script
 *
 * [핵심 기능]
 * 1. 연도별·교육과정별 자동 시트 누적 (하나의 스프레드시트 안에서 탭으로 깔끔하게 분리)
 *    예) `26년 개인택시양수`, `26년 버스양성과정`, `26년 일반기본교육(전기차)`, `26년 법정교육(버스)` ...
 *    ※ 2027년이 되면 입교일자 기준으로 `27년 ...` 시트가 자동 생성되어 누적됩니다.
 * 2. 높은 가독성의 리포트형 시트 서식
 *    - 1행: 시트 제목 배너
 *    - 2행: 총 응답 인원 · 전체 평균 · 문항별 실시간 평균 요약 바 (상단 3행 고정)
 *    - 3행: 영역별 색상 구분 헤더 (기본정보 / 만족도점수 / 의견·개선사항) + 자동 필터
 *    - 4행~: 줄무늬 배경, 경력 "N년 M개월" 표기, 저점수(5점 이하/평균 7점 미만) 연빨강 강조,
 *           개선의견 작성 셀 연주황 강조 + 자동 줄바꿈
 * 3. `요약대시보드` 시트 자동 집계 (모든 연도·과정 시트를 한눈에 비교)
 * 4. 동시 제출 충돌 방지(LockService) + 중복 저장 방지(submissionId)
 */

var SHEET_DASHBOARD = '요약대시보드';

var GENDER_MAP = { '1': '남자', '2': '여자' };

var BIZ_EXP_MAP = {
  '1': '택시',
  '2': '버스',
  '3': '화물',
  '4': '건설기계',
  '5': '타인고용 운전',
  '6': '해당없음'
};

var TRANSFER_MAP = {
  '1': '사전계약 체결',
  '2': '즉시~1개월 이내',
  '3': '3개월 이내',
  '4': '6개월 이내',
  '5': '1년 이내',
  '6': '양수시점 미정'
};

var SHORT_Q_HEADERS = [
  '①목적\n부합',
  '②미래\n가치',
  '③타기관\n대비',
  '④이용\n편의',
  '⑤직원\n친절',
  '⑥정보\n안내',
  '⑦시설\n쾌적',
  '⑧긍정\n인식',
  '⑨최선\n서비스',
  '⑩전반\n만족'
];

// 개인택시양수 시트 (24열: A~X)
var TAXI_HEADERS = [
  '순번', '제출일시', '입교일자', '연령', '성별',
  '사업용경험', '사업용경력', '자가용경력', '양수계획',
  '개인평균'
].concat(SHORT_Q_HEADERS).concat([
  '가장만족항목', '교육 개선의견', '시설 개선의견', '기타 의견'
]);

// 버스양성과정 / 일반과정 시트 (23열: A~W)
var STANDARD_HEADERS = [
  '순번', '제출일시', '입교일자', '연령', '성별',
  '사업용경험', '사업용경력', '자가용경력',
  '개인평균'
].concat(SHORT_Q_HEADERS).concat([
  '가장만족항목', '교육 개선의견', '시설 개선의견', '기타 의견'
]);

/**
 * 스프레드시트를 열 때 상단에 전용 관리 메뉴 추가
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 화성센터 설문 관리')
    .addItem('요약대시보드 새로고침', 'refreshDashboard')
    .addItem('올해 주요 과정 시트 미리 생성', 'setupSheets')
    .addToUi();
}

/**
 * 최초 1회 실행: 올해 주요 시트(개인택시양수, 버스양성과정)와 요약대시보드를 생성합니다.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var yy = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yy');
  ensureCourseSheet_(ss, yy + '년 개인택시양수', true);
  ensureCourseSheet_(ss, yy + '년 버스양성과정', false);
  refreshDashboard();

  // 기본 빈 '시트1' / 'Sheet1'이 비어 있으면 자동 정리
  ['시트1', 'Sheet1'].forEach(function (defName) {
    var defSheet = ss.getSheetByName(defName);
    if (defSheet && defSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(defSheet);
    }
  });
}

/**
 * (선택) Apps Script 편집기에서 직접 시트 저장 및 서식을 테스트할 때 실행하는 함수
 */
function testWriteSample() {
  setupSheets();
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  saveSurveyResponse_({
    submissionId: 'TEST-TAXI-' + Date.now(),
    surveyType: 'taxi',
    courseName: '개인택시양수',
    eduDate: today,
    age: '54',
    gender: '1',
    bizExp: '1',
    bizMonths: '42',
    privMonths: '180',
    transfer: '2',
    r1: '10', r2: '9', r3: '10', r4: '9', r5: '10',
    r6: '10', r7: '9', r8: '10', r9: '10', r10: '10',
    satisfiedText: '체험교육',
    imp_edu_yn: '1', imp_edu_text: '',
    imp_facility_yn: '2', imp_facility_text: '[샘플] 휴게실 의자가 조금 더 있으면 좋겠습니다.',
    imp_etc_yn: '1', imp_etc_text: ''
  });
  saveSurveyResponse_({
    submissionId: 'TEST-BUS-' + Date.now(),
    surveyType: 'bus',
    courseName: '버스양성과정',
    eduDate: today,
    age: '44',
    gender: '1',
    bizExp: '2',
    bizMonths: '18',
    privMonths: '132',
    r1: '10', r2: '10', r3: '10', r4: '9', r5: '10',
    r6: '9', r7: '10', r8: '10', r9: '10', r10: '10',
    satisfiedText: '교수진',
    imp_edu_yn: '1', imp_edu_text: '',
    imp_facility_yn: '1', imp_facility_text: '',
    imp_etc_yn: '2', imp_etc_text: '[샘플] 버스양성과정 연동 테스트입니다.'
  });
  saveSurveyResponse_({
    submissionId: 'TEST-EV-' + Date.now(),
    surveyType: 'general',
    courseName: '일반기본교육(전기차)',
    eduDate: today,
    age: '38',
    gender: '2',
    bizExp: '6',
    bizMonths: '',
    privMonths: '96',
    r1: '9', r2: '9', r3: '10', r4: '10', r5: '10',
    r6: '9', r7: '8', r8: '10', r9: '10', r10: '9',
    satisfiedText: '체험교육',
    imp_edu_yn: '1', imp_edu_text: '',
    imp_facility_yn: '1', imp_facility_text: '',
    imp_etc_yn: '1', imp_etc_text: ''
  });
}

/**
 * POST 요청 처리 (메인 제출 방식)
 */
function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    var result = saveSurveyResponse_(data);
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/**
 * GET 요청 처리 (연동 진단 ping + 폴백 제출 + 브라우저 상태 확인)
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  if (params.action === 'ping') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var list = [];
    var hasDash = false;
    allSheets.forEach(function (sh) {
      var name = sh.getName();
      if (name === SHEET_DASHBOARD) {
        hasDash = true;
      } else {
        var count = Math.max(0, sh.getLastRow() - 3);
        list.push({ name: name, count: count });
      }
    });
    return jsonResponse_({
      ok: true,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      serverTime: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      dashboard: hasDash,
      sheets: list
    }, params.callback);
  }

  if (!params.eduDate && params.r1 === undefined) {
    return ContentService
      .createTextOutput('화성교통안전체험교육센터 고객만족도 조사 서버가 정상 작동 중입니다.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    var result = saveSurveyResponse_(params);
    return jsonResponse_(result, params.callback);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) }, params.callback);
  }
}

function jsonResponse_(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback && /^[a-zA-Z0-9_$.]+$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 연도(YY년) + 교육과정명으로 시트 탭 이름을 결정합니다.
 */
function resolveSheetName_(data) {
  var yy = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yy');
  if (data.eduDate && /^\d{4}-\d{2}-\d{2}$/.test(String(data.eduDate))) {
    yy = String(data.eduDate).substring(2, 4);
  }

  var courseLabel;
  if (data.surveyType === 'taxi') {
    courseLabel = '개인택시양수';
  } else if (data.surveyType === 'bus') {
    courseLabel = '버스양성과정';
  } else {
    courseLabel = String(data.courseName || '일반과정').trim();
  }

  // 시트 이름 금지 문자 제거 및 길이 제한
  courseLabel = courseLabel.replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (courseLabel.length > 75) courseLabel = courseLabel.substring(0, 75);

  return yy + '년 ' + courseLabel;
}

/**
 * 개월수를 읽기 좋은 "N년 M개월" 형식으로 변환합니다.
 */
function formatMonths_(raw) {
  if (raw === '' || raw === null || raw === undefined) return '-';
  var m = Number(raw);
  if (isNaN(m)) return '-';
  if (m === 0) return '0개월';
  var y = Math.floor(m / 12);
  var rem = m % 12;
  if (y > 0 && rem > 0) return y + '년 ' + rem + '개월';
  if (y > 0) return y + '년';
  return rem + '개월';
}

/**
 * 개선의견: 없음이면 '-', 있음이면 작성 내용을 반환합니다.
 */
function formatFeedback_(yn, text) {
  if (String(yn) === '2' && text && String(text).trim() !== '') {
    return String(text).trim();
  }
  return '-';
}

/**
 * 응답 저장 (LockService 동시성 제어 + submissionId 중복 차단 + 고가독성 행 서식 적용)
 */
function saveSurveyResponse_(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var cache = CacheService.getScriptCache();
    var subId = data.submissionId ? String(data.submissionId) : '';
    if (subId) {
      var cached = cache.get('sub_' + subId);
      if (cached) {
        var prev = JSON.parse(cached);
        prev.duplicate = true;
        return prev;
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var isTaxi = (data.surveyType === 'taxi') || (!data.courseName && !!data.transfer);
    var sheetName = resolveSheetName_(data);
    var isNewSheet = !ss.getSheetByName(sheetName);
    var sheet = ensureCourseSheet_(ss, sheetName, isTaxi);

    var nextRow = Math.max(4, sheet.getLastRow() + 1);
    var seq = nextRow - 3;
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');

    var scores = [];
    var sum = 0;
    var count = 0;
    for (var i = 1; i <= 10; i++) {
      var raw = data['r' + i];
      var num = (raw !== undefined && raw !== '') ? Number(raw) : '';
      scores.push(num);
      if (typeof num === 'number' && !isNaN(num)) {
        sum += num;
        count++;
      }
    }
    var avg = count > 0 ? Math.round((sum / count) * 100) / 100 : '';

    var genderTxt = GENDER_MAP[String(data.gender || '')] || '';
    var bizTxt = BIZ_EXP_MAP[String(data.bizExp || '')] || '';
    var bizCareerTxt = (String(data.bizExp) === '6') ? '-' : formatMonths_(data.bizMonths);
    var privCareerTxt = formatMonths_(data.privMonths);
    var transferTxt = TRANSFER_MAP[String(data.transfer || '')] || '';

    var eduFb = formatFeedback_(data.imp_edu_yn, data.imp_edu_text);
    var facFb = formatFeedback_(data.imp_facility_yn, data.imp_facility_text);
    var etcFb = formatFeedback_(data.imp_etc_yn, data.imp_etc_text);

    var row;
    if (isTaxi) {
      row = [
        seq, now, data.eduDate || '', data.age ? Number(data.age) : '', genderTxt,
        bizTxt, bizCareerTxt, privCareerTxt, transferTxt, avg
      ].concat(scores).concat([
        data.satisfiedText || '', eduFb, facFb, etcFb
      ]);
    } else {
      row = [
        seq, now, data.eduDate || '', data.age ? Number(data.age) : '', genderTxt,
        bizTxt, bizCareerTxt, privCareerTxt, avg
      ].concat(scores).concat([
        data.satisfiedText || '', eduFb, facFb, etcFb
      ]);
    }

    var range = sheet.getRange(nextRow, 1, 1, row.length);
    range.setValues([row]);
    styleDataRow_(sheet, nextRow, row, isTaxi);

    // 새 연도/과정 시트가 처음 생겼으면 대시보드에 자동 추가
    if (isNewSheet) {
      refreshDashboard();
    }

    var response = { ok: true, sheet: sheetName, row: nextRow, seq: seq, duplicate: false };
    if (subId) {
      cache.put('sub_' + subId, JSON.stringify(response), 600);
    }
    return response;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 연도·과정 시트가 없으면 리포트형 서식(제목 배너 + 요약 평균 바 + 색상 헤더 + 열너비)으로 생성
 */
function ensureCourseSheet_(ss, name, isTaxi) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() >= 3) {
    return sheet;
  }

  var headers = isTaxi ? TAXI_HEADERS : STANDARD_HEADERS;
  var totalCols = headers.length;
  var avgColIdx = isTaxi ? 10 : 9;       // J(택시) or I(일반/버스)
  var scoreStartIdx = avgColIdx + 1;     // K(택시) or J(일반/버스)
  var opinionStartIdx = scoreStartIdx + 10;

  sheet.clear();

  // 1행: 시트 타이틀 배너
  sheet.getRange(1, 1, 1, totalCols).merge()
    .setValue('📊 ' + name + ' 고객만족도 조사 현황')
    .setBackground('#0f4c5c')
    .setFontColor('#ffffff')
    .setFontSize(13)
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // 2행: 실시간 요약 바 (총 응답 인원 + 전체 평균 + 문항별 평균)
  var avgColLetter = colToLetter_(avgColIdx);
  sheet.getRange(2, 1, 1, avgColIdx - 1).merge()
    .setFormula('="총 응답자: " & COUNTA(B4:B) & "명  |  100점 환산: " & TEXT(IFERROR(AVERAGE(' + avgColLetter + '4:' + avgColLetter + ')*10, 0), "0.0") & "점"')
    .setBackground('#e6f2f4')
    .setFontColor('#0a3440')
    .setFontWeight('bold')
    .setFontSize(10.5)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');

  sheet.getRange(2, avgColIdx)
    .setFormula('=IFERROR(AVERAGE(' + avgColLetter + '4:' + avgColLetter + '), 0)')
    .setNumberFormat('0.00')
    .setBackground('#cfe6ea')
    .setFontColor('#0a3440')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  for (var s = 0; s < 10; s++) {
    var colL = colToLetter_(scoreStartIdx + s);
    sheet.getRange(2, scoreStartIdx + s)
      .setFormula('=IFERROR(AVERAGE(' + colL + '4:' + colL + '), 0)')
      .setNumberFormat('0.0')
      .setBackground('#e6f2f4')
      .setFontColor('#0f4c5c')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }

  var fb1L = colToLetter_(opinionStartIdx + 1);
  var fb3L = colToLetter_(opinionStartIdx + 3);
  sheet.getRange(2, opinionStartIdx, 1, 4).merge()
    .setFormula('="개선·건의 작성: " & (COUNTIF(' + fb1L + '4:' + fb3L + ', "<>-") - COUNTBLANK(' + fb1L + '4:' + fb3L + ')) & "건"')
    .setBackground('#fff3eb')
    .setFontColor('#9a3412')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(2, 30);

  // 3행: 영역별 색상 구분 컬럼 헤더
  var headerRange = sheet.getRange(3, 1, 1, totalCols);
  headerRange.setValues([headers])
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.getRange(3, 1, 1, avgColIdx - 1).setBackground('#1b4958');
  sheet.getRange(3, avgColIdx, 1, 11).setBackground('#1a6b7c');
  sheet.getRange(3, opinionStartIdx, 1, 4).setBackground('#9a4a16');
  sheet.setRowHeight(3, 38);

  // 상단 3행 고정 + 자동 필터
  sheet.setFrozenRows(3);
  sheet.getRange(3, 1, 1, totalCols).createFilter();

  // 가독성 최적화 열 너비 지정
  var widths = isTaxi
    ? [50, 132, 98, 54, 54, 108, 90, 90, 128, 72, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 110, 220, 220, 220]
    : [50, 132, 98, 54, 54, 108, 90, 90, 72, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 110, 220, 220, 220];

  for (var c = 0; c < widths.length; c++) {
    sheet.setColumnWidth(c + 1, widths[c]);
  }

  return sheet;
}

/**
 * 새로 추가된 데이터 행에 줄무늬, 테두리, 저점수/개선의견 강조 서식을 자동 적용합니다.
 */
function styleDataRow_(sheet, rowNum, rowValues, isTaxi) {
  var totalCols = rowValues.length;
  var avgColIdx = isTaxi ? 10 : 9;
  var scoreStartIdx = avgColIdx + 1;
  var opinionStartIdx = scoreStartIdx + 10;
  var baseBg = (rowNum % 2 === 0) ? '#ffffff' : '#f7fafb';

  var rowRange = sheet.getRange(rowNum, 1, 1, totalCols);
  rowRange
    .setBackground(baseBg)
    .setFontColor('#182226')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#dce4e6', SpreadsheetApp.BorderStyle.SOLID);

  // 기본정보 & 점수: 가운데 정렬
  sheet.getRange(rowNum, 1, 1, opinionStartIdx).setHorizontalAlignment('center');

  // 의견 3열: 왼쪽 정렬 + 자동 줄바꿈
  var fbRange = sheet.getRange(rowNum, opinionStartIdx + 1, 1, 3);
  fbRange.setHorizontalAlignment('left').setWrap(true);

  // 개인평균 강조 (7점 미만이면 연빨강 경고, 이상이면 연청록 강조)
  var avgVal = Number(rowValues[avgColIdx - 1]);
  var avgCell = sheet.getRange(rowNum, avgColIdx);
  avgCell.setNumberFormat('0.00').setFontWeight('bold');
  if (!isNaN(avgVal) && avgVal < 7) {
    avgCell.setBackground('#fee2e2').setFontColor('#b91c1c');
  } else {
    avgCell.setBackground('#e6f2f4').setFontColor('#0a3440');
  }

  // 개별 문항 5점 이하 강조
  for (var s = 0; s < 10; s++) {
    var sc = Number(rowValues[scoreStartIdx - 1 + s]);
    if (!isNaN(sc) && sc <= 5) {
      sheet.getRange(rowNum, scoreStartIdx + s)
        .setBackground('#fee2e2')
        .setFontColor('#b91c1c')
        .setFontWeight('bold');
    }
  }

  // 개선의견 작성된 셀만 연주황 강조 ('-'는 연회색)
  var hasLongText = false;
  for (var f = 0; f < 3; f++) {
    var txt = String(rowValues[opinionStartIdx + f] || '-');
    var cell = sheet.getRange(rowNum, opinionStartIdx + 1 + f);
    if (txt !== '-') {
      cell.setBackground('#fff7ed').setFontColor('#9a3412');
      if (txt.length > 22) hasLongText = true;
    } else {
      cell.setHorizontalAlignment('center').setFontColor('#94a3b8');
    }
  }

  sheet.setRowHeight(rowNum, hasLongText ? 44 : 28);
}

/**
 * 모든 'YY년 과정명' 시트를 자동 스캔해 '요약대시보드' 시트를 최신화합니다.
 */
function refreshDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!dash) {
    dash = ss.insertSheet(SHEET_DASHBOARD, 0);
  } else {
    dash.clear();
  }

  // 데이터 시트 목록 수집 (최신 연도 우선 정렬)
  var dataSheets = ss.getSheets().filter(function (sh) {
    return sh.getName() !== SHEET_DASHBOARD && sh.getLastRow() >= 3;
  });
  dataSheets.sort(function (a, b) {
    return b.getName().localeCompare(a.getName(), 'ko');
  });

  var headers = [
    '연도 · 교육과정 시트',
    '응답 인원',
    '평균 점수\n(10점)',
    '100점\n환산'
  ].concat(SHORT_Q_HEADERS).concat(['개선의견\n작성건수']);

  var totalCols = headers.length; // 15열 (A~O)

  // 1행 타이틀
  dash.getRange(1, 1, 1, totalCols).merge()
    .setValue('📊 화성교통안전체험교육센터 고객만족도 연도·과정별 통합 대시보드')
    .setBackground('#0f4c5c')
    .setFontColor('#ffffff')
    .setFontSize(14)
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  dash.setRowHeight(1, 40);

  // 2행 안내
  dash.getRange(2, 1, 1, totalCols).merge()
    .setValue('※ 각 연도·교육과정 탭의 실시간 수식이 자동 연동됩니다. 새 과정 탭 추가 후 상단 [📊 화성센터 설문 관리 → 요약대시보드 새로고침]으로 언제든 갱신할 수 있습니다.')
    .setBackground('#f4f6f4')
    .setFontColor('#54656b')
    .setFontSize(9.5)
    .setVerticalAlignment('middle');
  dash.setRowHeight(2, 24);

  // 3행 헤더
  dash.getRange(3, 1, 1, totalCols)
    .setValues([headers])
    .setBackground('#1b4958')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  dash.setRowHeight(3, 38);

  if (dataSheets.length > 0) {
    var rows = [];
    dataSheets.forEach(function (sh) {
      var name = sh.getName();
      var escaped = "'" + name.replace(/'/g, "''") + "'";
      var isTaxi = (sh.getRange(3, 9).getValue() === '양수계획');
      var avgCol = isTaxi ? 'J' : 'I';
      var qCols = isTaxi
        ? ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']
        : ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
      var fbStart = isTaxi ? 'V' : 'U';
      var fbEnd = isTaxi ? 'X' : 'W';

      var rowIdx = 4 + rows.length;
      var line = [
        name,
        '=COUNTA(' + escaped + '!B4:B)',
        '=IFERROR(AVERAGE(' + escaped + '!' + avgCol + '4:' + avgCol + '), 0)',
        '=C' + rowIdx + '*10'
      ];
      qCols.forEach(function (col) {
        line.push('=IFERROR(AVERAGE(' + escaped + '!' + col + '4:' + col + '), 0)');
      });
      line.push('=COUNTIF(' + escaped + '!' + fbStart + '4:' + fbEnd + ', "<>-") - COUNTBLANK(' + escaped + '!' + fbStart + '4:' + fbEnd + ')');
      rows.push(line);
    });

    var bodyRange = dash.getRange(4, 1, rows.length, totalCols);
    bodyRange.setValues(rows)
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#dce4e6', SpreadsheetApp.BorderStyle.SOLID);

    dash.getRange(4, 1, rows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
    dash.getRange(4, 2, rows.length, totalCols - 1).setHorizontalAlignment('center');
    dash.getRange(4, 2, rows.length, 1).setNumberFormat('#,##0"명"');
    dash.getRange(4, 3, rows.length, 1).setNumberFormat('0.00').setBackground('#e6f2f4').setFontWeight('bold');
    dash.getRange(4, 4, rows.length, 1).setNumberFormat('0.0"점"');
    dash.getRange(4, 5, rows.length, 10).setNumberFormat('0.0');
    dash.getRange(4, 15, rows.length, 1).setNumberFormat('#,##0"건"');

    for (var r = 0; r < rows.length; r++) {
      dash.setRowHeight(4 + r, 28);
    }

    // 전체 합계 / 가중평균 행
    var totRow = 4 + rows.length;
    var lastDataRow = totRow - 1;
    var totValues = [
      '전체 합계 / 가중평균',
      '=SUM(B4:B' + lastDataRow + ')',
      '=IF(B' + totRow + '=0, 0, SUMPRODUCT(B4:B' + lastDataRow + ', C4:C' + lastDataRow + ')/B' + totRow + ')',
      '=C' + totRow + '*10'
    ];
    for (var q = 0; q < 10; q++) {
      var colL = colToLetter_(5 + q);
      totValues.push('=IF($B$' + totRow + '=0, 0, SUMPRODUCT($B$4:$B$' + lastDataRow + ', ' + colL + '4:' + colL + lastDataRow + ')/$B$' + totRow + ')');
    }
    totValues.push('=SUM(O4:O' + lastDataRow + ')');

    var totRange = dash.getRange(totRow, 1, 1, totalCols);
    totRange.setValues([totValues])
      .setBackground('#dce9ec')
      .setFontColor('#0a3440')
      .setFontWeight('bold')
      .setFontSize(10.5)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#0f4c5c', SpreadsheetApp.BorderStyle.SOLID);
    dash.getRange(totRow, 1).setHorizontalAlignment('left');
    dash.getRange(totRow, 2, 1, totalCols - 1).setHorizontalAlignment('center');
    dash.getRange(totRow, 2).setNumberFormat('#,##0"명"');
    dash.getRange(totRow, 3).setNumberFormat('0.00');
    dash.getRange(totRow, 4).setNumberFormat('0.0"점"');
    dash.getRange(totRow, 5, 1, 10).setNumberFormat('0.0');
    dash.getRange(totRow, 15).setNumberFormat('#,##0"건"');
    dash.setRowHeight(totRow, 32);
  }

  dash.setFrozenRows(3);
  dash.setColumnWidth(1, 220);
  dash.setColumnWidth(2, 86);
  dash.setColumnWidth(3, 82);
  dash.setColumnWidth(4, 78);
  for (var w = 5; w <= 14; w++) {
    dash.setColumnWidth(w, 62);
  }
  dash.setColumnWidth(15, 88);
}

function colToLetter_(col) {
  var letter = '';
  while (col > 0) {
    var temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

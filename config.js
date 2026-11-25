/**
 * 화성교통안전체험교육센터 고객만족도 조사 설정 파일
 *
 * [최초 설정 방법]
 * 1. 구글 시트에서 Apps Script(google-apps-script/Code.gs)를 웹 앱으로 배포합니다.
 * 2. 발급된 웹 앱 URL을 아래 SHEET_URL 에 붙여넣습니다.
 * 3. 구글 스프레드시트 브라우저 주소창의 URL을 SPREADSHEET_URL 에 붙여넣으면
 *    관리자 도구(자물쇠 메뉴)에서 버튼 한 번으로 시트를 바로 열 수 있습니다.
 * 4. ADMIN_PASSWORD 를 화성센터 담당자 전용 비밀번호로 변경해 사용하세요.
 */
window.SURVEY_CONFIG = {
  // ▼ 1. 구글 Apps Script 웹 앱 URL (https://script.google.com/macros/s/.../exec)
  SHEET_URL: 'https://script.google.com/macros/s/AKfycbwYr02-sFuP0v8OpG7YGMwEIBbeW4R5nr9zg4PhlfX0-B2xPGTrM_8C0JTxHyxkSr1S/exec',

  // ▼ 2. 연동된 구글 스프레드시트 URL (https://docs.google.com/spreadsheets/d/.../edit)
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/14e7BuD-ghlcUCaKago44gNaCzBhph43Wq0U9BHvJk-M/edit?gid=1659103135#gid=1659103135',

  // ▼ 3. 센터 담당자 도구(자물쇠 아이콘) 접속 비밀번호 (원하는 비밀번호로 변경하세요)
  ADMIN_PASSWORD: '1234',

  // 센터명
  CENTER_NAME: '화성교통안전체험교육센터',

  // 일반과정 설문 드롭다운 교육과정 목록 (요청 순서 반영)
  COURSES: [
    '일반기본교육(전기차)',
    '법정교육(버스)',
    '법정교육(택시)',
    '법정교육(화물)',
    '버스기본교육',
    '버스심화교육',
    '버스자격교육',
    '일반기본교육',
    '일반심화교육',
    '화물기본교육',
    '화물자격교육',
    '기타(직접입력)'
  ]
};

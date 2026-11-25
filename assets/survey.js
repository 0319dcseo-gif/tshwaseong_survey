(function () {
  'use strict';

  var RATING_QUESTIONS = [
    '교통안전체험교육센터의 서비스는 나의 이용 목적에 부합한다.',
    '교통안전체험교육센터는 국가나 사회의 미래가치 창출을 위한 업무를 수행하고 있다.',
    '교통안전체험교육센터의 교육이 타 공공기관 교육 대비 우수하다고 생각한다.',
    '교통안전체험교육센터에서 제공하는 서비스는 이용하는데에 문제가 없다.',
    '교통안전체험교육센터 직원들의 태도는 친절하고 만족스럽다.',
    '교통안전체험교육센터는 필요한 정보나 업무처리결과를 분명하게 알려준다.',
    '교통안전체험교육센터의 시설은 쾌적하다.',
    '교육 수료 후 교통안전체험교육센터에 대해 긍정적으로 생각할 것이다.',
    '교통안전체험교육센터 직원은 내가 필요한 서비스를 제공하기 위해 최선을 다한다.',
    '교통안전체험교육센터의 교육 서비스는 전반적으로 만족스럽다.'
  ];

  var DEFAULT_COURSES = [
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
  ];

  function isConfigured(url) {
    return (
      typeof url === 'string' &&
      url.indexOf('https://script.google.com/macros/s/') === 0 &&
      url.indexOf('YOUR_GOOGLE_APPS_SCRIPT') === -1
    );
  }

  function formatToday() {
    var t = new Date();
    return (
      t.getFullYear() +
      '-' +
      String(t.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(t.getDate()).padStart(2, '0')
    );
  }

  function getScoreLevel(val) {
    if (val <= 3) return { cls: 'low', label: val + '점 · 불만족' };
    if (val <= 6) return { cls: 'mid', label: val + '점 · 보통' };
    if (val <= 8) return { cls: 'high', label: val + '점 · 만족' };
    return { cls: 'high', label: val + '점 · 매우 만족' };
  }

  function createSubmissionId() {
    return (
      'HS-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8).toUpperCase()
    );
  }

  window.initHwaseongSurvey = function (options) {
    // surveyType: 'taxi' | 'bus' | 'general'
    var surveyType = options.surveyType;
    var config = window.SURVEY_CONFIG || {};
    var sheetUrl = config.SHEET_URL || '';
    var ratings = {};
    var queryParams = new URLSearchParams(window.location.search);
    var panels = Array.prototype.slice.call(document.querySelectorAll('.step-panel'));
    var stepPills = Array.prototype.slice.call(document.querySelectorAll('.step-pill'));
    var currentStep = 0;
    var activeSubmissionId = null;

    var centerEl = document.getElementById('centerName');
    if (centerEl && config.CENTER_NAME) {
      centerEl.textContent = config.CENTER_NAME;
    }

    var demoBanner = document.getElementById('demoBanner');
    if (demoBanner && !isConfigured(sheetUrl)) {
      demoBanner.classList.add('show');
    }

    function clearErr(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('show');
    }

    // 일반과정: 교육과정 드롭다운 구성 + URL 파라미터 자동 선택
    var courseSelect = document.getElementById('courseName');
    var courseEtcBox = document.getElementById('courseEtcBox');
    var courseEtcText = document.getElementById('courseEtcText');

    if (surveyType === 'general' && courseSelect) {
      var courses =
        Array.isArray(config.COURSES) && config.COURSES.length > 0
          ? config.COURSES
          : DEFAULT_COURSES;

      courses.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        courseSelect.appendChild(opt);
      });

      var preCourse = queryParams.get('course');
      if (preCourse) {
        if (courses.indexOf(preCourse) > -1) {
          courseSelect.value = preCourse;
        } else {
          var customOpt = document.createElement('option');
          customOpt.value = preCourse;
          customOpt.textContent = preCourse;
          courseSelect.insertBefore(customOpt, courseSelect.children[1] || null);
          courseSelect.value = preCourse;
        }
      }

      courseSelect.addEventListener('change', function () {
        clearErr('err-courseName');
        if (courseEtcBox) {
          courseEtcBox.classList.toggle('show', this.value === '기타(직접입력)');
        }
        updateProgress();
      });

      if (courseEtcText) {
        courseEtcText.addEventListener('input', function () {
          clearErr('err-courseName');
          updateProgress();
        });
      }
    }

    // 교육 입교 일자 기본값
    var eduDateEl = document.getElementById('eduDate');
    var preDate = queryParams.get('date');
    eduDateEl.value = /^\d{4}-\d{2}-\d{2}$/.test(preDate || '') ? preDate : formatToday();
    eduDateEl.addEventListener('change', function () {
      clearErr('err-eduDate');
      updateProgress();
    });

    // 0~10점 터치 패드 문항 렌더링
    var rc = document.getElementById('ratingContainer');
    RATING_QUESTIONS.forEach(function (q, i) {
      var card = document.createElement('div');
      card.className = 'rating-card';
      card.id = 'rq' + i;

      var btnsHtml = '';
      for (var s = 0; s <= 10; s++) {
        btnsHtml +=
          '<button type="button" class="score-btn" data-idx="' +
          i +
          '" data-score="' +
          s +
          '">' +
          s +
          '</button>';
      }

      card.innerHTML =
        '<div class="rating-top">' +
        '<div class="rating-q"><span class="rating-q-num">' +
        (i + 1) +
        '.</span>' +
        q +
        '<span class="required">*</span></div>' +
        '<span class="score-pill" id="pill' +
        i +
        '">미선택</span>' +
        '</div>' +
        '<div class="score-grid">' +
        btnsHtml +
        '</div>' +
        '<div class="score-scale-labels"><span class="low">0 매우 불만족</span><span>5 보통</span><span class="high">10 매우 만족</span></div>' +
        '<div class="error-msg" id="err-r' +
        i +
        '">점수를 선택해 주세요</div>';
      rc.appendChild(card);
    });

    function selectScore(idx, val) {
      ratings[idx] = String(val);
      var card = document.getElementById('rq' + idx);
      var pill = document.getElementById('pill' + idx);
      var level = getScoreLevel(val);

      card.classList.add('answered');
      card.classList.remove('has-error');
      clearErr('err-r' + idx);

      pill.className = 'score-pill ' + level.cls;
      pill.textContent = level.label;

      card.querySelectorAll('.score-btn').forEach(function (b) {
        var isSel = parseInt(b.dataset.score, 10) === val;
        b.className = 'score-btn' + (isSel ? ' selected ' + level.cls : '');
      });

      updateRatingCounter();
      updateProgress();
    }

    function updateRatingCounter() {
      var doneCount = 0;
      for (var i = 0; i < RATING_QUESTIONS.length; i++) {
        if (ratings[i] !== undefined) doneCount++;
      }
      var counterEl = document.getElementById('ratingCounter');
      if (counterEl) {
        counterEl.innerHTML = '평가 완료 <strong>' + doneCount + '</strong> / 10문항';
      }
    }

    rc.addEventListener('click', function (e) {
      var btn = e.target.closest('.score-btn');
      if (!btn) return;
      selectScore(parseInt(btn.dataset.idx, 10), parseInt(btn.dataset.score, 10));
    });

    document.getElementById('allSatisfiedBtn').addEventListener('click', function () {
      for (var k = 0; k < RATING_QUESTIONS.length; k++) {
        selectScore(k, 10);
      }
    });

    // 타일형 라디오 버튼 선택 처리
    document.addEventListener('change', function (e) {
      if (e.target.type === 'radio') {
        var name = e.target.name;
        document.querySelectorAll('input[name="' + name + '"]').forEach(function (r) {
          var tile = r.closest('.choice-tile');
          if (tile) tile.classList.toggle('checked', r.checked);
        });
        if (name === 'gender') clearErr('err-gender');
        if (name === 'bizExp') clearErr('err-bizExp');
        if (name === 'transfer') clearErr('err-transfer');
        if (name === 'satisfied') clearErr('err-satisfied');
        if (name === 'imp_edu' || name === 'imp_facility' || name === 'imp_etc') {
          clearErr('err-improvement');
        }
        updateProgress();
      }
    });

    document.querySelectorAll('input[name="bizExp"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var show = ['1', '2', '3', '4', '5'].indexOf(this.value) > -1;
        document.getElementById('bizCareerBox').classList.toggle('show', show);
      });
    });

    document.querySelectorAll('input[name="satisfied"]').forEach(function (r) {
      r.addEventListener('change', function () {
        document.getElementById('satisfiedEtcBox').classList.toggle('show', this.value === '기타');
      });
    });

    ['imp_edu', 'imp_facility', 'imp_etc'].forEach(function (n) {
      document.querySelectorAll('input[name="' + n + '"]').forEach(function (r) {
        r.addEventListener('change', function () {
          document.getElementById(n + '_box').classList.toggle('show', this.value === '2');
        });
      });
      var txt = document.getElementById(n + '_text');
      if (txt) {
        txt.addEventListener('input', function () {
          clearErr('err-improvement');
          updateProgress();
        });
      }
    });

    ['age', 'bizYear', 'bizMonth', 'privYear', 'privMonth', 'satisfiedEtcText'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          if (id === 'age') clearErr('err-age');
          if (id === 'bizYear' || id === 'bizMonth') clearErr('err-bizExp');
          if (id === 'privYear' || id === 'privMonth') clearErr('err-privCareer');
          if (id === 'satisfiedEtcText') clearErr('err-satisfied');
          updateProgress();
        });
      }
    );

    // 단계별 유효성 검사
    function validateStep(stepIndex) {
      var panel = panels[stepIndex];
      var stepKey = panel.dataset.stepKey;
      var hasError = false;
      var firstEl = null;

      function markErr(errId, focusId) {
        var el = document.getElementById(errId);
        if (el) el.classList.add('show');
        if (!firstEl) firstEl = document.getElementById(focusId || errId);
        hasError = true;
      }

      if (stepKey === 'basic') {
        if (surveyType === 'general') {
          var cVal = courseSelect.value;
          if (!cVal) {
            markErr('err-courseName', 'courseName');
          } else if (cVal === '기타(직접입력)' && !courseEtcText.value.trim()) {
            markErr('err-courseName', 'courseEtcText');
          }
        }
        if (!eduDateEl.value) markErr('err-eduDate', 'eduDate');
        var ageVal = parseInt(document.getElementById('age').value, 10);
        if (!ageVal || ageVal < 18 || ageVal > 100) markErr('err-age', 'age');
        if (!document.querySelector('input[name="gender"]:checked')) {
          markErr('err-gender', 'err-gender');
        }
        var bizCk = document.querySelector('input[name="bizExp"]:checked');
        if (!bizCk) {
          markErr('err-bizExp', 'err-bizExp');
        } else if (['1', '2', '3', '4', '5'].indexOf(bizCk.value) > -1) {
          if (
            document.getElementById('bizYear').value === '' &&
            document.getElementById('bizMonth').value === ''
          ) {
            markErr('err-bizExp', 'bizCareerBox');
          }
        }
        if (
          document.getElementById('privYear').value === '' &&
          document.getElementById('privMonth').value === ''
        ) {
          markErr('err-privCareer', 'privYear');
        }
      } else if (stepKey === 'transfer') {
        if (!document.querySelector('input[name="transfer"]:checked')) {
          markErr('err-transfer', 'err-transfer');
        }
      } else if (stepKey === 'rating') {
        for (var i = 0; i < RATING_QUESTIONS.length; i++) {
          if (ratings[i] === undefined) {
            document.getElementById('rq' + i).classList.add('has-error');
            markErr('err-r' + i, 'rq' + i);
          }
        }
      } else if (stepKey === 'feedback') {
        var satCk = document.querySelector('input[name="satisfied"]:checked');
        if (!satCk) {
          markErr('err-satisfied', 'err-satisfied');
        } else if (
          satCk.value === '기타' &&
          !document.getElementById('satisfiedEtcText').value.trim()
        ) {
          markErr('err-satisfied', 'satisfiedEtcText');
        }

        var impErr = false;
        ['imp_edu', 'imp_facility', 'imp_etc'].forEach(function (n) {
          var ck = document.querySelector('input[name="' + n + '"]:checked');
          if (!ck) impErr = true;
          else if (ck.value === '2' && !document.getElementById(n + '_text').value.trim()) {
            impErr = true;
          }
        });
        if (impErr) markErr('err-improvement', 'err-improvement');
      }

      if (hasError && firstEl) {
        firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return !hasError;
    }

    function showStep(idx) {
      currentStep = idx;
      panels.forEach(function (p, i) {
        p.classList.toggle('active', i === idx);
      });
      stepPills.forEach(function (pill, i) {
        pill.classList.toggle('active', i === idx);
        pill.classList.toggle('done', i < idx);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      updateProgress();
    }

    document.querySelectorAll('[data-action="next"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (validateStep(currentStep)) {
          showStep(Math.min(panels.length - 1, currentStep + 1));
        }
      });
    });

    document.querySelectorAll('[data-action="prev"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showStep(Math.max(0, currentStep - 1));
      });
    });

    stepPills.forEach(function (pill, idx) {
      pill.addEventListener('click', function () {
        if (idx <= currentStep) {
          showStep(idx);
        } else if (idx === currentStep + 1 && validateStep(currentStep)) {
          showStep(idx);
        }
      });
    });

    function updateProgress() {
      var fill = document.getElementById('progressFill');
      if (!fill) return;
      var total = 19;
      var done = 0;

      if (eduDateEl.value) done++;
      if (surveyType === 'general') {
        total++;
        var cVal = courseSelect ? courseSelect.value : '';
        if (cVal && (cVal !== '기타(직접입력)' || (courseEtcText && courseEtcText.value.trim()))) {
          done++;
        }
      } else if (surveyType === 'taxi') {
        total++;
        if (document.querySelector('input[name="transfer"]:checked')) done++;
      }

      if (document.getElementById('age').value) done++;
      if (document.querySelector('input[name="gender"]:checked')) done++;

      var bizCk = document.querySelector('input[name="bizExp"]:checked');
      if (bizCk) {
        if (['1', '2', '3', '4', '5'].indexOf(bizCk.value) > -1) {
          if (
            document.getElementById('bizYear').value !== '' ||
            document.getElementById('bizMonth').value !== ''
          ) {
            done++;
          }
        } else {
          done++;
        }
      }
      if (
        document.getElementById('privYear').value !== '' ||
        document.getElementById('privMonth').value !== ''
      ) {
        done++;
      }

      for (var i = 0; i < RATING_QUESTIONS.length; i++) {
        if (ratings[i] !== undefined) done++;
      }

      var satCk = document.querySelector('input[name="satisfied"]:checked');
      if (satCk) {
        if (satCk.value !== '기타' || document.getElementById('satisfiedEtcText').value.trim()) {
          done++;
        }
      }

      ['imp_edu', 'imp_facility', 'imp_etc'].forEach(function (n) {
        var ck = document.querySelector('input[name="' + n + '"]:checked');
        if (ck && (ck.value === '1' || document.getElementById(n + '_text').value.trim())) {
          done++;
        }
      });

      var pct = Math.min(100, Math.round((done / total) * 100));
      fill.style.width = pct + '%';
    }

    // 최종 제출 처리
    document.getElementById('submitBtn').addEventListener('click', function () {
      var statusBox = document.getElementById('statusBox');
      statusBox.className = 'status-box';
      statusBox.style.display = 'none';

      for (var s = 0; s < panels.length; s++) {
        if (!validateStep(s)) {
          showStep(s);
          statusBox.className = 'status-box error';
          statusBox.style.display = 'block';
          statusBox.textContent = '❌ 아직 입력하지 않은 필수 항목이 있습니다. 확인해 주세요.';
          return;
        }
      }

      var resolvedCourse = '개인택시양수';
      if (surveyType === 'bus') {
        resolvedCourse = '버스양성과정';
      } else if (surveyType === 'general') {
        resolvedCourse =
          courseSelect.value === '기타(직접입력)'
            ? courseEtcText.value.trim()
            : courseSelect.value;
      }

      var bizCk = document.querySelector('input[name="bizExp"]:checked');
      var hasBiz = ['1', '2', '3', '4', '5'].indexOf(bizCk.value) > -1;
      var bizMonths = hasBiz
        ? parseInt(document.getElementById('bizYear').value || '0', 10) * 12 +
          parseInt(document.getElementById('bizMonth').value || '0', 10)
        : '';
      var privMonths =
        parseInt(document.getElementById('privYear').value || '0', 10) * 12 +
        parseInt(document.getElementById('privMonth').value || '0', 10);
      var transferCk = document.querySelector('input[name="transfer"]:checked');
      var satCk = document.querySelector('input[name="satisfied"]:checked');
      var satText =
        satCk.value === '기타'
          ? document.getElementById('satisfiedEtcText').value.trim()
          : satCk.value;
      var iEdu = document.querySelector('input[name="imp_edu"]:checked').value;
      var iFac = document.querySelector('input[name="imp_facility"]:checked').value;
      var iEtc = document.querySelector('input[name="imp_etc"]:checked').value;

      if (!activeSubmissionId) {
        activeSubmissionId = createSubmissionId();
      }

      var payload = {
        submissionId: activeSubmissionId,
        surveyType: surveyType,
        centerName: config.CENTER_NAME || '화성교통안전체험교육센터',
        courseName: resolvedCourse,
        eduDate: eduDateEl.value,
        age: String(parseInt(document.getElementById('age').value, 10)),
        gender: document.querySelector('input[name="gender"]:checked').value,
        bizExp: bizCk.value,
        bizMonths: String(bizMonths),
        privMonths: String(privMonths),
        transfer: transferCk ? transferCk.value : '',
        r1: ratings[0],
        r2: ratings[1],
        r3: ratings[2],
        r4: ratings[3],
        r5: ratings[4],
        r6: ratings[5],
        r7: ratings[6],
        r8: ratings[7],
        r9: ratings[8],
        r10: ratings[9],
        satisfiedText: satText,
        imp_edu_yn: iEdu,
        imp_edu_text: iEdu === '2' ? document.getElementById('imp_edu_text').value.trim() : '',
        imp_facility_yn: iFac,
        imp_facility_text:
          iFac === '2' ? document.getElementById('imp_facility_text').value.trim() : '',
        imp_etc_yn: iEtc,
        imp_etc_text: iEtc === '2' ? document.getElementById('imp_etc_text').value.trim() : ''
      };

      if (!isConfigured(sheetUrl)) {
        showCompleteScreen(payload, { isDemo: true });
        return;
      }

      var btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = '구글 시트로 전송 중...';
      statusBox.className = 'status-box';
      statusBox.style.display = 'block';
      statusBox.textContent = '⏳ 응답을 안전하게 저장하고 있습니다...';

      fetch(sheetUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data && data.ok) {
            showCompleteScreen(payload, {
              isDemo: false,
              verified: true,
              sheet: data.sheet,
              row: data.row
            });
          } else {
            throw new Error((data && data.error) || '저장 오류');
          }
        })
        .catch(function () {
          if (!navigator.onLine) {
            btn.disabled = false;
            btn.textContent = '다시 제출하기';
            statusBox.className = 'status-box error';
            statusBox.textContent =
              '❌ 인터넷 연결이 끊겨 있습니다. 데이터/와이파이를 확인한 뒤 다시 눌러주세요.';
            return;
          }
          fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          })
            .then(function () {
              showCompleteScreen(payload, { isDemo: false, verified: false });
            })
            .catch(function () {
              btn.disabled = false;
              btn.textContent = '다시 제출하기';
              statusBox.className = 'status-box error';
              statusBox.textContent =
                '❌ 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
            });
        });
    });

    function showCompleteScreen(payload, info) {
      document.getElementById('surveyForm').style.display = 'none';
      var stepper = document.getElementById('stepperBar');
      if (stepper) stepper.style.display = 'none';

      var complete = document.getElementById('completeScreen');
      complete.classList.add('show');

      var meta = document.getElementById('completeMeta');
      if (meta) {
        var nowStr = new Date().toLocaleString('ko-KR');
        var badge = info.isDemo
          ? '⚠️ 테스트 모드 (config.js에 구글 시트 URL 미연결)'
          : info.verified && info.sheet
          ? '✅ 구글 시트 저장 확인 (' + info.sheet + ' #' + info.row + '행)'
          : '✅ 설문 응답 전송 완료';
        meta.innerHTML =
          '<strong>' +
          badge +
          '</strong><br>' +
          payload.courseName +
          ' · 입교일 ' +
          payload.eduDate +
          '<br>제출시각 ' +
          nowStr;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateRatingCounter();
    showStep(0);
  };
})();

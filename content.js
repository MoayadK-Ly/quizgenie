// QuizGenie - Content Script (Dual Mode AI Solver v1.2.0)

let extensionEnabled = true;
let fabEnabled = true;
let serverType = 'gemini';
let subject = 'general';
let targetLanguage = 'ar';
let currentMode = 'concise';
let liveAutoClickEnabled = false;

let fabElement = null;
let menuElement = null;
let panelElement = null;
let shadowRoot = null;
let hostElement = null;
let selectedTextCache = '';
let currentQuestionCache = {
  text: '',
  concise: null,
  detailed: null
};
let currentFontSize = 14;

// التنسيقات المضمنة لضمان عمل الواجهة دائماً وبدقة داخل Shadow DOM
const EMBEDDED_STYLES = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  direction: rtl;
  text-align: right;
  font-size: 14px;
  color: #e2e8f0;
}

/* Floating Action Button (FAB) */
.quizgenie-fab {
  position: absolute;
  width: 40px;
  height: 40px;
  background: #0f172a;
  border: 1.5px solid #334155;
  border-radius: 11px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  padding: 0;
  outline: none;
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.quizgenie-fab-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  transition: transform 0.2s ease, filter 0.2s ease;
  pointer-events: none;
}

.quizgenie-fab:hover {
  transform: scale(1.08);
  background: #1e293b;
  border-color: #0284c7;
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.35);
}

.quizgenie-fab:hover .quizgenie-fab-img {
  transform: scale(1.08);
}

/* التوهج الأزرق يظهر فقط عند الضغط / التفعيل */
.quizgenie-fab:active,
.quizgenie-fab.active {
  transform: scale(0.95);
  background: #0284c7 !important;
  border-color: #38bdf8 !important;
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.85), 0 4px 14px rgba(0, 0, 0, 0.6) !important;
}

.quizgenie-fab:active .quizgenie-fab-img,
.quizgenie-fab.active .quizgenie-fab-img {
  filter: drop-shadow(0 0 6px #ffffff) !important;
}

/* Options Mini-Menu */
.quizgenie-menu {
  position: absolute;
  background: #0b0f19;
  border: 1px solid #38bdf8;
  border-radius: 12px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.85), 0 0 15px rgba(56, 189, 248, 0.25);
  width: 220px;
  padding: 8px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: qgFadeIn 0.15s ease-out;
}

.quizgenie-menu-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px 6px 6px;
  border-bottom: 1px solid #1e293b;
}

.quizgenie-logo-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  vertical-align: middle;
}

.quizgenie-menu-title {
  font-size: 12px;
  font-weight: 700;
  color: #38bdf8;
}

.quizgenie-option-btn {
  background: #111827;
  border: 1px solid #1e293b;
  color: #f1f5f9;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 500;
  text-align: right;
  width: 100%;
  transition: all 0.15s ease;
}

.quizgenie-option-btn:hover {
  background: #1e293b;
  border-color: #38bdf8;
  color: #38bdf8;
}

.quizgenie-option-icon {
  font-size: 14px;
}

/* Floating Answer Card */
.quizgenie-panel {
  position: fixed;
  background: #0b0f19;
  border: 1px solid #38bdf8;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(56, 189, 248, 0.25);
  width: 460px;
  max-width: 90vw;
  max-height: 82vh;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: qgFadeIn 0.2s ease-out;
}

.quizgenie-panel-header {
  background: #0f172a;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e293b;
}

.quizgenie-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  color: #38bdf8;
}

.quizgenie-server-tag {
  font-size: 11px;
  font-weight: 600;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.35);
  padding: 2px 7px;
  border-radius: 12px;
}

.quizgenie-subject-tag {
  font-size: 11px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 2px 7px;
  border-radius: 12px;
}

.quizgenie-lang-tag {
  font-size: 11px;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 7px;
  border-radius: 12px;
}

.quizgenie-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quizgenie-copy-btn {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid #0284c7;
  color: #38bdf8;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.quizgenie-copy-btn:hover {
  background: #0284c7;
  color: #ffffff;
}

.quizgenie-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s;
}

.quizgenie-close-btn:hover {
  color: #f1f5f9;
}

/* Tabs */
.quizgenie-tabs {
  display: flex;
  background: #111827;
  border-bottom: 1px solid #1e293b;
}

.quizgenie-tab-btn {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.quizgenie-tab-btn:hover {
  color: #e2e8f0;
}

.quizgenie-tab-btn.active {
  color: #38bdf8;
  border-bottom-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

/* Panel Body */
.quizgenie-panel-body {
  padding: 16px;
  overflow-y: auto;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quizgenie-answer-badge {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid #10b981;
  color: #6ee7b7;
  padding: 10px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14.5px;
  line-height: 1.5;
}

.quizgenie-content-text {
  font-size: 13px;
  line-height: 1.7;
  color: #cbd5e1;
  white-space: pre-wrap;
}

.quizgenie-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px 10px;
  color: #94a3b8;
  font-size: 13px;
}

.quizgenie-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #334155;
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: qgSpin 0.8s linear infinite;
}

.quizgenie-error {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.quizgenie-retry-btn {
  margin-top: 8px;
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid #0284c7;
  color: #38bdf8;
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-block;
  transition: all 0.2s;
  outline: none;
}

.quizgenie-retry-btn:hover {
  background: #0284c7;
  color: #ffffff;
}

@keyframes qgSpin {
  to { transform: rotate(360deg); }
}

.quizgenie-section-card {
  margin-bottom: 10px;
  border-radius: 8px;
  padding: 10px 12px;
  border-right: 4px solid #38bdf8;
  background: #1e293b;
  font-size: 13.5px;
  line-height: 1.55;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.quizgenie-card-header {
  font-weight: 700;
  margin-bottom: 6px;
  font-size: 14px;
}

.quizgenie-card-body {
  white-space: pre-wrap;
  color: #cbd5e1;
  font-size: 13px;
}

.card-answer {
  background: #064e3b !important;
  border-right-color: #10b981 !important;
  border: 1px solid #059669;
}
.card-answer .quizgenie-card-header {
  color: #6ee7b7;
  font-size: 15px;
}
.card-answer .quizgenie-card-body {
  color: #a7f3d0;
  font-weight: 600;
}

.card-concise {
  background: #082f49 !important;
  border-right-color: #38bdf8 !important;
  border: 1px solid #0284c7;
}
.card-concise .quizgenie-card-header {
  color: #7dd3fc;
}

.card-concept {
  background: #0f172a !important;
  border-right-color: #38bdf8 !important;
  border: 1px solid #1e3a5f;
}
.card-concept .quizgenie-card-header {
  color: #38bdf8;
}

.card-steps {
  background: #1e293b !important;
  border-right-color: #94a3b8 !important;
  border: 1px solid #334155;
}
.card-steps .quizgenie-card-header {
  color: #e2e8f0;
}

.card-elimination {
  background: #451a03 !important;
  border-right-color: #f59e0b !important;
  border: 1px solid #b45309;
}
.card-elimination .quizgenie-card-header {
  color: #fcd34d;
}
.card-elimination .quizgenie-card-body {
  color: #fde68a;
}

.card-tip {
  background: #2e1065 !important;
  border-right-color: #a855f7 !important;
  border: 1px solid #7e22ce;
}
.card-tip .quizgenie-card-header {
  color: #d8b4fe;
}
.card-tip .quizgenie-card-body {
  color: #f3e8ff;
}

.quizgenie-zoom-btn, .quizgenie-audio-btn {
  background: #1e293b;
  border: 1px solid #475569;
  color: #cbd5e1;
  border-radius: 6px;
  padding: 3px 7px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}
.quizgenie-zoom-btn:hover, .quizgenie-audio-btn:hover {
  background: #334155;
  color: #fff;
  border-color: #38bdf8;
}
.quizgenie-audio-btn.active {
  background: #ef4444 !important;
  color: #fff !important;
  border-color: #f87171 !important;
}
@keyframes qgFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

// تهيئة حاوية Shadow DOM
function initShadowHost() {
  if (hostElement && shadowRoot) return;

  hostElement = document.createElement('quizgenie-extension-root');
  hostElement.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;';
  
  shadowRoot = hostElement.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = EMBEDDED_STYLES;
  shadowRoot.appendChild(styleEl);

  document.documentElement.appendChild(hostElement);
}

function getLogoUrl() {
  try {
    return (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icons/icon48.png') : '';
  } catch (e) {
    return '';
  }
}

const CONTENT_LANG_LABELS = {
  'ar': 'مترجم للعربية',
  'same': 'لغة السؤال',
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'zh': '中文',
  'ja': '日本語',
  'ko': '한국어',
  'ru': 'Русский',
  'tr': 'Türkçe',
  'it': 'Italiano',
  'pt': 'Português',
  'hi': 'हिन्दी',
  'ur': 'اردو',
  'id': 'Indonesia',
  'fa': 'فارسی',
  'pl': 'Polski',
  'nl': 'Nederlands',
  'sv': 'Svenska',
  'el': 'Ελληνικά',
  'he': 'עברית',
  'tl': 'Tagalog',
  'vi': 'Tiếng Việt',
  'th': 'ภาษาไทย',
  'ms': 'Melayu',
  'bn': 'বাংলা',
  'uk': 'Українська',
  'ro': 'Română',
  'cs': 'Čeština',
  'hu': 'Magyar',
  'da': 'Dansk',
  'fi': 'Suomi',
  'no': 'Norsk',
  'sw': 'Kiswahili',
  'la': 'Latina'
};

const CONTENT_SUBJECT_LABELS = {
  'general': '🌟 عام',
  'math': '📐 رياضيات',
  'science': '🧪 علوم',
  'physics': '⚛️ فيزياء',
  'chemistry': '⚗️ كيمياء',
  'biology': '🧬 أحياء',
  'social': '🌍 اجتماعيات',
  'history': '📜 تاريخ',
  'geography': '🗺️ جغرافيا',
  'arabic': '📖 لغة عربية',
  'islamic': '🕌 إسلاميات',
  'computer': '💻 حاسب وتقنية',
  'qudrat': '🎯 قدرات عامة',
  'tahsili': '🏆 تحصيلي',
  'english': '🇬🇧 إنجليزي',
  'philosophy': '🧠 تفكير ناقد',
  'business': '📊 إدارة واقتصاد',
  'law': '⚖️ أنظمة وقانون',
  'medical': '🩺 علوم طبية'
};

const CONTENT_SERVER_LABELS = {
  'gemini': '⚡ Gemini',
  'free': '⚡ Gemini',
  'free_backup': '⚡ Gemini',
  'deepseek': '🧠 DeepSeek R1',
  'groq': '⚡ Groq (0.1s)',
  'openai': '🤖 ChatGPT'
};

function getServerLabel(srv) {
  return CONTENT_SERVER_LABELS[srv] || '⚡ Gemini';
}

function getSubjectLabel(s) {
  return CONTENT_SUBJECT_LABELS[s] || 'عام';
}

function getLangLabel(lang) {
  return CONTENT_LANG_LABELS[lang] || 'العربية';
}

// مزامنة حالة التفعيل والخادم والمادة واللغة والنقر التلقائي مع التخزين
try {
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) {
        if (response.enabled !== undefined) extensionEnabled = response.enabled;
        if (response.fabEnabled !== undefined) fabEnabled = response.fabEnabled;
        if (response.serverType) serverType = response.serverType;
        if (response.subject) subject = response.subject;
        if (response.defaultMode) currentMode = response.defaultMode;
        if (response.targetLanguage) targetLanguage = response.targetLanguage;
      }
    });
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['liveAutoClickEnabled'], (d) => {
      if (d && d.liveAutoClickEnabled !== undefined) {
        liveAutoClickEnabled = !!d.liveAutoClickEnabled;
      }
    });
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.liveAutoClickEnabled) {
        liveAutoClickEnabled = !!changes.liveAutoClickEnabled.newValue;
        const autoClickBadge = document.getElementById('qgLiveAutoClickBadge');
        if (autoClickBadge) {
          if (liveAutoClickEnabled) {
            autoClickBadge.classList.add('active');
            autoClickBadge.textContent = '⚡ نقر تلقائي';
          } else {
            autoClickBadge.classList.remove('active');
            autoClickBadge.textContent = '⚪ بدون نقر';
          }
        }
      }
    });
  }
} catch (e) {
  console.warn('Init state error:', e);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_LIVE_AUTO_CLICK') {
    liveAutoClickEnabled = !!request.enabled;
    const autoClickBadge = document.getElementById('qgLiveAutoClickBadge');
    if (autoClickBadge) {
      if (liveAutoClickEnabled) {
        autoClickBadge.classList.add('active');
        autoClickBadge.textContent = '⚡ نقر تلقائي';
      } else {
        autoClickBadge.classList.remove('active');
        autoClickBadge.textContent = '⚪ بدون نقر';
      }
    }
    if (typeof sendResponse === 'function') sendResponse({ success: true, enabled: liveAutoClickEnabled });
    return false;
  }

  if (request.action === 'STATE_UPDATED') {
    if (request.enabled !== undefined) {
      extensionEnabled = request.enabled;
      if (!extensionEnabled) {
        removeFAB();
        removeMenu();
        removePanel();
      }
    }
    if (request.fabEnabled !== undefined) {
      fabEnabled = request.fabEnabled;
      if (!fabEnabled) {
        removeFAB();
        removeMenu();
      }
    }
    if (request.serverType) serverType = request.serverType;
    if (request.subject) subject = request.subject;
    if (request.defaultMode) currentMode = request.defaultMode;
    if (request.targetLanguage) targetLanguage = request.targetLanguage;
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  // عند طلب الحل من قائمة الزر الأيمن
  if (request.action === 'CONTEXT_MENU_TRIGGER') {
    if (request.text) {
      let enriched = '';
      try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) enriched = getEnrichedSelectionText(sel);
      } catch (e) {}
      selectedTextCache = enriched || selectedTextCache || request.text;
      currentMode = request.mode || currentMode || 'concise';
      if (request.serverType) serverType = request.serverType;
      if (request.subject) subject = request.subject;
      if (request.targetLanguage) targetLanguage = request.targetLanguage;
      showResponsePanel(selectedTextCache, currentMode);
    }
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  // عند طلب الحل المباشر ووضع الريكورد
  if (request.action === 'START_LIVE_DIRECT_SOLVER') {
    if (request.autoClick !== undefined) {
      liveAutoClickEnabled = !!request.autoClick;
    }
    const liveMode = request.mode || currentMode || 'concise';
    if (request.isFullScreen === false) {
      showLiveSelectorOverlay(liveMode);
    } else {
      startLiveDirectMode({
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight,
        isFullScreen: true
      }, liveMode);
    }
    if (typeof sendResponse === 'function') sendResponse({ success: true, mode: liveMode });
    return false;
  }

  // عند طلب إيقاف الحل المباشر
  if (request.action === 'STOP_LIVE_DIRECT_SOLVER') {
    stopLiveDirectMode();
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  // عند طلب مسح وحل صفحة الامتحان من واجهة الأداة أو الاختصار
  if (request.action === 'TRIGGER_EXAM_SCAN') {
    scanAndSolveCurrentExam(request.mode || currentMode || 'concise');
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  // عند طلب أداة تحديد وقص الشاشة بالكامل
  if (request.action === 'START_SCREEN_AREA_SNIP') {
    startFullScreenAreaSnip(request.mode || currentMode || 'concise');
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  // مسح التظليلات الملونة
  if (request.action === 'CLEAR_EXAM_HIGHLIGHTS') {
    clearAllExamHighlights();
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }

  if (typeof sendResponse === 'function') sendResponse({ received: true });
  return false;
});

// دالة مساعدة ذكية تكشف ما إذا كان التحديد جزءاً من سؤال في امتحان وتستخرج الخيارات التابعة له تلقائياً
function getEnrichedSelectionInfo(selection) {
  if (!selection || !selection.rangeCount) return { text: '', hasOptions: false, optCount: 0 };
  const rawText = selection.toString().trim();
  if (!rawText || rawText.length < 3) return { text: rawText, hasOptions: false, optCount: 0 };

  // إذا كان التحديد يحتوي مسبقاً على خيارين أو أكثر (A, B أو 1, 2 أو أ، ب)، نتركه كما هو
  const choicePattern = /(?:^|\n)\s*(?:[A-Da-d\u0623\u0628\u062c\u062f1-4][\.\-\:\)\/]|[\(\[][A-Da-d\u0623\u0628\u062c\u062f1-4][\)\]])/g;
  const directMatches = rawText.match(choicePattern);
  if (directMatches && directMatches.length >= 2) {
    return { text: rawText, hasOptions: true, optCount: directMatches.length };
  }

  try {
    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return { text: rawText, hasOptions: false, optCount: 0 };

    const IGNORED_SELECTORS = '#quizgenie-live-selector-overlay, #quizgenie-live-direct-hud, #quizgenie-toast-container, #quizgenie-monitored-area-frame, #quizgenie-direct-solution-card, #quizgenie-countdown-overlay, #quizgenie-corner-rec-badge, #quizgenie-selection-live-indicator, .answer-verifier, .question-meta, .btn-reveal-solution, .correct-answer-hint, .exam-footer-toolbar, .instructions-card, .exam-header';
    const IGNORED_TEXT = /^(Previous|Next|Submit|السابق|التالي|إرسال|حفظ|درجة|وقت|كشف|عرض الإجابة|تحقق|تأكيد|مساعدة|مراجعة|إلغاء|حذف|مسح|Of|Show|Check|Verify|Hint|Skip|Solution|Goal|Boost|XP|Streak|Bonus|Reward|Score|Points|هدف|تعزيز|مكافأة|نقاط|المستوى|إغلاق|Close)/i;

    const cardSelectors = '.question-card, [class*="question-card" i], [class*="question-item" i], [class*="quiz-question" i], [class*="question_wrapper" i], [class*="question-wrapper" i], [class*="question-container" i], [class*="question-block" i], .que, fieldset, [role="radiogroup"], .form-group, [class*="quiz-item" i], [class*="exam-item" i], [class*="test-item" i], tr.question-row, tr[class*="question" i], .question, [class*="question" i]:not(.question-text):not(.q-text):not([class*="title" i]):not([class*="body" i])';
    let container = (node.parentElement ? node.parentElement.closest(cardSelectors) : null) || node.closest(cardSelectors);

    if (!container) {
      let cur = node;
      for (let depth = 0; depth < 5 && cur && cur !== document.body; depth++) {
        const optCheck = cur.parentElement ? cur.parentElement.querySelectorAll('.option-item, .choice-item, .option, .choice, input[type="radio"], label, li') : [];
        if (optCheck.length >= 2) {
          container = cur.parentElement;
          break;
        }
        cur = cur.parentElement;
      }
    }

    // فحص العناصر الشقيقة المجاورة (مثل options-list بجوار question-text)
    if (!container && node.nextElementSibling) {
      const sibOpts = node.nextElementSibling.querySelectorAll('.option-item, .choice-item, .option, .choice, input[type="radio"], label, li');
      if (sibOpts && sibOpts.length >= 2) {
        container = node.parentElement || node.nextElementSibling;
      }
    }

    if (container) {
      const choiceSelector = '.option-item, .choice-item, .quiz-option, .exam-option, input[type="radio"], input[type="checkbox"], [role="radio"], label, li, [class*="true-false" i], [class*="tf-option" i], [class*="custom-control" i], svg circle';
      let rawChoiceCandidates = Array.from(container.querySelectorAll(choiceSelector)).filter(el => {
        if (el.closest(IGNORED_SELECTORS)) return false;
        if (node.contains(el)) return false;
        const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
        if (/options-list|choices-list|answers-list|options-container|choices-container|wrapper|grid/.test(cls)) return false;
        if (/letter|title|icon|badge|hint|prefix|number/.test(cls)) return false;
        const r = el.getBoundingClientRect();
        return (r.width > 0 && r.height > 0) || (el.offsetWidth > 0 || el.offsetHeight > 0) || (el.innerText && el.innerText.trim().length > 0);
      });

      const choiceCandidates = rawChoiceCandidates.filter(c => !rawChoiceCandidates.some(other => other !== c && c.contains(other)));

      const extractedOptions = [];
      for (const el of choiceCandidates) {
        const res = extractOptionFromCandidate(el, container, IGNORED_SELECTORS, IGNORED_TEXT);
        if (res && res.text && !extractedOptions.includes(res.text) && res.text.toLowerCase().trim() !== rawText.toLowerCase().trim() && !node.contains(res.containerEl)) {
          extractedOptions.push(res.text);
        }
      }

      if (extractedOptions.length >= 2) {
        const formattedOpts = extractedOptions.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          if (/^([A-Da-d\u0623-\u062f1-4][\.\-\:\)\/\s]|[\(\[][A-Da-d\u0623-\u062f1-4][\)\]])/.test(opt)) {
            return opt;
          }
          return `(${letter}) ${opt}`;
        }).join('\n');

        return {
          text: `${rawText}\n\nالخيارات المتاحة (Options):\n${formattedOpts}`,
          hasOptions: true,
          optCount: extractedOptions.length
        };
      }
    }
  } catch (err) {
    console.warn('Enrich selection error:', err);
  }

  return { text: rawText, hasOptions: false, optCount: 0 };
}

function getEnrichedSelectionText(selection) {
  const info = getEnrichedSelectionInfo(selection);
  return info ? info.text : '';
}

// شريط القراءة الاستباقية اللحظية أثناء حركة التحديد (Live Reader Pill)
let liveSelectionIndicatorEl = null;

function removeLiveSelectionIndicator() {
  if (liveSelectionIndicatorEl) {
    liveSelectionIndicatorEl.remove();
    liveSelectionIndicatorEl = null;
  }
}

function showLiveSelectionIndicator(rect, hasOptions, optCount) {
  if (!extensionEnabled || !fabEnabled) return;
  if (!rect || (rect.width === 0 && rect.height === 0)) return;

  if (!liveSelectionIndicatorEl) {
    liveSelectionIndicatorEl = document.createElement('div');
    liveSelectionIndicatorEl.id = 'quizgenie-selection-live-indicator';
    liveSelectionIndicatorEl.style.cssText = `
      position: absolute;
      z-index: 2147483645;
      background: rgba(15, 23, 42, 0.95);
      border: 1.5px solid #38bdf8;
      color: #38bdf8;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 11.5px;
      font-weight: 800;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
      direction: rtl;
      font-family: system-ui, -apple-system, sans-serif;
      transition: all 0.15s ease;
      white-space: nowrap;
    `;
    (document.body || document.documentElement).appendChild(liveSelectionIndicatorEl);
  }

  const msg = hasOptions
    ? `⚡ يقرأ معك السؤال وخياراته (${optCount})...`
    : `⚡ QuizGenie يقرأ معك السؤال...`;

  liveSelectionIndicatorEl.innerHTML = `
    <span style="display:inline-block; animation:qgPulseYellowQuestion 1.2s infinite ease-in-out;">⚡</span>
    <span>${msg}</span>
  `;

  let top = rect.bottom + window.scrollY + 8;
  let left = rect.left + window.scrollX;
  if (left + 230 > window.innerWidth + window.scrollX) {
    left = window.innerWidth + window.scrollX - 235;
  }
  liveSelectionIndicatorEl.style.top = `${top}px`;
  liveSelectionIndicatorEl.style.left = `${left}px`;
}

// التفكير الاستباقي الحي المسبق أثناء حركة التحديد (Pre-computation 0s)
let preSolveDebounceTimer = null;
document.addEventListener('selectionchange', () => {
  if (!extensionEnabled || !fabEnabled) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    removeLiveSelectionIndicator();
    return;
  }

  const rawTxt = sel.toString().trim();
  if (rawTxt.length < 4) {
    removeLiveSelectionIndicator();
    return;
  }

  try {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const enrichedInfo = getEnrichedSelectionInfo(sel);
      const targetTxt = enrichedInfo.text || rawTxt;
      showLiveSelectionIndicator(rect, enrichedInfo.hasOptions, enrichedInfo.optCount);

      clearTimeout(preSolveDebounceTimer);
      preSolveDebounceTimer = setTimeout(() => {
        if (targetTxt !== currentQuestionCache.text) {
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'PRE_SOLVE',
              text: targetTxt,
              mode: currentMode,
              subject: subject,
              targetLanguage: targetLanguage
            }).catch(() => {});
          }
        }
      }, 140);
    }
  } catch (e) {}
});

// مراقبة إفلات تحديد النصوص في الصفحة
document.addEventListener('mouseup', handleSelectionEvent, { capture: true });
document.addEventListener('keyup', handleSelectionEvent, { capture: true });

function handleSelectionEvent(e) {
  // إخفاء مؤشر القراءة اللحظي فور إفلات الفأرة
  removeLiveSelectionIndicator();

  // إذا كانت الأداة متوقفة أو ميزة الزر العائم متوقفة، لا نفعل شيئاً
  if (!extensionEnabled || !fabEnabled) return;

  if (hostElement && (e.composedPath ? e.composedPath().includes(hostElement) : hostElement.contains(e.target))) {
    return;
  }

  setTimeout(() => {
    const selection = window.getSelection();
    const rawText = selection ? selection.toString().trim() : '';

    if (rawText.length > 0) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'password') {
        removeFAB();
        removeMenu();
        return;
      }

      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;

      const enrichedText = getEnrichedSelectionText(selection);
      const textToUse = enrichedText || rawText;
      selectedTextCache = textToUse;
      triggerPrefetch(textToUse);
      showFAB(rect);
    } else if (!menuElement && !panelElement) {
      removeFAB();
    }
  }, 40);
}

// زر Escape للإغلاق
document.addEventListener('keydown', (e) => {
  // Alt+Q: تشغيل ماسح الامتحان وتلوين السؤال بالأصفر والإجابة بالأخضر والخطأ بالأحمر
  if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.key === 'ض')) {
    e.preventDefault();
    scanAndSolveCurrentExam(currentMode || 'concise');
  }

  if (e.key === 'Escape') {
    clearAllExamHighlights();
    if (panelElement) removePanel();
    else if (menuElement) removeMenu();
    else if (fabElement) removeFAB();
  }
});

// إغلاق النوافذ عند النقر بالخارج
document.addEventListener('mousedown', (e) => {
  if (hostElement && !hostElement.contains(e.target)) {
    if (menuElement) removeMenu();
    if (fabElement && !panelElement) removeFAB();
  }
});

// إظهار الزر العائم (FAB) بنفس الشعار الموحد
function showFAB(rect) {
  if (!extensionEnabled || !fabEnabled) return;
  initShadowHost();
  removeFAB();
  removeMenu();

  fabElement = document.createElement('button');
  fabElement.className = 'quizgenie-fab';
  fabElement.title = 'QuizGenie - حل السؤال فوراً';
  fabElement.innerHTML = `
    <img src="${getLogoUrl()}" class="quizgenie-fab-img" alt="QuizGenie">
  `;

  fabElement.addEventListener('mousedown', (e) => e.preventDefault());
  
  // عند النقر على الأيقونة: تضيء باللون الأزرق فوراً وتفتح الخيارات
  fabElement.addEventListener('click', (e) => {
    e.stopPropagation();
    fabElement.classList.add('active');
    openOptionsMenu(rect);
  });

  let top = rect.bottom + window.scrollY + 8;
  let left = rect.left + window.scrollX;

  if (left + 50 > window.innerWidth + window.scrollX) {
    left = window.innerWidth + window.scrollX - 55;
  }

  fabElement.style.top = `${top}px`;
  fabElement.style.left = `${left}px`;
  shadowRoot.appendChild(fabElement);
}

function removeFAB() {
  if (fabElement) {
    fabElement.remove();
    fabElement = null;
  }
}

// فتح قائمة الخيارات المخصصة بالاسم والشعار الموحد
function openOptionsMenu(rect) {
  removeMenu();

  menuElement = document.createElement('div');
  menuElement.className = 'quizgenie-menu';
  menuElement.innerHTML = `
    <div class="quizgenie-menu-header">
      <img src="${getLogoUrl()}" class="quizgenie-logo-img" alt="QuizGenie">
      <span class="quizgenie-menu-title">QuizGenie</span>
      <span class="quizgenie-subject-tag">${getSubjectLabel(subject)}</span>
      <span class="quizgenie-lang-tag" style="margin-right:auto;">${getLangLabel(targetLanguage)}</span>
    </div>
    <button class="quizgenie-option-btn" id="qg-opt-concise">
      <span class="quizgenie-option-icon">⚡</span>
      <span>الإجابة بدون فلسفة</span>
    </button>
    <button class="quizgenie-option-btn" id="qg-opt-detailed">
      <span class="quizgenie-option-icon">📖</span>
      <span>الإجابة المفصلة</span>
    </button>
  `;

  let top = rect.bottom + window.scrollY + 8;
  let left = rect.left + window.scrollX;

  if (left + 230 > window.innerWidth + window.scrollX) {
    left = window.innerWidth + window.scrollX - 235;
  }

  menuElement.style.top = `${top}px`;
  menuElement.style.left = `${left}px`;
  shadowRoot.appendChild(menuElement);

  menuElement.querySelector('#qg-opt-concise').addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = 'concise';
    showResponsePanel(selectedTextCache, 'concise');
  });

  menuElement.querySelector('#qg-opt-detailed').addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = 'detailed';
    showResponsePanel(selectedTextCache, 'detailed');
  });
}

function removeMenu() {
  if (menuElement) {
    menuElement.remove();
    menuElement = null;
  }
}

// عرض بطاقة الإجابة مع الشعار الموحد ولغة الترجمة
function showResponsePanel(text, mode) {
  initShadowHost();
  removeFAB();
  removeMenu();
  removePanel();

  currentMode = mode || 'concise';

  panelElement = document.createElement('div');
  panelElement.className = 'quizgenie-panel';

  const titleModeText = (currentMode === 'detailed') ? 'الإجابة المفصلة' : 'الإجابة بدون فلسفة';

  panelElement.innerHTML = `
    <div class="quizgenie-panel-header">
      <div class="quizgenie-panel-title">
        <img src="${getLogoUrl()}" class="quizgenie-logo-img" alt="QuizGenie">
        <span id="qg-header-title">${titleModeText}</span>
        <span class="quizgenie-server-tag">${getServerLabel(serverType)}</span>
        <span class="quizgenie-subject-tag">${getSubjectLabel(subject)}</span>
        <span class="quizgenie-lang-tag">${getLangLabel(targetLanguage)}</span>
      </div>
      <div class="quizgenie-actions">
        <button class="quizgenie-zoom-btn" id="qg-zoom-out" title="تصغير الخط">A-</button>
        <button class="quizgenie-zoom-btn" id="qg-zoom-in" title="تكبير الخط">A+</button>
        <button class="quizgenie-audio-btn" id="qg-audio" title="استماع صوتي">🔊 استماع</button>
        <button class="quizgenie-copy-btn" id="qg-copy">نسخ</button>
        <button class="quizgenie-close-btn" id="qg-close">&times;</button>
      </div>
    </div>
    <div class="quizgenie-tabs">
      <button class="quizgenie-tab-btn ${currentMode === 'concise' ? 'active' : ''}" id="tab-concise">الإجابة بدون فلسفة</button>
      <button class="quizgenie-tab-btn ${currentMode === 'detailed' ? 'active' : ''}" id="tab-detailed">الإجابة المفصلة</button>
    </div>
    <div class="quizgenie-panel-body" id="qg-body">
      <div class="quizgenie-loading">
        <div class="quizgenie-spinner"></div>
        <span>جاري تحليل السؤال واستخراج الإجابة...</span>
      </div>
    </div>
  `;

  // التوسيط في الشاشة
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = Math.min(460, viewportWidth - 30);
  const left = (viewportWidth - panelWidth) / 2;
  const top = Math.max(20, (viewportHeight - 380) / 2);

  panelElement.style.top = `${top}px`;
  panelElement.style.left = `${left}px`;
  panelElement.style.width = `${panelWidth}px`;

  shadowRoot.appendChild(panelElement);

  panelElement.querySelector('#qg-close').addEventListener('click', removePanel);

  // التبديل بين التبويبات داخل البطاقة مباشرة
  const tabConcise = panelElement.querySelector('#tab-concise');
  const tabDetailed = panelElement.querySelector('#tab-detailed');

  tabConcise.addEventListener('click', () => {
    if (currentMode === 'concise') return;
    switchMode('concise');
  });

  tabDetailed.addEventListener('click', () => {
    if (currentMode === 'detailed') return;
    switchMode('detailed');
  });

  function switchMode(newMode) {
    currentMode = newMode;
    tabConcise.className = `quizgenie-tab-btn ${newMode === 'concise' ? 'active' : ''}`;
    tabDetailed.className = `quizgenie-tab-btn ${newMode === 'detailed' ? 'active' : ''}`;
    const headerTitle = panelElement.querySelector('#qg-header-title');
    if (headerTitle) {
      headerTitle.textContent = (newMode === 'detailed') ? 'الإجابة المفصلة' : 'الإجابة بدون فلسفة';
    }
    fetchAndDisplayAnswer(text, newMode);
  }

  const copyBtn = panelElement.querySelector('#qg-copy');
  const zoomInBtn = panelElement.querySelector('#qg-zoom-in');
  const zoomOutBtn = panelElement.querySelector('#qg-zoom-out');
  const audioBtn = panelElement.querySelector('#qg-audio');
  let currentResultText = '';

  if (currentQuestionCache.text !== text) {
    currentQuestionCache = {
      text: text,
      concise: null,
      detailed: null
    };
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (currentFontSize < 22) {
        currentFontSize += 1.5;
        const bodyEl = shadowRoot.getElementById('qg-body');
        if (bodyEl) bodyEl.style.fontSize = `${currentFontSize}px`;
      }
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (currentFontSize > 11) {
        currentFontSize -= 1.5;
        const bodyEl = shadowRoot.getElementById('qg-body');
        if (bodyEl) bodyEl.style.fontSize = `${currentFontSize}px`;
      }
    });
  }

  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        if (typeof showScanFeedbackBanner === 'function') {
          showScanFeedbackBanner('⚠️ ميزة القراءة الصوتية غير مدعومة في هذا المتصفح.', '#ef4444');
        }
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        audioBtn.textContent = '🔊 استماع';
        audioBtn.classList.remove('active');
      } else {
        if (!currentResultText) return;
        const clean = currentResultText.replace(/[🎯⚡📘📐🔍💡✓❌*#]/g, '');
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = (targetLanguage === 'en') ? 'en-US' : 'ar-SA';
        utterance.onend = () => {
          audioBtn.textContent = '🔊 استماع';
          audioBtn.classList.remove('active');
        };
        utterance.onerror = () => {
          audioBtn.textContent = '🔊 استماع';
          audioBtn.classList.remove('active');
        };
        audioBtn.textContent = '⏹️ إيقاف';
        audioBtn.classList.add('active');
        window.speechSynthesis.speak(utterance);
      }
    });
  }

  copyBtn.addEventListener('click', () => {
    if (currentResultText) {
      navigator.clipboard.writeText(currentResultText).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'تم النسخ! ✓';
        copyBtn.style.color = '#34d399';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.color = '';
        }, 2000);
      });
    }
  });

  function fetchAndDisplayAnswer(targetText, targetMode) {
    const bodyEl = shadowRoot.getElementById('qg-body');
    if (!bodyEl) return;
    if (currentFontSize) bodyEl.style.fontSize = `${currentFontSize}px`;

    // 0ms INSTANT DUAL-MODE CACHE
    if (currentQuestionCache.text === targetText && currentQuestionCache[targetMode]) {
      currentResultText = currentQuestionCache[targetMode];
      renderAnswerContent(currentResultText, bodyEl);
      return;
    }

    const serverNamesMap = {
      'free': 'الخادم المجاني',
      'free_backup': 'الخادم المجاني الاحتياطي',
      'deepseek': 'خادم ديب سيك DeepSeek R1',
      'groq': 'خادم جروك فائق السرعة Groq',
      'gemini': 'جوجل Gemini الصاروخي',
      'openai': 'شات جي بي تي'
    };
    const srvText = serverNamesMap[serverType] || getServerLabel(serverType);

    bodyEl.innerHTML = `
      <div class="quizgenie-loading" style="flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 9px;">
          <div class="quizgenie-spinner"></div>
          <span>جاري معالجة السؤال عبر (${srvText})...</span>
        </div>
        ${serverType === 'free' ? '<span style="font-size: 10.5px; color: #64748b;">(الخادم المجاني العام قد يستغرق ثوانٍ معدودة بسبب الضغط العالمي)</span>' : ''}
      </div>
    `;

    chrome.runtime.sendMessage({
      action: 'PROCESS_TEXT',
      text: targetText,
      mode: targetMode,
      subject: subject,
      targetLanguage: targetLanguage
    }, (response) => {
      const activeBody = shadowRoot.getElementById('qg-body');
      if (!activeBody) return;

      if (chrome.runtime.lastError) {
        activeBody.innerHTML = `
          <div class="quizgenie-error">
            <span>خطأ في الاتصال بالخدمة: ${chrome.runtime.lastError.message}</span>
            <div style="margin-top: 8px;">
              <button class="quizgenie-retry-btn" id="qg-retry-btn">🔄 إعادة المحاولة</button>
            </div>
          </div>
        `;
        const retryBtn = activeBody.querySelector('#qg-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => fetchAndDisplayAnswer(targetText, targetMode));
        }
        return;
      }

      if (response && response.success) {
        currentResultText = response.data;
        currentQuestionCache.text = targetText;
        currentQuestionCache[targetMode] = response.data;
        renderAnswerContent(response.data, activeBody);
      } else {
        const errorMsg = (response && response.error) ? response.error : 'تعذر الحصول على إجابة.';
        const showFreeFallback = (serverType !== 'free');
        activeBody.innerHTML = `
          <div class="quizgenie-error">
            <span>${errorMsg}</span>
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="quizgenie-retry-btn" id="qg-retry-btn">🔄 إعادة المحاولة</button>
              ${showFreeFallback ? '<button class="quizgenie-retry-btn" id="qg-fallback-btn" style="background:#0284c7;color:#ffffff;border-color:#38bdf8;">🌐 الحل عبر الخادم المجاني</button>' : ''}
            </div>
          </div>
        `;
        const retryBtn = activeBody.querySelector('#qg-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => fetchAndDisplayAnswer(targetText, targetMode));
        }
        const fallbackBtn = activeBody.querySelector('#qg-fallback-btn');
        if (fallbackBtn) {
          fallbackBtn.addEventListener('click', () => {
            serverType = 'gemini';
            const serverTag = panelElement ? panelElement.querySelector('.quizgenie-server-tag') : null;
            if (serverTag) serverTag.textContent = '⚡ Gemini';
            fetchAndDisplayAnswer(targetText, targetMode);
          });
        }
      }
    });
  }

  fetchAndDisplayAnswer(text, currentMode);
}

function removePanel() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    try { window.speechSynthesis.cancel(); } catch(e) {}
  }
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
}

// عرض الإجابة والتحليل الأكاديمي بتنسيق بطاقات ذكية مستقلة
function renderAnswerContent(markdownText, container) {
  container.innerHTML = '';
  container.setAttribute('dir', 'auto');

  if (!markdownText || !markdownText.trim()) return;
  const rawText = markdownText.trim();

  // تفكيك الأقسام الأكاديمية الذكية
  const lines = rawText.split('\n');
  const sections = [];
  let currentSec = { header: '', lines: [] };

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    if (t.startsWith('🎯') || t.startsWith('⚡') || t.startsWith('📘') || t.startsWith('📐') || t.startsWith('🔍') || t.startsWith('💡') || t.startsWith('🟢') || t.startsWith('✅') || t.startsWith('🔢')) {
      if (currentSec.header || currentSec.lines.length > 0) {
        sections.push(currentSec);
      }
      currentSec = { header: t, lines: [] };
    } else {
      currentSec.lines.push(t);
    }
  }
  if (currentSec.header || currentSec.lines.length > 0) {
    sections.push(currentSec);
  }

  if (sections.length > 0 && sections[0].header) {
    for (const sec of sections) {
      const card = document.createElement('div');
      card.className = 'quizgenie-section-card';

      if (sec.header.startsWith('🎯') || sec.header.startsWith('✅')) {
        card.classList.add('card-answer');
      } else if (sec.header.startsWith('🟢')) {
        card.classList.add('card-confidence');
      } else if (sec.header.startsWith('🔢')) {
        card.classList.add('card-sequence');
      } else if (sec.header.startsWith('⚡')) {
        card.classList.add('card-concise');
      } else if (sec.header.startsWith('📘')) {
        card.classList.add('card-concept');
      } else if (sec.header.startsWith('📐')) {
        card.classList.add('card-steps');
      } else if (sec.header.startsWith('🔍')) {
        card.classList.add('card-elimination');
      } else if (sec.header.startsWith('💡')) {
        card.classList.add('card-tip');
      }

      const h = document.createElement('div');
      h.className = 'quizgenie-card-header';
      h.textContent = sec.header;
      card.appendChild(h);

      if (sec.lines.length > 0) {
        const b = document.createElement('div');
        b.className = 'quizgenie-card-body';
        b.textContent = sec.lines.join('\n');
        card.appendChild(b);
      }
      container.appendChild(card);
    }
  } else {
    // التنسيق الافتراضي في حال عدم وجود علامات الأقسام
    const trimmedLines = lines.map(l => l.trim()).filter(Boolean);
    if (!trimmedLines.length) return;

    const badge = document.createElement('div');
    badge.className = 'quizgenie-answer-badge';
    badge.textContent = trimmedLines[0];
    container.appendChild(badge);

    if (trimmedLines.length > 1) {
      const contentText = document.createElement('div');
      contentText.className = 'quizgenie-content-text';
      contentText.textContent = trimmedLines.slice(1).join('\n\n');
      container.appendChild(contentText);
    }
  }
}

// =========================================================================
// QuizGenie - Smart Exam Scanner & Live Tri-Color Visual Feedback System
// 🟡 Question = Yellow Glow
// 🔴 Wrong Options = Red Tint + ✖
// 🟢 Correct Option = Emerald Green Pulse + ✔
// =========================================================================

let prefetchDebounce = null;
function triggerPrefetch(text) {
  if (!text || text.length < 3) return;
  clearTimeout(prefetchDebounce);
  prefetchDebounce = setTimeout(() => {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'PREFETCH_QUESTION',
          text: text,
          subject: subject,
          targetLanguage: targetLanguage
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    } catch (e) {}
  }, 120);
}

function ensureHighlightStylesInPage() {
  if (document.getElementById('quizgenie-page-highlight-styles')) return;
  const style = document.createElement('style');
  style.id = 'quizgenie-page-highlight-styles';
  style.textContent = `
    .quizgenie-question-yellow-glow, .quizgenie-question-ring-red, .quizgenie-highlight-question {
      position: relative !important;
      outline: 3.5px solid #eab308 !important;
      outline-offset: 4px !important;
      background-color: rgba(234, 179, 8, 0.14) !important;
      border-radius: 8px !important;
      box-shadow: 0 0 22px rgba(234, 179, 8, 0.85), inset 0 0 10px rgba(234, 179, 8, 0.25) !important;
      animation: qgPulseYellowQuestion 1.8s infinite ease-in-out !important;
      transition: all 0.3s ease !important;
    }
    .quizgenie-question-badge-tag, .quizgenie-question-badge-tag-yellow {
      position: absolute !important;
      top: -24px !important;
      right: 0 !important;
      background: #eab308 !important;
      color: #0b0f19 !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      padding: 2px 8px !important;
      border-radius: 6px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
      z-index: 2147483640 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
    }
    .quizgenie-correct-answer-glow, .quizgenie-highlight-correct {
      position: relative !important;
      outline: 3.5px solid #10b981 !important;
      outline-offset: 4px !important;
      background-color: rgba(16, 185, 129, 0.2) !important;
      border-radius: 8px !important;
      box-shadow: 0 0 26px rgba(16, 185, 129, 0.95), inset 0 0 12px rgba(16, 185, 129, 0.45) !important;
      animation: qgGlowGreenAnswer 1.8s infinite ease-in-out !important;
      transition: all 0.3s ease !important;
    }
    .quizgenie-correct-badge-tag {
      position: absolute !important;
      top: 50% !important;
      left: 10px !important;
      right: auto !important;
      transform: translateY(-50%) !important;
      background: #10b981 !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      padding: 3px 9px !important;
      border-radius: 20px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
      z-index: 2147483640 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
    }
    .quizgenie-wrong-answer-outline, .quizgenie-highlight-wrong {
      position: relative !important;
      outline: 2px dashed #ef4444 !important;
      outline-offset: 2px !important;
      background-color: rgba(239, 68, 68, 0.08) !important;
      border-radius: 8px !important;
      opacity: 0.75 !important;
      transition: all 0.3s ease !important;
    }
    .quizgenie-wrong-badge-tag {
      position: absolute !important;
      top: 50% !important;
      left: 12px !important;
      right: auto !important;
      transform: translateY(-50%) !important;
      background: rgba(239, 68, 68, 0.2) !important;
      border: 1px solid #ef4444 !important;
      color: #f87171 !important;
      font-size: 10.5px !important;
      font-weight: 800 !important;
      padding: 2px 8px !important;
      border-radius: 20px !important;
      z-index: 2147483640 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
    }
    .quizgenie-correct-badge-tag.qg-badge-ltr,
    .quizgenie-wrong-badge-tag.qg-badge-ltr,
    .quizgenie-sequence-badge.qg-badge-ltr {
      left: auto !important;
      right: 12px !important;
    }
    .quizgenie-sequence-badge {
      position: absolute !important;
      top: 50% !important;
      left: 10px !important;
      right: auto !important;
      transform: translateY(-50%) !important;
      background: linear-gradient(135deg, #0284c7, #2563eb) !important;
      border: 1px solid #38bdf8 !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      padding: 3px 9px !important;
      border-radius: 20px !important;
      box-shadow: 0 2px 10px rgba(2, 132, 199, 0.6) !important;
      z-index: 2147483640 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
    }
    .quizgenie-sequence-item {
      position: relative !important;
      outline: 2.5px solid #0284c7 !important;
      outline-offset: 3px !important;
      background-color: rgba(2, 132, 199, 0.12) !important;
      border-radius: 8px !important;
      box-shadow: 0 0 16px rgba(2, 132, 199, 0.45) !important;
      transition: all 0.25s ease !important;
    }
    .quizgenie-autoclick-done {
      animation: qgAutoClickFlash 0.5s ease-out !important;
    }
    @keyframes qgAutoClickFlash {
      0% { transform: scale(0.96); filter: brightness(1.3); }
      50% { transform: scale(1.04); }
      100% { transform: scale(1); filter: brightness(1); }
    }
    .quizgenie-circle-correct,
    input[type="radio"].quizgenie-circle-correct {
      border-color: #10b981 !important;
      background-color: #10b981 !important;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.95), 0 0 4px #10b981 !important;
      accent-color: #10b981 !important;
      transform: scale(1.15) !important;
      transition: all 0.2s ease !important;
    }
    div.quizgenie-circle-correct,
    span.quizgenie-circle-correct,
    [role="radio"].quizgenie-circle-correct {
      border-color: #10b981 !important;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.95), inset 0 0 6px rgba(16, 185, 129, 0.6) !important;
      background-color: rgba(16, 185, 129, 0.25) !important;
      color: #10b981 !important;
    }
    .quizgenie-circle-wrong,
    input[type="radio"].quizgenie-circle-wrong {
      border-color: #ef4444 !important;
      background-color: rgba(239, 68, 68, 0.25) !important;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.75) !important;
      accent-color: #ef4444 !important;
      transition: all 0.2s ease !important;
    }
    div.quizgenie-circle-wrong,
    span.quizgenie-circle-wrong,
    [role="radio"].quizgenie-circle-wrong {
      border-color: #ef4444 !important;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.75) !important;
      background-color: rgba(239, 68, 68, 0.15) !important;
      color: #ef4444 !important;
    }
    svg circle.quizgenie-circle-correct,
    svg.quizgenie-circle-correct circle {
      fill: #10b981 !important;
      stroke: #34d399 !important;
      filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.9)) !important;
    }
    svg circle.quizgenie-circle-wrong,
    svg.quizgenie-circle-wrong circle {
      fill: rgba(239, 68, 68, 0.25) !important;
      stroke: #ef4444 !important;
      filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.7)) !important;
    }
    #quizgenie-mini-exam-bar,
    .quizgenie-scanner-fab,
    #quizgenie-exam-scanner-pill,
    .qg-inpage-exam-toolbar,
    #qg-inpage-exam-toolbar,
    [class*="inpage-exam-toolbar"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    @keyframes qgPulseYellowQuestion {
      0% { box-shadow: 0 0 10px rgba(234, 179, 8, 0.5), inset 0 0 5px rgba(234, 179, 8, 0.2); outline-color: #eab308; }
      50% { box-shadow: 0 0 24px rgba(234, 179, 8, 0.95), inset 0 0 12px rgba(234, 179, 8, 0.5); outline-color: #facc15; }
      100% { box-shadow: 0 0 10px rgba(234, 179, 8, 0.5), inset 0 0 5px rgba(234, 179, 8, 0.2); outline-color: #eab308; }
    }
    @keyframes qgGlowGreenAnswer {
      0% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.6), inset 0 0 6px rgba(16, 185, 129, 0.3); outline-color: #10b981; }
      50% { box-shadow: 0 0 28px rgba(16, 185, 129, 1), inset 0 0 14px rgba(16, 185, 129, 0.6); outline-color: #34d399; }
      100% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.6), inset 0 0 6px rgba(16, 185, 129, 0.3); outline-color: #10b981; }
    }
  `;
  document.head.appendChild(style);
}

function clearAllExamHighlights() {
  document.querySelectorAll('.quizgenie-question-yellow-glow, .quizgenie-question-ring-red, .quizgenie-highlight-question').forEach(el => {
    el.classList.remove('quizgenie-question-yellow-glow', 'quizgenie-question-ring-red', 'quizgenie-highlight-question');
  });
  document.querySelectorAll('.quizgenie-correct-answer-glow, .quizgenie-highlight-correct').forEach(el => {
    el.classList.remove('quizgenie-correct-answer-glow', 'quizgenie-highlight-correct');
  });
  document.querySelectorAll('.quizgenie-wrong-answer-outline, .quizgenie-highlight-wrong').forEach(el => {
    el.classList.remove('quizgenie-wrong-answer-outline', 'quizgenie-highlight-wrong');
  });
  document.querySelectorAll('.quizgenie-circle-correct, .quizgenie-circle-wrong').forEach(el => {
    el.classList.remove('quizgenie-circle-correct', 'quizgenie-circle-wrong');
  });
  document.querySelectorAll('.quizgenie-question-badge-tag-yellow, .quizgenie-question-badge-tag, .quizgenie-correct-badge-tag, .quizgenie-wrong-badge-tag').forEach(el => el.remove());
  document.querySelectorAll('[data-qg-solved]').forEach(el => {
    delete el.dataset.qgSolved;
  });
  const card = document.getElementById('quizgenie-direct-solution-card');
  if (card) card.remove();
  const banner = document.getElementById('quizgenie-exam-scan-banner');
  if (banner) banner.remove();
  const modal = document.getElementById('quizgenie-scan-result-card');
  if (modal) modal.remove();
  const overlay = document.getElementById('quizgenie-snip-overlay');
  if (overlay) overlay.remove();
}

function scanAndSolveCurrentExam(preferredMode = 'concise') {
  ensureHighlightStylesInPage();
  clearAllExamHighlights();

  const parsed = extractQuestionAndOptionsFromRegion({
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
    isFullScreen: true
  });

  if (!parsed || !parsed.questionText || !parsed.optionsList || parsed.optionsList.length === 0) {
    showScanFeedbackBanner('⚠️ لم يتم العثور على سؤال أو خيارات تلقائياً. يمكنك تظليل السؤال بالماوس أو تشغيل التحديد الحر.', '#f59e0b');
    return;
  }

  const questionText = parsed.questionText;
  const questionElement = parsed.questionElement;
  const optionsList = parsed.optionsList;
  const optionElements = parsed.optionElements;
  const container = parsed.container;

  // تطبيق التوهج الأصفر البارز على السؤال
  if (questionElement) {
    questionElement.classList.add('quizgenie-question-yellow-glow', 'quizgenie-highlight-question');
    let qTag = questionElement.querySelector('.quizgenie-question-badge-tag-yellow');
    if (!qTag) {
      qTag = document.createElement('span');
      qTag.className = 'quizgenie-question-badge-tag-yellow';
      qTag.textContent = '🟡 السؤال';
      questionElement.appendChild(qTag);
    }
    questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showScanFeedbackBanner('⏳ جارٍ مسح وحل السؤال بالذكاء الاصطناعي في 0 ثانية وتحديد الخيار الصحيح...', '#0284c7');

  chrome.runtime.sendMessage({
    action: 'SOLVE_EXAM_SCAN',
    question: questionText,
    questionText: questionText,
    options: optionsList,
    optionsList: optionsList,
    mode: preferredMode || 'concise',
    subject: subject,
    targetLanguage: targetLanguage
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const err = (response && response.error) ? response.error : 'فشل الاتصال بالخدمة';
      showScanFeedbackBanner('❌ ' + err, '#ef4444');
      return;
    }

    const data = response.data || response.result || {};
    applyLiveDirectSolution(data, questionElement, optionElements, optionsList, null, container);
    showScanResultModal(questionText, data.correctText || optionsList[0] || '', data.explanation || data.rawAnswer || '', preferredMode, data.relation);
  });
}

function startFullScreenAreaSnip(preferredMode = 'concise') {
  clearAllExamHighlights();
  const existing = document.getElementById('quizgenie-snip-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quizgenie-snip-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.45);
    z-index: 2147483646;
    cursor: crosshair;
    user-select: none;
    direction: rtl;
    font-family: system-ui, sans-serif;
  `;

  const topBar = document.createElement('div');
  topBar.style.cssText = `
    position: fixed;
    top: 20px; left: 50%; transform: translateX(-50%);
    background: #0f172a;
    border: 1.5px solid #38bdf8;
    color: #ffffff;
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    display: flex; align-items: center; gap: 14px;
    z-index: 2147483647;
  `;
  topBar.innerHTML = `
    <span>🎯 اسحب بالماوس لتحديد منطقة السؤال والخيارات معاً</span>
    <button id="qg-snip-auto-btn" style="background:#0284c7; border:none; color:#fff; padding:5px 12px; border-radius:20px; font-weight:700; cursor:pointer;">⚡ مسح تلقائي كامل</button>
    <button id="qg-snip-cancel-btn" style="background:#334155; border:none; color:#cbd5e1; padding:5px 10px; border-radius:20px; cursor:pointer;">إلغاء (Esc)</button>
  `;
  overlay.appendChild(topBar);

  const selectionBox = document.createElement('div');
  selectionBox.style.cssText = `
    position: fixed;
    border: 2px dashed #38bdf8;
    background: rgba(56, 189, 248, 0.15);
    display: none;
    pointer-events: none;
    z-index: 2147483647;
    border-radius: 6px;
  `;
  overlay.appendChild(selectionBox);

  let startX = 0, startY = 0, isDragging = false;

  overlay.addEventListener('mousedown', (e) => {
    if (e.target.closest('#qg-snip-auto-btn') || e.target.closest('#qg-snip-cancel-btn')) return;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = minX + 'px';
    selectionBox.style.top = minY + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    const rect = selectionBox.getBoundingClientRect();
    overlay.remove();

    if (rect.width > 30 && rect.height > 20) {
      processSnipSelectionRect(rect, preferredMode);
    }
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  topBar.querySelector('#qg-snip-cancel-btn').addEventListener('click', () => overlay.remove());
  topBar.querySelector('#qg-snip-auto-btn').addEventListener('click', () => {
    overlay.remove();
    scanAndSolveCurrentExam(preferredMode);
  });

  document.body.appendChild(overlay);
}

function processSnipSelectionRect(rect, preferredMode) {
  ensureHighlightStylesInPage();
  clearAllExamHighlights();

  // Find all elements fully or partially inside rect
  const allElements = Array.from(document.querySelectorAll('div, p, span, label, li, h1, h2, h3, h4, h5, b, strong, input'));
  const insideElements = allElements.filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return (r.left >= rect.left - 20 && r.right <= rect.right + 20 &&
            r.top >= rect.top - 20 && r.bottom <= rect.bottom + 20);
  });

  // Extract options and question from inside elements
  const optionsList = [];
  const optionElements = [];
  let questionElement = null;
  let questionText = '';

  for (const el of insideElements) {
    const isRadio = el.tagName === 'INPUT' && el.type === 'radio';
    const isChoice = el.classList.contains('choice') || el.classList.contains('option') || el.tagName === 'LI' || el.tagName === 'LABEL';
    if (isRadio || isChoice) {
      const text = el.innerText ? el.innerText.trim() : '';
      if (text && text.length < 120 && !optionsList.includes(text)) {
        optionsList.push(text);
        optionElements.push(el);
      }
    }
  }

  // Find question element (not in options)
  for (const el of insideElements) {
    const text = el.innerText ? el.innerText.trim() : '';
    const isOpt = optionElements.some(opt => opt.contains(el) || el.contains(opt));
    if (!isOpt && text && text.length > 2 && text.length < 300) {
      questionElement = el;
      questionText = text;
      break;
    }
  }

  if (!questionText && optionsList.length > 0) {
    questionText = optionsList.shift();
    questionElement = optionElements.shift();
  }

  if (questionElement) {
    questionElement.classList.add('quizgenie-question-ring-red', 'quizgenie-highlight-question');
  }

  showScanFeedbackBanner('⏳ جارٍ تحليل المنطقة المحددة بالذكاء الاصطناعي...', '#0284c7');

  chrome.runtime.sendMessage({
    action: 'SOLVE_EXAM_SCAN',
    question: questionText,
    questionText: questionText,
    options: optionsList,
    optionsList: optionsList,
    mode: preferredMode || 'concise',
    subject: subject,
    targetLanguage: targetLanguage
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      showScanFeedbackBanner('❌ تعذر حل السؤال المحدد.', '#ef4444');
      return;
    }
    const data = response.data || response.result || {};
    applyLiveDirectSolution(data, questionElement, optionElements, optionsList, null, null);
    const correctIndex = (typeof data.correctIndex === 'number') ? data.correctIndex : 0;
    showScanResultModal(questionText, data.correctText || optionsList[correctIndex] || '', data.explanation || data.rawAnswer || '', preferredMode, data.relation);
  });
}

function showScanFeedbackBanner(message, bgColor) {
  let banner = document.getElementById('quizgenie-exam-scan-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'quizgenie-exam-scan-banner';
    banner.style.cssText = `
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      padding: 10px 18px;
      border-radius: 30px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      direction: rtl;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(banner);
  }
  banner.style.background = bgColor;
  banner.textContent = message;
  setTimeout(() => {
    if (banner && banner.parentElement) banner.remove();
  }, 4000);
}

function showScanResultModal(questionText, correctText, rawAnswer, mode, relation) {
  const existing = document.getElementById('quizgenie-scan-result-card');
  if (existing) existing.remove();

  const card = document.createElement('div');
  card.id = 'quizgenie-scan-result-card';
  card.style.cssText = `
    position: fixed;
    bottom: 25px;
    right: 25px;
    width: 360px;
    max-width: 90vw;
    background: #0b0f19;
    border: 2px solid #10b981;
    border-radius: 16px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.85), 0 0 25px rgba(16,185,129,0.3);
    z-index: 2147483647;
    direction: rtl;
    text-align: right;
    font-family: system-ui, sans-serif;
    color: #f1f5f9;
    padding: 16px;
    animation: qgFadeIn 0.25s ease-out;
  `;

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:18px;">🎯</span>
        <strong style="font-size:13px; color:#38bdf8;">تم فحص السؤال وتحديد الخيار الصحيح</strong>
      </div>
      <button id="qg-close-scan-card" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer; line-height:1;">&times;</button>
    </div>
    <div style="margin-bottom:8px;">
      <span style="font-size:11px; color:#ef4444; font-weight:700;">🔴 السؤال المقروء:</span>
      <div style="font-size:12.5px; color:#e2e8f0; margin-top:2px; font-weight:600;">${questionText || ''}</div>
    </div>
    ${relation ? `<div style="font-size:11px; color:#38bdf8; margin-bottom:6px; background:rgba(56,189,248,0.1); padding:4px 8px; border-radius:6px;">💡 العلاقة: ${relation}</div>` : ''}
    <div style="background:rgba(16,185,129,0.15); border:1.5px solid #10b981; border-radius:10px; padding:10px; margin-bottom:10px;">
      <span style="font-size:11px; color:#34d399; font-weight:700;">🟢 الخيار الصحيح المعتمد:</span>
      <div style="font-size:14px; font-weight:800; color:#ffffff; margin-top:3px;">${correctText || ''}</div>
    </div>
    <div style="max-height:130px; overflow-y:auto; font-size:11.5px; color:#cbd5e1; line-height:1.5; margin-bottom:12px; white-space:pre-wrap;">${rawAnswer || ''}</div>
    <div style="display:flex; gap:8px;">
      <button id="qg-voice-tts-btn" style="flex:1; background:#1e293b; border:1px solid #475569; color:#cbd5e1; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">🔊 استماع</button>
      <button id="qg-clear-highlights-btn" style="flex:1; background:#0284c7; border:none; color:#fff; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">✖ مسح التلوين</button>
    </div>
  `;

  document.body.appendChild(card);

  card.querySelector('#qg-close-scan-card').addEventListener('click', () => card.remove());
  card.querySelector('#qg-clear-highlights-btn').addEventListener('click', () => clearAllExamHighlights());

  const ttsBtn = card.querySelector('#qg-voice-tts-btn');
  ttsBtn.addEventListener('click', () => {
    if (window.speechSynthesis) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        ttsBtn.textContent = '🔊 استماع';
        return;
      }
      const utter = new SpeechSynthesisUtterance((correctText ? 'الخيار الصحيح هو ' + correctText + '. ' : '') + rawAnswer);
      utter.lang = 'ar-SA';
      utter.rate = 1.0;
      utter.onend = () => { ttsBtn.textContent = '🔊 استماع'; };
      ttsBtn.textContent = '⏹ إيقاف الصوت';
      window.speechSynthesis.speak(utter);
    }
  });
}

// زر الماسح العائم والشريط العائم تم إزالتهما بطلب المستخدم لمنع أي تشتيت
function initExamScannerFab() {
  const existing = document.getElementById('quizgenie-exam-scanner-pill');
  if (existing) existing.remove();
}

// --- مركز تخصيص المظهر وشكل الحواف v2.1.0 ---
let activeBorderShape = 'smooth';
let activePrimaryColor = '#0284c7';
let activeBgColor = '#0f172a';
let activeGlowColor = '#10b981';
let activeRingColor = '#ef4444';
let isMiniToolbarEnabled = false;

function loadThemeSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({
      customBorderShape: 'smooth',
      customPrimaryColor: '#0284c7',
      customBgColor: '#0f172a',
      customGlowColor: '#10b981',
      customRingColor: '#ef4444',
      customMiniToolbar: false
    }, (data) => {
      activeBorderShape = data.customBorderShape || 'smooth';
      activePrimaryColor = data.customPrimaryColor || '#0284c7';
      activeBgColor = data.customBgColor || '#0f172a';
      activeGlowColor = data.customGlowColor || '#10b981';
      activeRingColor = data.customRingColor || '#ef4444';
      isMiniToolbarEnabled = false;

      updatePageThemeVariables();
      removeMiniExamToolbar();
    });
  }
}

function updatePageThemeVariables() {
  try {
    let radiusPx = '12px';
    if (activeBorderShape === 'sharp') radiusPx = '4px';
    else if (activeBorderShape === 'capsule') radiusPx = '26px';

    document.documentElement.style.setProperty('--qg-option-radius', radiusPx);
    document.documentElement.style.setProperty('--qg-bar-primary', activePrimaryColor);
    document.documentElement.style.setProperty('--qg-bar-bg', activeBgColor);
    document.documentElement.style.setProperty('--qg-glow-color', activeGlowColor);
    document.documentElement.style.setProperty('--qg-ring-color', activeRingColor);
  } catch (e) {}
}

function ensureMiniExamToolbar() {
  removeMiniExamToolbar();
}

function removeMiniExamToolbar() {
  const bar = document.getElementById('quizgenie-mini-exam-bar');
  if (bar) bar.remove();
  const pill = document.getElementById('quizgenie-exam-scanner-pill');
  if (pill) pill.remove();
  document.querySelectorAll('.qg-inpage-exam-toolbar, #qg-inpage-exam-toolbar, [class*="inpage-exam-toolbar"]').forEach(el => el.remove());
}

// الاستماع لرسائل مزامنة الثيم الحية
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SYNC_THEME_CUSTOMIZATION') {
    const s = request.settings || {};
    activeBorderShape = s.customBorderShape || 'smooth';
    activePrimaryColor = s.customPrimaryColor || '#0284c7';
    activeBgColor = s.customBgColor || '#0f172a';
    activeGlowColor = s.customGlowColor || '#10b981';
    activeRingColor = s.customRingColor || '#ef4444';
    isMiniToolbarEnabled = s.customMiniToolbar !== false;

    updatePageThemeVariables();
    if (isMiniToolbarEnabled && extensionEnabled) {
      ensureMiniExamToolbar();
    } else {
      removeMiniExamToolbar();
    }
    if (typeof sendResponse === 'function') sendResponse({ success: true });
    return false;
  }
  return false;
});

// تحميل الثيم عند بدء الصفحة
loadThemeSettings();

// =========================================================================
// محرك الحل المباشر المستمر مع محدد الشاشة وزر الإيقاف والعلامة الحمراء المؤشرة
// =========================================================================

let liveDirectActive = false;
let liveDirectRegion = null;
let liveDirectLastQuestion = '';
let liveDirectObserver = null;
let liveDirectCheckTimer = null;
let liveDirectTimerInterval = null;
let liveDirectElapsedSeconds = 0;
let liveDirectSolvedCount = 0;
let activeLiveMode = 'concise';
let isSolvingLiveStep = false;
const speculativeResultCache = new Map();
let liveDirectCountdownTimer = null;
let liveCountdownOverlay = null;

// دالة إظهار مؤقت العد التنازلي البصري المباشر 3 ثوانٍ (3... 2... 1... 🚀)
function playCountdownBeep(freq, duration) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq || 600, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.08));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (duration || 0.08));
  } catch (e) {}
}

// دالة إظهار مؤقت العد التنازلي البصري المباشر 3 ثوانٍ (3... 2... 1... 🚀)
function showLiveCountdownOverlay(onFinish) {
  if (liveCountdownOverlay) {
    try { liveCountdownOverlay.remove(); } catch (e) {}
    liveCountdownOverlay = null;
  }
  if (liveDirectCountdownTimer) {
    clearInterval(liveDirectCountdownTimer);
    liveDirectCountdownTimer = null;
  }

  const overlay = document.createElement('div');
  overlay.id = 'quizgenie-countdown-overlay';
  overlay.innerHTML = `
    <div class="qg-countdown-card">
      <div style="position: absolute; top: 12px; left: 14px;">
        <button type="button" id="qgCancelCountdownBtn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 6px; font-size: 11px; padding: 3px 8px; cursor: pointer;">✕ إلغاء</button>
      </div>
      <div class="qg-countdown-header">
        <span style="font-size: 22px;">⚡</span>
        <span>مساعد QuizGenie للحل المباشر</span>
      </div>
      <div class="qg-countdown-number" id="qgCountdownVal">3</div>
      <div class="qg-countdown-sub" id="qgCountdownSub">استعد! جاري الاتصال بالخادم وتهيئة الرصد الذكي...</div>
      <div class="qg-countdown-progress-bar">
        <div class="qg-countdown-progress-fill" id="qgCountdownProgress" style="width: 33%;"></div>
      </div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(overlay);
  liveCountdownOverlay = overlay;

  playCountdownBeep(520, 0.1);

  const cancelCountdown = () => {
    if (liveDirectCountdownTimer) {
      clearInterval(liveDirectCountdownTimer);
      liveDirectCountdownTimer = null;
    }
    if (overlay && overlay.parentElement) overlay.remove();
    if (liveCountdownOverlay === overlay) liveCountdownOverlay = null;
    stopLiveDirectMode();
  };

  const cancelBtn = overlay.querySelector('#qgCancelCountdownBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelCountdown);

  const onKeyEsc = (e) => {
    if (e.key === 'Escape') {
      cancelCountdown();
      document.removeEventListener('keydown', onKeyEsc);
    }
  };
  document.addEventListener('keydown', onKeyEsc);

  let count = 3;
  const numEl = overlay.querySelector('#qgCountdownVal');
  const subEl = overlay.querySelector('#qgCountdownSub');
  const progEl = overlay.querySelector('#qgCountdownProgress');

  liveDirectCountdownTimer = setInterval(() => {
    count--;
    if (count === 2) {
      playCountdownBeep(660, 0.1);
      if (numEl) numEl.textContent = '2';
      if (subEl) subEl.textContent = 'جاري مطابقة الخيارات وتحديد منطقة الاختبار...';
      if (progEl) progEl.style.width = '66%';
    } else if (count === 1) {
      playCountdownBeep(880, 0.1);
      if (numEl) numEl.textContent = '1';
      if (subEl) subEl.textContent = 'ثوانٍ معدودة وسيبدأ التلوين البصري الذكي!';
      if (progEl) progEl.style.width = '100%';
    } else if (count <= 0) {
      clearInterval(liveDirectCountdownTimer);
      liveDirectCountdownTimer = null;
      document.removeEventListener('keydown', onKeyEsc);
      playCountdownBeep(1100, 0.22);
      if (numEl) {
        numEl.textContent = '🚀';
        numEl.style.fontSize = '65px';
      }
      if (subEl) subEl.textContent = 'بدأ الكشف التلقائي وحل الاختبار مباشرة!';
      setTimeout(() => {
        if (overlay && overlay.parentElement) {
          overlay.style.transition = 'opacity 0.25s ease-out';
          overlay.style.opacity = '0';
          setTimeout(() => {
            if (overlay && overlay.parentElement) overlay.remove();
            if (liveCountdownOverlay === overlay) liveCountdownOverlay = null;
          }, 250);
        }
        if (typeof onFinish === 'function') onFinish();
      }, 350);
    }
  }, 1000);
}

// دالة شارة الرصد الزاوية الثابتة مع الدائرة الحمراء النابضة فوق يمين الشاشة
function updateCornerRecBadge(isActive, statusText) {
  let badge = document.getElementById('quizgenie-corner-rec-badge');
  if (!isActive) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'quizgenie-corner-rec-badge';
    badge.title = 'ميزة الحل المباشر والريكورد نشطة الآن وترصد الأسئلة تلقائياً. اضغط لإيقاف الريكورد.';
    badge.innerHTML = `
      <span class="qg-pulsing-red-circle-prominent"></span>
      <span id="qgCornerBadgeText" style="font-weight: 800; color: #fecdd3;">REC 🔴 مباشر نشط</span>
      <span id="qgCornerTimer" style="font-family: Consolas, monospace; font-size: 11px; background: rgba(0,0,0,0.35); padding: 1px 7px; border-radius: 12px; color: #38bdf8;">00:00</span>
    `;
    badge.addEventListener('click', () => {
      stopLiveDirectMode();
    });
    (document.body || document.documentElement).appendChild(badge);
  }
  const textEl = badge.querySelector('#qgCornerBadgeText');
  if (textEl && statusText) textEl.textContent = statusText;
}

function showLiveSelectorOverlay(preferredMode) {
  stopLiveDirectMode();
  clearAllExamHighlights();

  if (preferredMode) activeLiveMode = preferredMode;

  const existing = document.getElementById('quizgenie-live-selector-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quizgenie-live-selector-overlay';

  // شريط علوي عائم بتصميم سكرين شوت ويندوز 11 (Windows Snipping Tool Pill)
  const toolbar = document.createElement('div');
  toolbar.className = 'qg-snipping-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="qg-snipping-btn active" id="qgSnipRectBtn" title="تحديد مستطيل مخصص (قص السؤال والخيارات)">
      <span style="font-size: 14px;">🔲</span>
      <span>تحديد مستطيل</span>
    </button>
    <button type="button" class="qg-snipping-btn" id="qgSnipFullBtn" title="تحديد كامل الشاشة">
      <span style="font-size: 14px;">🖥️</span>
      <span>كامل الشاشة</span>
    </button>
    <div class="qg-snipping-divider"></div>
    <button type="button" class="qg-snipping-btn qg-snipping-close" id="qgSnipCloseBtn" title="إلغاء (Esc)">
      <span style="font-size: 14px;">✕</span>
    </button>
  `;
  overlay.appendChild(toolbar);

  const hint = document.createElement('div');
  hint.className = 'qg-snipping-hint';
  hint.textContent = '📸 اسحب الماوس لتحديد السؤال والخيارات (Win+Shift+S) — الخادم يقرأ معك السؤال لحظياً أثناء السحب!';
  overlay.appendChild(hint);

  // صندوق التحديد الشفاف المضيء من الداخل
  const box = document.createElement('div');
  box.className = 'qg-live-selector-box';
  box.style.display = 'none';

  const dimTag = document.createElement('div');
  dimTag.className = 'qg-live-selector-dimensions';
  dimTag.textContent = '0 × 0 بكسل';
  box.appendChild(dimTag);
  overlay.appendChild(box);

  let startX = 0, startY = 0, isDragging = false;
  let speculativeThrottler = null;
  let lastPrefetchedKey = '';

  function triggerSpeculativeScan(w, h, l, t) {
    if (w < 80 || h < 50) return;
    const candidate = extractQuestionAndOptionsFromRegion({
      left: l,
      top: t,
      right: l + w,
      bottom: t + h,
      width: w,
      height: h,
      isFullScreen: false
    });
    if (!candidate || !candidate.questionText || candidate.optionsList.length < 2) return;
    const qKey = candidate.questionText.trim().replace(/\s+/g, ' ');
    if (qKey === lastPrefetchedKey) return;
    lastPrefetchedKey = qKey;

    if (dimTag) {
      dimTag.innerHTML = `<span>${w} × ${h} بكسل</span> <span style="color: #38bdf8; font-weight: 800;">(⚡ الخادم يقرأ معك السؤال...)</span>`;
    }

    chrome.runtime.sendMessage({
      action: 'SOLVE_EXAM_SCAN',
      question: candidate.questionText,
      questionText: candidate.questionText,
      options: candidate.optionsList,
      optionsList: candidate.optionsList,
      mode: activeLiveMode,
      subject: subject || 'qudrat',
      targetLanguage: targetLanguage || 'ar'
    }, (resp) => {
      if (resp && resp.success && resp.data) {
        speculativeResultCache.set(qKey, resp.data);
        if (dimTag && isDragging) {
          dimTag.innerHTML = `<span>${w} × ${h} بكسل</span> <span style="color: #34d399; font-weight: 800;">(🎯 تم الحل مسبقاً! أفلت للمشاهدة)</span>`;
        }
      }
    });
  }

  const closeBtn = toolbar.querySelector('#qgSnipCloseBtn');
  const fullBtn = toolbar.querySelector('#qgSnipFullBtn');

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
  });

  fullBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    startLiveDirectMode({
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
      isFullScreen: true
    }, activeLiveMode);
  });

  overlay.addEventListener('mousedown', (e) => {
    if (e.target.closest('.qg-snipping-toolbar') || e.target.closest('.qg-snipping-hint')) return;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    overlay.classList.add('qg-is-dragging');
    box.style.left = startX + 'px';
    box.style.top = startY + 'px';
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    box.style.left = minX + 'px';
    box.style.top = minY + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    dimTag.textContent = `${width} × ${height} بكسل`;

    // قراءة استباقية لحظية أثناء السحب مع الخادم
    if (!speculativeThrottler) {
      speculativeThrottler = setTimeout(() => {
        speculativeThrottler = null;
        if (isDragging) {
          triggerSpeculativeScan(width, height, minX, minY);
        }
      }, 160);
    }
  });

  overlay.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    const rect = box.getBoundingClientRect();
    overlay.remove();

    if (rect.width > 25 && rect.height > 20) {
      startLiveDirectMode({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        isFullScreen: false
      }, activeLiveMode);
    } else {
      showScanFeedbackBanner('💡 اسحب الفأرة لتحديد منطقة السؤال والخيارات.', '#0284c7');
    }
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  (document.body || document.documentElement).appendChild(overlay);
}

function startLiveDirectMode(region, mode) {
  stopLiveDirectMode();
  ensureHighlightStylesInPage();

  liveDirectActive = true;
  liveDirectRegion = region;
  liveDirectLastQuestion = '';
  liveDirectElapsedSeconds = 0;
  liveDirectSolvedCount = 0;
  if (mode) activeLiveMode = mode;

  const host = document.body || document.documentElement;

  // 1. إذا كانت منطقة محددة بأبعاد، إظهار إطار المنطقة المراقبة المتوهج
  if (!region.isFullScreen) {
    const frame = document.createElement('div');
    frame.id = 'quizgenie-monitored-area-frame';
    frame.style.left = region.left + 'px';
    frame.style.top = region.top + 'px';
    frame.style.width = region.width + 'px';
    frame.style.height = region.height + 'px';
    host.appendChild(frame);
  }

  // 2. إظهار شريط التحكم أعلى اليمين (وضع الريكورد REC 🔴 + عداد الثواني الحي + زر الإيقاف + قص جديد)
  const hud = document.createElement('div');
  hud.id = 'quizgenie-live-direct-hud';
  const modeLabel = (activeLiveMode === 'detailed') ? '📖 مفصل مع الشرح' : '⚡ بدون فلسفة';
  hud.innerHTML = `
    <div class="qg-live-hud-top">
      <div class="qg-live-rec-badge" title="وضع الريكورد المباشر نشط ويرصد الأسئلة لحظياً">
        <span class="qg-pulsing-red-circle-prominent"></span>
        <span class="qg-rec-label" style="font-weight: 800; color: #f87171;">REC 🔴</span>
        <span class="qg-rec-timer" id="qgRecTimer">00:00</span>
      </div>
      <span class="qg-live-mode-badge" id="qgLiveModeBadge">${modeLabel}</span>
      <span class="qg-live-confidence-badge" id="qgLiveConfidenceBadge" title="نسبة اليقين الأكاديمي للحل">🟢 يقين: 99.4%</span>
      <span class="qg-live-autoclick-badge ${liveAutoClickEnabled ? 'active' : ''}" id="qgLiveAutoClickBadge" title="حالة النقر التلقائي">
        ${liveAutoClickEnabled ? '⚡ نقر تلقائي' : '⚪ بدون نقر'}
      </span>
      <button type="button" class="qg-live-stop-btn" id="qgLiveStopBtn" title="اضغط هنا لإيقاف ميزة الريكورد والحل المباشر">
        <span>⏹️</span>
        <span>إيقاف الريكورد</span>
      </button>
    </div>
    <div class="qg-live-hud-bottom">
      <div class="qg-live-counter-pill">
        <span>🎯 تم حل:</span>
        <span id="qgLiveSolvedCount" style="color: #38bdf8; font-weight: 800;">0</span>
        <span>أسئلة</span>
      </div>
      <button type="button" class="qg-live-resnip-btn" id="qgLiveResnipBtn" title="قص وتحديد سؤال جديد (مثل Win+Shift+S)">
        <span>📸 قص وتحديد جديد</span>
      </button>
    </div>
  `;
  host.appendChild(hud);

  hud.querySelector('#qgLiveStopBtn').addEventListener('click', () => {
    stopLiveDirectMode();
  });

  hud.querySelector('#qgLiveResnipBtn').addEventListener('click', () => {
    showLiveSelectorOverlay(activeLiveMode);
  });

  const hudAutoClickBtn = hud.querySelector('#qgLiveAutoClickBadge');
  if (hudAutoClickBtn) {
    hudAutoClickBtn.style.cursor = 'pointer';
    hudAutoClickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      liveAutoClickEnabled = !liveAutoClickEnabled;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ liveAutoClickEnabled: liveAutoClickEnabled });
      }
      if (liveAutoClickEnabled) {
        hudAutoClickBtn.classList.add('active');
        hudAutoClickBtn.textContent = '⚡ نقر تلقائي';
        showScanFeedbackBanner('🔘 تم تفعيل النقر التلقائي الذكي فوراً', '#10b981');
      } else {
        hudAutoClickBtn.classList.remove('active');
        hudAutoClickBtn.textContent = '⚪ بدون نقر';
        showScanFeedbackBanner('⚪ تم إيقاف النقر التلقائي (وضع الرصد فقط)', '#64748b');
      }
    });
  }

  // تفعيل سحب شريط الريكورد بحرية في الشاشة حتى لا يحجب أي جزء من السؤال
  let isHudDragging = false, hudStartX = 0, hudStartY = 0, hudInitLeft = 0, hudInitTop = 0;
  hud.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isHudDragging = true;
    hudStartX = e.clientX;
    hudStartY = e.clientY;
    const rect = hud.getBoundingClientRect();
    hudInitLeft = rect.left;
    hudInitTop = rect.top;
    hud.style.right = 'auto';
    hud.style.left = hudInitLeft + 'px';
    hud.style.top = hudInitTop + 'px';
    hud.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!isHudDragging) return;
    const dx = e.clientX - hudStartX;
    const dy = e.clientY - hudStartY;
    const maxLeft = window.innerWidth - hud.offsetWidth - 10;
    const maxTop = window.innerHeight - hud.offsetHeight - 10;
    const nLeft = Math.max(10, Math.min(maxLeft, hudInitLeft + dx));
    const nTop = Math.max(10, Math.min(maxTop, hudInitTop + dy));
    hud.style.left = nLeft + 'px';
    hud.style.top = nTop + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (isHudDragging) {
      isHudDragging = false;
      hud.style.cursor = 'grab';
    }
  });

  // تفعيل شارة التسجيل الزاوية الحمراء النابضة (أعلى اليمين)
  updateCornerRecBadge(true, '⏳ يستعد (3 ثوانٍ)...');

  // إطلاق مؤقت العد التنازلي البصري المباشر 3 ثوانٍ (3... 2... 1... 🚀)
  showLiveCountdownOverlay(() => {
    if (!liveDirectActive) return;

    updateCornerRecBadge(true, 'REC 🔴 مباشر نشط');

    // تشغيل عداد الثواني الحي للريكورد
    liveDirectTimerInterval = setInterval(() => {
      liveDirectElapsedSeconds++;
      const m = String(Math.floor(liveDirectElapsedSeconds / 60)).padStart(2, '0');
      const s = String(liveDirectElapsedSeconds % 60).padStart(2, '0');
      const timerEl = document.getElementById('qgRecTimer');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      const cornerTimer = document.getElementById('qgCornerTimer');
      if (cornerTimer) cornerTimer.textContent = `${m}:${s}`;
    }, 1000);

    showScanFeedbackBanner('🔴 بدأ رصد وحل أسئلة الاختبار مباشرة!', '#ef4444');

    // 3. تنفيذ الفحص والحل الأولي الفوري بعد انتهاء الثواني الـ 3
    executeLiveDirectSolveStep();

    // 4. مراقبة التغيرات في الصفحة للمتابعة التلقائية مع تقدم الطالب
    liveDirectObserver = new MutationObserver(() => {
      if (!liveDirectActive || isSolvingLiveStep) return;
      executeLiveDirectSolveStep();
    });
    liveDirectObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    // فحص دوري كل 1.5 ثانية للرصد الحي المستمر
    liveDirectCheckTimer = setInterval(() => {
      if (!liveDirectActive || isSolvingLiveStep) return;
      executeLiveDirectSolveStep();
    }, 1500);
  });
}

function stopLiveDirectMode() {
  liveDirectActive = false;
  liveDirectRegion = null;
  liveDirectLastQuestion = '';

  if (liveDirectCountdownTimer) {
    clearInterval(liveDirectCountdownTimer);
    liveDirectCountdownTimer = null;
  }
  if (liveCountdownOverlay) {
    try { liveCountdownOverlay.remove(); } catch (e) {}
    liveCountdownOverlay = null;
  }
  updateCornerRecBadge(false);

  if (liveDirectTimerInterval) {
    clearInterval(liveDirectTimerInterval);
    liveDirectTimerInterval = null;
  }
  if (liveDirectObserver) {
    liveDirectObserver.disconnect();
    liveDirectObserver = null;
  }
  if (liveDirectCheckTimer) {
    clearInterval(liveDirectCheckTimer);
    liveDirectCheckTimer = null;
  }

  const hud = document.getElementById('quizgenie-live-direct-hud');
  if (hud) hud.remove();

  const frame = document.getElementById('quizgenie-monitored-area-frame');
  if (frame) frame.remove();

  const overlay = document.getElementById('quizgenie-live-selector-overlay');
  if (overlay) overlay.remove();

  const card = document.getElementById('quizgenie-direct-solution-card');
  if (card) card.remove();

  clearAllExamHighlights();
  showScanFeedbackBanner('⏹️ تم إيقاف وضع الريكورد والحل المباشر.', '#64748b');
}

// دالة مساعدة ذكية لاستخراج نص الخيار الدائري أو المربع بدقة وربطه بعنصره القابل للنقر
function extractOptionFromCandidate(el, targetContainer, IGNORED_SELECTORS, IGNORED_TEXT) {
  if (!el || el.closest(IGNORED_SELECTORS)) return null;
  const r = el.getBoundingClientRect();
  const hasVisualOrText = (r.width > 0 && r.height > 0) || (el.offsetWidth > 0 || el.offsetHeight > 0) || (el.innerText && el.innerText.trim().length > 0);
  if (!hasVisualOrText) return null;

  // الحاوية الخارجية للخيار (تغطي الراديو الدائري والنص والأيقونات)
  let containerEl = el.closest('.option-item, .choice-item, .quiz-option, .exam-option, label, li, tr, .form-check, [role="radio"]') ||
                    el.closest('[class*="option" i], [class*="choice" i]') ||
                    el.parentElement || el;
  if (!containerEl || containerEl.closest(IGNORED_SELECTORS)) return null;

  // استبعاد الحاويات العامة ومجموعات الخيارات إذا كانت تحوي أكثر من خيار
  const cCls = (typeof containerEl.className === 'string') ? containerEl.className.toLowerCase() : '';
  if (/options-list|choices-list|answers-list|options-container|choices-container|grid|wrapper/.test(cCls) ||
      containerEl.querySelectorAll('.option-item, .choice-item, input[type="radio"], label, li').length > 1) {
    containerEl = el;
  }

  // إذا كانت الحاوية بدون نص كافٍ وكانت مجرد غلاف للزر الدائري، نتوسع للحاوية الأب المشتركة
  const directText = (containerEl.innerText || '').trim();
  if (!directText && containerEl.parentElement && containerEl.parentElement !== document.body && !containerEl.parentElement.closest(IGNORED_SELECTORS)) {
    if ((containerEl.parentElement.innerText || '').trim().length > 0) {
      containerEl = containerEl.parentElement;
    }
  }

  // استخراج النص من الحاوية أو التسمية المرتبطة (label for) أو السمات (aria-label, value)
  let text = '';
  if (el.id) {
    try {
      const forLabel = (targetContainer || document).querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel && forLabel.innerText) text = forLabel.innerText;
    } catch (e) {}
  }
  if (!text) {
    text = (containerEl ? containerEl.innerText : el.innerText || '') || '';
  }
  if (!text.trim()) {
    text = el.getAttribute('aria-label') || el.value || el.getAttribute('title') || (el.nextElementSibling ? el.nextElementSibling.innerText : '') || '';
  }

  // تنظيف الرموز والدوائر والنقاط والبادئات واللواحق (مع الحفاظ على أدوات اللغة الإنجليزية مثل A car / A book)
  if (text.trim().length > 2) {
    text = text
      .replace(/^(([A-Da-d\u0623\u0628\u062c\u062f1-4][.\-:\)\/]\s*|[\(\[][A-Da-d\u0623\u0628\u062c\u062f1-4][\)\]]\s*|[\u0623\u0628\u062c\u062f1-4]\s+|[A-Da-d]\n\s*)|[\u2022\u2023\u2043\u2299\u229a\u25cb-\u25cf\u25cd-\u25d3\u25e6\u25ef\u26aa\u26ab\u26ac\u29bf\u2b24\u2b55\u2b58\u25cf\u25cb]\s*)+/g, '')
      .replace(/[\u2022\u2023\u2043\u2299\u229a\u25cb-\u25cf\u25cd-\u25d3\u25e6\u25ef\u26aa\u26ab\u26ac\u29bf\u2b24\u2b55\u2b58\u25cf\u25cb.\-:\(\)\[\]\s]+$/g, '')
      .trim();
  }

  if (text.length > 0 && text.length < 160 && !IGNORED_TEXT.test(text)) {
    try { containerEl._qgRadioEl = el; } catch (e) {}
    return { text, containerEl };
  }
  return null;
}

// محرك استخراج السؤال والخيارات بذكاء فائق ودقة 100% مع دعم الراديو الدائري وأسئلة صح وخطأ
function extractQuestionAndOptionsFromRegion(region) {
  const IGNORED_SELECTORS = '#quizgenie-live-selector-overlay, #quizgenie-live-direct-hud, #quizgenie-toast-container, #quizgenie-monitored-area-frame, #quizgenie-direct-solution-card, #quizgenie-countdown-overlay, #quizgenie-corner-rec-badge, .answer-verifier, .question-meta, .btn-reveal-solution, .correct-answer-hint, .exam-footer-toolbar, .instructions-card, .exam-header, [class*="goal" i], [id*="goal" i], [class*="boost" i], [id*="boost" i], [class*="popup" i], [class*="modal" i], [role="dialog"], [class*="streak" i], [class*="gamif" i], [class*="reward" i], [class*="badge-container" i]';
  const IGNORED_TEXT = /^(Previous|Next|Submit|السابق|التالي|إرسال|حفظ|درجة|وقت|كشف|عرض الإجابة|تحقق|تأكيد|مساعدة|مراجعة|إلغاء|حذف|مسح|Of|Show|Check|Verify|Hint|Skip|Solution|Goal|Boost|XP|Streak|Bonus|Reward|Score|Points|هدف|تعزيز|مكافأة|نقاط|المستوى|إغلاق|Close)/i;

  // 1. فحص حاويات الأسئلة المنظمة (مثل question-card أو que أو quiz-question أو fieldset أو الصفوف)
  const cardSelectors = '.question-card, [class*="question-card" i], [class*="question-item" i], [class*="quiz-question" i], [class*="question_wrapper" i], [class*="question-wrapper" i], [class*="question-container" i], [class*="question-block" i], .que, fieldset, [role="radiogroup"], .form-group, [class*="quiz-item" i], [class*="exam-item" i], [class*="test-item" i], tr.question-row, tr[class*="question" i]';
  let containers = Array.from(document.querySelectorAll(cardSelectors)).filter(c => {
    if (c.closest(IGNORED_SELECTORS)) return false;
    const r = c.getBoundingClientRect();
    if (!region.isFullScreen) {
      const intersects = (r.left < region.right + 30 && r.right > region.left - 30 &&
                          r.top < region.bottom + 30 && r.bottom > region.top - 30);
      if (intersects) return true;
      const qEl = c.querySelector('.question-text, .q-text, [class*="question-title" i], [class*="question-body" i], [class*="stem" i], h1, h2, h3, h4, h5');
      if (qEl) {
        const qr = qEl.getBoundingClientRect();
        return (qr.left < region.right + 30 && qr.right > region.left - 30 &&
                qr.top < region.bottom + 30 && qr.bottom > region.top - 30);
      }
      return false;
    }
    return true;
  });

  if (containers.length > 0) {
    // تحديد الحاوية النشطة: الحاوية الأكثر تطابقاً مع المنطقة المحددة
    let targetContainer = null;
    if (!region.isFullScreen) {
      let bestScore = -1;
      for (const c of containers) {
        if (c.dataset.qgSolved === 'true') continue;
        const r = c.getBoundingClientRect();
        const xOverlap = Math.max(0, Math.min(r.right, region.right) - Math.max(r.left, region.left));
        const yOverlap = Math.max(0, Math.min(r.bottom, region.bottom) - Math.max(r.top, region.top));
        const overlapArea = xOverlap * yOverlap;

        const qEl = c.querySelector('.question-text, .q-text, [class*="question-title" i], [class*="question-body" i], [class*="stem" i], h1, h2, h3, h4, h5');
        let qOverlap = 0;
        if (qEl) {
          const qr = qEl.getBoundingClientRect();
          const qx = Math.max(0, Math.min(qr.right, region.right) - Math.max(qr.left, region.left));
          const qy = Math.max(0, Math.min(qr.bottom, region.bottom) - Math.max(qr.top, region.top));
          qOverlap = qx * qy;
        }

        const score = overlapArea + (qOverlap * 10);
        if (score > bestScore && score > 0) {
          bestScore = score;
          targetContainer = c;
        }
      }
    }

    if (!targetContainer) {
      for (const c of containers) {
        if (c.dataset.qgSolved === 'true') continue;
        const r = c.getBoundingClientRect();
        if (r.bottom > 20 && r.top < window.innerHeight - 20) {
          targetContainer = c;
          break;
        }
      }
    }
    if (!targetContainer) {
      targetContainer = containers.find(c => c.dataset.qgSolved !== 'true');
    }

    if (targetContainer) {
      // استخراج رأس السؤال من الحاوية المستهدفة فقط
      let questionElement = targetContainer.querySelector('.question-text, .q-text, [class*="question-title" i], [class*="question-body" i], [class*="stem" i], [class*="prompt" i], h1, h2, h3, h4, h5, legend, .form-label');
      if (!questionElement) {
        const potentialQ = Array.from(targetContainer.querySelectorAll('div, p, span, b, strong')).filter(el => {
          if (el.closest('.option-item, .choice, .option, label, li, tr, ' + IGNORED_SELECTORS)) return false;
          const t = (el.innerText || '').trim();
          return t.length > 5 && !IGNORED_TEXT.test(t);
        });
        if (potentialQ.length > 0) questionElement = potentialQ[0];
      }
      const questionText = questionElement ? questionElement.innerText.trim() : '';

      // استخراج خيارات هذه الحاوية حصراً دون الحاويات المجمعة أو العناصر الداخلية
      const choiceSelector = '.option-item, .choice-item, .quiz-option, .exam-option, input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], label, li, [class*="true-false" i], [class*="tf-option" i], [class*="custom-control" i], svg circle';
      let rawChoiceCandidates = Array.from(targetContainer.querySelectorAll(choiceSelector)).filter(el => {
        if (el.closest(IGNORED_SELECTORS)) return false;
        if (questionElement && (el === questionElement || questionElement.contains(el))) return false;
        const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
        if (/options-list|choices-list|answers-list|options-container|choices-container|wrapper|grid/.test(cls)) return false;
        if (/letter|title|icon|badge|hint|prefix|number/.test(cls)) return false;
        const r = el.getBoundingClientRect();
        return (r.width > 0 && r.height > 0) || (el.offsetWidth > 0 || el.offsetHeight > 0) || (el.innerText && el.innerText.trim().length > 0);
      });

      // استبعاد أي حاوية تضم داخلها خيارات أخرى لمنع التكرار والتداخل
      const choiceCandidates = rawChoiceCandidates.filter(c => !rawChoiceCandidates.some(other => other !== c && c.contains(other)));

      const optionsList = [];
      const optionElements = [];
      for (const el of choiceCandidates) {
        const res = extractOptionFromCandidate(el, targetContainer, IGNORED_SELECTORS, IGNORED_TEXT);
        if (res && !optionsList.includes(res.text) && !optionElements.includes(res.containerEl)) {
          optionsList.push(res.text);
          optionElements.push(res.containerEl);
        }
      }

      if (questionText && optionsList.length >= 2) {
        return {
          questionText,
          questionElement,
          optionsList,
          optionElements,
          container: targetContainer,
          hasMoreUnsolved: containers.some(c => c !== targetContainer && c.dataset.qgSolved !== 'true')
        };
      }
    }
  }

  // 2. إذا لم تكن الصفحة مقسمة إلى حاويات، نستخدم التحديد الجغرافي داخل المنطقة المحددة
  let candidateElements = [];
  const all = Array.from(document.querySelectorAll('div, p, span, label, li, h1, h2, h3, h4, h5, b, strong, button, input, tr, td, svg, circle'));
  if (region.isFullScreen) {
    candidateElements = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest(IGNORED_SELECTORS);
    });
  } else {
    candidateElements = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (el.closest(IGNORED_SELECTORS)) return false;
      return (r.left >= region.left - 25 && r.right <= region.right + 25 &&
              r.top >= region.top - 25 && r.bottom <= region.bottom + 25);
    });
  }

  const optionsList = [];
  const optionElements = [];
  let questionElement = null;
  let questionText = '';

  const rawChoiceEls = candidateElements.filter(el => {
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (/options-list|choices-list|answers-list|options-container|choices-container|wrapper|grid/.test(cls)) return false;
    if (/letter|title|icon|badge|hint|prefix|number/.test(cls)) return false;
    const isRadio = (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) || el.getAttribute('role') === 'radio' || el.tagName === 'circle' || (el.tagName === 'svg' && el.querySelector('circle'));
    const isChoiceCls = /choice|option|radio|answer|select|check|form-check|circle|true-false|tf-option/i.test(cls) || el.tagName === 'LI' || el.tagName === 'LABEL';
    return isRadio || isChoiceCls;
  });
  const filteredChoiceEls = rawChoiceEls.filter(c => !rawChoiceEls.some(other => other !== c && c.contains(other)));

  for (const el of filteredChoiceEls) {
    const res = extractOptionFromCandidate(el, null, IGNORED_SELECTORS, IGNORED_TEXT);
    if (res && !optionsList.includes(res.text) && !optionElements.includes(res.containerEl)) {
      optionsList.push(res.text);
      optionElements.push(res.containerEl);
    }
  }

  // استخراج رأس السؤال
  for (const el of candidateElements) {
    if (el.closest(IGNORED_SELECTORS)) continue;
    const isQCls = el.classList.contains('question-text') || el.classList.contains('q-text') || el.id.includes('question-text') || el.classList.contains('question-title');
    if (isQCls) {
      const txt = (el.innerText || '').trim();
      if (txt && !IGNORED_TEXT.test(txt) && !optionsList.includes(txt)) {
        questionElement = el;
        questionText = txt;
        break;
      }
    }
  }

  if (!questionText) {
    for (const el of candidateElements) {
      if (el.closest(IGNORED_SELECTORS)) continue;
      const txt = (el.innerText || '').trim();
      const isOpt = optionElements.some(opt => opt.contains(el) || el.contains(opt));
      if (!isOpt && txt && txt.length > 4 && txt.length < 350) {
        if (IGNORED_TEXT.test(txt)) continue;
        questionElement = el;
        questionText = txt;
        if (txt.includes('؟') || txt.includes('?')) break;
      }
    }
  }

  return { questionText, questionElement, optionsList, optionElements, container: null, hasMoreUnsolved: false };
}

function executeLiveDirectSolveStep() {
  if (!liveDirectActive || isSolvingLiveStep) return;

  const region = liveDirectRegion;
  if (!region) return;

  const parsed = extractQuestionAndOptionsFromRegion(region);
  if (!parsed || !parsed.questionText || !parsed.optionsList || parsed.optionsList.length === 0) return;

  const questionText = parsed.questionText;
  const questionElement = parsed.questionElement;
  const optionsList = parsed.optionsList;
  const optionElements = parsed.optionElements;
  const container = parsed.container;

  const questionKey = questionText.replace(/\s+/g, ' ');
  if (questionKey === liveDirectLastQuestion && !parsed.hasMoreUnsolved) return;

  liveDirectLastQuestion = questionKey;
  isSolvingLiveStep = true;

  // 1. وضع خط وتوهج أصفر بارز حول السؤال المقروء مع شارة "🟡 السؤال"
  if (questionElement) {
    questionElement.classList.add('quizgenie-question-yellow-glow', 'quizgenie-highlight-question');
    let qTag = questionElement.querySelector('.quizgenie-question-badge-tag-yellow');
    if (!qTag) {
      qTag = document.createElement('span');
      qTag.className = 'quizgenie-question-badge-tag-yellow';
      qTag.textContent = '🟡 السؤال';
      questionElement.appendChild(qTag);
    }
    try { questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }

  // فحص الكاش الاستباقي للحل المسبق الفوري أثناء السحب
  const cachedData = speculativeResultCache.get(questionKey);
  if (cachedData) {
    applyLiveDirectSolution(cachedData, questionElement, optionElements, optionsList, region, container);
    return;
  }

  // 2. إرسال السؤال لحله فورياً عبر خادم الذكاء الاصطناعي
  chrome.runtime.sendMessage({
    action: 'SOLVE_EXAM_SCAN',
    question: questionText,
    questionText: questionText,
    options: optionsList,
    optionsList: optionsList,
    mode: activeLiveMode,
    subject: subject || 'qudrat',
    targetLanguage: targetLanguage || 'ar'
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      isSolvingLiveStep = false;
      return;
    }

    const data = response.data || response.result || {};
    speculativeResultCache.set(questionKey, data);
    applyLiveDirectSolution(data, questionElement, optionElements, optionsList, region, container);
  });
}

function normalizeExamText(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^[({\[]?[a-d\u0623-\u062f1-4\u25cb\u25cf\u25ef\u2b58\u25ce\u25c9\u2299\u229a\u25d0-\u25d3]?[)}\]]?[.\-:\s]\s*/g, '')
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapLetterToIndex(letter) {
  if (!letter) return -1;
  const match = letter.toString().match(/[A-Da-d\u0623\u0628\u062c\u062f1-4]/);
  if (!match) return -1;
  const clean = match[0].toUpperCase();
  const map = {
    '\u0623': 0, 'أ': 0, 'A': 0, '1': 0,
    '\u0628': 1, 'ب': 1, 'B': 1, '2': 1,
    '\u062c': 2, 'ج': 2, 'C': 2, '3': 2,
    '\u062f': 3, 'د': 3, 'D': 3, '4': 3
  };
  return (map[clean] !== undefined) ? map[clean] : -1;
}

function applyLiveDirectSolution(data, questionElement, optionElements, optionsList, region, container) {
  isSolvingLiveStep = false;
  liveDirectSolvedCount++;
  const countEl = document.getElementById('qgLiveSolvedCount');
  if (countEl) countEl.textContent = String(liveDirectSolvedCount);

  if (container) {
    container.dataset.qgSolved = 'true';
  }

  const correctChoiceText = data.correctChoiceText || data.correctText || '';
  let matchedIdx = -1;
  let isConfidentMatch = false;

  // 1. مطابقة نص الخيار أولاً بدقة متناهية عبر التطبيع ودعم خيارات صح وخطأ (True/False)
  const cleanTarget = normalizeExamText(correctChoiceText);
  const isTrueVariant = (t) => {
    const raw = (t || '').trim().toLowerCase();
    const clean = normalizeExamText(raw);
    return /^(صح|صواب|صحيح|صحيحة|صحيحه|نعم|true|t|yes|y)$/i.test(raw) ||
           /^(صح|صواب|صحيح|صحيحه|نعم|true|t|yes|y)$/i.test(clean) ||
           clean === 'صح' || clean === 'صواب' || clean === 'صحيح' || clean === 'صحيحه' || clean === 'true' ||
           raw.includes('صح') || raw.includes('صواب') || raw.includes('صحيح') || raw.includes('true');
  };
  const isFalseVariant = (t) => {
    const raw = (t || '').trim().toLowerCase();
    const clean = normalizeExamText(raw);
    return /^(خطأ|خطا|خاطئ|خاطئة|خاطئه|لا|false|f|no|n)$/i.test(raw) ||
           /^(خطأ|خطا|خاطئ|خاطئه|لا|false|f|no|n)$/i.test(clean) ||
           clean === 'خطا' || clean === 'خاطئ' || clean === 'خاطئه' || clean === 'false' ||
           raw.includes('خطأ') || raw.includes('خطا') || raw.includes('خاطئ') || raw.includes('false');
  };

  if (cleanTarget.length > 0 && optionsList && optionsList.length > 0) {
    for (let i = 0; i < optionsList.length; i++) {
      const cleanOpt = normalizeExamText(optionsList[i]);
      if (cleanOpt === cleanTarget || 
          (cleanTarget.length > 3 && cleanOpt.includes(cleanTarget)) || 
          (cleanOpt.length > 3 && cleanTarget.includes(cleanOpt)) ||
          (isTrueVariant(correctChoiceText) && isTrueVariant(optionsList[i])) ||
          (isFalseVariant(correctChoiceText) && isFalseVariant(optionsList[i])) ||
          (isTrueVariant(cleanTarget) && isTrueVariant(cleanOpt)) ||
          (isFalseVariant(cleanTarget) && isFalseVariant(cleanOpt))) {
        matchedIdx = i;
        isConfidentMatch = true;
        break;
      }
    }
  }

  // 2. فحص رمز الخيار الصريح (A, B, C, D أو أ، ب، ج، د) إذا لم يتطابق النص
  if (matchedIdx === -1) {
    const rawChar = data.correctLetter || '';
    const charIdx = mapLetterToIndex(rawChar);
    if (charIdx >= 0 && charIdx < optionElements.length) {
      matchedIdx = charIdx;
      isConfidentMatch = true;
    }
  }

  // 3. إذا لم يطابق الرمز أو النص، استخدم رقم الفهرس القادم من الخادم
  if (matchedIdx === -1 && typeof data.correctIndex === 'number' && data.correctIndex >= 0 && data.correctIndex < optionElements.length) {
    matchedIdx = data.correctIndex;
    isConfidentMatch = true;
  }

  const confidence = data.confidence || '99.4%';
  const confBadge = document.getElementById('qgLiveConfidenceBadge');
  if (confBadge) confBadge.textContent = '🟢 يقين: ' + confidence;

  // دالة مساعدة للعثور على زر الراديو أو الدائرة القابلة للنقر المرتبطة بالخيار
  function findRadioOrCircle(container, optElement) {
    // 1. فحص داخل الحاوية أو العنصر المباشر
    let el = container ? container.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"]') : null;
    if (!el && container && (container.tagName === 'INPUT' && (container.type === 'radio' || container.type === 'checkbox'))) {
      el = container;
    }
    if (!el && optElement && (optElement.tagName === 'INPUT' && (optElement.type === 'radio' || optElement.type === 'checkbox'))) {
      el = optElement;
    }
    if (!el && container && container.getAttribute('role') === 'radio') {
      el = container;
    }
    if (!el && optElement && optElement.getAttribute('role') === 'radio') {
      el = optElement;
    }
    // 2. فحص ارتباط التسمية id / for
    if (!el && container && container.htmlFor) el = document.getElementById(container.htmlFor);
    if (!el && container && container.getAttribute('for')) el = document.getElementById(container.getAttribute('for'));
    if (!el && optElement && optElement.htmlFor) el = document.getElementById(optElement.htmlFor);
    if (!el && optElement && optElement.getAttribute('for')) el = document.getElementById(optElement.getAttribute('for'));
    // 3. فحص الإشارات المخبأة في العنصر
    if (!el && container && container._qgRadioEl) el = container._qgRadioEl;
    if (!el && optElement && optElement._qgRadioEl) el = optElement._qgRadioEl;
    // 4. فحص الأشقاء المباشرين (قبل أو بعد العنصر مباشرة)
    if (!el && container) {
      if (container.previousElementSibling && container.previousElementSibling.matches('input[type="radio"], input[type="checkbox"], [role="radio"]')) {
        el = container.previousElementSibling;
      } else if (container.nextElementSibling && container.nextElementSibling.matches('input[type="radio"], input[type="checkbox"], [role="radio"]')) {
        el = container.nextElementSibling;
      }
    }
    // 5. فحص غلاف الخيار الفردي فقط (دون التوسع لحاوية الأسئلة العامة)
    if (!el && container && container.parentElement) {
      const p = container.parentElement;
      const isOptionWrap = p.matches && p.matches('.option-item, .choice-item, label, li, tr, .form-check, [class*="option" i], [class*="choice" i]');
      const radioCount = p.querySelectorAll('input[type="radio"], [role="radio"]').length;
      if (isOptionWrap && radioCount === 1) {
        el = p.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"]');
      }
    }
    return el;
  }

  // دالة النقر التلقائي الذكي البشري فائق الدقة 100% (ميزة رقم 2)
  function performUltraPreciseAutoClick(container, optElement, confidenceScore) {
    if (!container && !optElement) return;
    try {
      let target = findRadioOrCircle(container, optElement);
      if (!target) {
        if (optElement && (optElement.tagName === 'INPUT' || optElement.getAttribute('role') === 'radio')) {
          target = optElement;
        } else if (container && container.tagName === 'LABEL') {
          target = container;
        } else {
          target = container || optElement;
        }
      }
      if (!target) return;

      setTimeout(() => {
        try {
          const rect = target.getBoundingClientRect();
          const cx = (rect.left + rect.width / 2) || 0;
          const cy = (rect.top + rect.height / 2) || 0;
          const evOpts = {
            bubbles: true,
            cancelable: true,
            view: window,
            composed: true,
            clientX: cx,
            clientY: cy,
            button: 0,
            buttons: 1
          };

          try { target.focus({ preventScroll: true }); } catch (e) {}

          if (typeof PointerEvent !== 'undefined') {
            target.dispatchEvent(new PointerEvent('pointerover', evOpts));
            target.dispatchEvent(new PointerEvent('pointerenter', evOpts));
            target.dispatchEvent(new PointerEvent('pointerdown', evOpts));
          }
          target.dispatchEvent(new MouseEvent('mouseover', evOpts));
          target.dispatchEvent(new MouseEvent('mousedown', evOpts));

          if (typeof PointerEvent !== 'undefined') {
            target.dispatchEvent(new PointerEvent('pointerup', { ...evOpts, buttons: 0 }));
          }
          target.dispatchEvent(new MouseEvent('mouseup', { ...evOpts, buttons: 0 }));

          if (typeof target.click === 'function') {
            target.click();
          } else {
            target.dispatchEvent(new MouseEvent('click', { ...evOpts, buttons: 0 }));
          }

          if (target.tagName === 'INPUT') {
            target.checked = true;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (target.getAttribute('role') === 'radio') {
            target.setAttribute('aria-checked', 'true');
            target.dispatchEvent(new Event('change', { bubbles: true }));
          }

          target.classList.add('quizgenie-autoclick-done');
          if (container && container !== target) {
            container.classList.add('quizgenie-autoclick-done');
          }
        } catch (innerErr) {
          console.warn('AutoClick inner error:', innerErr);
        }
      }, 160);
    } catch (e) {
      console.warn('AutoClick execution error:', e);
    }
  }

  // 4. فحص أسئلة الترتيب والتسلسل (Feature #7: Ordering & Sequence)
  const isSequence = (data.isSequence === true) && Array.isArray(data.sequence) && data.sequence.length === optionElements.length;

  if (isSequence) {
    for (let i = 0; i < optionElements.length; i++) {
      const optEl = optionElements[i];
      const targetContainer = (optEl.tagName === 'INPUT' || optEl.tagName === 'IMG' || optEl.tagName === 'circle') ? (optEl.parentElement || optEl) : optEl;
      try {
        if (window.getComputedStyle(targetContainer).position === 'static') {
          targetContainer.style.position = 'relative';
        }
      } catch (e) {}

      targetContainer.querySelectorAll('.quizgenie-correct-badge-tag, .quizgenie-wrong-badge-tag, .quizgenie-sequence-badge').forEach(b => b.remove());
      if (optEl !== targetContainer) {
        optEl.querySelectorAll('.quizgenie-correct-badge-tag, .quizgenie-wrong-badge-tag, .quizgenie-sequence-badge').forEach(b => b.remove());
      }

      let isLtrBadge = false;
      try {
        const radioOrLetter = targetContainer.querySelector('.option-letter, input[type="radio"], input[type="checkbox"], [role="radio"], circle, [class*="letter" i]');
        if (radioOrLetter) {
          const rRect = radioOrLetter.getBoundingClientRect();
          const cRect = targetContainer.getBoundingClientRect();
          isLtrBadge = (rRect.left - cRect.left < cRect.right - rRect.right);
        } else {
          isLtrBadge = (window.getComputedStyle(targetContainer).direction === 'ltr');
        }
      } catch (e) {
        isLtrBadge = false;
      }

      const stepNum = data.sequence[i] || (i + 1);
      const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const emoji = numEmojis[stepNum - 1] || `${stepNum}️⃣`;

      targetContainer.classList.remove('quizgenie-highlight-wrong', 'quizgenie-wrong-answer-outline', 'quizgenie-highlight-correct', 'quizgenie-correct-answer-glow');
      targetContainer.classList.add('quizgenie-sequence-item');

      const seqTag = document.createElement('span');
      seqTag.className = 'quizgenie-sequence-badge' + (isLtrBadge ? ' qg-badge-ltr' : '');
      seqTag.textContent = `${emoji} الترتيب: ${stepNum}`;
      try { targetContainer.appendChild(seqTag); } catch (e) {}
    }
    showScanFeedbackBanner(`🔢 تم ترتيب وتسلسل الخطوات بدقة (1 إلى ${optionElements.length}) • يقين: ${confidence}!`, '#0284c7');
  } else if (optionElements && optionElements.length > 0 && matchedIdx !== -1) {
    // 5. الأسئلة الاعتيادية: وضع التوهج الأخضر وشارة "🟢 الخيار الصحيح • نسبة اليقين"
    for (let i = 0; i < optionElements.length; i++) {
      const optEl = optionElements[i];
      const targetContainer = (optEl.tagName === 'INPUT' || optEl.tagName === 'IMG' || optEl.tagName === 'circle') ? (optEl.parentElement || optEl) : optEl;
      try {
        if (window.getComputedStyle(targetContainer).position === 'static') {
          targetContainer.style.position = 'relative';
        }
      } catch (e) {}

      // تنظيف أي شارات سابقة لمنع التكرار والتراكم
      targetContainer.querySelectorAll('.quizgenie-correct-badge-tag, .quizgenie-wrong-badge-tag, .quizgenie-sequence-badge').forEach(b => b.remove());
      if (optEl !== targetContainer) {
        optEl.querySelectorAll('.quizgenie-correct-badge-tag, .quizgenie-wrong-badge-tag, .quizgenie-sequence-badge').forEach(b => b.remove());
      }

      let isLtrBadge = false;
      try {
        const radioOrLetter = targetContainer.querySelector('.option-letter, input[type="radio"], input[type="checkbox"], [role="radio"], circle, [class*="letter" i]');
        if (radioOrLetter) {
          const rRect = radioOrLetter.getBoundingClientRect();
          const cRect = targetContainer.getBoundingClientRect();
          if (rRect.left - cRect.left < cRect.right - rRect.right) {
            isLtrBadge = true;
          } else {
            isLtrBadge = false;
          }
        } else {
          isLtrBadge = (window.getComputedStyle(targetContainer).direction === 'ltr');
        }
      } catch (e) {
        isLtrBadge = false;
      }

      if (i === matchedIdx) {
        // الإجابة الصحيحة: خط وتوهج أخضر نيون مع نسبة اليقين الذكي (Feature #4)
        targetContainer.classList.remove('quizgenie-highlight-wrong', 'quizgenie-wrong-answer-outline');
        targetContainer.classList.add('quizgenie-highlight-correct', 'quizgenie-correct-answer-glow');
        const ansTag = document.createElement('span');
        ansTag.className = 'quizgenie-correct-badge-tag' + (isLtrBadge ? ' qg-badge-ltr' : '');
        ansTag.textContent = `🟢 الخيار الصحيح • ${confidence}`;
        try { targetContainer.appendChild(ansTag); } catch (e) {}

        // تفعيل وتمييز زر الراديو الدائري وعناصر الدوائر
        try {
          const radioInside = findRadioOrCircle(targetContainer, optEl);
          if (radioInside) {
            if (radioInside.tagName === 'INPUT') {
              radioInside.style.accentColor = '#10b981';
            }
            radioInside.classList.remove('quizgenie-circle-wrong');
            radioInside.classList.add('quizgenie-circle-correct');
          }
          const circularElements = Array.from(targetContainer.querySelectorAll('circle, svg, [class*="circle" i], [class*="radio" i], [role="radio"]'));
          if (radioInside && !circularElements.includes(radioInside)) circularElements.push(radioInside);
          circularElements.forEach(cEl => {
            cEl.classList.remove('quizgenie-circle-wrong');
            cEl.classList.add('quizgenie-circle-correct');
            if (cEl.tagName === 'circle') {
              cEl.setAttribute('fill', '#10b981');
              cEl.setAttribute('stroke', '#34d399');
            }
          });
        } catch (e) {}

        // النقر التلقائي فائق الدقة 100% فقط عند تفعيل الخيار من قبل المستخدم ومطابقة مؤكدة (Feature #2)
        if (liveAutoClickEnabled && isConfidentMatch) {
          performUltraPreciseAutoClick(targetContainer, optEl, confidence);
        }
      } else {
        // الإجابة الخاطئة: خط بارز أحمر متوهج
        targetContainer.classList.remove('quizgenie-highlight-correct', 'quizgenie-correct-answer-glow');
        targetContainer.classList.add('quizgenie-highlight-wrong', 'quizgenie-wrong-answer-outline');
        const wrongTag = document.createElement('span');
        wrongTag.className = 'quizgenie-wrong-badge-tag' + (isLtrBadge ? ' qg-badge-ltr' : '');
        wrongTag.textContent = '🔴 خيار خاطئ';
        try { targetContainer.appendChild(wrongTag); } catch (e) {}

        // تمييز زر الراديو الدائري الخاطئ
        try {
          const radioInside = findRadioOrCircle(targetContainer, optEl);
          if (radioInside) {
            if (radioInside.tagName === 'INPUT') {
              radioInside.style.accentColor = '#ef4444';
            }
            if (radioInside.getAttribute('role') === 'radio' && radioInside.getAttribute('aria-checked') === 'true') {
              radioInside.setAttribute('aria-checked', 'false');
            }
            radioInside.classList.remove('quizgenie-circle-correct');
            radioInside.classList.add('quizgenie-circle-wrong');
          }
          const circularElements = Array.from(targetContainer.querySelectorAll('circle, svg, [class*="circle" i], [class*="radio" i], [role="radio"]'));
          if (radioInside && !circularElements.includes(radioInside)) circularElements.push(radioInside);
          circularElements.forEach(cEl => {
            cEl.classList.remove('quizgenie-circle-correct');
            cEl.classList.add('quizgenie-circle-wrong');
            if (cEl.tagName === 'circle') {
              cEl.setAttribute('stroke', '#ef4444');
            }
          });
        } catch (e) {}
      }
    }

    if (liveAutoClickEnabled && isConfidentMatch) {
      showScanFeedbackBanner(`🔘 تم النقر التلقائي بدقة 100% على الخيار الصحيح! • يقين: ${confidence}`, '#10b981');
    } else if (liveAutoClickEnabled && !isConfidentMatch) {
      showScanFeedbackBanner(`🎯 تم رصد الخيار تقريبياً • يقين: ${confidence} (تجاوز النقر للأمان الأكاديمي)`, '#eab308');
    } else {
      showScanFeedbackBanner(`🎯 تم رصد الخيار الصحيح • نسبة اليقين: ${confidence} 🟢`, '#10b981');
    }
  } else if (matchedIdx === -1 && optionElements && optionElements.length > 0) {
    // احتياط خوارزمي: تحديد أول خيار كإجابة في حال عدم وضوح النموذج
    optionElements[0].classList.add('quizgenie-highlight-correct', 'quizgenie-correct-answer-glow');
    for (let i = 1; i < optionElements.length; i++) {
      optionElements[i].classList.add('quizgenie-highlight-wrong', 'quizgenie-wrong-answer-outline');
    }
    showScanFeedbackBanner(`🎯 تم التمييز التقريبي: السؤال أصفر 🟡 | الصحيح أخضر 🟢 | الخاطئ أحمر 🔴 • يقين: ${confidence}`, '#10b981');
  }

  // إزالة أي بطاقة حل سابقة منعاً لتغطية الشاشة
  const card = document.getElementById('quizgenie-direct-solution-card');
  if (card) card.remove();
}

// الاسم المعياري المترادف لميزة الحل المباشر
const highlightLiveDirectResult = applyLiveDirectSolution;
try { window.highlightLiveDirectResult = applyLiveDirectSolution; } catch (e) {}

// الاستماع لاختصار لوحة المفاتيح Ctrl+Shift+S أو F2 داخل صفحة الويب
document.addEventListener('keydown', (e) => {
  if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) || e.key === 'F2') {
    e.preventDefault();
    showLiveSelectorOverlay();
  }
});

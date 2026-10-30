// QuizGenie - Content Script (Dual Mode AI Solver v1.2.0)

let extensionEnabled = true;
let fabEnabled = true;
let serverType = 'gemini';
let subject = 'general';
let targetLanguage = 'ar';
let currentMode = 'concise';

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

// مزامنة حالة التفعيل والخادم والمادة واللغة مع الخلفية
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
} catch (e) {
  console.warn('Init state error:', e);
}

chrome.runtime.onMessage.addListener((request) => {
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
  }

  // عند طلب الحل من قائمة الزر الأيمن
  if (request.action === 'CONTEXT_MENU_TRIGGER') {
    if (request.text) {
      selectedTextCache = request.text;
      currentMode = request.mode || currentMode || 'concise';
      if (request.serverType) serverType = request.serverType;
      if (request.subject) subject = request.subject;
      if (request.targetLanguage) targetLanguage = request.targetLanguage;
      showResponsePanel(request.text, currentMode);
    }
  }

  // عند طلب الحل المباشر المستمر مع محدد الشاشة
  if (request.action === 'START_LIVE_DIRECT_SOLVER') {
    showLiveSelectorOverlay();
  }

  // عند طلب إيقاف الحل المباشر
  if (request.action === 'STOP_LIVE_DIRECT_SOLVER') {
    stopLiveDirectMode();
  }

  // عند طلب مسح وحل صفحة الامتحان من واجهة الأداة أو الاختصار
  if (request.action === 'TRIGGER_EXAM_SCAN') {
    scanAndSolveCurrentExam(request.mode || currentMode || 'concise');
  }

  // عند طلب أداة تحديد وقص الشاشة بالكامل
  if (request.action === 'START_SCREEN_AREA_SNIP') {
    startFullScreenAreaSnip(request.mode || currentMode || 'concise');
  }

  // مسح التظليلات الملونة
  if (request.action === 'CLEAR_EXAM_HIGHLIGHTS') {
    clearAllExamHighlights();
  }
});

// التفكير الاستباقي الحي المسبق أثناء حركة التحديد (Pre-computation 0s)
let preSolveDebounceTimer = null;
document.addEventListener('selectionchange', () => {
  if (!extensionEnabled || !fabEnabled) return;
  clearTimeout(preSolveDebounceTimer);
  preSolveDebounceTimer = setTimeout(() => {
    try {
      const sel = window.getSelection();
      const txt = sel ? sel.toString().trim() : '';
      if (txt.length >= 4 && txt !== currentQuestionCache.text) {
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'PRE_SOLVE',
            text: txt,
            mode: currentMode,
            subject: subject,
            targetLanguage: targetLanguage
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }, 180);
});

// مراقبة تحديد النصوص في الصفحة
document.addEventListener('mouseup', handleSelectionEvent, { capture: true });
document.addEventListener('keyup', handleSelectionEvent, { capture: true });

function handleSelectionEvent(e) {
  // إذا كانت الأداة متوقفة أو ميزة الزر العائم متوقفة، لا نفعل شيئاً
  if (!extensionEnabled || !fabEnabled) return;

  if (hostElement && (e.composedPath ? e.composedPath().includes(hostElement) : hostElement.contains(e.target))) {
    return;
  }

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (text.length > 0) {
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

      selectedTextCache = text;
      triggerPrefetch(text);
      showFAB(rect);
    } else if (!menuElement && !panelElement) {
      removeFAB();
    }
  }, 40);
}

// زر Escape للإغلاق
document.addEventListener('keydown', (e) => {
  // Alt+Q: طھط´ط؛ظٹظ„ ظ…ط§ط³ط­ ط§ظ„ط§ظ…طھط­ط§ظ† ظˆطھظ„ظˆظٹظ† ط§ظ„ط³ط¤ط§ظ„ ط¨ط§ظ„ط£طµظپط± ظˆط§ظ„ط¥ط¬ط§ط¨ط© ط¨ط§ظ„ط£ط®ط¶ط± ظˆط§ظ„ط®ط·ط£ ط¨ط§ظ„ط£ط­ظ…ط±
  if (e.altKey && (e.key === 'q' || e.key === 'Q' || e.key === 'ط¶')) {
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
        alert('ميزة القراءة الصوتية غير مدعومة في هذا المتصفح.');
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

    if (t.startsWith('🎯') || t.startsWith('⚡') || t.startsWith('📘') || t.startsWith('📐') || t.startsWith('🔍') || t.startsWith('💡')) {
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

      if (sec.header.startsWith('🎯')) {
        card.classList.add('card-answer');
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
// ًںں، Question = Yellow Glow
// ًں”´ Wrong Options = Red Tint + âœ–
// ًںں¢ Correct Option = Emerald Green Pulse + âœ”
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
    .quizgenie-question-ring-red, .quizgenie-highlight-question {
      position: relative !important;
      outline: 3.5px solid #ef4444 !important;
      outline-offset: 4px !important;
      background-color: rgba(239, 68, 68, 0.12) !important;
      border-radius: 8px !important;
      box-shadow: 0 0 22px rgba(239, 68, 68, 0.8), inset 0 0 10px rgba(239, 68, 68, 0.35) !important;
      animation: qgPulseRedRing 1.8s infinite ease-in-out !important;
      transition: all 0.3s ease !important;
    }
    .quizgenie-question-ring-red::before, .quizgenie-highlight-question::before {
      content: "ًں”´ طھظ… ظپط­طµ ظˆظ‚ط±ط§ط،ط© ظ‡ط°ط§ ط§ظ„ط³ط¤ط§ظ„" !important;
      position: absolute !important;
      top: -24px !important;
      right: 0 !important;
      background: #ef4444 !important;
      color: #ffffff !important;
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
    .quizgenie-correct-answer-glow::after, .quizgenie-highlight-correct::after {
      content: "âœ“ ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­ ط§ظ„ظ…ط¹طھظ…ط¯" !important;
      position: absolute !important;
      left: 8px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      background: #059669 !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: bold !important;
      padding: 3px 9px !important;
      border-radius: 20px !important;
      box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4) !important;
      z-index: 2147483640 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      white-space: nowrap !important;
    }
    .quizgenie-highlight-wrong {
      position: relative !important;
      outline: 1.5px dashed rgba(239, 68, 68, 0.5) !important;
      outline-offset: 2px !important;
      background-color: rgba(239, 68, 68, 0.05) !important;
      opacity: 0.6 !important;
      border-radius: 6px !important;
      transition: all 0.3s ease !important;
    }
    .quizgenie-highlight-wrong::after {
      content: "âœ–" !important;
      position: absolute !important;
      left: 8px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      color: #ef4444 !important;
      font-size: 13px !important;
      font-weight: 900 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
    }
    @keyframes qgPulseRedRing {
      0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5), inset 0 0 5px rgba(239, 68, 68, 0.2); outline-color: #ef4444; }
      50% { box-shadow: 0 0 24px rgba(239, 68, 68, 0.95), inset 0 0 12px rgba(239, 68, 68, 0.5); outline-color: #f87171; }
      100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5), inset 0 0 5px rgba(239, 68, 68, 0.2); outline-color: #ef4444; }
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
  document.querySelectorAll('.quizgenie-question-ring-red, .quizgenie-highlight-question').forEach(el => {
    el.classList.remove('quizgenie-question-ring-red', 'quizgenie-highlight-question');
  });
  document.querySelectorAll('.quizgenie-correct-answer-glow, .quizgenie-highlight-correct').forEach(el => {
    el.classList.remove('quizgenie-correct-answer-glow', 'quizgenie-highlight-correct');
  });
  document.querySelectorAll('.quizgenie-highlight-wrong').forEach(el => el.classList.remove('quizgenie-highlight-wrong'));
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

  let questionText = '';
  let questionElement = null;
  const optionsList = [];
  const optionElements = [];

  // 1. ظپط­طµ ط¥ط°ط§ ظƒط§ظ† ظ‡ظ†ط§ظƒ ظ†طµ ظ…ط­ط¯ط¯ ظ…ط³ط¨ظ‚ط§ظ‹ ط¨ط§ظ„ظ…ط§ظˆط³
  const selText = window.getSelection() ? window.getSelection().toString().trim() : '';

  // 2. طھط¬ظ…ظٹط¹ ط®ظٹط§ط±ط§طھ ط§ظ„ط±ط§ط¯ظٹظˆ (Radio buttons) ظپظٹ ط§ظ„طµظپط­ط©
  const radioInputs = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]')).filter(r => {
    const rect = r.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (radioInputs.length > 0) {
    for (const r of radioInputs) {
      const container = r.closest('label, li, tr, [class*="option"], [class*="choice"]') || r.parentElement;
      const text = (container ? container.innerText : '').replace(/^[A-Da-dط£-ط¯1-4][\.\-\)]\s*/, '').trim();
      if (text && !optionsList.includes(text)) {
        optionsList.push(text);
        optionElements.push(container || r);
      }
    }
  }

  // ط¥ط°ط§ ظ„ظ… ظ†ط¬ط¯ ط®ظٹط§ط±ط§طھ ط±ط§ط¯ظٹظˆطŒ ظ†ط¨ط­ط« ط¹ظ† ط¹ظ†ط§طµط± ط§ظ„ظ‚ظˆط§ط¦ظ… ظˆط§ظ„ط®ظٹط§ط±ط§طھ ط§ظ„ط´ط§ط¦ط¹ط©
  if (optionsList.length === 0) {
    const candidateChoices = Array.from(document.querySelectorAll('[class*="choice"], [class*="option"], [class*="answer"], li')).filter(el => {
      const t = el.innerText.trim();
      return t.length > 1 && t.length < 120 && (el.getBoundingClientRect().height > 0);
    });
    for (const el of candidateChoices.slice(0, 4)) {
      optionsList.push(el.innerText.trim());
      optionElements.push(el);
    }
  }

  // 3. ط§ظ„ط¨ط­ط« ط§ظ„ط°ظƒظٹ ط¹ظ† ط±ط£ط³ ط§ظ„ط³ط¤ط§ظ„ (ظ…ط¹ ط§ط³طھط¨ط¹ط§ط¯ ط£ظٹ ط¹ظ†ط§طµط± طھظ‚ط¹ ط¯ط§ط®ظ„ ط®ظٹط§ط±ط§طھ ط§ظ„ط¥ط¬ط§ط¨ط©)
  if (selText && selText.length > 2) {
    questionText = selText;
    const anchor = window.getSelection().anchorNode;
    questionElement = anchor ? (anchor.nodeType === 3 ? anchor.parentElement : anchor) : null;
  } else {
    // ط£) ظپط­طµ ط¹ظ†ط§طµط± ط§ظ„ط¹ظ†ط§ظˆظٹظ† ط§ظ„طھظٹ ظ„ط§ طھظ‚ط¹ ط¯ط§ط®ظ„ ط§ظ„ط®ظٹط§ط±ط§طھ
    const questionCandidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [class*="question"], [class*="prompt"], [class*="stem"], [class*="title"]')).filter(q => {
      const t = q.innerText.trim();
      const isInsideOption = optionElements.some(opt => opt.contains(q));
      return t.length > 2 && t.length < 400 && !isInsideOption && !optionsList.includes(t) && q.getBoundingClientRect().height > 0;
    });

    if (questionCandidates.length > 0) {
      questionElement = questionCandidates[0];
      questionText = questionElement.innerText.trim();
    } else {
      // ط¨) ط§ظ„ط¨ط­ط« ط¹ظ† ظ†طµظˆطµ ط§ظ„طھظ†ط§ط¸ط± ط§ظ„ظ„ظپط¸ظٹ (ظ…ط«ظ„: ظ„ط­ط§ط، : ط´ط¬ط±ط©) ط®ط§ط±ط¬ ظ‚ط§ط¦ظ…ط© ط§ظ„ط®ظٹط§ط±ط§طھ
      const allDivs = Array.from(document.querySelectorAll('div, p, span, b, strong')).filter(el => {
        const t = el.innerText ? el.innerText.trim() : '';
        const isInsideOption = optionElements.some(opt => opt.contains(el) || el.contains(opt));
        return /[\u0600-\u06FF\w]+\s*:\s*[\u0600-\u06FF\w]+/.test(t) && t.length < 60 && !isInsideOption && el.getBoundingClientRect().height > 0;
      });
      if (allDivs.length > 0) {
        questionElement = allDivs[allDivs.length - 1] || allDivs[0];
        questionText = questionElement.innerText.trim();
      }
    }
  }

  if (!questionText && optionsList.length === 0) {
    showScanFeedbackBanner('âڑ ï¸ڈ ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط³ط¤ط§ظ„ ط£ظˆ ط®ظٹط§ط±ط§طھ طھظ„ظ‚ط§ط¦ظٹط§ظ‹. ظٹظ…ظƒظ†ظƒ طھط¸ظ„ظٹظ„ ط§ظ„ط³ط¤ط§ظ„ ط¨ط§ظ„ظ…ط§ظˆط³ ط£ظˆ طھط´ط؛ظٹظ„ ط§ظ„طھط­ط¯ظٹط¯ ط§ظ„ط­ط±.', '#f59e0b');
    return;
  }

  // طھط·ط¨ظٹظ‚ ط§ظ„ط¯ط§ط¦ط±ط© / ط§ظ„ط¥ط·ط§ط± ط§ظ„ط£ط­ظ…ط± ط§ظ„ظ…طھظˆظ‡ط¬ ظپظˆط±ط§ظ‹ ط¹ظ„ظ‰ ط§ظ„ط³ط¤ط§ظ„ ط§ظ„ظ…ظ‚ط±ظˆط،
  if (questionElement) {
    questionElement.classList.add('quizgenie-question-ring-red', 'quizgenie-highlight-question');
    questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showScanFeedbackBanner('âڈ³ ط¬ط§ط±ظچ ظ…ط³ط­ ظˆط­ظ„ ط§ظ„ط³ط¤ط§ظ„ ط¨ط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ ظپظٹ 0 ط«ط§ظ†ظٹط© ظˆطھط­ط¯ظٹط¯ ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­...', '#0284c7');

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
      const err = (response && response.error) ? response.error : 'ظپط´ظ„ ط§ظ„ط§طھطµط§ظ„ ط¨ط§ظ„ط®ط¯ظ…ط©';
      showScanFeedbackBanner('â‌Œ ' + err, '#ef4444');
      return;
    }

    const data = response.data || response.result || {};
    const correctIndex = (typeof data.correctIndex === 'number') ? data.correctIndex : 0;

    // طھظ„ظˆظٹظ† ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­ ط¨ط§ظ„ط¥ط·ط§ط± ط§ظ„ط£ط®ط¶ط± ط§ظ„ظ…طھظˆظ‡ط¬
    if (optionElements.length > 0) {
      for (let i = 0; i < optionElements.length; i++) {
        if (i === correctIndex) {
          optionElements[i].classList.add('quizgenie-correct-answer-glow', 'quizgenie-highlight-correct');
          try {
            const inputInside = optionElements[i].querySelector('input[type="radio"]') || (optionElements[i].tagName === 'INPUT' ? optionElements[i] : null);
            if (inputInside) inputInside.checked = true;
          } catch (e) {}
        } else {
          optionElements[i].classList.add('quizgenie-highlight-wrong');
        }
      }
    }

    showScanResultModal(questionText, data.correctText || optionsList[correctIndex] || '', data.explanation || data.rawAnswer || '', preferredMode, data.relation);
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
    <span>ًںژ¯ ط§ط³ط­ط¨ ط¨ط§ظ„ظ…ط§ظˆط³ ظ„طھط­ط¯ظٹط¯ ظ…ظ†ط·ظ‚ط© ط§ظ„ط³ط¤ط§ظ„ ظˆط§ظ„ط®ظٹط§ط±ط§طھ ظ…ط¹ط§ظ‹</span>
    <button id="qg-snip-auto-btn" style="background:#0284c7; border:none; color:#fff; padding:5px 12px; border-radius:20px; font-weight:700; cursor:pointer;">âڑ، ظ…ط³ط­ طھظ„ظ‚ط§ط¦ظٹ ظƒط§ظ…ظ„</button>
    <button id="qg-snip-cancel-btn" style="background:#334155; border:none; color:#cbd5e1; padding:5px 10px; border-radius:20px; cursor:pointer;">ط¥ظ„ط؛ط§ط، (Esc)</button>
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

  showScanFeedbackBanner('âڈ³ ط¬ط§ط±ظچ طھط­ظ„ظٹظ„ ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ظ…ط­ط¯ط¯ط© ط¨ط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ...', '#0284c7');

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
      showScanFeedbackBanner('â‌Œ طھط¹ط°ط± ط­ظ„ ط§ظ„ط³ط¤ط§ظ„ ط§ظ„ظ…ط­ط¯ط¯.', '#ef4444');
      return;
    }
    const data = response.data || response.result || {};
    const correctIndex = (typeof data.correctIndex === 'number') ? data.correctIndex : 0;

    if (optionElements[correctIndex]) {
      optionElements[correctIndex].classList.add('quizgenie-correct-answer-glow', 'quizgenie-highlight-correct');
    }
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
        <span style="font-size:18px;">ًںژ¯</span>
        <strong style="font-size:13px; color:#38bdf8;">طھظ… ظپط­طµ ط§ظ„ط³ط¤ط§ظ„ ظˆطھط­ط¯ظٹط¯ ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­</strong>
      </div>
      <button id="qg-close-scan-card" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer; line-height:1;">&times;</button>
    </div>
    <div style="margin-bottom:8px;">
      <span style="font-size:11px; color:#ef4444; font-weight:700;">ًں”´ ط§ظ„ط³ط¤ط§ظ„ ط§ظ„ظ…ظ‚ط±ظˆط،:</span>
      <div style="font-size:12.5px; color:#e2e8f0; margin-top:2px; font-weight:600;">${questionText || ''}</div>
    </div>
    ${relation ? `<div style="font-size:11px; color:#38bdf8; margin-bottom:6px; background:rgba(56,189,248,0.1); padding:4px 8px; border-radius:6px;">ًں’، ط§ظ„ط¹ظ„ط§ظ‚ط©: ${relation}</div>` : ''}
    <div style="background:rgba(16,185,129,0.15); border:1.5px solid #10b981; border-radius:10px; padding:10px; margin-bottom:10px;">
      <span style="font-size:11px; color:#34d399; font-weight:700;">ًںں¢ ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­ ط§ظ„ظ…ط¹طھظ…ط¯:</span>
      <div style="font-size:14px; font-weight:800; color:#ffffff; margin-top:3px;">${correctText || ''}</div>
    </div>
    <div style="max-height:130px; overflow-y:auto; font-size:11.5px; color:#cbd5e1; line-height:1.5; margin-bottom:12px; white-space:pre-wrap;">${rawAnswer || ''}</div>
    <div style="display:flex; gap:8px;">
      <button id="qg-voice-tts-btn" style="flex:1; background:#1e293b; border:1px solid #475569; color:#cbd5e1; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">ًں”ٹ ط§ط³طھظ…ط§ط¹</button>
      <button id="qg-clear-highlights-btn" style="flex:1; background:#0284c7; border:none; color:#fff; padding:6px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">âœ– ظ…ط³ط­ ط§ظ„طھظ„ظˆظٹظ†</button>
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
        ttsBtn.textContent = 'ًں”ٹ ط§ط³طھظ…ط§ط¹';
        return;
      }
      const utter = new SpeechSynthesisUtterance((correctText ? 'ط§ظ„ط®ظٹط§ط± ط§ظ„طµط­ظٹط­ ظ‡ظˆ ' + correctText + '. ' : '') + rawAnswer);
      utter.lang = 'ar-SA';
      utter.rate = 1.0;
      utter.onend = () => { ttsBtn.textContent = 'ًں”ٹ ط§ط³طھظ…ط§ط¹'; };
      ttsBtn.textContent = 'âڈ¹ ط¥ظٹظ‚ط§ظپ ط§ظ„طµظˆطھ';
      window.speechSynthesis.speak(utter);
    }
  });
}

// ط²ط± ط§ظ„ظ…ط§ط³ط­ ط§ظ„ط¹ط§ط¦ظ… ط¹ظ„ظ‰ طµظپط­ط§طھ ط§ظ„ط§ط®طھط¨ط§ط±ط§طھ
function initExamScannerFab() {
  if (document.getElementById('quizgenie-exam-scanner-pill')) return;
  const pill = document.createElement('button');
  pill.id = 'quizgenie-exam-scanner-pill';
  pill.className = 'quizgenie-scanner-fab';
  pill.innerHTML = `
    <span style="font-size:15px;">ًں”چ</span>
    <span>ظ…ط³ط­ ظˆط­ظ„ ط§ظ„ط§ظ…طھط­ط§ظ†</span>
  `;
  pill.addEventListener('click', () => {
    scanAndSolveCurrentExam(currentMode);
  });
  document.body.appendChild(pill);
}

// طھظپط¹ظٹظ„ ط§ظ„ط²ط± ط§ظ„ط¹ط§ط¦ظ… ظ„ظ„ط§ظ…طھط­ط§ظ†ط§طھ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¹ظ†ط¯ ظˆط¬ظˆط¯ ظ…ط¤ط´ط±ط§طھ ط§ظ„ط§ط®طھط¨ط§ط±
setTimeout(() => {
  const isExamPage = document.querySelector('input[type="radio"], [role="radio"], [class*="exam"], [class*="quiz"], [class*="question"]');
  if (isExamPage && extensionEnabled && fabEnabled) {
    initExamScannerFab();
  }
}, 1000);

// --- مركز تخصيص المظهر وشكل الحواف والشريط العائم v2.1.0 ---
let activeBorderShape = 'smooth';
let activePrimaryColor = '#0284c7';
let activeBgColor = '#0f172a';
let activeGlowColor = '#10b981';
let activeRingColor = '#ef4444';
let isMiniToolbarEnabled = true;

function loadThemeSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({
      customBorderShape: 'smooth',
      customPrimaryColor: '#0284c7',
      customBgColor: '#0f172a',
      customGlowColor: '#10b981',
      customRingColor: '#ef4444',
      customMiniToolbar: true
    }, (data) => {
      activeBorderShape = data.customBorderShape || 'smooth';
      activePrimaryColor = data.customPrimaryColor || '#0284c7';
      activeBgColor = data.customBgColor || '#0f172a';
      activeGlowColor = data.customGlowColor || '#10b981';
      activeRingColor = data.customRingColor || '#ef4444';
      isMiniToolbarEnabled = data.customMiniToolbar !== false;

      updatePageThemeVariables();
      if (isMiniToolbarEnabled && extensionEnabled) {
        ensureMiniExamToolbar();
      } else {
        removeMiniExamToolbar();
      }
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
  if (document.getElementById('quizgenie-mini-exam-bar')) return;
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ensureMiniExamToolbar(), { once: true });
    }
    return;
  }
  const bar = document.createElement('div');
  bar.id = 'quizgenie-mini-exam-bar';
  bar.innerHTML = `
    <span class="qg-drag-handle" title="اسحب لتحريك الشريط بحرية في الشاشة">⠿</span>
    <button type="button" class="qg-mini-btn qg-mini-btn-concise" id="qgMiniBtnConcise" title="حل مباشر وفوري (0.0 ثانية)">⚡ مباشر</button>
    <button type="button" class="qg-mini-btn qg-mini-btn-detailed" id="qgMiniBtnDetailed" title="حل مفصل مع الشرح">📖 مفصل</button>
    <button type="button" class="qg-mini-btn qg-mini-btn-snip" id="qgMiniBtnSnip" title="أداة التحديد والقص الحر">✂️ قص</button>
    <button type="button" class="qg-mini-btn-toggle" id="qgMiniBtnMinimize" title="تصغير لنقطة خفية">─</button>
  `;
  document.body.appendChild(bar);

  // استعادة المكان المحفوظ
  try {
    const savedPos = JSON.parse(localStorage.getItem('quizgenie_mini_bar_pos') || 'null');
    if (savedPos && savedPos.x !== undefined && savedPos.y !== undefined) {
      bar.style.bottom = 'auto';
      bar.style.left = savedPos.x + 'px';
      bar.style.top = savedPos.y + 'px';
    }
  } catch (e) {}

  // السحب الحر (Draggable)
  let isDragging = false;
  let startX, startY, initialX, initialY;
  const handle = bar.querySelector('.qg-drag-handle');

  if (handle) {
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = bar.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      bar.style.transition = 'none';
      e.preventDefault();
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newX = Math.max(10, Math.min(window.innerWidth - bar.offsetWidth - 10, initialX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - bar.offsetHeight - 10, initialY + dy));
    bar.style.bottom = 'auto';
    bar.style.left = newX + 'px';
    bar.style.top = newY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      bar.style.transition = 'transform 0.2s, box-shadow 0.2s, opacity 0.2s';
      const rect = bar.getBoundingClientRect();
      localStorage.setItem('quizgenie_mini_bar_pos', JSON.stringify({ x: rect.left, y: rect.top }));
    }
  });

  // أزرار الشريط
  const bConcise = bar.querySelector('#qgMiniBtnConcise');
  if (bConcise) {
    bConcise.addEventListener('click', () => {
      scanAndSolveCurrentExam('concise');
    });
  }

  const bDetailed = bar.querySelector('#qgMiniBtnDetailed');
  if (bDetailed) {
    bDetailed.addEventListener('click', () => {
      scanAndSolveCurrentExam('detailed');
    });
  }

  const bSnip = bar.querySelector('#qgMiniBtnSnip');
  if (bSnip) {
    bSnip.addEventListener('click', () => {
      startFullScreenAreaSnip('concise');
    });
  }

  const btnMin = bar.querySelector('#qgMiniBtnMinimize');
  if (btnMin) {
    btnMin.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.classList.add('minimized');
    });
  }

  bar.addEventListener('click', (e) => {
    if (bar.classList.contains('minimized')) {
      bar.classList.remove('minimized');
    }
  });
}

function removeMiniExamToolbar() {
  const bar = document.getElementById('quizgenie-mini-exam-bar');
  if (bar) bar.remove();
}

// الاستماع لرسائل مزامنة الثيم الحية
chrome.runtime.onMessage.addListener((request) => {
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
  }
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
let isSolvingLiveStep = false;

function showLiveSelectorOverlay() {
  stopLiveDirectMode();
  clearAllExamHighlights();

  const existing = document.getElementById('quizgenie-live-selector-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quizgenie-live-selector-overlay';

  // شريط علوي عائم بتصميم سكرين شوت ويندوز 11 (Windows Snipping Tool Pill)
  const toolbar = document.createElement('div');
  toolbar.className = 'qg-snipping-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="qg-snipping-btn active" id="qgSnipRectBtn" title="تحديد مستطيل (قص السؤال والخيارات)">
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
  hint.textContent = '📸 اسحب الماوس لتحديد السؤال والخيارات مثل سكرين شوت ويندوز (Win+Shift+S) ليحل معك فوراً';
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
    });
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
      });
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

function startLiveDirectMode(region) {
  stopLiveDirectMode();
  ensureHighlightStylesInPage();

  liveDirectActive = true;
  liveDirectRegion = region;
  liveDirectLastQuestion = '';

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

  // 2. إظهار شريط التحكم أعلى اليمين (زر الإيقاف + العلامة الدائرية الحمراء المؤشرة + زر سكرين شوت جديد)
  const hud = document.createElement('div');
  hud.id = 'quizgenie-live-direct-hud';
  hud.innerHTML = `
    <button type="button" class="qg-live-stop-btn" id="qgLiveStopBtn" title="اضغط هنا لإيقاف ميزة الحل المباشر">
      <span>⏹️</span>
      <span>إيقاف الحل المباشر</span>
    </button>
    <div class="qg-live-indicator-pill">
      <span class="qg-pulsing-red-circle"></span>
      <span style="font-size: 11px; font-weight: 700; color: #fca5a5;">الحل المباشر مفعّل</span>
    </div>
    <button type="button" class="qg-live-resnip-btn" id="qgLiveResnipBtn" title="قص وتحديد سؤال جديد (مثل Win+Shift+S)">
      <span>📸</span>
      <span>قص سؤال جديد</span>
    </button>
  `;
  host.appendChild(hud);

  hud.querySelector('#qgLiveStopBtn').addEventListener('click', () => {
    stopLiveDirectMode();
  });

  hud.querySelector('#qgLiveResnipBtn').addEventListener('click', () => {
    showLiveSelectorOverlay();
  });

  showScanFeedbackBanner('⚡ تم تفعيل الحل المباشر! جاري قراءة السؤال وحله معك فوراً...', '#0284c7');

  // 3. تنفيذ الفحص والحل الأولي الفوري
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
}

function stopLiveDirectMode() {
  liveDirectActive = false;
  liveDirectRegion = null;
  liveDirectLastQuestion = '';

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

  // إزالة البطاقة العائمة السابقة إن وجدت
  const card = document.getElementById('quizgenie-direct-solution-card');
  if (card) card.remove();

  showScanFeedbackBanner('⏹️ تم إيقاف ميزة الحل المباشر.', '#64748b');
}

// محرك استخراج السؤال والخيارات بذكاء من داخل إحداثيات السكرين شوت
function extractQuestionAndOptionsFromRegion(region) {
  let candidateElements = [];
  const all = Array.from(document.querySelectorAll('div, p, span, label, li, h1, h2, h3, h4, h5, b, strong, button, input'));
  
  if (region.isFullScreen) {
    candidateElements = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('#quizgenie-live-selector-overlay, #quizgenie-live-direct-hud, #quizgenie-toast-container');
    });
  } else {
    candidateElements = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (el.closest('#quizgenie-live-selector-overlay, #quizgenie-live-direct-hud, #quizgenie-toast-container, #quizgenie-monitored-area-frame, #quizgenie-direct-solution-card')) return false;
      return (r.left >= region.left - 25 && r.right <= region.right + 25 &&
              r.top >= region.top - 25 && r.bottom <= region.bottom + 25);
    });
  }

  const optionsList = [];
  const optionElements = [];
  let questionElement = null;
  let questionText = '';

  // 1. فحص عناصر الراديو أو كلاسات الخيارات
  for (const el of candidateElements) {
    const isRadio = (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) || el.getAttribute('role') === 'radio';
    const isChoiceCls = el.classList.contains('choice') || el.classList.contains('option') || el.tagName === 'LI' || el.tagName === 'LABEL';
    if (isRadio || isChoiceCls) {
      const container = el.closest('label, li, tr, [class*="option"], [class*="choice"], [class*="radio"]') || el.parentElement || el;
      const text = (container ? container.innerText : el.innerText || '').replace(/^[A-Da-dأ-د1-4][\.\-\)]\s*/, '').trim();
      if (text && text.length > 0 && text.length < 150 && !optionsList.includes(text)) {
        optionsList.push(text);
        optionElements.push(container);
      }
    }
  }

  // 2. دعم الخيارات المسبوقة برموز أو حروف (أ - ب - ج - د أو A - B - C - D)
  if (optionsList.length < 2) {
    for (const el of candidateElements) {
      if (el.children.length > 2) continue;
      const txt = (el.innerText || '').trim();
      if (!txt || txt.length > 120 || txt.length < 1) continue;
      if (/^(Previous|Next|Submit|السابق|التالي|إرسال|حفظ|درجة|وقت)/i.test(txt)) continue;

      const hasPrefix = /^([A-Da-dأ-د1-4][\.\-\)]|[○●•])\s*(.+)/.test(txt);
      if (hasPrefix) {
        const clean = txt.replace(/^([A-Da-dأ-د1-4][\.\-\)]|[○●•])\s*/, '').trim();
        if (clean && !optionsList.includes(clean)) {
          optionsList.push(clean);
          optionElements.push(el);
        }
      }
    }
  }

  // 3. دعم المنصات الحديثة (مثل منصات القدرات ونون حيث الخيارات كتل نصية مستقلة)
  if (optionsList.length < 2) {
    const leafCandidates = candidateElements.filter(el => {
      const txt = (el.innerText || '').trim();
      return el.children.length === 0 && txt.length > 1 && txt.length < 90 &&
             !/^(Previous|Next|Submit|السابق|التالي|إرسال|حفظ|درجة|وقت|Of)/i.test(txt);
    });

    for (const el of leafCandidates) {
      const txt = el.innerText.trim();
      if (!optionsList.includes(txt)) {
        optionsList.push(txt);
        optionElements.push(el);
      }
    }
  }

  // 4. استخراج رأس السؤال (فحص التناظر اللفظي أولاً ثم علامات الاستفهام ثم أول كتلة)
  for (const el of candidateElements) {
    const txt = (el.innerText || '').trim();
    if (txt && /[\u0600-\u06FF\w]+\s*:\s*[\u0600-\u06FF\w]+/.test(txt)) {
      const isChoice = optionElements.includes(el) || optionElements.some(o => o.contains(el));
      if (!isChoice || txt.length < 60) {
        questionText = txt;
        questionElement = el;
        const idx = optionsList.indexOf(txt);
        if (idx !== -1) {
          optionsList.splice(idx, 1);
          optionElements.splice(idx, 1);
        }
        break;
      }
    }
  }

  if (!questionText) {
    for (const el of candidateElements) {
      const txt = (el.innerText || '').trim();
      const isOpt = optionElements.some(opt => opt.contains(el) || el.contains(opt));
      if (!isOpt && txt && txt.length > 2 && txt.length < 350) {
        if (/^(Previous|Next|Submit|السابق|التالي|إرسال|حفظ|Of)/i.test(txt)) continue;
        questionElement = el;
        questionText = txt;
        break;
      }
    }
  }

  if (!questionText && optionsList.length > 2) {
    questionText = optionsList.shift();
    questionElement = optionElements.shift();
  }

  return { questionText, questionElement, optionsList, optionElements };
}

function executeLiveDirectSolveStep() {
  if (!liveDirectActive || isSolvingLiveStep) return;

  const region = liveDirectRegion;
  if (!region) return;

  const parsed = extractQuestionAndOptionsFromRegion(region);
  const questionText = parsed.questionText;
  const questionElement = parsed.questionElement;
  const optionsList = parsed.optionsList;
  const optionElements = parsed.optionElements;

  if (!questionText || optionsList.length === 0) return;

  // تحقق هل السؤال تغير فعلاً عن السؤال المحلول سابقاً
  const questionKey = questionText.replace(/\s+/g, ' ');
  if (questionKey === liveDirectLastQuestion) return;

  liveDirectLastQuestion = questionKey;
  isSolvingLiveStep = true;

  clearAllExamHighlights();

  // إزالة البطاقة السابقة
  const oldCard = document.getElementById('quizgenie-direct-solution-card');
  if (oldCard) oldCard.remove();

  // 1. وضع الدائرة الحمراء المتوهجة حول السؤال المقروء
  if (questionElement) {
    questionElement.classList.add('quizgenie-question-ring-red', 'quizgenie-highlight-question');
    try { questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }

  // 2. إرسال السؤال لحله فورياً عبر خادم الذكاء الاصطناعي
  chrome.runtime.sendMessage({
    action: 'SOLVE_EXAM_SCAN',
    question: questionText,
    questionText: questionText,
    options: optionsList,
    optionsList: optionsList,
    mode: 'concise',
    subject: subject || 'qudrat',
    targetLanguage: targetLanguage || 'ar'
  }, (response) => {
    isSolvingLiveStep = false;
    if (chrome.runtime.lastError || !response || !response.success) {
      return;
    }

    const data = response.data || response.result || {};
    const correctIndex = (typeof data.correctIndex === 'number') ? data.correctIndex : 0;
    const correctChoiceText = data.correctChoiceText || data.correctText || '';
    const explanation = data.explanation || '';
    const relation = data.relation || '';

    // 3. إضاءة الخيار الصحيح باللون الأخضر المتوهج
    let matchedOptionElement = null;
    if (correctIndex >= 0 && correctIndex < optionElements.length) {
      matchedOptionElement = optionElements[correctIndex];
    } else if (correctChoiceText) {
      const cleanTarget = correctChoiceText.toLowerCase().replace(/^[a-dأ-د1-4][\.\-\)]\s*/, '').trim();
      for (let i = 0; i < optionsList.length; i++) {
        const cleanOpt = optionsList[i].toLowerCase().trim();
        if (cleanOpt.includes(cleanTarget) || cleanTarget.includes(cleanOpt)) {
          matchedOptionElement = optionElements[i];
          break;
        }
      }
    }

    if (matchedOptionElement) {
      matchedOptionElement.classList.add('quizgenie-highlight-correct');
    }

    // 4. إظهار بطاقة الحل الذكية العائمة بجانب السؤال أو المنطقة
    const answerDisplay = correctChoiceText || (optionsList[correctIndex] || 'الإجابة المحددة');
    const card = document.createElement('div');
    card.id = 'quizgenie-direct-solution-card';
    card.className = 'qg-direct-solution-card';
    
    let spawnLeft = region.right + 15;
    let spawnTop = region.top;
    if (spawnLeft + 350 > window.innerWidth) {
      spawnLeft = Math.max(15, region.left - 365);
    }
    card.style.left = spawnLeft + 'px';
    card.style.top = Math.max(20, spawnTop) + 'px';

    card.innerHTML = `
      <div class="qg-direct-solution-header">
        <span>🎯 الإجابة الصحيحة:</span>
        <span style="color: #38bdf8; font-weight: 800;">${answerDisplay}</span>
      </div>
      ${relation ? `<div style="font-size: 11.5px; color: #fbbf24; margin-bottom: 4px;">🔗 <strong>العلاقة:</strong> ${relation}</div>` : ''}
      ${explanation ? `<div class="qg-direct-solution-body">${explanation}</div>` : ''}
    `;
    (document.body || document.documentElement).appendChild(card);
  });
}

// الاستماع لاختصار لوحة المفاتيح Ctrl+Shift+S أو F2 داخل صفحة الويب
document.addEventListener('keydown', (e) => {
  if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) || e.key === 'F2') {
    e.preventDefault();
    showLiveSelectorOverlay();
  }
});

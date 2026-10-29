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
  return chrome.runtime.getURL('icons/icon48.png');
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
chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
  if (response) {
    if (response.enabled !== undefined) extensionEnabled = response.enabled;
    if (response.fabEnabled !== undefined) fabEnabled = response.fabEnabled;
    if (response.serverType) serverType = response.serverType;
    if (response.subject) subject = response.subject;
    if (response.defaultMode) currentMode = response.defaultMode;
    if (response.targetLanguage) targetLanguage = response.targetLanguage;
  }
});

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
      showFAB(rect);
    } else if (!menuElement && !panelElement) {
      removeFAB();
    }
  }, 40);
}

// زر Escape للإغلاق
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
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
        <button class="quizgenie-copy-btn" id="qg-copy">نسخ الإجابة</button>
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
  let currentResultText = '';

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
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
}

// عرض الإجابة بتنسيق بارز وواضح للاختبارات
function renderAnswerContent(markdownText, container) {
  container.innerHTML = '';
  container.setAttribute('dir', 'auto');

  const lines = markdownText.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;

  // الإجابة البارزة (السطر الأول)
  const firstLine = lines[0];
  const badge = document.createElement('div');
  badge.className = 'quizgenie-answer-badge';
  badge.textContent = firstLine;
  container.appendChild(badge);

  // بقية الأسطر للشرح والتحليل
  if (lines.length > 1) {
    const contentText = document.createElement('div');
    contentText.className = 'quizgenie-content-text';
    contentText.textContent = lines.slice(1).join('\n\n');
    container.appendChild(contentText);
  }
}

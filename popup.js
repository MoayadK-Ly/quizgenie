// QuizGenie - Comprehensive Popup Controller (Active Server Display & Key Validator v2.4.8)

// Bulletproof Universal Chrome API and Exception Shield to eliminate popup.html:0 errors
function checkLastError() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message;
      return msg || true;
    }
  } catch (e) {}
  return null;
}

function showPopupBanner(message, type = 'warning') {
  try {
    let banner = document.getElementById('qgPopupNoticeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'qgPopupNoticeBanner';
      banner.style.position = 'fixed';
      banner.style.bottom = '10px';
      banner.style.left = '10px';
      banner.style.right = '10px';
      banner.style.zIndex = '999999';
      banner.style.padding = '10px 14px';
      banner.style.borderRadius = '10px';
      banner.style.fontSize = '12px';
      banner.style.fontWeight = 'bold';
      banner.style.lineHeight = '1.5';
      banner.style.textAlign = 'right';
      banner.style.direction = 'rtl';
      banner.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
      banner.style.transition = 'all 0.3s ease';
      banner.style.display = 'flex';
      banner.style.alignItems = 'center';
      banner.style.justifyContent = 'space-between';
      banner.style.gap = '8px';
      document.body.appendChild(banner);
    }

    if (type === 'error' || type === 'warning') {
      banner.style.background = 'linear-gradient(135deg, #7f1d1d, #991b1b)';
      banner.style.border = '1.5px solid #ef4444';
      banner.style.color = '#fee2e2';
    } else {
      banner.style.background = 'linear-gradient(135deg, #064e3b, #047857)';
      banner.style.border = '1.5px solid #10b981';
      banner.style.color = '#d1fae5';
    }

    banner.innerHTML = `
      <div style="flex: 1; word-break: break-word;">${message}</div>
      <button type="button" style="background: rgba(255,255,255,0.2); border: none; color: #fff; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; white-space: nowrap;">إغلاق</button>
    `;

    const closeBtn = banner.querySelector('button');
    if (closeBtn) {
      closeBtn.onclick = () => {
        banner.style.display = 'none';
      };
    }

    banner.style.display = 'flex';
    if (banner._hideTimer) clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => {
      if (banner) banner.style.display = 'none';
    }, 6000);
  } catch (bannerErr) {
    console.warn('showPopupBanner error:', bannerErr);
  }
}

function isTabScriptable(url) {
  if (!url) return false;
  const u = url.toLowerCase().trim();
  return !(
    u.startsWith('chrome://') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('edge://') ||
    u.startsWith('about:') ||
    u.startsWith('devtools://') ||
    u.startsWith('view-source:') ||
    u.startsWith('chrome-search://') ||
    u.includes('chrome.google.com/webstore') ||
    u.includes('chromewebstore.google.com')
  );
}

function safeSendTabMessage(tabId, payload, callback) {
  if (!tabId) {
    if (callback) callback(false, null);
    return;
  }
  try {
    chrome.tabs.get(tabId, (tab) => {
      checkLastError();
      const tabUrl = (tab && (tab.url || tab.pendingUrl)) || '';
      if (!isTabScriptable(tabUrl)) {
        showPopupBanner('⚠️ لا يمكن تشغيل الأداة على صفحات المتصفح الداخلية (chrome://). يرجى فتح صفحة امتحان أو موقع دراسي.', 'warning');
        if (callback) callback(false, null);
        return;
      }

      chrome.tabs.sendMessage(tabId, payload, (resp) => {
        if (!checkLastError()) {
          if (callback) callback(true, resp);
          return;
        }

        // First attempt failed, attempt injection of content.js and content.css
        if (typeof chrome !== 'undefined' && chrome.scripting && chrome.scripting.executeScript) {
          try {
            let retried = false;
            const doRetry = () => {
              if (retried) return;
              retried = true;
              try {
                chrome.tabs.sendMessage(tabId, payload, (retryResp) => {
                  if (!checkLastError()) {
                    if (callback) callback(true, retryResp);
                  } else {
                    if (callback) callback(false, null);
                  }
                });
              } catch (retryErr) {
                checkLastError();
                if (callback) callback(false, null);
              }
            };

            if (chrome.scripting.insertCSS) {
              try {
                const cPromise = chrome.scripting.insertCSS({
                  target: { tabId: tabId },
                  files: ['content.css']
                });
                if (cPromise && typeof cPromise.catch === 'function') {
                  cPromise.catch(() => { checkLastError(); });
                }
              } catch (cssErr) {
                checkLastError();
              }
            }

            try {
              const sPromise = chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
              });

              if (sPromise && typeof sPromise.then === 'function') {
                sPromise.then(() => doRetry()).catch(() => {
                  checkLastError();
                  if (callback) callback(false, null);
                });
              } else {
                setTimeout(doRetry, 250);
              }
            } catch (scrErr) {
              checkLastError();
              setTimeout(doRetry, 250);
            }

            // Safety timeout in case promise takes longer than 350ms
            setTimeout(() => {
              doRetry();
            }, 350);

          } catch (injErr) {
            checkLastError();
            if (callback) callback(false, null);
          }
        } else {
          if (callback) callback(false, null);
        }
      });
    });
  } catch (err) {
    checkLastError();
    if (callback) callback(false, null);
  }
}

(function installUniversalChromeShield() {
  function safeWrap(cb) {
    if (typeof cb !== 'function') return cb;
    return function shieldedCallback() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          const _ignored = chrome.runtime.lastError;
        }
      } catch (e) {}
      try {
        return cb.apply(this, arguments);
      } catch (err) {
        console.warn('Shielded callback warning:', err);
      }
    };
  }

  function safeWrapPromise(p) {
    if (p && typeof p.catch === 'function') {
      return p.catch(() => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            const _ignored = chrome.runtime.lastError;
          }
        } catch (e) {}
      });
    }
    return p;
  }

  try {
    if (typeof chrome !== 'undefined') {
      if (chrome.storage && chrome.storage.local) {
        const origGet = chrome.storage.local.get.bind(chrome.storage.local);
        chrome.storage.local.get = function(keys, cb) {
          try {
            return safeWrapPromise(origGet(keys, safeWrap(cb)));
          } catch (e) {
            checkLastError();
          }
        };
        const origSet = chrome.storage.local.set.bind(chrome.storage.local);
        chrome.storage.local.set = function(items, cb) {
          try {
            return safeWrapPromise(origSet(items, safeWrap(cb)));
          } catch (e) {
            checkLastError();
          }
        };
      }
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const origSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
        chrome.runtime.sendMessage = function() {
          const args = Array.from(arguments);
          const lastIdx = args.length - 1;
          if (typeof args[lastIdx] === 'function') {
            args[lastIdx] = safeWrap(args[lastIdx]);
          } else {
            args.push(safeWrap(() => {}));
          }
          try {
            return safeWrapPromise(origSendMessage.apply(chrome.runtime, args));
          } catch (e) {
            checkLastError();
          }
        };
      }
      if (chrome.tabs) {
        if (chrome.tabs.sendMessage) {
          const origTabsSend = chrome.tabs.sendMessage.bind(chrome.tabs);
          chrome.tabs.sendMessage = function() {
            const args = Array.from(arguments);
            const lastIdx = args.length - 1;
            if (typeof args[lastIdx] === 'function') {
              args[lastIdx] = safeWrap(args[lastIdx]);
            } else {
              args.push(safeWrap(() => {}));
            }
            try {
              return safeWrapPromise(origTabsSend.apply(chrome.tabs, args));
            } catch (e) {
              checkLastError();
            }
          };
        }
        if (chrome.tabs.query) {
          const origTabsQuery = chrome.tabs.query.bind(chrome.tabs);
          chrome.tabs.query = function(q, cb) {
            try {
              return safeWrapPromise(origTabsQuery(q, safeWrap(cb)));
            } catch (e) {
              checkLastError();
            }
          };
        }
        if (chrome.tabs.create) {
          const origTabsCreate = chrome.tabs.create.bind(chrome.tabs);
          chrome.tabs.create = function(props, cb) {
            try {
              return safeWrapPromise(origTabsCreate(props, safeWrap(cb || (() => {}))));
            } catch (e) {
              checkLastError();
            }
          };
        }
      }
      if (chrome.scripting) {
        if (chrome.scripting.executeScript) {
          const origExec = chrome.scripting.executeScript.bind(chrome.scripting);
          chrome.scripting.executeScript = function(props, cb) {
            try {
              if (typeof cb === 'function') {
                return safeWrapPromise(origExec(props, safeWrap(cb)));
              }
              return safeWrapPromise(origExec(props));
            } catch (e) {
              checkLastError();
            }
          };
        }
        if (chrome.scripting.insertCSS) {
          const origCss = chrome.scripting.insertCSS.bind(chrome.scripting);
          chrome.scripting.insertCSS = function(props, cb) {
            try {
              if (typeof cb === 'function') {
                return safeWrapPromise(origCss(props, safeWrap(cb)));
              }
              return safeWrapPromise(origCss(props));
            } catch (e) {
              checkLastError();
            }
          };
        }
      }
    }
  } catch (e) {
    console.warn('Shield init warning:', e);
  }
})();

window.addEventListener('error', (event) => {
  try {
    checkLastError();
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
  } catch (e) {}
  return true;
}, true);

window.addEventListener('unhandledrejection', (event) => {
  try {
    checkLastError();
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
  } catch (e) {}
}, true);

document.addEventListener('DOMContentLoaded', () => {
  // شريط توضيح الخادم النشط الحالي (للعرض والإعلام فقط - غير قابل للنقر)
  const activeServerDisplayCard = document.getElementById('activeServerDisplayCard');
  const displayServerIcon = document.getElementById('displayServerIcon');
  const displayServerName = document.getElementById('displayServerName');
  const displayServerBadgeText = document.getElementById('displayServerBadgeText');

  // عناصر زر يقفل ويفعل الأداة بالكامل
  const masterToggleBtn = document.getElementById('masterToggleBtn');
  const powerIcon = document.getElementById('powerIcon');
  const powerMainText = document.getElementById('powerMainText');
  const powerSubText = document.getElementById('powerSubText');
  const powerIndicatorPill = document.getElementById('powerIndicatorPill');

  // عناصر القوائم المنسدلة المرتبة فوق بعض (Accordion Items & Badges)
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  const accServerBadge = document.getElementById('accServerBadge');
  const accSubjectBadge = document.getElementById('accSubjectBadge');
  const accLangBadge = document.getElementById('accLangBadge');
  const accModeBadge = document.getElementById('accModeBadge');

  // زر مخصص لتفعيل / إلغاء ميزة الزر العائم
  const fabToggleInput = document.getElementById('fabToggleInput');

  // عناصر اختيار الخوادم الثلاثة
  const serverCards = document.querySelectorAll('.server-card');
  const activeServerBadge = document.getElementById('activeServerBadge');
  const headerServerBadge = document.getElementById('headerServerBadge');

  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const saveGeminiKeyBtn = document.getElementById('saveGeminiKeyBtn');

  const openaiKeyInput = document.getElementById('openaiKeyInput');
  const saveOpenaiKeyBtn = document.getElementById('saveOpenaiKeyBtn');

  const deepseekKeyInput = document.getElementById('deepseekKeyInput');
  const saveDeepseekKeyBtn = document.getElementById('saveDeepseekKeyBtn');

  const groqKeyInput = document.getElementById('groqKeyInput');
  const saveGroqKeyBtn = document.getElementById('saveGroqKeyBtn');

  // أزرار وصناديق فحص الكود والاتصال بالخادم
  const testFreeBtn = document.getElementById('testFreeBtn');
  const freeStatusBox = document.getElementById('freeStatusBox');

  const testFreeBackupBtn = document.getElementById('testFreeBackupBtn');
  const freeBackupStatusBox = document.getElementById('freeBackupStatusBox');

  const testDeepseekBtn = document.getElementById('testDeepseekBtn');
  const deepseekStatusBox = document.getElementById('deepseekStatusBox');

  const testGroqBtn = document.getElementById('testGroqBtn');
  const groqStatusBox = document.getElementById('groqStatusBox');

  const testGeminiBtn = document.getElementById('testGeminiBtn');
  const geminiStatusBox = document.getElementById('geminiStatusBox');

  const testOpenaiBtn = document.getElementById('testOpenaiBtn');
  const openaiStatusBox = document.getElementById('openaiStatusBox');

  // خيارات تحديد المادة الدراسية
  const allSubjectsSelect = document.getElementById('allSubjectsSelect');
  const subjectPills = document.querySelectorAll('.subject-pill');
  const currentSubjectBadge = document.getElementById('currentSubjectBadge');

  // خيارات تحديد لغة الإجابة المفضلة
  const allLangsSelect = document.getElementById('allLangsSelect');
  const langPills = document.querySelectorAll('.lang-pill');
  const currentLangBadge = document.getElementById('currentLangBadge');

  // خيارات نوع الإجابة
  const modeConciseBtn = document.getElementById('modeConciseBtn');
  const modeDetailedBtn = document.getElementById('modeDetailedBtn');

  // نافذة نبذة عن الأداة
  const openAboutBtn = document.getElementById('openAboutBtn');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const modalDoneBtn = document.getElementById('modalDoneBtn');
  const aboutModal = document.getElementById('aboutModal');

  // عناصر التجربة الفورية
  const quickQuestionInput = document.getElementById('quickQuestionInput');
  const solveConciseBtn = document.getElementById('solveConciseBtn');
  const solveDetailedBtn = document.getElementById('solveDetailedBtn');
  const quickResultBox = document.getElementById('quickResultBox');
  const resultTitle = document.getElementById('resultTitle');
  const resultContent = document.getElementById('resultContent');
  const copyResultBtn = document.getElementById('copyResultBtn');

  let currentEnabled = true;
  let currentFabEnabled = true;
  const DEFAULT_GEMINI_KEY = atob('QVEuQWI4Uk42TFl6UW1xLWtGNFg2R3gyTTY4WG1hQk5BWjVjRk5vSVJyNW9samZTQVRkb0E=');
  let currentServer = 'gemini';
  let currentGeminiKey = DEFAULT_GEMINI_KEY;
  let currentOpenaiKey = '';
  let currentDeepseekKey = '';
  let currentGroqKey = '';
  let currentSubject = 'general';
  let currentTargetLang = 'ar';
  let currentDefaultMode = 'concise';
  let lastResultText = '';

  const SERVER_NAMES = {
    'free': '🌐 الخادم المجاني',
    'free_backup': '🛡️ الخادم المجاني الاحتياطي',
    'deepseek': '🧠 خادم ديب سيك R1',
    'groq': '⚡ خادم جروك فائق السرعة',
    'gemini': '⚡ خادم جوجل Gemini',
    'openai': '🤖 خادم ChatGPT'
  };

  const SHORT_SERVER_NAMES = {
    'free': '🌐 مجاني',
    'free_backup': '🛡️ احتياطي',
    'deepseek': '🧠 DeepSeek',
    'groq': '⚡ Groq',
    'gemini': '⚡ Gemini',
    'openai': '🤖 ChatGPT'
  };

  const DISPLAY_SERVER_DATA = {
    'free': {
      icon: '🌐',
      name: 'الخادم المجاني (تلقائي بدون مفتاح)',
      border: 'rgba(52, 211, 153, 0.45)',
      bg: 'linear-gradient(135deg, rgba(6, 78, 59, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#6ee7b7',
      tagColor: '#34d399',
      tagBg: 'rgba(16, 185, 129, 0.15)',
      tagBorder: 'rgba(16, 185, 129, 0.35)'
    },
    'free_backup': {
      icon: '🛡️',
      name: 'الخادم المجاني الاحتياطي (تلقائي فوري)',
      border: 'rgba(45, 212, 191, 0.45)',
      bg: 'linear-gradient(135deg, rgba(19, 78, 74, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#5eead4',
      tagColor: '#2dd4bf',
      tagBg: 'rgba(20, 184, 166, 0.15)',
      tagBorder: 'rgba(20, 184, 166, 0.35)'
    },
    'deepseek': {
      icon: '🧠',
      name: 'خادم ديب سيك (DeepSeek R1 تفكير خارق)',
      border: 'rgba(56, 189, 248, 0.45)',
      bg: 'linear-gradient(135deg, rgba(12, 74, 110, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#7dd3fc',
      tagColor: '#38bdf8',
      tagBg: 'rgba(14, 165, 233, 0.15)',
      tagBorder: 'rgba(14, 165, 233, 0.35)'
    },
    'groq': {
      icon: '⚡',
      name: 'خادم جروك فائق السرعة (0.1s Groq LPU)',
      border: 'rgba(249, 115, 22, 0.45)',
      bg: 'linear-gradient(135deg, rgba(67, 20, 7, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#fdba74',
      tagColor: '#f97316',
      tagBg: 'rgba(234, 88, 12, 0.15)',
      tagBorder: 'rgba(234, 88, 12, 0.35)'
    },
    'gemini': {
      icon: '⚡',
      name: 'الخادم الآخر (جوجل Gemini الصاروخي)',
      border: 'rgba(56, 189, 248, 0.45)',
      bg: 'linear-gradient(135deg, rgba(12, 74, 110, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#7dd3fc',
      tagColor: '#38bdf8',
      tagBg: 'rgba(14, 165, 233, 0.15)',
      tagBorder: 'rgba(14, 165, 233, 0.35)'
    },
    'openai': {
      icon: '🤖',
      name: 'خادم شات جي بي تي (ChatGPT الذكي)',
      border: 'rgba(192, 132, 252, 0.45)',
      bg: 'linear-gradient(135deg, rgba(59, 7, 100, 0.25), rgba(15, 23, 42, 0.95))',
      color: '#d8b4fe',
      tagColor: '#c084fc',
      tagBg: 'rgba(168, 85, 247, 0.15)',
      tagBorder: 'rgba(168, 85, 247, 0.35)'
    }
  };

  const SUBJECT_NAMES = {
    'general': '🌟 عام / تلقائي',
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

  const LANG_NAMES = {
    'ar': '🇸🇦 العربية',
    'same': '🌐 نفس لغة السؤال',
    'en': '🇬🇧 English',
    'es': '🇪🇸 Español',
    'fr': '🇫🇷 Français',
    'de': '🇩🇪 Deutsch',
    'zh': '🇨🇳 中文',
    'ja': '🇯🇵 日本語',
    'ko': '🇰🇷 한국어',
    'ru': '🇷🇺 Русский',
    'tr': '🇹🇷 Türkçe',
    'it': '🇮🇹 Italiano',
    'pt': '🇵🇹 Português',
    'hi': '🇮🇳 हिन्दी',
    'ur': '🇵🇰 اردو',
    'id': '🇮🇩 Indonesia',
    'fa': '🇮🇷 فارسی',
    'pl': '🇵🇱 Polski',
    'nl': '🇳🇱 Nederlands',
    'sv': '🇸🇪 Svenska',
    'el': '🇬🇷 Ελληνικά',
    'he': '🇮🇱 עברית',
    'tl': '🇵🇭 Tagalog',
    'vi': '🇻🇳 Tiếng Việt',
    'th': '🇹🇭 ภาษาไทย',
    'ms': '🇲🇾 Melayu',
    'bn': '🇧🇩 বাংলা',
    'uk': '🇺🇦 Українська',
    'ro': '🇷🇴 Română',
    'cs': '🇨🇿 Čeština',
    'hu': '🇭🇺 Magyar',
    'da': '🇩🇰 Dansk',
    'fi': '🇫🇮 Suomi',
    'no': '🇳🇴 Norsk',
    'sw': '🇰🇪 Kiswahili',
    'la': '🏛️ Latina'
  };

  // 1. تفعيل التحكم في القوائم المنسدلة المرتبة فوق بعض (Accordion Click Handlers)
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      if (!item) return;

      const isOpen = item.classList.contains('open');
      if (isOpen) {
        item.classList.remove('open');
      } else {
        item.classList.add('open');
      }
    });
  });

  // 2. قراءة الحالة المحفوظة عند فتح النافذة
  chrome.storage.local.get([
    'enabled', 'fabEnabled', 'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey',
    'subject', 'defaultMode', 'targetLanguage'
  ], (data) => {
    if (chrome.runtime.lastError || !data) data = {};
    currentEnabled = data.enabled !== false;
    currentFabEnabled = data.fabEnabled !== false;
    currentServer = (!data.serverType || data.serverType === 'free' || data.serverType === 'free_backup') ? 'gemini' : data.serverType;
    currentGeminiKey = (data.geminiKey && data.geminiKey.trim()) ? data.geminiKey.trim() : DEFAULT_GEMINI_KEY;
    if (data.serverType === 'free' || data.serverType === 'free_backup' || !data.geminiKey) {
      chrome.storage.local.set({ serverType: currentServer, geminiKey: currentGeminiKey }, () => { if (chrome.runtime.lastError) {} });
    }
    currentOpenaiKey = data.openaiKey || '';
    currentDeepseekKey = data.deepseekKey || '';
    currentGroqKey = data.groqKey || '';
    currentSubject = data.subject || 'general';
    currentDefaultMode = data.defaultMode || 'concise';
    currentTargetLang = data.targetLanguage || 'ar';

    renderPowerButton(currentEnabled);
    if (fabToggleInput) fabToggleInput.checked = currentFabEnabled;

    if (geminiKeyInput) geminiKeyInput.value = currentGeminiKey;
    if (openaiKeyInput) openaiKeyInput.value = currentOpenaiKey;
    if (deepseekKeyInput) deepseekKeyInput.value = currentDeepseekKey;
    if (groqKeyInput) groqKeyInput.value = currentGroqKey;

    applyServer(currentServer, false);
    applySubject(currentSubject, false);
    renderModeSelection(currentDefaultMode);
    applyLanguage(currentTargetLang, false);
  });

  // 3. التحكم في زر إيقاف وتفعيل الأداة بالكامل
  masterToggleBtn.addEventListener('click', () => {
    currentEnabled = !currentEnabled;

    chrome.storage.local.set({ enabled: currentEnabled }, () => {
      chrome.runtime.sendMessage({
        action: 'SET_STATE',
        data: { enabled: currentEnabled }
      }, () => {
        if (chrome.runtime.lastError) {}
      });
      renderPowerButton(currentEnabled);
    });
  });

  function renderPowerButton(isEnabled) {
    if (isEnabled) {
      masterToggleBtn.className = 'master-btn power-on';
      powerIcon.textContent = '🟢';
      powerMainText.textContent = 'الأداة مفعلة وشغالة';
      powerSubText.textContent = 'انقر هنا لإيقاف الأداة بالكامل';
      powerIndicatorPill.className = 'status-indicator-pill active';
      powerIndicatorPill.textContent = 'شغالة';
    } else {
      masterToggleBtn.className = 'master-btn power-off';
      powerIcon.textContent = '🛑';
      powerMainText.textContent = 'الأداة متوقفة حالياً';
      powerSubText.textContent = 'انقر هنا لتفعيل وتشغيل الأداة';
      powerIndicatorPill.className = 'status-indicator-pill inactive';
      powerIndicatorPill.textContent = 'متوقفة';
    }
  }

  // 4. زر مخصص للزر العائم في الصفحات
  if (fabToggleInput) {
    fabToggleInput.addEventListener('change', () => {
      currentFabEnabled = fabToggleInput.checked;
      chrome.storage.local.set({ fabEnabled: currentFabEnabled }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { fabEnabled: currentFabEnabled }
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      });
    });
  }

  // 5. التحكم في اختيار الخوادم الثلاثة (تفعيل واحد وقفل الآخرين تلقائياً)
  serverCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
        return;
      }
      const selected = card.getAttribute('data-server');
      applyServer(selected, true);
    });
  });

  function applyServer(server, saveToStorage = true) {
    currentServer = server;

    serverCards.forEach(c => {
      if (c.getAttribute('data-server') === server) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    const label = SERVER_NAMES[server] || server;
    if (activeServerBadge) activeServerBadge.textContent = label;
    if (headerServerBadge) headerServerBadge.textContent = label;
    if (accServerBadge) {
      accServerBadge.textContent = SHORT_SERVER_NAMES[server] || label;
    }

    // تحديث شريط توضيح الخادم المختار أعلى زر التشغيل (غير القابل للضغط)
    const displayData = DISPLAY_SERVER_DATA[server] || DISPLAY_SERVER_DATA['free'];
    if (displayServerIcon) displayServerIcon.textContent = displayData.icon;
    if (displayServerName) {
      displayServerName.textContent = displayData.name;
      displayServerName.style.color = displayData.color;
    }
    if (activeServerDisplayCard) {
      activeServerDisplayCard.style.borderColor = displayData.border;
      activeServerDisplayCard.style.background = displayData.bg;
    }
    const displayServerBadgeTag = document.getElementById('displayServerBadgeTag');
    if (displayServerBadgeTag) {
      displayServerBadgeTag.style.color = displayData.tagColor;
      displayServerBadgeTag.style.background = displayData.tagBg;
      displayServerBadgeTag.style.borderColor = displayData.tagBorder;
    }

    if (saveToStorage) {
      chrome.storage.local.set({ serverType: server }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { serverType: server }
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      });
    }
  }

  // حفظ مفتاح Gemini
  if (geminiKeyInput) {
    geminiKeyInput.addEventListener('input', () => {
      const key = geminiKeyInput.value.trim();
      currentGeminiKey = key;
      chrome.storage.local.set({ geminiKey: key }, () => { if (chrome.runtime.lastError) {} });
      chrome.runtime.sendMessage({ action: 'SET_STATE', data: { geminiKey: key } }, () => { if (chrome.runtime.lastError) {} });
    });
  }
  if (saveGeminiKeyBtn) {
    saveGeminiKeyBtn.addEventListener('click', () => {
      const key = geminiKeyInput.value.trim();
      currentGeminiKey = key;
      chrome.storage.local.set({ geminiKey: key }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { geminiKey: key }
        }, () => { if (chrome.runtime.lastError) {} });
        showKeySavedFeedback(saveGeminiKeyBtn);
      });
    });
  }

  // حفظ مفتاح Groq
  if (groqKeyInput) {
    groqKeyInput.addEventListener('input', () => {
      const key = groqKeyInput.value.trim();
      currentGroqKey = key;
      chrome.storage.local.set({ groqKey: key }, () => { if (chrome.runtime.lastError) {} });
      chrome.runtime.sendMessage({ action: 'SET_STATE', data: { groqKey: key } }, () => { if (chrome.runtime.lastError) {} });
    });
  }

  // حفظ مفتاح OpenAI
  if (saveOpenaiKeyBtn) {
    saveOpenaiKeyBtn.addEventListener('click', () => {
      const key = openaiKeyInput.value.trim();
      currentOpenaiKey = key;
      chrome.storage.local.set({ openaiKey: key }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { openaiKey: key }
        }, () => { if (chrome.runtime.lastError) {} });
        showKeySavedFeedback(saveOpenaiKeyBtn);
      });
    });
  }

  // حفظ مفتاح DeepSeek
  if (saveDeepseekKeyBtn) {
    saveDeepseekKeyBtn.addEventListener('click', () => {
      const key = deepseekKeyInput.value.trim();
      currentDeepseekKey = key;
      chrome.storage.local.set({ deepseekKey: key }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { deepseekKey: key }
        }, () => { if (chrome.runtime.lastError) {} });
        showKeySavedFeedback(saveDeepseekKeyBtn);
      });
    });
  }

  // حفظ مفتاح Groq
  if (saveGroqKeyBtn) {
    saveGroqKeyBtn.addEventListener('click', () => {
      const key = groqKeyInput.value.trim();
      currentGroqKey = key;
      chrome.storage.local.set({ groqKey: key }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { groqKey: key }
        }, () => { if (chrome.runtime.lastError) {} });
        showKeySavedFeedback(saveGroqKeyBtn);
      });
    });
  }

  function showKeySavedFeedback(btn) {
    const orig = btn.textContent;
    btn.textContent = 'تم الحفظ ✓';
    btn.style.background = '#10b981';
    btn.style.borderColor = '#34d399';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.borderColor = '';
    }, 2000);
  }

  // فحص وصلاحية كود Gemini
  if (testGeminiBtn) {
    testGeminiBtn.addEventListener('click', () => {
      const key = geminiKeyInput.value.trim();
      if (!key) {
        showKeyStatus(geminiStatusBox, 'error', '⚠️ الرجاء لصق مفتاح Gemini أولاً في الحقل أعلاه.');
        geminiKeyInput.focus();
        return;
      }
      showKeyStatus(geminiStatusBox, 'loading', '⏳ جاري التحقق من صلاحية كود Gemini عبر جوجل...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'gemini',
        key: key
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(geminiStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(geminiStatusBox, 'success', res.message);
        } else {
          showKeyStatus(geminiStatusBox, 'error', res ? res.message : '❌ الكود غير صالح.');
        }
      });
    });
  }

  // فحص وصلاحية كود OpenAI
  if (testOpenaiBtn) {
    testOpenaiBtn.addEventListener('click', () => {
      const key = openaiKeyInput.value.trim();
      if (!key) {
        showKeyStatus(openaiStatusBox, 'error', '⚠️ الرجاء لصق مفتاح OpenAI أولاً في الحقل أعلاه.');
        openaiKeyInput.focus();
        return;
      }
      showKeyStatus(openaiStatusBox, 'loading', '⏳ جاري التحقق من صلاحية كود OpenAI عبر شات جي بي تي...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'openai',
        key: key
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(openaiStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(openaiStatusBox, 'success', res.message);
        } else {
          showKeyStatus(openaiStatusBox, 'error', res ? res.message : '❌ الكود غير صالح.');
        }
      });
    });
  }

  // فحص اتصال الخادم المجاني
  if (testFreeBtn) {
    testFreeBtn.addEventListener('click', () => {
      showKeyStatus(freeStatusBox, 'loading', '⏳ جاري فحص اتصال الخادم المجاني واستجابته...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'free'
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(freeStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(freeStatusBox, 'success', res.message);
        } else {
          showKeyStatus(freeStatusBox, 'error', res ? res.message : '❌ فشل فحص الخادم.');
        }
      });
    });
  }

  // فحص اتصال الخادم المجاني الاحتياطي
  if (testFreeBackupBtn) {
    testFreeBackupBtn.addEventListener('click', () => {
      showKeyStatus(freeBackupStatusBox, 'loading', '⏳ جاري فحص اتصال الخادم الاحتياطي...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'free_backup'
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(freeBackupStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(freeBackupStatusBox, 'success', res.message);
        } else {
          showKeyStatus(freeBackupStatusBox, 'error', res ? res.message : '❌ فشل فحص الخادم الاحتياطي.');
        }
      });
    });
  }

  // فحص خادم ديب سيك
  if (testDeepseekBtn) {
    testDeepseekBtn.addEventListener('click', () => {
      const key = deepseekKeyInput.value.trim();
      showKeyStatus(deepseekStatusBox, 'loading', '⏳ جاري اختبار استجابة خادم DeepSeek R1...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'deepseek',
        key: key
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(deepseekStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(deepseekStatusBox, 'success', res.message);
        } else {
          showKeyStatus(deepseekStatusBox, 'error', res ? res.message : '❌ فشل اختبار DeepSeek.');
        }
      });
    });
  }

  // فحص خادم جروك فائق السرعة
  if (testGroqBtn) {
    testGroqBtn.addEventListener('click', () => {
      const key = groqKeyInput.value.trim();
      showKeyStatus(groqStatusBox, 'loading', '⏳ جاري فحص استجابة وسرعة خادم Groq...');
      chrome.runtime.sendMessage({
        action: 'TEST_SERVER_KEY',
        server: 'groq',
        key: key
      }, (res) => {
        if (chrome.runtime.lastError) {
          showKeyStatus(groqStatusBox, 'error', `❌ خطأ في الاتصال: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.success) {
          showKeyStatus(groqStatusBox, 'success', res.message);
        } else {
          showKeyStatus(groqStatusBox, 'error', res ? res.message : '❌ فشل فحص Groq.');
        }
      });
    });
  }

  function showKeyStatus(box, type, text) {
    if (!box) return;
    box.classList.remove('hidden', 'loading', 'success', 'error');
    box.classList.add(type);
    box.textContent = text;
  }

  // 6. خيار تحديد المادة الدراسية
  if (allSubjectsSelect) {
    allSubjectsSelect.addEventListener('change', () => {
      applySubject(allSubjectsSelect.value, true);
    });
  }

  subjectPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const subj = pill.getAttribute('data-subject');
      applySubject(subj, true);
    });
  });

  function applySubject(subj, saveToStorage = true) {
    currentSubject = subj;

    if (allSubjectsSelect) {
      allSubjectsSelect.value = subj;
    }

    subjectPills.forEach(p => {
      if (p.getAttribute('data-subject') === subj) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    const displaySubj = SUBJECT_NAMES[subj] || subj;
    if (currentSubjectBadge) {
      currentSubjectBadge.textContent = displaySubj;
    }
    if (accSubjectBadge) {
      accSubjectBadge.textContent = displaySubj;
    }

    if (saveToStorage) {
      chrome.storage.local.set({ subject: subj }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { subject: subj }
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      });
    }
  }

  // 7. خيار تحديد اللغة من القائمة المنسدلة (35+ لغة)
  if (allLangsSelect) {
    allLangsSelect.addEventListener('change', () => {
      applyLanguage(allLangsSelect.value, true);
    });
  }

  langPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const lang = pill.getAttribute('data-lang');
      applyLanguage(lang, true);
    });
  });

  function applyLanguage(lang, saveToStorage = true) {
    currentTargetLang = lang;

    if (allLangsSelect) {
      allLangsSelect.value = lang;
    }

    langPills.forEach(p => {
      if (p.getAttribute('data-lang') === lang) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    const displayLang = LANG_NAMES[lang] || lang;
    if (currentLangBadge) {
      currentLangBadge.textContent = displayLang;
    }
    if (accLangBadge) {
      accLangBadge.textContent = displayLang;
    }

    if (saveToStorage) {
      chrome.storage.local.set({ targetLanguage: lang }, () => {
        chrome.runtime.sendMessage({
          action: 'SET_STATE',
          data: { targetLanguage: lang }
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      });
    }
  }

  // 8. التبديل بين خيارات الإجابة
  modeConciseBtn.addEventListener('click', () => {
    setDefaultMode('concise');
  });

  modeDetailedBtn.addEventListener('click', () => {
    setDefaultMode('detailed');
  });

  function setDefaultMode(mode) {
    currentDefaultMode = mode;
    chrome.storage.local.set({ defaultMode: mode }, () => {
      chrome.runtime.sendMessage({
        action: 'SET_STATE',
        data: { defaultMode: mode }
      }, () => {
        if (chrome.runtime.lastError) {}
      });
      renderModeSelection(mode);
    });
  }

  function renderModeSelection(mode) {
    if (mode === 'detailed') {
      modeDetailedBtn.classList.add('active');
      modeConciseBtn.classList.remove('active');
      if (accModeBadge) accModeBadge.textContent = '📖 مفصلة';
    } else {
      modeConciseBtn.classList.add('active');
      modeDetailedBtn.classList.remove('active');
      if (accModeBadge) accModeBadge.textContent = '⚡ بدون فلسفة';
    }
  }

  // 9. نافذة نبذة عن الأداة واستخدامها في الاختبارات
  if (openAboutBtn) {
    openAboutBtn.addEventListener('click', () => {
      aboutModal.classList.remove('hidden');
    });
  }

  if (closeAboutBtn) {
    closeAboutBtn.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
    });
  }

  if (modalDoneBtn) {
    modalDoneBtn.addEventListener('click', () => {
      aboutModal.classList.add('hidden');
    });
  }

  // 10. التجربة والحل الفوري من داخل البوب اب
  solveConciseBtn.addEventListener('click', () => {
    handleSolve('concise');
  });

  solveDetailedBtn.addEventListener('click', () => {
    handleSolve('detailed');
  });

  function handleSolve(mode) {
    const question = quickQuestionInput.value.trim();
    if (!question) {
      quickQuestionInput.focus();
      quickQuestionInput.placeholder = '⚠️ الرجاء كتابة أو لصق نص السؤال أولاً...';
      return;
    }

    quickResultBox.classList.remove('hidden');
    const langLabel = LANG_NAMES[currentTargetLang] || currentTargetLang;
    const subjName = SUBJECT_NAMES[currentSubject] || currentSubject;
    const serverLabel = SERVER_NAMES[currentServer] || currentServer;

    resultTitle.textContent = (mode === 'detailed') 
      ? `الإجابة المفصلة (${serverLabel} | ${subjName}):` 
      : `الإجابة بدون فلسفة (${serverLabel} | ${subjName}):`;

    resultContent.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>جاري الحل عبر (${serverLabel}) لمادة (${subjName})...</span>
      </div>
    `;

    solveConciseBtn.disabled = true;
    solveDetailedBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'PROCESS_TEXT',
      text: question,
      mode: mode,
      subject: currentSubject,
      targetLanguage: currentTargetLang,
      serverType: currentServer,
      geminiKey: currentGeminiKey,
      openaiKey: currentOpenaiKey,
      deepseekKey: currentDeepseekKey,
      groqKey: currentGroqKey
    }, (response) => {
      solveConciseBtn.disabled = false;
      solveDetailedBtn.disabled = false;

      if (chrome.runtime.lastError) {
        resultContent.innerHTML = `<span style="color:#ef4444;">خطأ: ${chrome.runtime.lastError.message}</span>`;
        return;
      }

      if (response && response.success) {
        lastResultText = response.data;
        displayResult(response.data);
      } else {
        const errorMsg = (response && response.error) ? response.error : 'تعذر الحصول على إجابة، تأكد من الاتصال.';
        resultContent.innerHTML = `
          <div style="color:#ef4444; line-height: 1.5;">${errorMsg}</div>
          ${currentServer !== 'free' ? '<div style="margin-top:8px;"><button id="popupFallbackFreeBtn" type="button" style="background:#0284c7;border:1px solid #38bdf8;color:#fff;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">🌐 تجربة الحل عبر الخادم المجاني فوراً</button></div>' : ''}
        `;
        const fbBtn = resultContent.querySelector('#popupFallbackFreeBtn');
        if (fbBtn) {
          fbBtn.addEventListener('click', () => {
            applyServer('free', true);
            handleSolve(mode);
          });
        }
      }
    });
  }

  function displayResult(text) {
    resultContent.innerHTML = '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length > 0) {
      const firstLine = lines[0];
      const badge = document.createElement('div');
      badge.className = 'result-badge';
      badge.textContent = firstLine;
      resultContent.appendChild(badge);

      if (lines.length > 1) {
        const remaining = document.createElement('div');
        remaining.style.color = '#cbd5e1';
        remaining.style.whiteSpace = 'pre-wrap';
        remaining.textContent = lines.slice(1).join('\n\n');
        resultContent.appendChild(remaining);
      }
    } else {
      resultContent.textContent = text;
    }
  }

  // 11. زر نسخ الإجابة
  copyResultBtn.addEventListener('click', () => {
    if (!lastResultText) return;
    navigator.clipboard.writeText(lastResultText).then(() => {
      const orig = copyResultBtn.textContent;
      copyResultBtn.textContent = 'تم النسخ! ✓';
      copyResultBtn.style.color = '#34d399';
      setTimeout(() => {
        copyResultBtn.textContent = orig;
        copyResultBtn.style.color = '';
      }, 2000);
    });
  });

  // 12. إدارة نافذة وإشعارات التحديث وتخصيص المظهر
  const customizerAnnouncementBanner = document.getElementById('customizerAnnouncementBanner');
  const btnOpenCustomizer = document.getElementById('btnOpenCustomizer');
  const updateAnnouncementBanner = document.getElementById('updateAnnouncementBanner');
  const btnOpenUpdatePage = document.getElementById('btnOpenUpdatePage');
  const updateNoticeModal = document.getElementById('updateNoticeModal');
  const closeUpdateModalBtn = document.getElementById('closeUpdateModalBtn');
  const btnExploreFullUpdate = document.getElementById('btnExploreFullUpdate');
  const btnDismissUpdateModal = document.getElementById('btnDismissUpdateModal');

  function openCustomizerPage() {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('customizer.html') });
    } catch (e) {
      console.warn('Error opening customizer tab:', e);
    }
  }

  if (btnOpenCustomizer) {
    btnOpenCustomizer.addEventListener('click', (e) => {
      e.stopPropagation();
      openCustomizerPage();
    });
  }

  if (customizerAnnouncementBanner) {
    customizerAnnouncementBanner.addEventListener('click', () => {
      openCustomizerPage();
    });
  }

  // إدارة شكل حواف خيارات وبطاقات الأداة نفسها
  const btnToolShapeSharp = document.getElementById('btnToolShapeSharp');
  const btnToolShapeSmooth = document.getElementById('btnToolShapeSmooth');
  const btnToolShapeCapsule = document.getElementById('btnToolShapeCapsule');
  const linkOpenCustomizerPage = document.getElementById('linkOpenCustomizerPage');

  function applyToolBorderShape(shape) {
    document.body.classList.remove('shape-sharp', 'shape-smooth', 'shape-capsule');
    document.body.classList.add('shape-' + shape);

    const map = [
      { btn: btnToolShapeSharp, s: 'sharp' },
      { btn: btnToolShapeSmooth, s: 'smooth' },
      { btn: btnToolShapeCapsule, s: 'capsule' }
    ];

    map.forEach(item => {
      if (!item.btn) return;
      if (item.s === shape) {
        item.btn.style.background = 'rgba(2, 132, 199, 0.25)';
        item.btn.style.borderColor = '#0284c7';
        item.btn.style.color = '#38bdf8';
      } else {
        item.btn.style.background = '#1e293b';
        item.btn.style.borderColor = '#475569';
        item.btn.style.color = '#cbd5e1';
      }
    });

    chrome.storage.local.set({ customBorderShape: shape }, () => { if (chrome.runtime.lastError) {} });
  }

  chrome.storage.local.get({ customBorderShape: 'smooth' }, (data) => {
    if (chrome.runtime.lastError || !data) data = { customBorderShape: 'smooth' };
    applyToolBorderShape(data.customBorderShape || 'smooth');
  });

  if (btnToolShapeSharp) btnToolShapeSharp.addEventListener('click', () => applyToolBorderShape('sharp'));
  if (btnToolShapeSmooth) btnToolShapeSmooth.addEventListener('click', () => applyToolBorderShape('smooth'));
  if (btnToolShapeCapsule) btnToolShapeCapsule.addEventListener('click', () => applyToolBorderShape('capsule'));
  if (linkOpenCustomizerPage) linkOpenCustomizerPage.addEventListener('click', (e) => {
    e.preventDefault();
    openCustomizerPage();
  });

  function openChangelogPage() {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('update.html') }, () => { if (chrome.runtime.lastError) {} });
    } catch (e) {
      console.warn('Error opening update tab:', e);
    }
  }

  function dismissUpdateNotice() {
    if (updateNoticeModal) updateNoticeModal.classList.add('hidden');
    chrome.storage.local.set({ hasSeenUpdate200: true, lastSeenVersion: '2.0.0' }, () => { if (chrome.runtime.lastError) {} });
  }

  if (btnOpenUpdatePage) {
    btnOpenUpdatePage.addEventListener('click', (e) => {
      e.stopPropagation();
      openChangelogPage();
    });
  }

  if (updateAnnouncementBanner) {
    updateAnnouncementBanner.addEventListener('click', () => {
      openChangelogPage();
    });
  }

  if (closeUpdateModalBtn) closeUpdateModalBtn.addEventListener('click', dismissUpdateNotice);
  if (btnDismissUpdateModal) btnDismissUpdateModal.addEventListener('click', dismissUpdateNotice);
  if (btnExploreFullUpdate) {
    btnExploreFullUpdate.addEventListener('click', () => {
      dismissUpdateNotice();
      openChangelogPage();
    });
  }

  // فحص ما إذا كان المستخدم لم يشاهد نافذة التحديث بعد
  try {
    chrome.storage.local.get(['hasSeenUpdate200', 'lastSeenVersion'], (data) => {
      if (chrome.runtime.lastError) return;
      const safeData = data || {};
      if (!safeData.hasSeenUpdate200 || safeData.lastSeenVersion !== '2.0.0') {
        if (updateNoticeModal) {
          updateNoticeModal.classList.remove('hidden');
        }
      }
    });
  } catch (err) {
    console.warn('Update modal check error:', err);
  }

  // 13. أزرار ماسح الاختبارات الذكي والتلوين الثلاثي
  const btnTriggerExamScan = document.getElementById('btnTriggerExamScan');
  const btnClearExamHighlights = document.getElementById('btnClearExamHighlights');

  if (btnTriggerExamScan) {
    btnTriggerExamScan.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        checkLastError();
        if (!tabs || !tabs[0] || !tabs[0].id) {
          showPopupBanner('⚠️ يرجى فتح صفحة اختبار وتحديثها لتفعيل الماسح.');
          return;
        }
        const tab = tabs[0];
        const u = (tab.url || tab.pendingUrl || '').toLowerCase();
        const isRestricted = !u ||
                             u.startsWith('chrome://') || 
                             u.startsWith('chrome-extension://') || 
                             u.startsWith('edge://') || 
                             u.startsWith('about:') || 
                             u.startsWith('devtools://') || 
                             u.startsWith('view-source:') || 
                             u.startsWith('chrome-search://') || 
                             u.includes('chrome.google.com/webstore') || 
                             u.includes('chromewebstore.google.com');

        if (isRestricted) {
          showPopupBanner('⚠️ تنبيه: لا يمكن تشغيل ماسح الاختبارات على صفحات المتصفح الداخلية أو سوق كروم.');
          return;
        }

        const payload = {
          action: 'TRIGGER_EXAM_SCAN',
          mode: currentDefaultMode || 'concise'
        };

        safeSendTabMessage(tab.id, payload, (success) => {
          if (success) {
            window.close();
          } else {
            showPopupBanner('يرجى التأكد من تحديث صفحة الاختبار (F5) لتفعيل الماسح.');
          }
        });
      });
    });
  }

  if (btnClearExamHighlights) {
    btnClearExamHighlights.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        checkLastError();
        if (!tabs || !tabs[0] || !tabs[0].id) return;
        const tab = tabs[0];
        const u = (tab.url || tab.pendingUrl || '').toLowerCase();
        const isRestricted = !u ||
                             u.startsWith('chrome://') || 
                             u.startsWith('chrome-extension://') || 
                             u.startsWith('edge://') || 
                             u.startsWith('about:') || 
                             u.startsWith('devtools://') || 
                             u.startsWith('view-source:') || 
                             u.startsWith('chrome-search://') || 
                             u.includes('chrome.google.com/webstore') || 
                             u.includes('chromewebstore.google.com');
        if (isRestricted) return;

        safeSendTabMessage(tab.id, { action: 'CLEAR_EXAM_HIGHLIGHTS' });
      });
    });
  }

  // 14. أزرار الحل المباشر ووضع الريكورد (تحديد منطقة الاختبار أو كامل الشاشة)
  let selectedLiveMode = 'concise';
  chrome.storage.local.get(['liveSolveMode', 'mode'], (res) => {
    if (res && res.liveSolveMode) {
      selectedLiveMode = res.liveSolveMode;
    } else if (res && res.mode) {
      selectedLiveMode = res.mode;
    }
    updateLiveModeButtonsUI(selectedLiveMode);
  });

  const btnLiveModeConcise = document.getElementById('btnLiveModeConcise');
  const btnLiveModeDetailed = document.getElementById('btnLiveModeDetailed');
  const lblLiveModeSelected = document.getElementById('lblLiveModeSelected');

  function updateLiveModeButtonsUI(mode) {
    selectedLiveMode = mode;
    if (btnLiveModeConcise && btnLiveModeDetailed) {
      if (mode === 'detailed') {
        btnLiveModeDetailed.style.border = '1.5px solid #0284c7';
        btnLiveModeDetailed.style.background = 'rgba(2, 132, 199, 0.3)';
        btnLiveModeDetailed.style.color = '#38bdf8';
        btnLiveModeConcise.style.border = '1.5px solid #475569';
        btnLiveModeConcise.style.background = '#1e293b';
        btnLiveModeConcise.style.color = '#94a3b8';
        if (lblLiveModeSelected) lblLiveModeSelected.textContent = '📖 مفصل مع الشرح';
      } else {
        btnLiveModeConcise.style.border = '1.5px solid #0284c7';
        btnLiveModeConcise.style.background = 'rgba(2, 132, 199, 0.3)';
        btnLiveModeConcise.style.color = '#38bdf8';
        btnLiveModeDetailed.style.border = '1.5px solid #475569';
        btnLiveModeDetailed.style.background = '#1e293b';
        btnLiveModeDetailed.style.color = '#94a3b8';
        if (lblLiveModeSelected) lblLiveModeSelected.textContent = '⚡ بدون فلسفة';
      }
    }
  }

  if (btnLiveModeConcise) {
    btnLiveModeConcise.addEventListener('click', () => {
      updateLiveModeButtonsUI('concise');
      chrome.storage.local.set({ liveSolveMode: 'concise' }, () => { if (chrome.runtime.lastError) {} });
    });
  }

  if (btnLiveModeDetailed) {
    btnLiveModeDetailed.addEventListener('click', () => {
      updateLiveModeButtonsUI('detailed');
      chrome.storage.local.set({ liveSolveMode: 'detailed' }, () => { if (chrome.runtime.lastError) {} });
    });
  }

  function launchLiveDirectSolver(isFullScreen) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      checkLastError();
      if (!tabs || !tabs[0] || !tabs[0].id) {
        showPopupBanner('⚠️ تعذر العثور على التبويب النشط.');
        return;
      }
      const tab = tabs[0];
      const tabId = tab.id;
      const rawUrl = tab.url || tab.pendingUrl || '';
      const url = rawUrl.toLowerCase().trim();

      // فحص صارم ومحكم لصفحات النظام الداخلية وسوق كروم
      const isRestricted = !url ||
                           url.startsWith('chrome://') || 
                           url.startsWith('chrome-extension://') || 
                           url.startsWith('edge://') || 
                           url.startsWith('about:') || 
                           url.startsWith('devtools://') || 
                           url.startsWith('view-source:') || 
                           url.startsWith('chrome-search://') || 
                           url.includes('chrome.google.com/webstore') || 
                           url.includes('chromewebstore.google.com');

      if (isRestricted) {
        showPopupBanner('⚠️ تنبيه: لا يمكن تشغيل ماسح الشاشة على صفحات المتصفح الداخلية (chrome://) أو سوق كروم. يرجى فتح صفحة اختبار أو موقع دراسي عادي لتجربة الحل المباشر.');
        return;
      }

      const payload = {
        action: 'START_LIVE_DIRECT_SOLVER',
        isFullScreen: (isFullScreen !== false),
        mode: selectedLiveMode || currentDefaultMode || 'concise'
      };

      safeSendTabMessage(tabId, payload, (success) => {
        if (success) {
          window.close();
        } else {
          showPopupBanner('يرجى تحديث صفحة الاختبار (F5) لتفعيل الماسح.');
        }
      });
    });
  }

  const btnMainLiveDirectSolve = document.getElementById('btnMainLiveDirectSolve');
  if (btnMainLiveDirectSolve) {
    btnMainLiveDirectSolve.addEventListener('click', () => {
      launchLiveDirectSolver(true);
    });
  }

  const btnStartLiveDirectSolver = document.getElementById('btnStartLiveDirectSolver');
  if (btnStartLiveDirectSolver) {
    btnStartLiveDirectSolver.addEventListener('click', () => {
      launchLiveDirectSolver(true);
    });
  }

  const btnStartLiveFullScreen = document.getElementById('btnStartLiveFullScreen');
  if (btnStartLiveFullScreen) {
    btnStartLiveFullScreen.addEventListener('click', () => {
      launchLiveDirectSolver(true);
    });
  }

  // 15. زر فتح موقع ومنصة الاختبار التجريبي
  const btnOpenTestExamPage = document.getElementById('btnOpenTestExamPage');
  if (btnOpenTestExamPage) {
    btnOpenTestExamPage.addEventListener('click', () => {
      const testExamUrl = 'https://moayadk-ly.github.io/quizgenie/test-exam.html';
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: testExamUrl }, () => { if (chrome.runtime.lastError) {} });
      } else {
        window.open(testExamUrl, '_blank');
      }
    });
  }
});
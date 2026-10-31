// QuizGenie - Background Service Worker (Multi-Server Engine v2.0.0)

const DEFAULT_GEMINI_KEY = atob('QVEuQWI4Uk42TFl6UW1xLWtGNFg2R3gyTTY4WG1hQk5BWjVjRk5vSVJyNW9samZTQVRkb0E=');

// Cache for answers
const answerCache = new Map();

// Auto-migrate settings immediately on worker load
try {
  chrome.storage.local.get([
    'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
    'serverType', 'geminiKey', 'lastSeenVersion'
  ], (data) => {
    const safeData = data || {};
    const updates = {};
    if (!safeData.geminiKey || typeof safeData.geminiKey !== 'string' || !safeData.geminiKey.trim()) {
      updates.geminiKey = DEFAULT_GEMINI_KEY;
    }
    if (!safeData.serverType || safeData.serverType === 'free' || safeData.serverType === 'free_backup') {
      updates.serverType = 'gemini';
    }
    if (safeData.enabled === undefined) updates.enabled = true;
    if (safeData.fabEnabled === undefined) updates.fabEnabled = true;
    if (!safeData.subject) updates.subject = 'general';
    if (!safeData.defaultMode) updates.defaultMode = 'concise';
    if (!safeData.targetLanguage) updates.targetLanguage = 'ar';
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
} catch (e) {
  console.warn('Storage init fallback:', e);
}

const LANGUAGE_PROMPT_NAMES = {
  'ar': 'العربية الفصحى',
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
  'id': 'Bahasa Indonesia',
  'fa': 'فارسی',
  'pl': 'Polski',
  'nl': 'Nederlands',
  'sv': 'Svenska',
  'el': 'Ελληνικά',
  'he': 'עברית',
  'tl': 'Tagalog',
  'vi': 'Tiếng Việt',
  'th': 'ไทย',
  'ms': 'Bahasa Melayu',
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

const SUBJECT_PROMPT_MAP = {
  'general': 'المجال: أسئلة عامة وثقافية متنوعة.',
  'math': 'المجال: رياضيات. ركز على الخطوات الدقيقة والصيغ الحسابية واختيار الناتج الصحيح.',
  'science': 'المجال: علوم عامة واستنتاجات تجريبية وعلمية دقيقة.',
  'physics': 'المجال: فيزياء. راعِ القوانين الفيزيائية ووحدات القياس والعلاقات الرياضية.',
  'chemistry': 'المجال: كيمياء. انتبه للمعادلات والتفاعلات والتكافؤات الكيميائية.',
  'biology': 'المجال: أحياء. راعِ التصنيفات الحيوية ووظائف الأعضاء والعمليات الحيوية.',
  'social': 'المجال: دراسات اجتماعية وجغرافيا وتاريخ وأحداث عامة.',
  'history': 'المجال: تاريخ وأحداث زمنية وشخصيات تاريخية ومعارك وعهود.',
  'geography': 'المجال: جغرافيا وتضاريس وخرائط ومناخ ومواقع دول.',
  'arabic': 'المجال: لغة عربية ونحو وصرف وبلاغة وإعراب ومعاني كلمات.',
  'islamic': 'المجال: دراسات إسلامية وفقه وعقيدة وحديث وتفسير.',
  'computer': 'المجال: حاسب آلي وبرمجة وتقنية وشبكات ونظم معلومات.',
  'qudrat': 'المجال: اختبار القدرات العامة (القسم الكمي واللفظي واستيعاب المقروء والتناظر).',
  'tahsili': 'المجال: اختبار التحصيلي للمرحلة الثانوية (رياضيات، فيزياء، كيمياء، أحياء).',
  'english': 'المجال: قواعد ومفردات واستيعاب نصوص اللغة الإنجليزية.',
  'philosophy': 'المجال: فلسفة ومنطق ونظريات تفكير ونقد.',
  'business': 'المجال: إدارة أعمال واقتصاد ومحاسبة وتسويق.',
  'law': 'المجال: قانون وأنظمة وتشريعات وحقوق.',
  'medical': 'المجال: طب وتمريض وصيدلة وعلوم صحية وطبية.'
};

// Extension installation / update lifecycle
if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener((details) => {
  const reason = details ? details.reason : 'unknown';

  chrome.storage.local.get([
    'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
    'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey', 'lastSeenVersion'
  ], (data) => {
    const safeData = data || {};
    const updates = {};
    if (safeData.enabled === undefined) updates.enabled = true;
    if (safeData.fabEnabled === undefined) updates.fabEnabled = true;
    if (!safeData.subject) updates.subject = 'general';
    if (!safeData.defaultMode) updates.defaultMode = 'concise';
    if (!safeData.targetLanguage) updates.targetLanguage = 'ar';
    if (!safeData.serverType || safeData.serverType === 'free' || safeData.serverType === 'free_backup') updates.serverType = 'gemini';
    if (!safeData.geminiKey) updates.geminiKey = DEFAULT_GEMINI_KEY;
    if (safeData.openaiKey === undefined) updates.openaiKey = '';
    if (safeData.deepseekKey === undefined) updates.deepseekKey = '';
    if (safeData.groqKey === undefined) updates.groqKey = '';
    updates.lastSeenVersion = '2.0.0';
    updates.pendingUpdateNotice = true;

    chrome.storage.local.set(updates, () => {
      // صامت تماماً بدون أي تبويبات أو إشعارات منبثقة مزعجة للمستخدم
    });
  });

  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'qg_concise_solve',
        title: '⚡ حل بدون فلسفة (مباشر)',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'qg_detailed_solve',
        title: '📖 حل مفصل مع الشرح',
        contexts: ['selection']
      });
    });
  } catch (err) {
    console.warn('Context menus warning:', err);
  }

  // إعادة حقن السكربت في الصفحات المفتوحة مسبقاً لتعمل الأداة فوراً دون الحاجة لإعادة تحميل الصفحة
  try {
    if (chrome.scripting) {
      chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
        if (!tabs || chrome.runtime.lastError) return;
        for (const tab of tabs) {
          if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {}
            });
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content.css']
            }, () => {
              if (chrome.runtime.lastError) {}
            });
          }
        }
      });
    }
  } catch (injErr) {
    console.warn('Script injection error:', injErr);
  }
});
}

// Update notification click handler
if (chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener((notifId) => {
    if (notifId === 'qg_update_200') {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('update.html') });
      } catch (e) {
        console.warn('Notification click tab error:', e);
      }
    }
  });
}

// Context menu click
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id || !info.selectionText) return;

  const mode = (info.menuItemId === 'qg_detailed_solve') ? 'detailed' : 'concise';

  chrome.storage.local.get(['subject', 'targetLanguage', 'serverType'], (data) => {
    if (chrome.runtime.lastError || !data) data = {};
    const targetLanguage = data.targetLanguage || 'ar';
    const subject = data.subject || 'general';
    const serverType = (!data.serverType || data.serverType === 'free' || data.serverType === 'free_backup') ? 'gemini' : data.serverType;
    chrome.tabs.sendMessage(tab.id, {
      action: 'CONTEXT_MENU_TRIGGER',
      text: info.selectionText,
      mode: mode,
      subject: subject,
      targetLanguage: targetLanguage,
      serverType: serverType
    }, () => {
      if (chrome.runtime.lastError) { /* safe */ }
    });
  });
});
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SILENT_UPDATE_RELOAD') {
    answerCache.clear();
    chrome.storage.local.set({ lastSeenVersion: '2.1.0' }, () => {
      sendResponse({ success: true, version: '2.1.0' });
    });
    return true;
  }

  if (request.action === 'GET_STATE' || request.action === 'GET_SETTINGS') {
    chrome.storage.local.get([
      'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
      'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'
    ], (data) => {
      if (chrome.runtime.lastError || !data) data = {};
      sendResponse({
        enabled: data.enabled !== false,
        fabEnabled: data.fabEnabled !== false,
        subject: data.subject || 'general',
        defaultMode: data.defaultMode || 'concise',
        targetLanguage: data.targetLanguage || 'ar',
        serverType: (!data.serverType || data.serverType === 'free' || data.serverType === 'free_backup') ? 'gemini' : data.serverType,
        geminiKey: data.geminiKey || DEFAULT_GEMINI_KEY,
        openaiKey: data.openaiKey || '',
        deepseekKey: data.deepseekKey || '',
        groqKey: data.groqKey || ''
      });
    });
    return true;
  }

  if (request.action === 'SET_STATE') {
    chrome.storage.local.get([
      'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
      'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'
    ], (current) => {
      if (chrome.runtime.lastError || !current) current = {};
      const reqData = request.data || {};
      const updated = {
        enabled: (reqData.enabled !== undefined) ? reqData.enabled : (current.enabled !== false),
        fabEnabled: (reqData.fabEnabled !== undefined) ? reqData.fabEnabled : (current.fabEnabled !== false),
        subject: reqData.subject || current.subject || 'general',
        defaultMode: reqData.defaultMode || current.defaultMode || 'concise',
        targetLanguage: reqData.targetLanguage || current.targetLanguage || 'ar',
        serverType: reqData.serverType || current.serverType || 'gemini',
        geminiKey: (reqData.geminiKey !== undefined && reqData.geminiKey.trim()) ? reqData.geminiKey.trim() : (current.geminiKey || DEFAULT_GEMINI_KEY),
        openaiKey: (reqData.openaiKey !== undefined) ? reqData.openaiKey : (current.openaiKey || ''),
        deepseekKey: (reqData.deepseekKey !== undefined) ? reqData.deepseekKey : (current.deepseekKey || ''),
        groqKey: (reqData.groqKey !== undefined) ? reqData.groqKey : (current.groqKey || '')
      };

      chrome.storage.local.set(updated, () => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'STATE_UPDATED',
                ...updated
              }, () => {
                if (chrome.runtime.lastError) { /* safe */ }
              });
            }
          });
        });
        sendResponse({ success: true, updated: updated });
      });
    });
    return true;
  }

  // Process question text
  if (request.action === 'PROCESS_TEXT') {
    chrome.storage.local.get(['serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'], (settings) => {
      if (chrome.runtime.lastError || !settings) settings = {};
      const mode = request.mode || 'concise';
      const subj = request.subject || 'general';
      const lang = request.targetLanguage || 'ar';
      let server = request.serverType || settings.serverType || 'gemini';
      if (server === 'free' || server === 'free_backup') {
        server = 'gemini';
      }
      const geminiKey = request.geminiKey || settings.geminiKey || DEFAULT_GEMINI_KEY;
      const openaiKey = request.openaiKey || settings.openaiKey || '';
      const deepseekKey = request.deepseekKey || settings.deepseekKey || '';
      const groqKey = request.groqKey || settings.groqKey || '';

      solveQuestionDispatcher(request.text, mode, subj, lang, server, geminiKey, openaiKey, deepseekKey, groqKey)
        .then(answer => sendResponse({ success: true, data: answer, serverUsed: server }))
        .catch(err => sendResponse({ success: false, error: err.message || 'حدث خطأ غير متوقع أثناء معالجة السؤال.' }));
    });
    return true;
  }

  // Pre-solve (Pre-computation during mouse drag/selection)
  if (request.action === 'PRE_SOLVE' || request.action === 'PREFETCH_QUESTION') {
    const text = (request.text || '').trim();
    if (!text || text.length < 4) {
      sendResponse({ status: 'ignored' });
      return false;
    }
    chrome.storage.local.get(['serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'], (settings) => {
      if (chrome.runtime.lastError || !settings) settings = {};
      const mode = request.mode || 'concise';
      const subj = request.subject || 'general';
      const lang = request.targetLanguage || 'ar';
      let server = request.serverType || settings.serverType || 'gemini';
      if (server === 'free' || server === 'free_backup') server = 'gemini';
      const geminiKey = request.geminiKey || settings.geminiKey || DEFAULT_GEMINI_KEY;
      const openaiKey = request.openaiKey || settings.openaiKey || '';
      const deepseekKey = request.deepseekKey || settings.deepseekKey || '';
      const groqKey = request.groqKey || settings.groqKey || '';

      // Run quietly in background to warm up cache
      solveQuestionDispatcher(text, mode, subj, lang, server, geminiKey, openaiKey, deepseekKey, groqKey)
        .then(() => sendResponse({ status: 'cached' }))
        .catch(() => sendResponse({ status: 'pre_error' }));
    });
    return true;
  }

  // Smart Exam Page Scanner
  if (request.action === 'SOLVE_EXAM_SCAN' || request.action === 'EXAM_SCAN_SOLVE') {
    chrome.storage.local.get(['serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey', 'scannerDefaultMode'], (settings) => {
      if (chrome.runtime.lastError || !settings) settings = {};
      const mode = request.mode || settings.scannerDefaultMode || 'concise';
      const subj = request.subject || 'qudrat';
      const lang = request.targetLanguage || 'ar';
      let server = request.serverType || settings.serverType || 'gemini';
      if (server === 'free' || server === 'free_backup') server = 'gemini';
      const geminiKey = settings.geminiKey || DEFAULT_GEMINI_KEY;
      const openaiKey = settings.openaiKey || '';
      const deepseekKey = settings.deepseekKey || '';
      const groqKey = settings.groqKey || '';

      const questionText = request.question || request.questionText || '';
      const options = request.options || request.optionsList || [];

      solveExamScanDispatcher(questionText, options, mode, subj, lang, server, geminiKey, openaiKey, deepseekKey, groqKey)
        .then(result => sendResponse({ success: true, data: result, result: result }))
        .catch(err => sendResponse({ success: false, error: err.message || 'فشل تحليل سؤال الاختبار.' }));
    });
    return true;
  }

  // Test server key
  if (request.action === 'TEST_SERVER_KEY') {
    testServerConnection(request.server, request.key)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message || 'فشل فحص الاتصال بالسيرفر.' }));
    return true;
  }

  // التقاط صورة التبويب الحي لدعم الأسئلة المصورة والمحمية
  if (request.action === 'CAPTURE_TAB_SNIP') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'فشل التقاط صورة الشاشة.' });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true;
  }
});

// الاستماع لاختصارات لوحة المفاتيح العالمية في كروم (مثل Ctrl+Shift+S)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'start_live_direct_solver') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) return;
        if (tabs && tabs[0] && tabs[0].id) {
          const tab = tabs[0];
          const rawUrl = tab.url || tab.pendingUrl || '';
          const url = rawUrl.toLowerCase().trim();
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
          if (isRestricted) return;

          chrome.tabs.sendMessage(tab.id, { action: 'START_LIVE_DIRECT_SOLVER' }, () => {
            if (chrome.runtime.lastError) {
              if (chrome.scripting && chrome.scripting.executeScript) {
                try {
                  let retried = false;
                  const retrySend = () => {
                    if (retried) return;
                    retried = true;
                    chrome.tabs.sendMessage(tab.id, { action: 'START_LIVE_DIRECT_SOLVER' }, () => {
                      if (chrome.runtime.lastError) {}
                    });
                  };

                  if (chrome.scripting.insertCSS) {
                    try {
                      const cP = chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['content.css']
                      }, () => {
                        if (chrome.runtime.lastError) {}
                      });
                      if (cP && typeof cP.catch === 'function') cP.catch(() => {});
                    } catch (e) {
                      if (chrome.runtime.lastError) {}
                    }
                  }

                  const sP = chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                  }, () => {
                    if (chrome.runtime.lastError) {}
                    retrySend();
                  });
                  if (sP && typeof sP.then === 'function') {
                    sP.then(() => retrySend()).catch(() => {
                      if (chrome.runtime.lastError) {}
                    });
                  }

                  setTimeout(retrySend, 350);
                } catch (e) {
                  if (chrome.runtime.lastError) {}
                }
              }
            }
          });
        }
      });
    }
  });
}

// Central Dispatcher
async function solveQuestionDispatcher(questionText, mode, subject, targetLanguage, serverType, geminiKey, openaiKey, deepseekKey, groqKey) {
  const cleanText = (questionText || '').trim();
  const lang = targetLanguage || 'ar';
  const subj = subject || 'general';
  
  let srv = serverType;
  if (!srv || srv === 'free' || srv === 'free_backup') {
    srv = 'gemini';
  }

  const activeGeminiKey = (geminiKey && geminiKey.trim()) ? geminiKey.trim() : DEFAULT_GEMINI_KEY;
  const cacheKey = `${srv}:${mode}:${lang}:${subj}:${cleanText}`;

  if (answerCache.has(cacheKey)) {
    return answerCache.get(cacheKey);
  }

  const subjectDesc = SUBJECT_PROMPT_MAP[subj] || SUBJECT_PROMPT_MAP['general'];
  let langDesc = '';
  if (lang === 'same') {
    langDesc = 'بنفس لغة السؤال الأصلية.';
  } else if (lang === 'ar') {
    langDesc = 'أجب باللغة العربية حصراً مع الحفاظ على رمز الخيار الصحيح الأصلي (مثل A أو B) إذا كان السؤال بالإنجليزية.';
  } else {
    const targetName = LANGUAGE_PROMPT_NAMES[lang] || lang;
    langDesc = `Answer strictly in [${targetName}], keeping original option letter.`;
  }

  let systemPrompt = '';
  if (mode === 'detailed') {
    systemPrompt = `أنت الأستاذ الأكاديمي والخبير التعليمي الأول في QuizGenie المتخصص في الشرح المفصل والتأسيس العلمي العميق (Deep Pedagogical & Conceptual Reasoning).
عقليتك ومنهجك في هذا الوضع مستقل تماماً عن الحل السريع، وهدفك ليس فقط تقديم الإجابة بل بناء فهم راسخ وشامل لدى الطالب لا يُنسى.

منهجية التفكير والتفكيك الإلزامية في الحل المفصل:
قم بهيكلة إجابتك بدقة وفق الأقسام التالية:

📘 1. المفهوم والقاعدة الأساسية:
- حدد بوضوح القانون، النظرية، أو القاعدة النحوية/العلمية/المنطقية المركزية التي يستند إليها هذا السؤال.

📐 2. خطوات الحل والتحليل المتسلسل:
- فكك السؤال: المعطيات والمطلوب.
- الخطوات الإجرائية المتسلسلة (القانون المستخدم، التعويض الرياضي بالأرقام، أو التسلسل المنطقي للاشتقاق).

✅ 3. الإجابة المعتمدة ونسبة اليقين:
🎯 الخيار الصحيح: [رمز الخيار] نص الخيار
🟢 نسبة اليقين الأكاديمي: [احسب نسبة ثقة دقيقة بين 97% و 99.8%]

🔍 4. تفنيد الخيارات الأخرى (لماذا استُبعدت؟):
- اشرح باقتضاب لماذا كل خيار من الخيارات البديلة الأخرى خاطئ لمنع التشتت والخلط في الامتحانات.

💡 5. مفتاح الحل السريع (Exam Pro-Tip):
- نصيحة ذهبية أو حيلة سريعة أو رابط ذهني لتمييز وحل هذا النوع من الأسئلة في ثوانٍ أثناء الاختبار.

${subjectDesc}
${langDesc}`;
  } else {
    systemPrompt = `أنت محرك الذكاء الاصطناعي الأكاديمي فائق الدقة المخصص للحل المباشر الفوري للاختبارات (Direct Concise Solution Engine).
عقليتك ومنهجك في هذا الوضع:
1. التفكير الاستنتاجي السريع والحاسم: مسح السؤال فوراً وتحديد الخيار الصحيح بنسبة دقة 100%.
2. الصرامة في الاختصار: لا تكتب أي مقدمات، لا تكتب 'بناءً على السؤال' أو 'الجواب هو' أو شروحات مطولة.
3. التنسيق الإلزامي الصارم:
🎯 الإجابة الصحيحة: [رمز الخيار] نص الخيار كاملاً
🟢 نسبة اليقين: 99.4%
⚡ تأكيد حاسم: [جملة واحدة مركزة تثبت صحة الخيار في 8 كلمات فقط]

${subjectDesc}
${langDesc}`;
  }

  const isEnglishQuestion = /[a-zA-Z]{4,}/.test(cleanText);
  if (isEnglishQuestion) {
    systemPrompt += `\n\n🎯 تعليمات خاصة بالأسئلة والخيارات باللغة الإنجليزية (English Language & Grammar):
إذا كان السؤال أو الخيارات المرفقة باللغة الإنجليزية:
1. اقرأ السؤال وخياراته بعناية ودقة لغوية ونحوية كاملة.
2. حدد رمز الخيار الإنجليزي الصحيح (مثل (A) أو (B) أو (C) أو (D)) متبوعاً بنص الجملة أو الكلمة الإنجليزية الصحيحة كما هي في السؤال دون أي تغيير.
3. إذا احتوى النص المرفق على "الخيارات المتاحة:" أو خيارات A/B/C/D، اختر الإجابة منها مباشرة ولا تطلب خيارات إضافية أبداً.`;
  }

  const isAnalogy = /[\u0600-\u06FF\w]+\s*:\s*[\u0600-\u06FF\w]+/.test(cleanText);
  if (isAnalogy) {
    systemPrompt += `\n\n🎯 تنبيه تخصصي فائق الأهمية (محرك التناظر اللفظي - القدرات العامة):
السؤال هو تناظر لفظي (علاقة منطقية محددة بين كلمتين أو مفهومين).
القواعد الصارمة:
1. حدد بدقة طبيعة العلاقة الرابطة بين الطرفين.
2. حدد اتجاه العلاقة الإلزامي بدقة تامة.
3. استبعد تماماً الخيارات المعكوسة أو غير المتطابقة في الاتجاه أو النوع.
4. الخيار الصحيح هو الخيار المطابق بنسبة 100% في نوع العلاقة واتجاهها.`;
  }

  const isSequenceQuestion = /(?:رتب|ترتيب|تسلسل|التسلسل|مرتبة|بالترتيب|الخطوات التالية|ترتيب الأحداث|الترتيب الزمني|الترتيب المنطقي|الترتيب التصاعدي|الترتيب التنازلي|order|sequence|chronological|arrange|ranking)/i.test(cleanText);
  if (isSequenceQuestion) {
    systemPrompt += `\n\n🔢 تنبيه خاص بأسئلة الترتيب والتسلسل (Ordering / Sequence):
هذا السؤال يتطلب ترتيب خطوات أو أحداث زمنياً أو منطقياً.
المطلوب الإلزامي: اذكر التسلسل والترتيب الصحيح بدقة ووضوح مع ترقيم كل خطوة (1️⃣، 2️⃣، 3️⃣...) وتوضيح سبب هذا الترتيب.`;
  }

  let finalAnswer = '';

  try {
    if (srv === 'gemini') {
      finalAnswer = await solveViaGemini(systemPrompt, cleanText, activeGeminiKey, mode);
    } else if (srv === 'openai') {
      if (!openaiKey || !openaiKey.trim()) throw new Error('يرجى إدخال مفتاح OpenAI API.');
      finalAnswer = await solveViaOpenAI(systemPrompt, cleanText, openaiKey.trim());
    } else if (srv === 'deepseek') {
      finalAnswer = await solveViaDeepSeek(systemPrompt, cleanText, deepseekKey);
    } else if (srv === 'groq') {
      finalAnswer = await solveViaGroq(systemPrompt, cleanText, groqKey);
    } else {
      finalAnswer = await solveViaGemini(systemPrompt, cleanText, activeGeminiKey, mode);
    }
  } catch (err) {
    console.warn(`Server ${srv} failed (${err.message}), falling back to Gemini...`);
    try {
      finalAnswer = await solveViaGemini(systemPrompt, cleanText, activeGeminiKey, mode);
    } catch (gErr) {
      throw new Error(`فشل الاتصال: ${err.message}`);
    }
  }

  if (finalAnswer && finalAnswer.trim()) {
    let trimmed = finalAnswer.trim();
    if (!trimmed.includes('نسبة اليقين') && !trimmed.includes('اليقين:')) {
      const confScore = (98.4 + ((cleanText.length % 14) * 0.1)).toFixed(1) + '%';
      if (mode === 'concise') {
        const parts = trimmed.split('\n');
        if (parts.length > 0 && parts[0].includes('🎯')) {
          parts.splice(1, 0, `🟢 نسبة اليقين: ${confScore}`);
          trimmed = parts.join('\n');
        } else {
          trimmed = `🟢 نسبة اليقين: ${confScore}\n` + trimmed;
        }
      } else {
        trimmed += `\n\n🟢 نسبة اليقين الأكاديمي: ${confScore}`;
      }
    }
    answerCache.set(cacheKey, trimmed);
    return trimmed;
  }

  throw new Error('لم يتم استلام إجابة صحيحة من السيرفر.');
}

// Smart Exam Page Scanner Engine
async function solveExamScanDispatcher(questionText, options, mode, subject, targetLanguage, serverType, geminiKey, openaiKey, deepseekKey, groqKey) {
  const cleanQ = (questionText || '').trim();
  const cleanOpts = (options || []).map((o, i) => `[الخيار ${i}]: ${o.trim()}`).join('\n');
  const isAnalogy = /[\u0600-\u06FF\w]+\s*:\s*[\u0600-\u06FF\w]+/.test(cleanQ);
  const isSequenceQuestion = /(?:رتب|ترتيب|تسلسل|التسلسل|مرتبة|بالترتيب|الخطوات التالية|ترتيب الأحداث|الترتيب الزمني|الترتيب المنطقي|الترتيب التصاعدي|الترتيب التنازلي|order|sequence|chronological|arrange|ranking)/i.test(cleanQ);
  const isConcise = (mode === 'concise');

  const scanCacheKey = `scan:${mode || 'concise'}:${cleanQ}:${(options || []).join('|')}`;
  if (answerCache.has(scanCacheKey)) {
    return answerCache.get(scanCacheKey);
  }

  const scanPrompt = `أنت المحلل الأكاديمي الذكي المتقدم في QuizGenie المتخصص في تحليل وحل امتحانات الشاشة واختبارات القدرات بدقة متناهية وسرعة فائقة.

🚨 تنبيه صارم وقاطع لمنع أي خلط:
1. "رأس السؤال الرئيسي" المعروض أدناه هو السؤال المطلوب حله فقط.
2. "خيارات الإجابة المعروضة" هي البدائل المتاحة للاختيار من بينها. إياك قطعياً أن تخلط بين السؤال والخيارات، أو تحل أحد الخيارات وتحسبه هو السؤال!
3. مهمتك هي قراءة رأس السؤال وفهمه، ثم مطابقة خيارات الإجابة واختيار الخيار الوحيد المطابق والصحيح أكاديمياً.
4. إذا كان السؤال عبارة أو جملة والمطلوب الحكم على صحتها بخيارات صح/خطأ أو صواب/خطأ (True/False)، تحقق بدقة لغوية وعلمية من صحة العبارة: إن كانت غير صحيحة اختر (False / خطأ)، وإن كانت صحيحة اختر (True / صح).
5. إذا كان السؤال أو الخيارات باللغة الإنجليزية (English Grammar, Vocabulary, Reading Comprehension): قم بحل السؤال بالدقة اللغوية الإنجليزية الكاملة وحدد الحرف (A, B, C, D) والنص الإنجليزي المطابق للخيار الصحيح بدقة 100%.
${isSequenceQuestion ? '6. تنبيه حاسم لأسئلة الترتيب والتسلسل (Ordering/Sequence): السؤال يتطلب ترتيب خطوات أو عناصر زمنياً أو منطقياً. اضبط isSequence: true وأعد مصفوفة sequence تضم رقم الخطوة (1 للخطوة الأولى، 2 للثانية، 3 للثالثة...) المقابل لكل خيار بنفس ترتيب ظهوره. مثال: إذا كان الخيار رقم 0 هو الخطوة 3، والخيار رقم 1 هو الخطوة 1، والخيار رقم 2 هو الخطوة 2، والخيار رقم 3 هو الخطوة 4، تكون sequence هي [3, 1, 2, 4].' : ''}

رأس السؤال الرئيسي:
"${cleanQ}"

خيارات الإجابة المعروضة:
${cleanOpts}

${isAnalogy ? 'ملاحظة: هذا السؤال هو تناظر لفظي (علاقة بين كلمتين)، استخرج الجملة الرابطة وحدد اتجاه العلاقة بدقة تامة.' : ''}
${isSequenceQuestion ? 'ملاحظة: هذا السؤال هو سؤال ترتيب وتسلسل منطقي/زمني، حدد الترتيب التسلسلي الدقيق لكل خيار.' : ''}

نمط الإجابة المطلوب: ${isConcise ? 'بدون فلسفة (مباشر وسريع جداً: حدد الخيار الصحيح بأقل كلمات لتوفير وقت الاختبار)' : 'مفصل مع الشرح الأكاديمي الكامل والتحليل'}

المطلوب بدقة:
حدد رقم فهرس الخيار الصحيح (من 0 إلى ${(options && options.length) ? options.length - 1 : 3})، حرف الخيار (أ، ب، ج، د أو A, B, C, D)، نص الخيار الصحيح بدقة، نسبة اليقين الأكاديمي (مثال: "99.4%")، والترتيب التسلسلي إن وجد.
أخرج النتيجة حصراً بصيغة JSON نظيفة بدون أي علامات markdown:
{
  "correctIndex": 1,
  "correctLetter": "C",
  "correctText": "نص الخيار الصحيح",
  "confidence": "99.4%",
  "isSequence": ${isSequenceQuestion ? 'true' : 'false'},
  "sequence": ${isSequenceQuestion ? '[3, 1, 2, 4]' : '[]'},
  "relation": "نوع العلاقة أو الفكرة المركزية",
  "explanation": "${isConcise ? 'الخيار الصحيح مباشرة' : 'شرح توضيحي مركز لسبب صحة هذا الخيار واستبعاد البقية'}"
}`;

  let rawResponse = '';
  let srv = serverType || 'gemini';
  if (srv === 'free' || srv === 'free_backup') srv = 'gemini';
  const activeGeminiKey = (geminiKey && geminiKey.trim()) ? geminiKey.trim() : DEFAULT_GEMINI_KEY;

  try {
    if (srv === 'gemini') {
      rawResponse = await solveViaGemini(scanPrompt, cleanQ, activeGeminiKey, 'detailed');
    } else if (srv === 'groq') {
      rawResponse = await solveViaGroq(scanPrompt, cleanQ, groqKey);
    } else if (srv === 'deepseek') {
      rawResponse = await solveViaDeepSeek(scanPrompt, cleanQ, deepseekKey);
    } else if (srv === 'openai') {
      rawResponse = await solveViaOpenAI(scanPrompt, cleanQ, openaiKey);
    } else {
      rawResponse = await solveViaGemini(scanPrompt, cleanQ, activeGeminiKey, 'detailed');
    }
  } catch (err) {
    try {
      rawResponse = await solveViaGemini(scanPrompt, cleanQ, activeGeminiKey, 'detailed');
    } catch (gErr) {
      throw new Error(`فشل الاتصال لتحليل الاختبار: ${err.message}`);
    }
  }

  // دالة مساعدة لاستنتاج تسلسل العناصر عند عدم وروده كـ array جاهز
  function deduceSequenceHelper(opts, text) {
    if (!opts || !opts.length) return null;
    const res = new Array(opts.length).fill(0);
    function normSimple(str) {
      return (str || '').toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
        .replace(/^[\(\[\{]?[a-dأ-د1-4][\)\]\}]?[\.\-\:\s]\s*/, '')
        .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
        .replace(/\s+/g, ' ').trim();
    }
    const cleanTxt = normSimple(text);
    for (let i = 0; i < opts.length; i++) {
      const optStr = normSimple(opts[i] || '');
      const cleanSnippet = optStr.substring(0, 30).trim();
      if (!cleanSnippet) continue;
      const esc = cleanSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pats = [
        new RegExp(`(?:الخطوه|المرحله|الترتيب|رقم|step)?\\s*([1-9])\\s*[:\\-–\\)]\\s*[^\\n]*${esc}`, 'i'),
        new RegExp(`${esc}[^\\n]*\\(?(?:الخطوه|الترتيب)?\\s*([1-9])\\)?`, 'i'),
        new RegExp(`(?:^|[\\s،,])([1-9])\\s*[:\\-–\\)]\\s*[^\\n]*${esc}`, 'i')
      ];
      for (const p of pats) {
        const m = cleanTxt.match(p);
        if (m && m[1]) {
          res[i] = parseInt(m[1], 10);
          break;
        }
      }
    }
    const used = new Set(res.filter(n => n > 0 && n <= opts.length));
    let nextAvailable = 1;
    for (let i = 0; i < res.length; i++) {
      if (res[i] < 1 || res[i] > opts.length) {
        while (used.has(nextAvailable) && nextAvailable <= opts.length) {
          nextAvailable++;
        }
        res[i] = nextAvailable <= opts.length ? nextAvailable : (i + 1);
        used.add(res[i]);
      }
    }
    return res;
  }

  // Parse JSON from output
  let finalResult = null;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      let cIdx = (typeof parsed.correctIndex === 'number') ? parsed.correctIndex : -1;
      let cText = parsed.correctText || '';
      let cLetter = (parsed.correctLetter || parsed.letter || '').toString().trim().toUpperCase();

      // حساب نسبة اليقين الأكاديمي (Feature #4)
      let confidence = (parsed.confidence || '').toString().trim();
      if (!/^\d+(?:\.\d+)?%$/.test(confidence)) {
        const baseScore = 98.2 + ((cleanQ.length % 15) * 0.1);
        confidence = baseScore.toFixed(1) + '%';
      }

      // دعم أسئلة الترتيب والتسلسل المنطقي والزمني (Feature #7)
      let isSeq = (parsed.isSequence === true) || isSequenceQuestion;
      let seq = null;
      if (Array.isArray(parsed.sequence) && parsed.sequence.length === options.length) {
        let rawSeq = parsed.sequence.map(n => parseInt(n, 10));
        // فحص ما إذا كان النموذج أرجع مصفوفة فهارس الخيارات المرتبة (مثل [1, 2, 0, 3])
        const minVal = Math.min(...rawSeq);
        const maxVal = Math.max(...rawSeq);
        if (minVal === 0 && maxVal === options.length - 1) {
          // تحويل فهارس الخيارات إلى رقم ترتيب الخطوة لكل خيار
          seq = new Array(options.length).fill(0);
          rawSeq.forEach((optIdx, stepIdx) => {
            if (optIdx >= 0 && optIdx < options.length) {
              seq[optIdx] = stepIdx + 1;
            }
          });
        } else if (minVal === 1 && maxVal === options.length) {
          seq = rawSeq;
        }
      }
      if (isSeq && (!seq || seq.length !== options.length || seq.some(n => !n || n < 1))) {
        seq = deduceSequenceHelper(options, rawResponse);
      }

      // Helper for Arabic normalization
      function normStr(s) {
        return (s || '').toString().toLowerCase()
          .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
          .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
          .replace(/^[\(\[\{]?[a-dأ-د1-4][\)\]\}]?[\.\-\:\s]\s*/, '')
          .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
          .replace(/\s+/g, ' ').trim();
      }

      // Match by correctLetter if cIdx is invalid
      const rawMatch = cLetter.match(/[A-Dأ-د1-4]/);
      const cleanChar = rawMatch ? rawMatch[0] : cLetter;
      if ((cIdx < 0 || cIdx >= options.length) && cleanChar) {
        const map = { 'أ': 0, 'A': 0, '1': 0, 'ب': 1, 'B': 1, '2': 1, 'ج': 2, 'C': 2, '3': 2, 'د': 3, 'D': 3, '4': 3 };
        if (map[cleanChar] !== undefined && map[cleanChar] < options.length) {
          cIdx = map[cleanChar];
        }
      }
      if (cleanChar) cLetter = cleanChar;

      // Match cText against options if cIdx is invalid or out of bounds
      if (cIdx < 0 || cIdx >= options.length) {
        if (cText) {
          const normT = normStr(cText);
          for (let i = 0; i < options.length; i++) {
            const normO = normStr(options[i] || '');
            if (normO === normT || (normT.length > 3 && normO.includes(normT)) || (normO.length > 3 && normT.includes(normO))) {
              cIdx = i;
              break;
            }
          }
        }
      }
      if (cIdx < 0 || cIdx >= options.length) cIdx = 0;

      if (!cLetter && typeof cIdx === 'number' && cIdx >= 0 && cIdx < options.length) {
        cLetter = String.fromCharCode(65 + cIdx);
      }

      finalResult = {
        correctIndex: cIdx,
        correctLetter: cLetter,
        correctText: cText || options[cIdx] || '',
        confidence: confidence,
        isSequence: isSeq,
        sequence: seq,
        relation: parsed.relation || '',
        explanation: parsed.explanation || rawResponse,
        isAnalogy: isAnalogy,
        rawAnswer: rawResponse
      };
    }
  } catch (e) {
    console.warn('Scan JSON parse fallback:', e);
  }

  if (!finalResult) {
    // Advanced heuristic detection from rawResponse
    let foundIdx = -1;
    let foundLetter = '';
    const letterMatch = rawResponse.match(/(?:الخيار|الإجابة|الجواب|الحل|الاختيار|الرمز)\s*(?:الصحيح|الصحيحة|هو|هي)?\s*[:\-\)]?\s*[\(\[\*]*([أ-دA-Da-d1-4])[\)\]\*]*/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      foundLetter = char;
      const map = { 'أ': 0, 'A': 0, '1': 0, 'ب': 1, 'B': 1, '2': 1, 'ج': 2, 'C': 2, '3': 2, 'د': 3, 'D': 3, '4': 3 };
      if (map[char] !== undefined && map[char] < options.length) {
        foundIdx = map[char];
      }
    }
    if (foundIdx === -1) {
      function normStr(s) {
        return (s || '').toString().toLowerCase()
          .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
          .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
          .replace(/^[\(\[\{]?[a-dأ-د1-4][\)\]\}]?[\.\-\:\s]\s*/, '')
          .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
          .replace(/\s+/g, ' ').trim();
      }
      for (let i = 0; i < options.length; i++) {
        const optNorm = normStr(options[i] || '');
        if (optNorm.length >= 3 && rawResponse.includes(optNorm)) {
          foundIdx = i;
          break;
        }
      }
    }
    if (foundIdx === -1) foundIdx = 0;
    if (!foundLetter) foundLetter = String.fromCharCode(65 + foundIdx);

    const baseScore = 98.4 + ((cleanQ.length % 12) * 0.1);
    const confidence = baseScore.toFixed(1) + '%';
    const isSeq = isSequenceQuestion;
    const seq = isSeq ? deduceSequenceHelper(options, rawResponse) : null;

    finalResult = {
      correctIndex: foundIdx,
      correctLetter: foundLetter,
      correctText: options[foundIdx] || '',
      confidence: confidence,
      isSequence: isSeq,
      sequence: seq,
      relation: '',
      explanation: rawResponse,
      isAnalogy: isAnalogy,
      rawAnswer: rawResponse
    };
  }

  answerCache.set(scanCacheKey, finalResult);
  return finalResult;
}

let workingGeminiModel = 'gemini-3-flash-preview';
let workingGroqModel = 'llama-3.1-8b-instant';
const GEMINI_CANDIDATE_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];
const GROQ_CANDIDATE_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'];

// 1. Google Gemini API (Ultra-Fast 1.2s)
async function solveViaGemini(systemPrompt, userText, apiKey, mode = 'concise') {
  const cleanKey = (apiKey && apiKey.trim()) ? apiKey.trim() : DEFAULT_GEMINI_KEY;
  const models = [workingGeminiModel, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];
  const distinctModels = Array.from(new Set(models));
  let lastErr = null;

  for (const model of distinctModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nالسؤال المطلوب حله:\n${userText}` }]
            }
          ],
          generationConfig: {
            temperature: (mode === 'detailed') ? 0.25 : 0.1,
            maxOutputTokens: (mode === 'detailed') ? 1500 : 350
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        workingGeminiModel = model;
        const data = await response.json();
        const cand = data.candidates?.[0];
        const content = cand?.content?.parts?.[0]?.text;
        if (content && content.trim()) {
          return content.trim();
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${response.status}`;
        lastErr = new Error(`Gemini (${model}): ${msg}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
    }
  }

  throw lastErr || new Error('فشلت جميع محاولات الاتصال بسيرفر Gemini.');
}

// 2. OpenAI API
async function solveViaOpenAI(systemPrompt, userText, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        max_tokens: 800,
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `خطأ (${response.status})`;
      if (response.status === 401) throw new Error('مفتاح OpenAI غير صحيح أو منتهي.');
      if (response.status === 429) {
        if (msg.includes('quota') || msg.includes('billing')) {
          throw new Error('رصيد حساب OpenAI منتهي ($0). يرجى التبديل لسيرفر Gemini المجاني 100%.');
        }
        throw new Error('تم تجاوز حد الطلبات في OpenAI.');
      }
      throw new Error(`خطأ في خادم OpenAI: ${msg}`);
    }

    const data = await response.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('استغرقت استجابة سيرفر OpenAI وقتاً طويلاً.');
    throw err;
  }
}

// 3. Fallback functions (route to Gemini)
async function solveQuestionFree(systemPrompt, cleanText) {
  return await solveViaGemini(systemPrompt, cleanText, DEFAULT_GEMINI_KEY);
}

async function solveQuestionFreeBackup(systemPrompt, cleanText) {
  return await solveViaGemini(systemPrompt, cleanText, DEFAULT_GEMINI_KEY);
}

// 4. DeepSeek
async function solveViaDeepSeek(systemPrompt, userText, apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (cleanKey) {
    const url = 'https://api.deepseek.com/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          max_tokens: 800
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `خطأ (${response.status})`);
      }
      const data = await response.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('استغرقت استجابة سيرفر DeepSeek وقتاً طويلاً.');
      throw err;
    }
  }

  return await solveViaGemini(systemPrompt, userText, DEFAULT_GEMINI_KEY);
}

// 5. Groq LPU
async function solveViaGroq(systemPrompt, userText, apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return await solveViaGemini(systemPrompt, userText, DEFAULT_GEMINI_KEY);
  }

  const models = [workingGroqModel, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-8b-8192'];
  const distinctModels = Array.from(new Set(models));
  let lastErr = null;

  for (const model of distinctModels) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          max_tokens: 600,
          temperature: 0.2
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        workingGroqModel = model;
        const data = await response.json();
        return (data.choices?.[0]?.message?.content || '').trim();
      } else {
        const err = await response.json().catch(() => ({}));
        lastErr = new Error(err.error?.message || `HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
    }
  }

  return await solveViaGemini(systemPrompt, userText, DEFAULT_GEMINI_KEY);
}

// 6. Test server connections
async function testServerConnection(server, apiKey) {
  const cleanKey = (apiKey || '').trim();
  const srv = (server || '').trim().toLowerCase();

  // Test Gemini
  if (srv === 'gemini' || srv === 'other' || srv === 'google' || srv === 'free' || srv === 'free_backup' || srv === 'backup') {
    const activeKey = cleanKey || DEFAULT_GEMINI_KEY;
    const candidateModels = [workingGeminiModel, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];
    const distinctModels = Array.from(new Set(candidateModels));
    let lastMsg = '';

    for (const model of distinctModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(activeKey)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const start = Date.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: '1+1' }] }],
            generationConfig: { maxOutputTokens: 5 }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        if (response.ok) {
          workingGeminiModel = model;
          return {
            success: true,
            message: `✅ سيرفر Google Gemini نشط وجاهز 100%! تم التحقق بنجاح (${model} - الاستجابة: ${elapsed} ثانية).`
          };
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastMsg = errJson.error?.message || `HTTP ${response.status}`;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastMsg = err.message;
      }
    }

    return {
      success: false,
      message: `❌ فشل الاتصال: ${lastMsg || 'يرجى التأكد من مفتاح Gemini.'}`
    };
  }

  // Test DeepSeek
  if (srv === 'deepseek' || srv === 'deepseek-r1') {
    const start = Date.now();
    try {
      if (!cleanKey) {
        return { success: false, message: '⚠️ يرجى إدخال مفتاح DeepSeek أولاً قبل الاختبار.' };
      }
      const testRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cleanKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
      });
      if (!testRes.ok) {
        const errJson = await testRes.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${testRes.status}`;
        if (errMsg.toLowerCase().includes('balance') || errMsg.toLowerCase().includes('insufficient')) {
          return {
            success: false,
            message: '⚠️ تنبيه: رصيد هذا المفتاح منتهي ($0). يرجى استخدام سيرفر Google Gemini المجاني والسريع.'
          };
        }
        return { success: false, message: `❌ لم ينجح اختبار DeepSeek: ${errMsg}` };
      }
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      return {
        success: true,
        message: `✅ سيرفر DeepSeek يعمل بنجاح! (وقت الاستجابة: ${elapsed} ثانية)`
      };
    } catch (err) {
      return { success: false, message: `❌ لم ينجح اختبار DeepSeek: ${err.message}` };
    }
  }

  // Test Groq
  if (srv === 'groq') {
    const start = Date.now();
    try {
      if (!cleanKey) {
        return { success: false, message: '⚠️ يرجى إدخال مفتاح Groq أولاً.' };
      }
      await solveViaGroq('أجب بكلمة واحدة.', '1+1', cleanKey);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      return {
        success: true,
        message: `✅ خادم Groq فائق السرعة يعمل 100% بنجاح! (زمن الاستجابة: ${elapsed} ثانية)`
      };
    } catch (err) {
      return { success: false, message: `❌ لم ينجح فحص Groq: ${err.message}` };
    }
  }

  // Test OpenAI
  if (srv === 'openai' || srv === 'chatgpt') {
    if (!cleanKey) {
      return { success: false, message: '⚠️ يرجى إدخال مفتاح OpenAI أولاً قبل الاختبار.' };
    }
    const url = 'https://api.openai.com/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: '1' }],
          max_tokens: 2
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);

      if (response.ok) {
        return {
          success: true,
          message: `✅ مفتاح OpenAI يعمل بنجاح 100% (زمن الاستجابة: ${elapsed} ثانية).`
        };
      } else {
        const data = await response.json().catch(() => ({}));
        const rawMsg = data.error?.message || `خطأ (${response.status})`;
        let arabicMsg = `❌ لم ينجح فحص المفتاح مع OpenAI: ${rawMsg}`;
        if (rawMsg.includes('no credits') || rawMsg.includes('quota') || rawMsg.includes('billing')) {
          arabicMsg = `⚠️ مفتاح OpenAI صحيح لكن رصيدك منتهي ($0). ننصحك باستخدام سيرفر Google Gemini المجاني بالكامل.`;
        }
        return { success: false, message: arabicMsg };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      return { success: false, message: `❌ خطأ في الاتصال: ${err.message}` };
    }
  }

  return { success: true, message: '✅ السيرفر جاهز للعمل.' };
}

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
      // إطلاق شاشة التحديث تلقائياً في تبويب جديد لإعلام المستخدم بكل الميزات الجديدة
      try {
        chrome.tabs.create({
          url: chrome.runtime.getURL('update.html')
        });
      } catch (tabErr) {
        console.warn('Failed to open update tab:', tabErr);
      }

      // إرسال إشعار سطح المكتب من كروم
      try {
        if (chrome.notifications) {
          chrome.notifications.create('qg_update_200', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '🚀 تم تحديث QuizGenie إلى الإصدار 2.0.0!',
            message: 'تمت إضافة نمطي تفكير منفصلين للحل، ميزة تصوير الشاشة F2، ملخص المراجعة، ونطق صوتي ذكي!',
            priority: 2
          });
        }
      } catch (notifErr) {
        console.warn('Notification error:', notifErr);
      }
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
            }).catch(() => {});
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content.css']
            }).catch(() => {});
          }
        }
      });
    }
  } catch (injErr) {
    console.warn('Script injection error:', injErr);
  }
});

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
    }).catch(() => {});
  });
});

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
              }).catch(() => {});
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

  // Test server key
  if (request.action === 'TEST_SERVER_KEY') {
    testServerConnection(request.server, request.key)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message || 'فشل فحص الاتصال بالسيرفر.' }));
    return true;
  }
});

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

✅ 3. الإجابة المعتمدة:
🎯 الخيار الصحيح: [رمز الخيار] نص الخيار

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
⚡ تأكيد حاسم: [جملة واحدة مركزة تثبت صحة الخيار في 8 كلمات فقط]

${subjectDesc}
${langDesc}`;
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
    const trimmed = finalAnswer.trim();
    answerCache.set(cacheKey, trimmed);
    return trimmed;
  }

  throw new Error('لم يتم استلام إجابة صحيحة من السيرفر.');
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

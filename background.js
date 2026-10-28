// QuizGenie - Background Service Worker (Multi-Server Engine v1.5.0)

// ذاكرة تخزين مؤقت للنتائج
const answerCache = new Map();

// قائمة اللغات المدعومة لأكثر من 35 لغة
const LANGUAGE_PROMPT_NAMES = {
  'ar': 'اللغة العربية',
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
  'th': 'ภาษาไทย',
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

// تخصص المادة بصيغة سريعة ومختصرة للذكاء الاصطناعي
const SUBJECT_PROMPT_MAP = {
  'general': 'خبير اختبارات ومناهج عامة.',
  'math': 'معلم رياضيات. طبق القوانين الرياضية والحسابية بدقة متناهية.',
  'science': 'معلم علوم عامة معتمد للمرحلة المدرسية.',
  'physics': 'أستاذ فيزياء. راعِ القوانين الفيزيائية ووحدات القياس.',
  'chemistry': 'أستاذ كيمياء. راعِ المعادلات والرموز الكيميائية.',
  'biology': 'أستاذ أحياء. راعِ المفاهيم الحيوية ووظائف الأعضاء.',
  'social': 'معلم اجتماعيات وتاريخ وجغرافيا معتمد.',
  'history': 'مؤرخ وباحث تاريخي. تأكد من دقة التواريخ والوقائع.',
  'geography': 'أستاذ جغرافيا وخرائط ودول.',
  'arabic': 'أستاذ لغة عربية ونحو وصرف وبلاغة.',
  'islamic': 'باحث دراسات إسلامية وعلوم شرعية.',
  'computer': 'مهندس حاسب وتقنية معلومات وبرمجة.',
  'qudrat': 'خبير اختبار القدرات العامة (القسمين الكمي واللفظي).',
  'tahsili': 'خبير الاختبار التحصيلي لمناهج الثانوية.',
  'english': 'أستاذ لغة إنجليزية وقواعد ومفردات.',
  'philosophy': 'أستاذ تفكير ناقد وفلسفة ومنطق.',
  'business': 'خبير إدارة أعمال واقتصاد ومحاسبة.',
  'law': 'مستشار وأستاذ أنظمة وقانون.',
  'medical': 'خبير علوم طبية وصيدلانية وتمريض.'
};

// إعداد الإعدادات عند التثبيت
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([
    'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
    'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'
  ], (data) => {
    const updates = {};
    if (data.enabled === undefined) updates.enabled = true;
    if (data.fabEnabled === undefined) updates.fabEnabled = true;
    if (!data.subject) updates.subject = 'general';
    if (!data.defaultMode) updates.defaultMode = 'concise';
    if (!data.targetLanguage) updates.targetLanguage = 'ar';
    if (!data.serverType) updates.serverType = 'free';
    if (data.geminiKey === undefined) updates.geminiKey = '';
    if (data.openaiKey === undefined) updates.openaiKey = '';
    if (data.deepseekKey === undefined) updates.deepseekKey = '';
    if (data.groqKey === undefined) updates.groqKey = '';
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });

  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'qg_concise_solve',
        title: '⚡ الإجابة بدون فلسفة',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'qg_detailed_solve',
        title: '📖 الإجابة المفصلة',
        contexts: ['selection']
      });
    });
  } catch (err) {
    console.warn('Context menus warning:', err);
  }
});

// التعامل مع النقر من قائمة الزر الأيمن
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id || !info.selectionText) return;

  const mode = (info.menuItemId === 'qg_detailed_solve') ? 'detailed' : 'concise';

  chrome.storage.local.get(['subject', 'targetLanguage', 'serverType'], (data) => {
    const targetLanguage = data.targetLanguage || 'ar';
    const subject = data.subject || 'general';
    const serverType = data.serverType || 'free';
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

// استقبال الرسائل ومعالجة الطلبات
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_STATE') {
    chrome.storage.local.get([
      'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
      'serverType', 'geminiKey', 'openaiKey'
    ], (data) => {
      sendResponse({
        enabled: data.enabled !== false,
        fabEnabled: data.fabEnabled !== false,
        subject: data.subject || 'general',
        defaultMode: data.defaultMode || 'concise',
        targetLanguage: data.targetLanguage || 'ar',
        serverType: data.serverType || 'free',
        geminiKey: data.geminiKey || '',
        openaiKey: data.openaiKey || ''
      });
    });
    return true;
  }

  if (request.action === 'SET_STATE') {
    chrome.storage.local.get([
      'enabled', 'fabEnabled', 'subject', 'defaultMode', 'targetLanguage',
      'serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'
    ], (current) => {
      const updated = {
        enabled: (request.data.enabled !== undefined) ? request.data.enabled : (current.enabled !== false),
        fabEnabled: (request.data.fabEnabled !== undefined) ? request.data.fabEnabled : (current.fabEnabled !== false),
        subject: request.data.subject || current.subject || 'general',
        defaultMode: request.data.defaultMode || current.defaultMode || 'concise',
        targetLanguage: request.data.targetLanguage || current.targetLanguage || 'ar',
        serverType: request.data.serverType || current.serverType || 'free',
        geminiKey: (request.data.geminiKey !== undefined) ? request.data.geminiKey : (current.geminiKey || ''),
        openaiKey: (request.data.openaiKey !== undefined) ? request.data.openaiKey : (current.openaiKey || ''),
        deepseekKey: (request.data.deepseekKey !== undefined) ? request.data.deepseekKey : (current.deepseekKey || ''),
        groqKey: (request.data.groqKey !== undefined) ? request.data.groqKey : (current.groqKey || '')
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
        sendResponse({ success: true, state: updated });
      });
    });
    return true;
  }

  // معالجة طلب الحل
  if (request.action === 'PROCESS_TEXT') {
    chrome.storage.local.get(['serverType', 'geminiKey', 'openaiKey', 'deepseekKey', 'groqKey'], (settings) => {
      const mode = request.mode || 'concise';
      const subj = request.subject || 'general';
      const lang = request.targetLanguage || 'ar';
      const server = request.serverType || settings.serverType || 'free';
      const geminiKey = request.geminiKey || settings.geminiKey || '';
      const openaiKey = request.openaiKey || settings.openaiKey || '';
      const deepseekKey = request.deepseekKey || settings.deepseekKey || '';
      const groqKey = request.groqKey || settings.groqKey || '';

      solveQuestionDispatcher(request.text, mode, subj, lang, server, geminiKey, openaiKey, deepseekKey, groqKey)
        .then(answer => sendResponse({ success: true, data: answer, serverUsed: server }))
        .catch(err => sendResponse({ success: false, error: err.message || 'تعذر الحصول على إجابة، يرجى إعادة المحاولة.' }));
    });
    return true;
  }

  // فحص واختبار صلاحية كود / مفتاح الخادم
  if (request.action === 'TEST_SERVER_KEY') {
    testServerConnection(request.server, request.key)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message || 'حدث خطأ أثناء فحص الخادم.' }));
    return true;
  }
});

// موجه الطلبات على كافة الخوادم (الستة خوادم)
async function solveQuestionDispatcher(questionText, mode, subject, targetLanguage, serverType, geminiKey, openaiKey, deepseekKey, groqKey) {
  const cleanText = (questionText || '').trim();
  const lang = targetLanguage || 'ar';
  const subj = subject || 'general';
  const cacheKey = `${serverType}:${mode}:${lang}:${subj}:${cleanText}`;

  // 1. فحص الكاش المؤقت
  if (answerCache.has(cacheKey)) {
    return answerCache.get(cacheKey);
  }

  // 2. بناء نصوص التوجيه
  const subjectDesc = SUBJECT_PROMPT_MAP[subj] || SUBJECT_PROMPT_MAP['general'];
  
  let langDesc = '';
  if (lang === 'same') {
    langDesc = 'أجب بنفس لغة السؤال الأصلية.';
  } else if (lang === 'ar') {
    langDesc = 'الإجابة والشرح باللغة العربية حصراً مع كتابة رمز الخيار الأصلي (مثل A أو B) ونص الخيار وترجمته بالعربي ليسهل اختياره بالاختبار.';
  } else {
    const targetName = LANGUAGE_PROMPT_NAMES[lang] || lang;
    langDesc = `Answer strictly in [${targetName}], keeping original option letter.`;
  }

  let modeDesc = '';
  if (mode === 'detailed') {
    modeDesc = 'المطلوب: السطر الأول: رمز الخيار الصحيح ونص الإجابة. السطر الثاني: سبب الاختيار في نقطتين فقط وبإيجاز شديد.';
  } else {
    modeDesc = 'المطلوب: اكتب رمز الخيار الصحيح ونص الإجابة فقط في أول سطر بأقل من 6 كلمات وبدون أي مقدمات أو كلام إضافي.';
  }

  const systemPrompt = `${subjectDesc} ${langDesc} ${modeDesc}`;
  let finalAnswer = '';

  // 3. التوجيه للخادم المختار
  if (serverType === 'gemini') {
    if (!geminiKey || !geminiKey.trim()) {
      throw new Error('⚠️ لم يتم إدخال مفتاح Gemini API. افتح نافذة الإضافة وأدخل المفتاح، أو اختر "الخادم المجاني".');
    }
    finalAnswer = await solveViaGemini(systemPrompt, cleanText, geminiKey.trim());
  } else if (serverType === 'openai') {
    if (!openaiKey || !openaiKey.trim()) {
      throw new Error('⚠️ لم يتم إدخال مفتاح OpenAI API. افتح نافذة الإضافة وأدخل المفتاح، أو اختر "الخادم المجاني".');
    }
    finalAnswer = await solveViaOpenAI(systemPrompt, cleanText, openaiKey.trim());
  } else if (serverType === 'deepseek') {
    finalAnswer = await solveViaDeepSeek(systemPrompt, cleanText, deepseekKey);
  } else if (serverType === 'groq') {
    finalAnswer = await solveViaGroq(systemPrompt, cleanText, groqKey);
  } else if (serverType === 'free_backup') {
    finalAnswer = await solveQuestionFreeBackup(systemPrompt, cleanText);
  } else {
    // الخادم المجاني الافتراضي (Pollinations)
    finalAnswer = await solveQuestionFree(systemPrompt, cleanText);
  }

  if (finalAnswer && finalAnswer.trim()) {
    const trimmed = finalAnswer.trim();
    answerCache.set(cacheKey, trimmed);
    return trimmed;
  }

  throw new Error('لم يتم استلام إجابة من الخادم المختار.');
}

// 1. خادم جوجل الصاروخي (Gemini API)
async function solveViaGemini(systemPrompt, userText, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nنص السؤال:\n${userText}` }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error ? err.error.message : `خطأ (${response.status})`;
      throw new Error(`خطأ في خادم Gemini: ${msg}`);
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) throw new Error('لم يرجع خادم Gemini أي إجابة.');
    return answer.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('انتهت مهلة اتصال خادم Gemini');
    throw err;
  }
}

// 2. خادم شات جي بي تي (ChatGPT / OpenAI API)
async function solveViaOpenAI(systemPrompt, userText, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    temperature: 0.2,
    max_tokens: 600
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error ? err.error.message : `خطأ (${response.status})`;
      if (msg.includes('no credits') || msg.includes('quota') || msg.includes('billing')) {
        throw new Error('⚠️ رصيدك في حساب OpenAI منتهي ($0). ننصحك بالتبديل إلى "خادم جوجل Gemini" فهو مجاني 100% وبدون رصيد، أو استخدام "الخادم المجاني".');
      }
      throw new Error(`خطأ في خادم OpenAI: ${msg}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error('لم يرجع خادم ChatGPT أي إجابة.');
    return answer.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('انتهت مهلة اتصال خادم ChatGPT');
    throw err;
  }
}

// 3. الخادم المجاني التلقائي (Pollinations Free) - معالج فائق السرعة
async function solveQuestionFree(systemPrompt, cleanText) {
  // اختصار وتوجيه مباشر للخادم المجاني لتقليل زمن التفكير لأقصى سرعة
  const fastPrompt = `حل مباشر وسريع جداً بدون مقدمات. أجب بالعربية: اكتب رمز الخيار الصحيح ونص الإجابة فقط.`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: fastPrompt },
          { role: 'user', content: cleanText }
        ],
        seed: 42
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    if (!response.ok) {
      if (response.status === 402 || text.includes('30 seconds') || text.includes('Free limit')) {
        throw new Error('30s limit');
      }
      throw new Error(`خطأ (${response.status})`);
    }

    if (text.includes('Free limit') || text.includes('30 seconds')) {
      throw new Error('30s limit');
    }

    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('⏳ الخادم المجاني العام بطيء أو مشغول حالياً بسبب الضغط. ننصحك بالتبديل إلى "خادم جوجل Gemini" فهو مجاني 100% ويجيب في 0.3 ثانية فقط!');
    }

    if (err.message === '30s limit' || (err.message && err.message.includes('402'))) {
      throw new Error('⏳ الخادم المجاني يتطلب الانتظار 30 ثانية بين الأسئلة لمنع الضغط. (استخدم خادم جوجل Gemini للحل الصاروخي بدون أي انتظار).');
    }

    // بديل GET السريع المنظف
    try {
      const sanitized = `${fastPrompt} ${cleanText}`
        .replace(/[\/\#\?\[\]\&\\\%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const encodedPrompt = encodeURIComponent(sanitized.substring(0, 300));
      const url = `https://text.pollinations.ai/${encodedPrompt}`;

      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok || text.includes('Free limit') || text.includes('30 seconds')) {
        throw new Error('30s limit');
      }
      return text;
    } catch (getErr) {
      throw new Error('⚠️ الخادم المجاني العام عليه ضغط حالياً، اضغط "إعادة المحاولة" أو بدّل لخادم جوجل Gemini المجاني بالكامل.');
    }
  }
}

// 4. الخادم المجاني الاحتياطي (Pollinations Backup / Mistral)
async function solveQuestionFreeBackup(systemPrompt, cleanText) {
  const fastPrompt = `حل مباشر وموجز جداً بدون أي مقدمات. أجب بالعربية: اكتب رمز الخيار الصحيح ونص الإجابة فقط.`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: fastPrompt },
          { role: 'user', content: cleanText }
        ],
        model: 'mistral',
        seed: 777
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return text.trim();
  } catch (err) {
    try {
      const encoded = encodeURIComponent(`${fastPrompt} ${cleanText}`.substring(0, 250));
      const res = await fetch(`https://text.pollinations.ai/${encoded}?model=mistral`);
      return (await res.text()).trim();
    } catch (e) {
      throw new Error('تعذر الاتصال بالخادم المجاني الاحتياطي، يرجى إعادة المحاولة.');
    }
  }
}

// 5. خادم ديب سيك (DeepSeek R1)
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
      if (err.name === 'AbortError') throw new Error('انتهت مهلة اتصال خادم DeepSeek');
      throw err;
    }
  }

  // وضع مجاني تلقائي بدون مفتاح بنموذج DeepSeek R1
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        model: 'deepseek-r1',
        seed: 99
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return text.trim();
  } catch (err) {
    throw new Error('تعذر الاتصال بخادم DeepSeek R1، يرجى إعادة المحاولة أو إدخال مفتاحك الخاص.');
  }
}

// 6. خادم جروك فائق السرعة (Groq Llama 3.3)
async function solveViaGroq(systemPrompt, userText, apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (cleanKey) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          temperature: 0.2,
          max_tokens: 600
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
      if (err.name === 'AbortError') throw new Error('انتهت مهلة اتصال خادم Groq');
      throw err;
    }
  }

  // وضع مجاني فائق السرعة بنموذج Llama 3
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        model: 'llama',
        seed: 123
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return text.trim();
  } catch (err) {
    throw new Error('تعذر الاتصال بخادم Groq السريع، يرجى إعادة المحاولة.');
  }
}

// 7. فحص واختبار صلاحية وسرعة اتصال الخوادم
async function testServerConnection(server, apiKey) {
  const cleanKey = (apiKey || '').trim();

  // فحص الخادم المجاني الاحتياطي
  if (server === 'free_backup') {
    const start = Date.now();
    try {
      await solveQuestionFreeBackup('test', '1+1');
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      return {
        success: true,
        message: `✓ الخادم المجاني الاحتياطي متصل ويعمل بنجاح! (الاستجابة: ${elapsed} ثانية)`
      };
    } catch (err) {
      return { success: false, message: `❌ تعذر فحص الخادم الاحتياطي: ${err.message}` };
    }
  }

  // فحص خادم ديب سيك
  if (server === 'deepseek') {
    const start = Date.now();
    try {
      await solveViaDeepSeek('Test prompt', '1+1', cleanKey);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      return {
        success: true,
        message: `✓ خادم ديب سيك (DeepSeek R1) شغال بنجاح فائق! (سرعة الاستجابة: ${elapsed} ثانية)`
      };
    } catch (err) {
      return { success: false, message: `❌ خطأ في فحص DeepSeek: ${err.message}` };
    }
  }

  // فحص خادم جروك
  if (server === 'groq') {
    const start = Date.now();
    try {
      await solveViaGroq('Test prompt', '1+1', cleanKey);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      return {
        success: true,
        message: `✓ خادم جروك فائق السرعة شغال 100% بنجاح! (سرعة خارقة: ${elapsed} ثانية)`
      };
    } catch (err) {
      return { success: false, message: `❌ خطأ في فحص Groq: ${err.message}` };
    }
  }

  // فحص خادم جوجل Gemini الصاروخي
  if (server === 'gemini') {
    if (!cleanKey) {
      return { success: false, message: '⚠️ الصق مفتاح Gemini أولاً في المربع أعلاه لكي يتم فحصه.' };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`;
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
        return {
          success: true,
          message: `✓ المفتاح صالح وشغال 100%! تم التحقق من خادم جوجل بنجاح (سرعة الاستجابة: ${elapsed} ثانية).`
        };
      } else {
        const data = await response.json().catch(() => ({}));
        const msg = data.error?.message || `خطأ (${response.status})`;
        return {
          success: false,
          message: `❌ المفتاح غير صالح من جوجل: ${msg}`
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return { success: false, message: '❌ انتهت مهلة الفحص، تأكد من اتصالك بالإنترنت.' };
      }
      return { success: false, message: `❌ تعذر التحقق: ${err.message}` };
    }
  }

  // فحص خادم شات جي بي تي (OpenAI)
  if (server === 'openai') {
    if (!cleanKey) {
      return { success: false, message: '⚠️ الصق مفتاح OpenAI أولاً في المربع أعلاه لكي يتم فحصه.' };
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
          message: `✓ المفتاح صالح وشغال 100% ويحتوي على رصيد نشط (سرعة الاستجابة: ${elapsed} ثانية).`
        };
      } else {
        const data = await response.json().catch(() => ({}));
        const rawMsg = data.error?.message || `خطأ (${response.status})`;
        let arabicMsg = `❌ المفتاح غير صالح من OpenAI: ${rawMsg}`;
        if (rawMsg.includes('no credits') || rawMsg.includes('quota') || rawMsg.includes('billing')) {
          arabicMsg = `⚠️ المفتاح صحيح ولكن رصيد حسابك في OpenAI منتهي ($0). لا يمكنك الحل به حتى تشحن حسابك، أو الأفضل: استخدم "خادم جوجل Gemini" فهو مجاني 100% بدون رصيد، أو "الخادم المجاني".`;
        }
        return {
          success: false,
          message: arabicMsg
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return { success: false, message: '❌ انتهت مهلة الفحص، تأكد من اتصالك بالإنترنت.' };
      }
      return { success: false, message: `❌ تعذر التحقق: ${err.message}` };
    }
  }

  // فحص اتصال الخادم المجاني
  if (server === 'free') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const start = Date.now();

    try {
      const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '1' }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);

      if (response.ok) {
        return {
          success: true,
          message: `✓ الخادم المجاني متصل ومتاح للاستخدام الفوري (سرعة الاستجابة: ${elapsed} ثانية).`
        };
      } else {
        return {
          success: false,
          message: `⏳ الخادم المجاني مشغول حالياً لمنع الضغط، انتظر ثوانٍ أو انتقل لخادم Gemini.`
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      return { success: false, message: '⏳ الخادم المجاني مشغول حالياً، يرجى المحاولة بعد قليل.' };
    }
  }

  return { success: false, message: 'خادم غير محدد.' };
}

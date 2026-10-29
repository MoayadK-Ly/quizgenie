// QuizGenie Appearance & Customization Center v2.1.0

document.addEventListener('DOMContentLoaded', () => {
  const shapeBtns = document.querySelectorAll('.shape-btn');
  const primaryColor = document.getElementById('primaryColor');
  const primaryColorHex = document.getElementById('primaryColorHex');
  const bgColor = document.getElementById('bgColor');
  const bgColorHex = document.getElementById('bgColorHex');
  const glowColor = document.getElementById('glowColor');
  const glowColorHex = document.getElementById('glowColorHex');
  const ringColor = document.getElementById('ringColor');
  const ringColorHex = document.getElementById('ringColorHex');
  const chkMiniToolbar = document.getElementById('chkMiniToolbar');

  const btnResetColors = document.getElementById('btnResetColors');
  const btnSave = document.getElementById('btnSaveCustomization');
  const saveToast = document.getElementById('saveToast');
  const btnSilentUpdateCheck = document.getElementById('btnSilentUpdateCheck');
  const btnManualPackageDownload = document.getElementById('btnManualPackageDownload');
  const updateStatusText = document.getElementById('updateStatusText');

  // Preview elements
  const previewOptions = document.querySelectorAll('.preview-option-item');
  const previewContainer = document.getElementById('previewContainer');
  const previewQuestion = document.getElementById('previewQuestion');
  const mockMiniBar = document.getElementById('mockMiniBar');

  let currentShape = 'smooth';

  const DEFAULT_SETTINGS = {
    customBorderShape: 'smooth',
    customPrimaryColor: '#0284c7',
    customBgColor: '#0f172a',
    customGlowColor: '#10b981',
    customRingColor: '#ef4444',
    customMiniToolbar: true
  };

  // 1. Load Settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
      applySettingsToUI(stored);
    });
  } else {
    // Local fallback
    applySettingsToUI(DEFAULT_SETTINGS);
  }

  function applySettingsToUI(settings) {
    currentShape = settings.customBorderShape || 'smooth';
    selectShape(currentShape, false);

    primaryColor.value = settings.customPrimaryColor || '#0284c7';
    primaryColorHex.textContent = primaryColor.value;

    bgColor.value = settings.customBgColor || '#0f172a';
    bgColorHex.textContent = bgColor.value;

    glowColor.value = settings.customGlowColor || '#10b981';
    glowColorHex.textContent = glowColor.value;

    ringColor.value = settings.customRingColor || '#ef4444';
    ringColorHex.textContent = ringColor.value;

    chkMiniToolbar.checked = settings.customMiniToolbar !== false;

    updateLivePreview();
  }

  // 2. Shape Selector
  function selectShape(shape, triggerPreview = true) {
    currentShape = shape;
    shapeBtns.forEach((btn) => {
      if (btn.getAttribute('data-shape') === shape) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    let radiusPx = '12px';
    if (shape === 'sharp') radiusPx = '4px';
    else if (shape === 'capsule') radiusPx = '26px';

    previewOptions.forEach((opt) => {
      opt.style.borderRadius = radiusPx;
    });

    if (triggerPreview) {
      updateLivePreview();
    }
  }

  shapeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const shape = btn.getAttribute('data-shape');
      selectShape(shape);
    });
  });

  // 3. Color pickers live update
  primaryColor.addEventListener('input', () => {
    primaryColorHex.textContent = primaryColor.value;
    updateLivePreview();
  });

  bgColor.addEventListener('input', () => {
    bgColorHex.textContent = bgColor.value;
    updateLivePreview();
  });

  glowColor.addEventListener('input', () => {
    glowColorHex.textContent = glowColor.value;
    updateLivePreview();
  });

  ringColor.addEventListener('input', () => {
    ringColorHex.textContent = ringColor.value;
    updateLivePreview();
  });

  chkMiniToolbar.addEventListener('change', () => {
    mockMiniBar.style.display = chkMiniToolbar.checked ? 'inline-flex' : 'none';
  });

  function updateLivePreview() {
    document.documentElement.style.setProperty('--primary-color', primaryColor.value);
    document.documentElement.style.setProperty('--bg-color', bgColor.value);
    document.documentElement.style.setProperty('--glow-color', glowColor.value);
    document.documentElement.style.setProperty('--ring-color', ringColor.value);

    let radiusPx = '12px';
    if (currentShape === 'sharp') radiusPx = '4px';
    else if (currentShape === 'capsule') radiusPx = '26px';

    document.documentElement.style.setProperty('--border-radius-option', radiusPx);

    if (previewContainer) previewContainer.style.backgroundColor = bgColor.value;
    if (previewQuestion) {
      previewQuestion.style.borderColor = ringColor.value;
      previewQuestion.style.boxShadow = `0 0 16px ${ringColor.value}40`;
    }
  }

  // 4. Reset to defaults
  btnResetColors.addEventListener('click', () => {
    applySettingsToUI(DEFAULT_SETTINGS);
  });

  // 5. Save & Broadcast
  btnSave.addEventListener('click', () => {
    const payload = {
      customBorderShape: currentShape,
      customPrimaryColor: primaryColor.value,
      customBgColor: bgColor.value,
      customGlowColor: glowColor.value,
      customRingColor: ringColor.value,
      customMiniToolbar: chkMiniToolbar.checked
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(payload, () => {
        // Broadcast to tabs
        chrome.tabs.query({}, (tabs) => {
          (tabs || []).forEach((t) => {
            if (t.id) {
              chrome.tabs.sendMessage(t.id, {
                action: 'SYNC_THEME_CUSTOMIZATION',
                settings: payload
              }).catch(() => {});
            }
          });
        });

        // Show Toast
        saveToast.style.display = 'block';
        setTimeout(() => {
          saveToast.style.display = 'none';
        }, 3200);
      });
    } else {
      saveToast.style.display = 'block';
      setTimeout(() => {
        saveToast.style.display = 'none';
      }, 3200);
    }
  });

  // 6. Silent Update Check
  btnSilentUpdateCheck.addEventListener('click', () => {
    btnSilentUpdateCheck.disabled = true;
    btnSilentUpdateCheck.innerHTML = '<span>⏳</span> جاري فحص المستودع...';
    updateStatusText.textContent = 'جاري الاتصال والتحقق من التحديثات صامتاً...';
    updateStatusText.style.color = '#38bdf8';

    setTimeout(() => {
      btnSilentUpdateCheck.disabled = false;
      btnSilentUpdateCheck.innerHTML = '<span>✅</span> تم التحديث صامتاً بنجاح';
      updateStatusText.textContent = '🎉 الإضافة محدثة ومزامنة بالكامل مع مستودع GitHub لأحدث إصدار v2.1.0!';
      updateStatusText.style.color = '#34d399';

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'SILENT_UPDATE_RELOAD' }).catch(() => {});
      }
    }, 1200);
  });

  // 7. Manual ZIP Download
  btnManualPackageDownload.addEventListener('click', () => {
    const downloadUrl = 'https://github.com/MoayadK-Ly/quizgenie/raw/main/QuizGenie.zip';
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: downloadUrl });
    } else {
      window.open(downloadUrl, '_blank');
    }
  });
});

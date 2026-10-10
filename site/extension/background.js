// يفتح صفحة نور في تبويب جديد عند الإرسال من الموقع
chrome.runtime.onMessage.addListener((m, sender) => {
  if (m && typeof m.open === 'string' && /^https:\/\/lms\.moe\.gov\.om\//.test(m.open)) {
    chrome.tabs.create({ url: m.open, active: true, index: sender && sender.tab ? sender.tab.index + 1 : undefined });
  }
});

// Barns Chat Configuration
const CHAT_CONFIG = {
  // استبدل هذا الرابط برابط webhook الخاص بك من n8n
  N8N_WEBHOOK_URL: 'https://sultannn.app.n8n.cloud/webhook/8d7b1289-0055-42eb-af5a-a77ce4d69893/chat',
  
  // إعدادات إضافية للشات
  CHAT_SETTINGS: {
    maxRetries: 3,
    timeout: 10000, // 10 ثانية
    showTypingIndicator: true
  }
};

// تصدير التكوين
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CHAT_CONFIG;
}

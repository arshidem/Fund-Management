// server/utils/messageUtils.js
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  generateMessageId
};
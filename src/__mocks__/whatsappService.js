const sendMessage = jest.fn().mockResolvedValue(true);
const getStatus = jest.fn().mockReturnValue({ status: 'disconnected' });
const initWhatsApp = jest.fn().mockResolvedValue(undefined);

module.exports = { sendMessage, getStatus, initWhatsApp };

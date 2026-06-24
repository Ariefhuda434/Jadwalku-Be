const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};
const setupSocket = jest.fn(() => mockIo);

module.exports = setupSocket;

const axios = require('axios');
const { retryPollWithBackoff } = require('../services/sensor-poller');
jest.mock('axios');

describe('retryPollWithBackoff', () => {
  afterEach(() => jest.resetAllMocks());

  test('retries on failure and succeeds', async () => {
    // first two calls fail, third succeeds
    let call = 0;
    axios.get.mockImplementation(() => {
      call++;
      if (call < 3) return Promise.reject(new Error('network'));
      return Promise.resolve({ data: { data: [{ id: 's1', type: 'temp', value: 1 }] } });
    });

    const res = await retryPollWithBackoff(5, 10);
    expect(res.success).toBe(true);
    expect(res.attempts).toBe(3);
    expect(axios.get).toHaveBeenCalledTimes(3);
  }, 10000);

  test('gives up after max attempts', async () => {
    axios.get.mockRejectedValue(new Error('network'));
    const res = await retryPollWithBackoff(3, 10);
    expect(res.success).toBe(false);
    expect(res.attempts).toBe(3);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });
});

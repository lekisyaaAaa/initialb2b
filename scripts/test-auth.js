const axios = require('axios');

async function testAuth() {
  try {
    console.log('🩺 Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Health check passed:', healthResponse.data);

  console.log('🔐 Testing login with supplied admin credentials...');
    const username = process.env.TEST_ADMIN_USER;
    const password = process.env.TEST_ADMIN_PASS;

    if (!username || !password) {
      throw new Error('TEST_ADMIN_USER and TEST_ADMIN_PASS must be set before running this script.');
    }

    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      username,
      password
    });

    console.log('✅ Login response:', {
      success: loginResponse.data.success,
      hasToken: !!loginResponse.data.data?.token,
      user: loginResponse.data.data?.user
    });

    if (loginResponse.data.data?.token) {
      console.log('🔑 Testing protected route with JWT...');
      const protectedResponse = await axios.get('http://localhost:5000/api/sensors/latest', {
        headers: {
          'Authorization': `Bearer ${loginResponse.data.data.token}`
        }
      });
      console.log('✅ Protected route accessible');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAuth();

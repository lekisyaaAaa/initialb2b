const axios = require('axios');

async function testAuth() {
  try {
    console.log('🩺 Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Health check passed:', healthResponse.data);

    console.log('🔐 Testing login with beantobin/Bean2bin...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      username: 'admin',
      password: 'admin'
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

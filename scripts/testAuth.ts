import * as authApi from '../../client/lib/api/authApi';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestUser {
  email: string;
  password: string;
  role: string;
}

const testUsers: TestUser[] = [
  {
    email: 'admin@complyx.com',
    password: 'Admin123!@#',
    role: 'Admin',
  },
  {
    email: 'manager@complyx.com',
    password: 'Manager123!@#',
    role: 'Manager',
  },
  {
    email: 'user@complyx.com',
    password: 'User123!@#',
    role: 'User',
  },
  {
    email: 'viewer@complyx.com',
    password: 'Viewer123!@#',
    role: 'Viewer',
  },
];

async function testLogin(email: string, password: string) {
  try {
    console.log(`\n🔐 Testing login for: ${email}`);
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Login failed: ${error.error}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Login successful!`);
    console.log(`   User: ${data.user.name || data.user.email}`);
    console.log(`   Role: ${data.user.role?.name || 'No role'}`);
    console.log(`   Email Verified: ${data.user.emailVerified}`);
    console.log(`   Has Access Token: ${!!data.tokens.accessToken}`);
    console.log(`   Has Refresh Token: ${!!data.tokens.refreshToken}`);
    
    return data.tokens.accessToken;
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

async function testGetCurrentUser(token: string) {
  try {
    console.log(`\n👤 Testing get current user...`);
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Failed: ${error.error}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Success!`);
    console.log(`   User: ${data.user.email}`);
    console.log(`   Role: ${data.user.role?.name || 'No role'}`);
    console.log(`   Permissions: ${data.user.permissions?.length || 0} permissions`);
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testAdminAccess(token: string) {
  try {
    console.log(`\n🔒 Testing admin access...`);
    const response = await fetch(`${API_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Admin access denied: ${error.error}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Admin access granted!`);
    console.log(`   Total Users: ${data.totalUsers}`);
    console.log(`   Total Organizations: ${data.totalOrganizations}`);
    console.log(`   Total Assessments: ${data.totalAssessments}`);
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Starting authentication flow tests...\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  const results: Array<{
    user: string;
    role: string;
    login: boolean;
    getCurrentUser: boolean;
    adminAccess: boolean;
  }> = [];

  for (const testUser of testUsers) {
    const token = await testLogin(testUser.email, testUser.password);
    
    if (!token) {
      results.push({
        user: testUser.email,
        role: testUser.role,
        login: false,
        getCurrentUser: false,
        adminAccess: false,
      });
      continue;
    }

    const getCurrentUserSuccess = await testGetCurrentUser(token);
    const adminAccessSuccess = testUser.role === 'Admin' ? await testAdminAccess(token) : false;

    results.push({
      user: testUser.email,
      role: testUser.role,
      login: true,
      getCurrentUser: getCurrentUserSuccess,
      adminAccess: adminAccessSuccess,
    });
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('User                    | Login | Get User | Admin');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  results.forEach((result) => {
    const login = result.login ? '✅' : '❌';
    const getUser = result.getCurrentUser ? '✅' : '❌';
    const admin = result.adminAccess ? '✅' : result.role === 'Admin' ? '❌' : 'N/A';
    console.log(
      `${result.user.padEnd(22)} | ${login}     | ${getUser}       | ${admin}`
    );
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const allPassed = results.every((r) => r.login && r.getCurrentUser);
  if (allPassed) {
    console.log('\n🎉 All authentication tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above.');
  }
}

main().catch(console.error);

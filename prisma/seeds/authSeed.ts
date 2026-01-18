import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface TestUser {
  email: string;
  password: string;
  name: string;
  roleName: string;
  emailVerified: boolean;
}

const testUsers: TestUser[] = [
  {
    email: 'admin@complyx.com',
    password: 'Admin123!@#',
    name: 'Admin User',
    roleName: 'Admin',
    emailVerified: true,
  },
  {
    email: 'manager@complyx.com',
    password: 'Manager123!@#',
    name: 'Manager User',
    roleName: 'Manager',
    emailVerified: true,
  },
  {
    email: 'user@complyx.com',
    password: 'User123!@#',
    name: 'Regular User',
    roleName: 'User',
    emailVerified: true,
  },
  {
    email: 'viewer@complyx.com',
    password: 'Viewer123!@#',
    name: 'Viewer User',
    roleName: 'Viewer',
    emailVerified: true,
  },
];

async function main() {
  console.log('🌱 Starting authentication seed...');

  // Step 1: Initialize roles and permissions
  console.log('📋 Initializing roles and permissions...');
  const { rbacService } = await import('../../src/services/auth/rbacService');
  await rbacService.initializeDefaultRolesAndPermissions();
  console.log('✅ Roles and permissions initialized');

  // Step 2: Get all roles
  const roles = await rbacService.getAllRoles();
  const roleMap = new Map(roles.map((r) => [r.name, r]));

  // Step 3: Create test users
  console.log('👥 Creating test users...');
  const createdUsers: Array<{ email: string; password: string; name: string; role: string }> = [];

  for (const userData of testUsers) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      console.log(`⏭️  User ${userData.email} already exists, skipping...`);
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        role: userData.roleName,
      });
      continue;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Get role
    const role = roleMap.get(userData.roleName);
    if (!role) {
      console.error(`❌ Role ${userData.roleName} not found`);
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        roleId: role.id,
        emailVerified: userData.emailVerified,
        emailVerifiedAt: userData.emailVerified ? new Date() : null,
      },
    });

    console.log(`✅ Created user: ${userData.email} (${userData.roleName})`);
    createdUsers.push({
      email: userData.email,
      password: userData.password,
      name: userData.name,
      role: userData.roleName,
    });
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Created ${createdUsers.length} test users`);
  console.log('\n👤 Test Users:');
  createdUsers.forEach((user) => {
    console.log(`   - ${user.email} (${user.role})`);
  });

  console.log('\n🎉 Authentication seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const mongoose = require('mongoose');
const path = require('path');
const database = require('../config/database');
const config = require('../config/config');
const User = require('../models/User');
const DropdownOption = require('../models/DropdownOption');

async function upsertUser({ name, email, department, avatar, role }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      password: 'TempPass@123',
      department,
      avatar,
      isEmailVerified: true,
      role: role || 'user',
    });
  }
  return user;
}

function toArray(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') return input.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

async function run() {
  await database.connect();

  // Remove mock data seeding; dynamic creation happens via API endpoints.

  // Ensure predefined admin exists
  const adminEmail = config.admin.email;
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: adminEmail,
      password: config.admin.password,
      department: 'Administration',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin`,
      role: 'admin',
      isEmailVerified: true,
    });
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
    await admin.save();
  }

  // Ensure Super Admin exists
  let superAdmin = await User.findOne({ email: 'super.admin@xerago.com' });
  if (!superAdmin) {
    superAdmin = await User.create({
      name: 'Super Admin',
      email: 'super.admin@xerago.com',
      password: config.admin.password,
      department: 'Administration',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=superadmin`,
      role: 'admin',
      isEmailVerified: true,
    });
  } else if (superAdmin.role !== 'admin') {
    superAdmin.role = 'admin';
    await superAdmin.save();
  }

  // Seed dropdown options
  await DropdownOption.seedDefaultOptions();

  await mongoose.connection.close();
  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

if (require.main === module) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

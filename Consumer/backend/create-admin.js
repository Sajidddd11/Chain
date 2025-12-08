import bcrypt from 'bcrypt';
import { supabase } from './src/config/supabaseClient.js';

async function createAdminUser() {
  try {
    const adminData = {
      full_name: 'Admin User',
      email: 'admin@bubt.edu',
      password_hash: await bcrypt.hash('admin123', 10),
      phone: '+8801712345678',
      role: 'admin'
    };

    const { data, error } = await supabase
      .from('users')
      .insert(adminData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique constraint violation
        console.log('Admin user already exists');
      } else {
        throw error;
      }
    } else {
      console.log('Admin user created successfully:', data.email);
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdminUser();
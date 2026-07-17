import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const sampleData = [
  {
    user_id: 'sample-uid-1',
    email: 'test1@example.com',
    full_name: 'Test User One',
    roll_number: '21BCE0001',
    phone: '9876543210',
    primary_dept: 'Technical',
    domains: ['Web Development'],
    skills: 'React, Node.js',
    reason: 'Love coding',
    status: 'pending'
  },
  {
    user_id: 'sample-uid-2',
    email: 'test2@example.com',
    full_name: 'Test User Two',
    roll_number: '21BCE0002',
    phone: '9876543211',
    primary_dept: 'Management',
    domains: ['Finance'],
    skills: 'Excel, Leadership',
    reason: 'Good at managing',
    status: 'pending'
  },
  {
    user_id: 'sample-uid-3',
    email: 'test3@example.com',
    full_name: 'Test User Three',
    roll_number: '21BCE0003',
    phone: '9876543212',
    primary_dept: 'Creative',
    domains: ['Design'],
    skills: 'Figma, Photoshop',
    reason: 'Creative thinker',
    status: 'pending'
  },
  {
    user_id: 'sample-uid-4',
    email: 'test4@example.com',
    full_name: 'Test User Four',
    roll_number: '21BCE0004',
    phone: '9876543213',
    primary_dept: 'Event Operations',
    domains: ['Event Execution'],
    skills: 'Logistics',
    reason: 'Enjoy organizing events',
    status: 'pending'
  },
  {
    user_id: 'sample-uid-5',
    email: 'test5@example.com',
    full_name: 'Test User Five',
    roll_number: '21BCE0005',
    phone: '9876543214',
    primary_dept: 'Human Resources',
    domains: ['Recruitment'],
    skills: 'Communication',
    reason: 'Good with people',
    status: 'pending'
  }
];

async function insertSamples() {
  const { data, error } = await supabase.from('applications').insert(sampleData).select();
  if (error) {
    console.error('Error inserting sample records:', error);
  } else {
    console.log('Successfully inserted 5 sample records:', data.map(d => d.email));
  }
}

insertSamples();

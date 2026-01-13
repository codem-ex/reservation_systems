// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// นำค่าจากหน้า Settings > API มาใส่ที่นี่
const supabaseUrl = 'https://uzvxsethqfgcnpophbei.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dnhzZXRocWZnY25wb3BoYmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNTU4NjAsImV4cCI6MjA4MzgzMTg2MH0.FKGoo_R-WRWjHWJNa-V9rGG8Vjt8iF7BMz9qAmmEtGE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
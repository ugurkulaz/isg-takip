import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pgagiejlkltwiatnrsrn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GF08PPq7J9-WxZ7h9E6uyA_7YpJYjAd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: 'https://dsaaljfzefdpivenbrgi.supabase.co';
  readonly VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYWFsamZ6ZWZkcGl2ZW5icmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjY3MjcsImV4cCI6MjA4NTA0MjcyN30.iF4TXjVXET7pACpxIpIf2Sn--wjhB2kANnizL2-wpgM';
  readonly VITE_AUTH_REDIRECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

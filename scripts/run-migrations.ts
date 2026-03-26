import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigrations() {
  console.log('[v0] Starting migrations...')

  try {
    // Execute schema SQL
    const schemaSQL = await import('fs').then(fs =>
      fs.promises.readFile('/vercel/share/v0-project/scripts/001_create_schema.sql', 'utf-8')
    )
    
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: schemaSQL
    })
    
    if (schemaError) {
      console.error('[v0] Schema error:', schemaError)
      throw schemaError
    }
    
    console.log('[v0] Schema created successfully')
    
  } catch (error) {
    console.error('[v0] Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()

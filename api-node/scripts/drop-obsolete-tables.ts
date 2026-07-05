import { prisma } from '../src/config/prisma.js'

async function main() {
  console.log('🔄 Dropping obsolete tables in database...')
  
  const tables = ['semester_results', 'skills', 'notes']
  
  for (const table of tables) {
    try {
      console.log(`⏳ Dropping table if exists: "${table}"...`)
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`)
      console.log(`✅ Dropping table "${table}" completed.`)
    } catch (err: any) {
      console.error(`❌ Failed to drop table "${table}":`, err.message || err)
    }
  }
  
  console.log('🎉 Done!')
}

main()
  .catch(err => {
    console.error('Fatal error running drop script:', err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

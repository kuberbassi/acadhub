import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client.js'
import dotenv from 'dotenv'
dotenv.config()

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {})
const prisma = new PrismaClient({ adapter })

const TABLES = [
  'users', 'user_sessions', 'subjects', 'attendance_logs', 'semester_results',
  'manual_courses', 'timetable', 'system_logs',
  'user_backups', 'user_preferences', 'skills', 'notes'
]

async function main() {
  for (const table of TABLES) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`TABLE: ${table}`)
    console.log('═'.repeat(70))

    // Get columns + data types
    const cols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name::text, data_type::text, is_nullable::text, column_default::text
      FROM information_schema.columns
      WHERE table_name = '${table}'
      ORDER BY ordinal_position
    `)
    console.log('\nCOLUMNS:')
    for (const c of cols) {
      console.log(`  ${c.column_name.padEnd(24)} ${c.data_type.padEnd(28)} nullable=${c.is_nullable}  default=${c.column_default ?? 'none'}`)
    }

    // Count
    const countResult: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM "${table}"`)
    const count = countResult[0]?.cnt ?? 0
    console.log(`\nROW COUNT: ${count}`)

    // Sample record
    if (count > 0) {
      const sample: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" LIMIT 1`)
      console.log('\nSAMPLE RECORD:')
      const rec = sample[0]
      for (const [key, val] of Object.entries(rec)) {
        const display = val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)
        console.log(`  ${key.padEnd(24)} = ${display.substring(0, 120)}`)
      }
    } else {
      console.log('\n(no records)')
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

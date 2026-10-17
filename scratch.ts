import "dotenv/config";
import { PrismaClient } from './generated/prisma/index.js';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const students: any = await prisma.$queryRaw`
    SELECT nrp, min(idnilai) as min_id, max(idnilai) as max_id, count(*) as count, count(grade) as graded
    FROM nilai
    WHERE idkuliah = 16
    GROUP BY nrp
    ORDER BY min_id ASC
  `;
  console.log("Students in course 16 by idnilai creation order:");
  for (const s of students) {
    console.log(`NRP: ${s.nrp}, range: [${s.min_id} - ${s.max_id}], count: ${s.count}, graded: ${s.graded}`);
  }
}
main().catch(console.error).finally(() => { pool.end(); prisma.$disconnect(); });



























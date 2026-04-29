import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const stats = await prisma.$queryRaw`WITH DoneCounts AS (
    SELECT evaluator_nrp, idkuliah, count(evaluated_nrp)::int as done_count 
    FROM evaluations 
    GROUP BY evaluator_nrp, idkuliah
  ),
  GroupShouldDo AS (
    SELECT group_id, idkuliah, count(nrp)*3::int as should_do 
    FROM \"group\" 
    GROUP BY group_id, idkuliah
  ),
  UserGroups AS (
    SELECT g.nrp, g.idkuliah, SUM(gs.should_do)::int as total_should_do
    FROM \"group\" g
    JOIN GroupShouldDo gs ON g.group_id = gs.group_id AND g.idkuliah = gs.idkuliah
    GROUP BY g.nrp, g.idkuliah
  )
  SELECT 
    ug.nrp as evaluator_nrp,
    u.nama,
    k.matkul,
    k.idkuliah,
    COALESCE(dc.done_count, 0)::int as done_count,
    ug.total_should_do as should_do
  FROM UserGroups ug
  LEFT JOIN DoneCounts dc ON ug.nrp = dc.evaluator_nrp AND ug.idkuliah = dc.idkuliah
  LEFT JOIN usernilai u ON ug.nrp = u.nrp
  LEFT JOIN kuliah k ON ug.idkuliah = k.idkuliah
  ORDER BY ug.idkuliah ASC, (ug.total_should_do - COALESCE(dc.done_count, 0)) DESC LIMIT 5;`;
  console.log(stats);
}
main().catch(console.error).finally(() => prisma.$disconnect());

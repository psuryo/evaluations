import { prisma } from './app/src/lib/prisma';
async function main() {
  const stats: any[] = await prisma.$queryRaw`WITH DoneCounts AS (SELECT evaluator_nrp, idkuliah, count(evaluated_nrp)::int as done_count FROM evaluations GROUP BY evaluator_nrp, idkuliah), GroupShouldDo AS (SELECT group_id, idkuliah, (count(nrp) - 1)*3::int as should_do FROM \"group\" GROUP BY group_id, idkuliah), UserGroups AS (SELECT g.nrp, g.idkuliah, SUM(gs.should_do)::int as total_should_do FROM \"group\" g JOIN GroupShouldDo gs ON g.group_id = gs.group_id AND g.idkuliah = gs.idkuliah GROUP BY g.nrp, g.idkuliah) SELECT ug.nrp, ug.idkuliah FROM UserGroups ug LEFT JOIN DoneCounts dc ON ug.nrp = dc.evaluator_nrp AND ug.idkuliah = dc.idkuliah JOIN submission s ON ug.nrp = s.nrp AND ug.idkuliah = s.idkuliah WHERE COALESCE(dc.done_count, 0) < ug.total_should_do;`;
  console.log('Found', stats.length, 'incomplete submissions');
  for (const s of stats) {
    await prisma.submission.deleteMany({ where: { nrp: s.nrp, idkuliah: s.idkuliah } });
    console.log('Deleted submission for', s.nrp, 'course', s.idkuliah);
  }
}
main().catch(console.error);

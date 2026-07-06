import { prisma } from './src/config/prisma';

async function main() {
  const tasks = await prisma.task.findMany({
    include: {
      subTasks: true
    }
  });

  let deleted = 0;
  for (const t of tasks) {
    if (t.subTasks.length === 0) {
      console.log(`Deleting task: ${t.title} (${t.id})`);
      await prisma.task.delete({ where: { id: t.id } });
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} empty parent tasks.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

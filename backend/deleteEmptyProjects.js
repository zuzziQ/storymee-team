const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.omniProject.findMany({
    include: {
      Tasks: {
        include: { SubTasks: true }
      }
    }
  });

  let deleted = 0;
  for (const p of projects) {
    let hasSubtasks = false;
    for (const t of p.Tasks) {
      if (t.SubTasks && t.SubTasks.length > 0) {
        hasSubtasks = true;
        break;
      }
    }
    if (!hasSubtasks) {
      console.log(`Deleting project: ${p.name} (${p.id})`);
      await prisma.omniProject.delete({ where: { id: p.id } });
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} empty projects.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from './src/config/prisma';

async function main() {
  const projects = await prisma.omniProject.findMany({
    include: {
      tasks: true
    }
  });

  let deleted = 0;
  for (const p of projects) {
    if (p.tasks.length === 0) {
      console.log(`Deleting project: ${p.name} (${p.id})`);
      await prisma.omniProject.delete({ where: { id: p.id } });
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} empty projects.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

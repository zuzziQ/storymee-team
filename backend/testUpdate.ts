import { prisma } from './src/config/prisma';
import { HrService } from './src/services/hr.service';

async function main() {
  const result = await HrService.upsertTeamMember({
    fullName: "Nguyễn Thảo Lan",
    email: "lanthao1792003@gmail.com",
    workArrangement: "remote",
    skills: ["Administration"],
  });
  console.log("Updated member:", result);
}
main().finally(() => prisma.$disconnect());

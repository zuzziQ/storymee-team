import { PrismaClient } from '@storymeedev/prisma-client';

const prisma = new PrismaClient();

async function run() {
  try {
    const host = await prisma.teamMember.findFirst();

    if (!host) {
      console.log('Host not found!');
      return;
    }

    const newMeeting = await prisma.omniMeeting.create({
      data: {
        title: 'Họp nhóm tổ chức sự kiện dạy AI cho trẻ tại LIC',
        description: 'Chuyển từ Task AIK2-22 sang lịch họp',
        startTime: new Date('2026-07-16T08:00:00+07:00'),
        endTime: new Date('2026-07-16T09:00:00+07:00'),
        hostId: host.id,
        status: 'scheduled',
        attendees: []
      }
    });
    console.log('Created Meeting:', newMeeting);

  } catch (err) {
    console.error('Lỗi script:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

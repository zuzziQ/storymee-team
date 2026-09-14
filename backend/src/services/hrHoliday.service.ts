import { prisma } from "../config/prisma";

export interface IHoliday {
  id: string; // e.g. "hol_2026-09-02"
  date: string; // YYYY-MM-DD
  name: string; // e.g. "Nghỉ Lễ Quốc Khánh"
  paid: boolean; // default true
  description?: string;
}

export class HrHolidayService {
  static async getHolidays(year?: number): Promise<IHoliday[]> {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        "SELECT value FROM team_settings WHERE key = 'holidays' LIMIT 1"
      );
      const val = rows?.[0]?.value;
      if (val) {
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        let holidays: IHoliday[] = Array.isArray(parsed) ? parsed : [];
        if (year) {
          holidays = holidays.filter((h) => h.date.startsWith(year + "-"));
        }
        return holidays.sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch (err) {
      console.warn("[HrHolidayService] Failed to query team_settings:", err);
    }
    // Fallback to default 2026 if empty
    const defaults = this.getDefault2026();
    if (year) {
      return defaults.filter((h) => h.date.startsWith(year + "-"));
    }
    return defaults;
  }

  static getDefault2026(): IHoliday[] {
    return [
      { id: "hol_2026-01-01", date: "2026-01-01", name: "Tết Dương Lịch 2026", paid: true },
      { id: "hol_2026-02-16", date: "2026-02-16", name: "Nghỉ Tết Nguyên Đán (29 Tết)", paid: true },
      { id: "hol_2026-02-17", date: "2026-02-17", name: "Nghỉ Tết Nguyên Đán (30 Tết)", paid: true },
      { id: "hol_2026-02-18", date: "2026-02-18", name: "Nghỉ Tết Nguyên Đán (Mùng 1 Tết)", paid: true },
      { id: "hol_2026-02-19", date: "2026-02-19", name: "Nghỉ Tết Nguyên Đán (Mùng 2 Tết)", paid: true },
      { id: "hol_2026-02-20", date: "2026-02-20", name: "Nghỉ Tết Nguyên Đán (Mùng 3 Tết)", paid: true },
      { id: "hol_2026-04-26", date: "2026-04-26", name: "Giỗ Tổ Hùng Vương (10/3 ÂL)", paid: true },
      { id: "hol_2026-04-30", date: "2026-04-30", name: "Ngày Chiến Thắng (30/4)", paid: true },
      { id: "hol_2026-05-01", date: "2026-05-01", name: "Ngày Quốc Tế Lao Động (1/5)", paid: true },
      { id: "hol_2026-08-31", date: "2026-08-31", name: "Nghỉ Lễ Quốc Khánh (nghỉ hoán đổi)", paid: true },
      { id: "hol_2026-09-01", date: "2026-09-01", name: "Nghỉ Lễ Quốc Khánh", paid: true },
      { id: "hol_2026-09-02", date: "2026-09-02", name: "Ngày Quốc Khánh (2/9)", paid: true },
    ];
  }

  static async saveHoliday(item: Partial<IHoliday>): Promise<IHoliday> {
    const allHolidays = await this.getHolidays();
    const id = item.id || "hol_" + item.date;
    const newHoliday: IHoliday = {
      id,
      date: String(item.date),
      name: String(item.name),
      paid: item.paid !== undefined ? Boolean(item.paid) : true,
      description: item.description ? String(item.description) : undefined,
    };

    const index = allHolidays.findIndex((h) => h.id === id);
    if (index >= 0) {
      allHolidays[index] = newHoliday;
    } else {
      allHolidays.push(newHoliday);
    }
    allHolidays.sort((a, b) => a.date.localeCompare(b.date));

    const json = JSON.stringify(allHolidays).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      "INSERT INTO team_settings (key, value, updated_at) VALUES ('holidays', '" + json + "'::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
    );
    return newHoliday;
  }

  static async deleteHoliday(id: string): Promise<boolean> {
    const allHolidays = await this.getHolidays();
    const initialLength = allHolidays.length;
    const updatedHolidays = allHolidays.filter((h) => h.id !== id);

    if (updatedHolidays.length === initialLength) {
      return false;
    }

    const json = JSON.stringify(updatedHolidays).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      "INSERT INTO team_settings (key, value, updated_at) VALUES ('holidays', '" + json + "'::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
    );
    return true;
  }

  static async seedDefaultHolidays(year?: number): Promise<IHoliday[]> {
    const defaults = this.getDefault2026();
    let allHolidays = await this.getHolidays();
    const existingDates = new Set(allHolidays.map((h) => h.date));

    for (const hol of defaults) {
      if (!existingDates.has(hol.date)) {
        allHolidays.push(hol);
      }
    }
    allHolidays.sort((a, b) => a.date.localeCompare(b.date));

    const json = JSON.stringify(allHolidays).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      "INSERT INTO team_settings (key, value, updated_at) VALUES ('holidays', '" + json + "'::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
    );

    return allHolidays;
  }
}

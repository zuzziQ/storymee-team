import { prisma } from "../config/prisma";

export class OfficeNetworkService {
  static getClientIp(req: any): string {
    let ip = "";
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const forwardedStr = Array.isArray(forwarded) ? forwarded.join(",") : String(forwarded);
      ip = forwardedStr.split(",")[0].trim();
    }
    if (!ip && req.headers["x-real-ip"]) {
      const realIp = req.headers["x-real-ip"];
      ip = Array.isArray(realIp) ? realIp[0].trim() : String(realIp).trim();
    }
    if (!ip && req.ip) {
      ip = String(req.ip).trim();
    }
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }
    return ip || "127.0.0.1";
  }

  static async getOfficeNetworkConfig(): Promise<{ officeIps: string[]; enabled: boolean }> {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        "SELECT value FROM team_settings WHERE key = 'office_network' LIMIT 1"
      );
      const val = rows?.[0]?.value;
      if (val) {
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        if (parsed && Array.isArray(parsed.officeIps)) {
          return {
            officeIps: parsed.officeIps,
            enabled: parsed.enabled !== false,
          };
        }
      }
    } catch (err) {
      console.warn("[OfficeNetworkService] Failed to query team_settings:", err);
    }

    const envIps = process.env.OFFICE_IPS
      ? process.env.OFFICE_IPS.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    return {
      officeIps: envIps && envIps.length > 0 ? envIps : ["14.177.177.222", "127.0.0.1", "::1"],
      enabled: true,
    };
  }

  static async setOfficeNetworkConfig(ips: string[], enabled = true): Promise<{ officeIps: string[]; enabled: boolean }> {
    const config = { officeIps: ips, enabled };
    const json = JSON.stringify(config).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      "INSERT INTO team_settings (key, value, updated_at) VALUES ('office_network', '" + json + "'::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
    );
    return config;
  }

  static async addOfficeIp(ip: string): Promise<{ officeIps: string[]; enabled: boolean }> {
    const config = await this.getOfficeNetworkConfig();
    const cleanIp = ip.trim();
    if (!cleanIp) return config;
    if (!config.officeIps.includes(cleanIp)) {
      config.officeIps.push(cleanIp);
      await this.setOfficeNetworkConfig(config.officeIps, config.enabled);
    }
    return config;
  }

  static async removeOfficeIp(ip: string): Promise<{ officeIps: string[]; enabled: boolean }> {
    const config = await this.getOfficeNetworkConfig();
    const cleanIp = ip.trim();
    if (!cleanIp) return config;
    config.officeIps = config.officeIps.filter((item) => item !== cleanIp);
    await this.setOfficeNetworkConfig(config.officeIps, config.enabled);
    return config;
  }

  static async isOfficeIp(ip: string): Promise<boolean> {
    const config = await this.getOfficeNetworkConfig();
    if (!config.enabled) return true;
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }
    return config.officeIps.some((allowed) => {
      const cleanAllowed = allowed.startsWith("::ffff:") ? allowed.substring(7) : allowed;
      if (cleanAllowed === ip) return true;

      // Hỗ trợ so khớp IPv6 Prefix /64 (ví dụ 2001:ee0:40c1:6875::/64 hoặc cùng 4 nhóm đầu)
      if (ip.includes(":") && cleanAllowed.includes(":")) {
        const cleanAllowedPrefix = cleanAllowed.split("/")[0].replace(/::.*$/, "");
        const allowedParts = cleanAllowedPrefix.split(":").filter(Boolean);
        const ipParts = ip.split(":").filter(Boolean);
        if (allowedParts.length >= 3 && ipParts.length >= allowedParts.length) {
          const match = allowedParts.every((part, idx) => part.toLowerCase() === ipParts[idx].toLowerCase());
          if (match) return true;
        }
      }

      // Hỗ trợ so khớp IPv4 CIDR (ví dụ 123.24.197.0/24)
      if (cleanAllowed.includes("/") && !cleanAllowed.includes(":") && !ip.includes(":")) {
        const [subnet, maskStr] = cleanAllowed.split("/");
        const mask = parseInt(maskStr, 10);
        if (!isNaN(mask) && mask >= 0 && mask <= 32) {
          const toInt = (s: string) => s.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
          const maskNum = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
          if ((toInt(ip) & maskNum) === (toInt(subnet) & maskNum)) {
            return true;
          }
        }
      }

      return false;
    });
  }
}

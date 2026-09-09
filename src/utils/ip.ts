import { Request } from "express";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
    // X-Forwarded-For এ একাধিক IP থাকতে পারে, প্রথমটি হলো ক্লায়েন্টের আসল IP
    return ips.split(",")[0].trim();
  }
  
  return req.ip || req.socket.remoteAddress || "unknown";
}
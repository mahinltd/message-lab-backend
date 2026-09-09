export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
      device?: {
        deviceId: string;
        userId: string;
        deviceName: string;
        status: string;
      };
    }
  }
}
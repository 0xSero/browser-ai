import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

type User = {
  id: string;
  email: string;
  createdAt: string;
  stripeCustomerId: string;
};

type DeviceCodeEntry = {
  deviceCode: string;
  userCode: string;
  status: 'pending' | 'approved' | 'used';
  userId: string;
  createdAt: string;
  expiresAt: number;
  approvedAt?: string;
};

type Session = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
};

type DataStoreShape = {
  users: User[];
  deviceCodes: DeviceCodeEntry[];
  sessions: Session[];
};

const DEFAULT_DATA: DataStoreShape = {
  users: [],
  deviceCodes: [],
  sessions: []
};

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createUserCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (i === 3) code += '-';
  }
  return code;
}

function createToken(size = 24) {
  return crypto.randomBytes(size).toString('hex');
}

export class DataStore {
  filePath: string;
  data: DataStoreShape;
  loaded: boolean;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = { ...DEFAULT_DATA };
    this.loaded = false;
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(content) as DataStoreShape;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw err;
      await this.save();
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('Data store not loaded.');
    }
  }

  cleanupExpired(): void {
    const now = Date.now();
    this.data.deviceCodes = this.data.deviceCodes.filter(code => code.expiresAt > now);
    this.data.sessions = this.data.sessions.filter(session => session.expiresAt > now);
  }

  findUserByEmail(email: string): User | undefined {
    return this.data.users.find(user => user.email === email);
  }

  findUserById(id: string): User | undefined {
    return this.data.users.find(user => user.id === id);
  }

  upsertUser({ email }: { email: string }): User {
    const normalizedEmail = email.trim().toLowerCase();
    let user = this.findUserByEmail(normalizedEmail);
    if (!user) {
      user = {
        id: `user_${createToken(8)}`,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
        stripeCustomerId: ''
      };
      this.data.users.push(user);
    }
    return user;
  }

  createDeviceCode({ expiresInMs }: { expiresInMs: number }): DeviceCodeEntry {
    const deviceCode = `device_${createToken(12)}`;
    const userCode = createUserCode();
    const entry: DeviceCodeEntry = {
      deviceCode,
      userCode,
      status: 'pending',
      userId: '',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + expiresInMs
    };
    this.data.deviceCodes.push(entry);
    return entry;
  }

  approveDeviceCode({ userCode, email }: { userCode: string; email: string }): { entry: DeviceCodeEntry; user: User } {
    const entry = this.data.deviceCodes.find(code => code.userCode === userCode);
    if (!entry) {
      throw new Error('Invalid device code.');
    }
    if (entry.expiresAt <= Date.now()) {
      throw new Error('Device code expired.');
    }
    const user = this.upsertUser({ email });
    entry.status = 'approved';
    entry.userId = user.id;
    entry.approvedAt = new Date().toISOString();
    return { entry, user };
  }

  verifyDeviceCode({ deviceCode, sessionTtlMs }: { deviceCode: string; sessionTtlMs: number }):
    | { status: 'pending' }
    | { status: 'approved'; session: Session } {
    const entry = this.data.deviceCodes.find(code => code.deviceCode === deviceCode);
    if (!entry) {
      throw new Error('Invalid device code.');
    }
    if (entry.expiresAt <= Date.now()) {
      throw new Error('Device code expired.');
    }
    if (entry.status !== 'approved') {
      return { status: 'pending' };
    }
    const session = this.createSession(entry.userId, sessionTtlMs);
    entry.status = 'used';
    return { status: 'approved', session };
  }

  createSession(userId: string, sessionTtlMs: number): Session {
    const session = {
      token: `sess_${createToken(24)}`,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + sessionTtlMs
    };
    this.data.sessions.push(session);
    return session;
  }

  createSessionForEmail({ email, sessionTtlMs }: { email: string; sessionTtlMs: number }): { user: User; session: Session } {
    const user = this.upsertUser({ email });
    const session = this.createSession(user.id, sessionTtlMs);
    return { user, session };
  }

  findSession(token: string): Session | undefined {
    return this.data.sessions.find(session => session.token === token);
  }
}

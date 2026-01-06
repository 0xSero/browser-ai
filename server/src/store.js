import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_DATA = {
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
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { ...DEFAULT_DATA };
    this.loaded = false;
  }

  async load() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
    this.loaded = true;
  }

  async save() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  ensureLoaded() {
    if (!this.loaded) {
      throw new Error('Data store not loaded.');
    }
  }

  cleanupExpired() {
    const now = Date.now();
    this.data.deviceCodes = this.data.deviceCodes.filter(code => code.expiresAt > now);
    this.data.sessions = this.data.sessions.filter(session => session.expiresAt > now);
  }

  findUserByEmail(email) {
    return this.data.users.find(user => user.email === email);
  }

  findUserById(id) {
    return this.data.users.find(user => user.id === id);
  }

  upsertUser({ email }) {
    let user = this.findUserByEmail(email);
    if (!user) {
      user = {
        id: `user_${createToken(8)}`,
        email,
        createdAt: new Date().toISOString(),
        stripeCustomerId: ''
      };
      this.data.users.push(user);
    }
    return user;
  }

  createDeviceCode({ expiresInMs }) {
    const deviceCode = `device_${createToken(12)}`;
    const userCode = createUserCode();
    const entry = {
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

  approveDeviceCode({ userCode, email }) {
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

  verifyDeviceCode({ deviceCode, sessionTtlMs }) {
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
    const session = {
      token: `sess_${createToken(24)}`,
      userId: entry.userId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + sessionTtlMs
    };
    this.data.sessions.push(session);
    entry.status = 'used';
    return { status: 'approved', session };
  }

  findSession(token) {
    return this.data.sessions.find(session => session.token === token);
  }
}

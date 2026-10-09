const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const RPC_OPCODE = Object.freeze({
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
});

function cleanText(value, fallback) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, 128);
}

function buildHandshake(clientId) {
  return {
    v: 1,
    client_id: String(clientId),
  };
}

function buildActivity({ title, paused = false, positionSeconds, nowMs = Date.now() } = {}) {
  const activity = {
    type: 0,
    details: cleanText(title, "EchoDeck"),
    assets: {
      large_image: "logo_1_1_",
      large_text: "EchoDeck",
    },
  };

  if (paused) {
    activity.state = "Paused";
  } else if (Number.isFinite(positionSeconds) && positionSeconds >= 0 && Number.isFinite(nowMs)) {
    activity.timestamps = {
      start: Math.floor(nowMs / 1000 - positionSeconds),
    };
  }

  return activity;
}

function buildSetActivity(pid, activity, nonce) {
  return {
    cmd: "SET_ACTIVITY",
    args: {
      pid,
      activity,
    },
    nonce,
  };
}

function buildFrame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function getPipeNames(platform = process.platform, osModule = os) {
  if (platform === "win32") {
    return Array.from({ length: 10 }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  }

  return Array.from({ length: 10 }, (_, index) =>
    path.join(osModule.tmpdir(), `discord-ipc-${index}`),
  );
}

class DiscordPresence {
  constructor({
    clientId,
    platform = process.platform,
    netModule = net,
    osModule = os,
    processId = process.pid,
    logger = () => {},
  }) {
    this.clientId = String(clientId || "").trim();
    this.pipeNames = getPipeNames(platform, osModule);
    this.netModule = netModule;
    this.processId = processId;
    this.logger = logger;
    this.socket = null;
    this.connectPromise = null;
    this.ready = false;
    this.pendingActivity = undefined;
    this.buffer = Buffer.alloc(0);
    this.nonce = 0;
  }

  async setActivity(activity) {
    this.pendingActivity = activity || null;
    const socket = await this.ensureConnected();
    if (socket) {
      this.flushActivity();
    }
  }

  async clearActivity() {
    await this.setActivity(null);
  }

  disconnect() {
    this.ready = false;
    this.pendingActivity = undefined;
    this.connectPromise = null;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async ensureConnected() {
    if (!this.clientId) {
      return null;
    }

    if (this.socket && !this.socket.destroyed) {
      return this.socket;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connect()
        .catch(() => null)
        .finally(() => {
          this.connectPromise = null;
        });
    }

    return this.connectPromise;
  }

  async connect() {
    let lastError = null;

    for (const pipeName of this.pipeNames) {
      try {
        const socket = await this.connectToPipe(pipeName);
        this.socket = socket;
        this.ready = false;
        this.send(RPC_OPCODE.HANDSHAKE, buildHandshake(this.clientId));
        return socket;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      this.logger("Discord Rich Presence is unavailable.");
    }
    throw lastError || new Error("Discord IPC connection failed");
  }

  connectToPipe(pipeName) {
    return new Promise((resolve, reject) => {
      const socket = this.netModule.createConnection(pipeName);
      let settled = false;

      const rejectConnection = (error) => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(error);
        }
      };

      socket.once("connect", () => {
        if (!settled) {
          settled = true;
          this.attachSocket(socket);
          resolve(socket);
        }
      });
      socket.once("error", rejectConnection);
      socket.once("close", () => {
        if (!settled) {
          rejectConnection(new Error("Discord IPC pipe closed"));
        } else if (this.socket === socket) {
          this.ready = false;
          this.socket = null;
        }
      });
    });
  }

  attachSocket(socket) {
    socket.on("data", (chunk) => this.handleData(chunk));
    socket.on("error", () => {
      if (this.socket === socket) {
        this.ready = false;
      }
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readInt32LE(0);
      const length = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + length) {
        return;
      }

      const payloadBuffer = this.buffer.subarray(8, 8 + length);
      this.buffer = this.buffer.subarray(8 + length);
      let payload;
      try {
        payload = JSON.parse(payloadBuffer.toString("utf8"));
      } catch {
        continue;
      }

      if (opcode === RPC_OPCODE.PING) {
        this.send(RPC_OPCODE.PONG, payload);
      } else if (opcode === RPC_OPCODE.FRAME && payload.evt === "READY") {
        this.ready = true;
        this.flushActivity();
      }
    }
  }

  flushActivity() {
    if (!this.ready || this.pendingActivity === undefined) {
      return;
    }

    const activity = this.pendingActivity;
    this.pendingActivity = undefined;
    this.send(
      RPC_OPCODE.FRAME,
      buildSetActivity(this.processId, activity, String(++this.nonce)),
    );
  }

  send(opcode, payload) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(buildFrame(opcode, payload));
    }
  }
}

function createDiscordPresence(options) {
  return new DiscordPresence(options);
}

module.exports = {
  DiscordPresence,
  RPC_OPCODE,
  buildActivity,
  buildFrame,
  buildHandshake,
  buildSetActivity,
  createDiscordPresence,
  getPipeNames,
};

'use strict';

import { Mixer } from './mixer.mjs'

import express from 'express';
import { createServer } from 'http';
import net from 'net';
import { WebSocketServer } from 'ws';

const users = new Map();
const term = Buffer.alloc(1);
const received = Buffer.alloc(16 * 1024);
let parsed = 0;

const app = express();
app.use(express.static('public'));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const client = new net.Socket();
const mixer = new Mixer(msg => {
  const buffer = Buffer.from(msg, 'utf-8')
  const msgWithTerm = Buffer.concat([buffer, term]);
  // console.log('sending', msgWithTerm.toString())
  client.write(msgWithTerm);
});


client.connect(4710, '127.0.0.1', async () => {
	console.log('Connected. Retreiving devices...');

  client.on('data', data => {
    // console.log('Received: ', data.toString());
    for (let i = 0; i < data.length; ++i) {
      const b = data[i];
      if (b == 0) {
        const msg = received.toString('utf-8', 0, parsed);
        mixer.onMsg(msg)
        parsed = 0;
      } else {
        received[parsed++] = b;
      }
    }
  });

  client.on('close', () => {
    console.log('Connection closed');
    process.exit(1)
  });

  await mixer.getDevices();
  server.listen(8080, function () {
    console.log('Listening on http://localhost:8080');
  });
});

wss.on("connection", (socket, req) => {
  let id = 0;
  while (users.has(id)) {
    ++id;
  }

  users.set(id, socket);
  console.log(`New connection #${id} (${users.size} connected)`);

  socket.on("close", () => {
    users.delete(id);
    console.log(`#${id} connection closed (${users.size} connected)`);
  });

  socket.on("message", msg => {
    const {type, deviceId, inputType, inputId, sendId, value} = JSON.parse(msg);
    switch (type) {
      case 'Gain': mixer.updateGain(deviceId, inputType, inputId, sendId, value); break;
      case 'Pan': mixer.updatePan(deviceId, inputType, inputId, sendId, value); break;
      case 'Solo': mixer.updateSolo(deviceId, inputType, inputId, sendId, value); break;
      case 'Mute': mixer.updateMute(deviceId, inputType, inputId, sendId, value); break;
      default: console.error('Unknown message on ws:', msg);
    }
  });

  const msg = {
    'type': 'Devices',
    'devices': mixer.devices,
  }
  socket.send(JSON.stringify(msg))
});

mixer.inputChanged = (deviceId, input, send, key, value) => {
  const type = 'Input';
  const inputId = input.inputId;
  const sendId = send ? send.sendId : null;
  const msg = { type, deviceId, inputId, sendId, key, value };
  const msgStr = JSON.stringify(msg);
  users.forEach(user => user.send(msgStr));
}


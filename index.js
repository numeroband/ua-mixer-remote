'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');
const users = new Map();
const term = Buffer.alloc(1);
const received = Buffer.alloc(16 * 1024);
let parsed = 0;

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocketServer({ server });


const client = new net.Socket();
client.connect(4710, '127.0.0.1', () => {
	console.log('Connected');

  client.on('data', data => {
    // console.log('Received: ', data.toString());
    for (let i = 0; i < data.length; ++i) {
      const b = data[i];
      if (b == 0) {
        const msg = received.toString('utf-8', 0, parsed);
        users.forEach(user => user.send(msg));
        parsed = 0;
      } else {
        received[parsed++] = b;
      }
    }
  });

  client.on('close', () => {
    console.log('Connection closed');
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
    const msgWithTerm = Buffer.concat([msg, term]);
    // console.log('sending', msgWithTerm.toString())
    client.write(msgWithTerm);
  });
});

server.listen(8080, function () {
  console.log('Listening on http://localhost:8080');
});
var chat = {
  // (A) INIT CHAT
  name : null, // user's name
  socket : null, // chat websocket
  ewrap : null, // html chat history
  emsg : null, // html chat message
  ego : null, // html chat go button
  init : () => {
    // (A1) GET HTML ELEMENTS
    chat.ewrap = document.getElementById("chatShow");
    chat.emsg = document.getElementById("chatMsg");
    chat.ego = document.getElementById("chatGo");

    // (A2) USER'S NAME
    chat.name = "John";
    if (chat.name == null || chat.name=="") { chat.name = "Mysterious"; }

    // (A3) CONNECT TO CHAT SERVER
    chat.socket = new WebSocket("ws://localhost:8080");

    // (A4) ON CONNECT - ANNOUNCE "I AM HERE" TO THE WORLD
    chat.socket.addEventListener("open", () => {
      chat.controls(1);
    });

    // (A5) ON RECEIVE MESSAGE - DRAW IN HTML
    chat.socket.addEventListener("message", evt => chat.draw(evt.data));

    // (A6) ON ERROR & CONNECTION LOST
    chat.socket.addEventListener("close", () => {
      chat.controls();
      alert("Websocket connection lost!");
    });
    chat.socket.addEventListener("error", err => {
      chat.controls();
      console.log(err);
      alert("Websocket connection error!");
    });
  },

  // (B) TOGGLE HTML CONTROLS
  controls : enable => {
    if (enable) {
      chat.emsg.disabled = false;
      chat.ego.disabled = false;
    } else {
      chat.emsg.disabled = true;
      chat.ego.disabled = true;
    }
  },

  // (C) SEND MESSAGE TO CHAT SERVER
  send : msg => {
    if (msg == undefined) {
      msg = chat.emsg.value;
      chat.emsg.value = "";
    }
    chat.socket.send(msg);
    return false;
  },

  // (D) DRAW MESSAGE IN HTML
  draw : msg => {
    // (D1) PARSE JSON
    console.log(msg);

    // (D2) CREATE NEW ROW
    let row = document.createElement("div");
    row.className = "chatRow";
    row.innerHTML = `<div class="chatMsg">${msg}</div>`;
    chat.ewrap.appendChild(row);

    // (D3) AUTO SCROLL TO BOTTOM - MAY NOT BE THE BEST...
    window.scrollTo(0, document.body.scrollHeight);
  }
};
window.addEventListener("DOMContentLoaded", chat.init);
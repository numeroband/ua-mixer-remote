export class UI {
  constructor(document) {
    this.doc = document;
    this.ws = undefined;
    this.mixer = undefined;
    this.deviceId = undefined;
    this.sendId = "";
  }

  getWebServiceURI(loc) {
    let ws_uri = (loc.protocol === "https:") ? "wss:" : "ws:";
    ws_uri += "//" + loc.host;
    ws_uri += loc.pathname + "/to/ws";    
    return ws_uri;
  }

  init(location) {
    this.location = location;
    const params = new URLSearchParams(location.search);
    if (params.has('deviceId')) {
      this.deviceId = params.get('deviceId');
    }
    if (params.has('sendId')) {
      this.sendId = params.get('sendId');
    }
    this.connect();
  }

  connect() {
    if (this.ws) {
      return;
    }
    this.ws = new WebSocket(this.getWebServiceURI(this.location));
    this.ws.addEventListener("open", _ => this.onOpen());  
    this.ws.addEventListener("message", evt => this.onMessage(evt));
    this.ws.addEventListener("close", _ => this.onClose());
    this.ws.addEventListener("error", err => this.onError(err));
  }

  async onOpen() {
    this.reconnecting = false;
  }

  onMessage(evt) {
    // console.log('recv', evt.data.toString());
    // this.mixer.onMsg(evt.data);

    const msg = JSON.parse(evt.data);
    switch (msg.type) {
      case 'Devices':
        this.mixer = msg;
        this.drawUI();
        break;
      case 'Input':
        const {deviceId, inputId, sendId, key, value} = msg;
        this.inputChanged(deviceId, inputId, sendId, key, value);
        break;
      default:
        console.error('Invalid websocket msg:', msg);
        break;
    }
  }

  onClose() {
    const connected = document.getElementById("connected");
    const disconnected = document.getElementById("disconnected");
    connected.style.display = 'none';
    disconnected.style.display = 'block';

    console.log('ws close')
    this.mixer = undefined;
    this.ws = undefined;
    if (!this.reconnecting) {
      console.log('Reconnecting');
      this.reconnecting = true;
      this.connect();
    }
  }

  onError(err) {
    console.error('ws error')
    this.ws.close();
  }

  drawUI() {
    const connected = document.getElementById("connected");
    const disconnected = document.getElementById("disconnected");
    connected.style.display = 'block';
    disconnected.style.display = 'none';

    this.drawDevices();
    this.drawMixes();
    this.drawInputs();
  }

  drawDevices() {
    if (this.deviceId !== undefined) {
      const device = this.mixer.devices.find(device => device.deviceId === this.deviceId);
      if (!device) {
        this.deviceId = undefined;
      }
    }

    if (this.deviceId === undefined) {
      this.deviceId = this.mixer.devices[0].deviceId;
    }

    const select = document.getElementById("deviceSelect");

    while (select.length > 0) {
      select.remove(0);
    }

    this.mixer.devices.forEach(device =>  {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.name;
      select.add(option);      
    });
    select.value = this.deviceId;
  }

  drawMixes() {
    if (this.sendId != '') {
      const send = this.device.inputs[0].sends.find(send => send.id == this.sendId);
      if (!send) {
        this.sendId = '';
      }
    }

    const sends = this.device.inputs[0].sends;
    const select = document.getElementById("mixSelect");

    while (select.length > 0) {
      select.remove(0);
    }

    const option = document.createElement("option");
    option.value = '';
    option.text = 'Mix';
    select.add(option);      

    sends.forEach(send => {
      const option = document.createElement("option");
      option.value = send.id;
      option.text = send.name;
      select.add(option);      
    });

    select.value = this.sendId;
  }
  
  get device() { return this.mixer.devices.find(device => device.deviceId == this.deviceId); }
  getChannel = input => (this.sendId === "") ? input : input.sends.find(send => send.id == this.sendId);

  drawInputs() {
    const table = document.getElementById("inputsTable");
    while (table.rows.length > 0) {
      table.deleteRow(0);
    }
    
    const device = this.device;
    device.inputs.forEach(input => {
      const channel = this.getChannel(input);
      if (!channel) {
        return;
      }

      const inputType = input.inputType;
      const inputId = input.inputId;
      const row = table.insertRow();
      const name = row.insertCell();
      name.innerHTML = `<span>${input.name}</span>`;

      const sendIdArg = (this.sendId === "") ? 'undefined' : `'${channel.sendId}'`;
      const args = `'${inputType}', '${inputId}', ${sendIdArg}`; 

      const gainTaperedCell = row.insertCell();
      gainTaperedCell.classList.add('gain');
      const gainTaperedValue = Math.round(channel.gainTapered * 100);
      gainTaperedCell.innerHTML = `<input id="${inputType}${inputId}GainTapered" type="range" step="1" min="0" max="100" value="${gainTaperedValue}" oninput="updateGain(${args}, this.value)"/>`;  

      const gainCell = row.insertCell();
      const gainValue = (channel.gain == -144) ? "-&infin;" : channel.gain.toFixed(1);
      gainCell.innerHTML = `<span id="${inputType}${inputId}Gain">${gainValue}<span/>`;

      const panCell = row.insertCell();
      if (channel.pan !== undefined) {
        const panValue = Math.round(channel.pan * 100);
        panCell.innerHTML = `<input id="${inputType}${inputId}Pan" type="range" min="-100" max="100" oninput="updatePan(${args}, this.value)" value="${panValue}"/>`;
      }

      const soloCell = row.insertCell();
      if (channel.solo !== undefined) {
        const soloValue = channel.solo ? ' checked="checked"' : '';
        soloCell.innerHTML = `<input id="${inputType}${inputId}Solo" type="checkbox" oninput="updateSolo(${args}, this.checked)"${soloValue}/>`;
      }

      const muteCell = row.insertCell();
      if (channel.mute !== undefined) {
        const muteValue = channel.mute ? ' checked="checked"' : '';
        muteCell.innerHTML = `<input id="${inputType}${inputId}Mute" type="checkbox" oninput="updateMute(${args}, this.checked)"${muteValue}/>`;
      }
    });
  }

  inputChanged(deviceId, inputId, sendId, key, value) {
    const devices = this.mixer.devices;
    const device = devices.find(device => device.deviceId == this.deviceId);
    const input = device.inputs.find(input => input.inputId == inputId);
    const send = sendId ? input.sends.find(send => send.sendId == sendId) : null;
    const channel = sendId ? send : input;
    channel[key] = value;

    if (deviceId != this.deviceId) {
      return;
    }

    if ((!send && this.sendId !== "") || (send && send.id !== this.sendId)) {
      return;
    }

    const gainTapered = document.getElementById(`${input.inputType}${input.inputId}GainTapered`);
    const gainTaperedValue = Math.round(channel.gainTapered * 100);
    gainTapered.value = gainTaperedValue;

    const gain = document.getElementById(`${input.inputType}${input.inputId}Gain`);
    const gainValue = (channel.gain == -144) ? "-&infin;" : channel.gain.toFixed(1);
    gain.innerHTML = gainValue;

    const mute = document.getElementById(`${input.inputType}${input.inputId}Mute`);
    mute.checked = channel.mute;

    if (channel.pan !== undefined) {
      const pan = document.getElementById(`${input.inputType}${input.inputId}Pan`);
      const panValue = Math.round(channel.pan * 100);
      pan.value = panValue;
    }

    if (channel.solo !== undefined) {
      const solo = document.getElementById(`${input.inputType}${input.inputId}Solo`);
      solo.checked = channel.solo;  
    }
  }

  updateGain = (inputType, inputId, sendId, value) => this.sendUpdate('Gain', this.deviceId, inputType, inputId, sendId, value / 100);
  updatePan = (inputType, inputId, sendId, value) => this.sendUpdate('Pan', this.deviceId, inputType, inputId, sendId, value / 100);
  updateSolo = (inputType, inputId, sendId, value) => this.sendUpdate('Solo', this.deviceId, inputType, inputId, sendId, value);
  updateMute = (inputType, inputId, sendId, value) => this.sendUpdate('Mute', this.deviceId, inputType, inputId, sendId, value);

  sendUpdate(type, deviceId, inputType, inputId, sendId, value) {
    const msg = {type, deviceId, inputType, inputId, sendId, value};
    this.ws.send(JSON.stringify(msg));
  }

  updateDevice(value, location) {
    const params = new URLSearchParams();
    params.set('deviceId', value);
    location.search = params.toLocaleString();
  }

  updateMix(value, location) {
    const params = new URLSearchParams();
    params.set('deviceId', this.deviceId);
    if (value) {
      params.set('sendId', value);
    }
    location.search = params.toLocaleString();
  }
}

import { Mixer } from "./mixer.js";

export class UI {
  constructor(document) {
    this.doc = document;
    this.ws = undefined;
    this.mixer = undefined;
    this.deviceId = undefined;
    this.sendId = undefined;
  }

  getWebServiceURI(loc) {
    let ws_uri = (loc.protocol === "https:") ? "wss:" : "ws:";
    ws_uri += "//" + loc.host;
    ws_uri += loc.pathname + "/to/ws";    
    return ws_uri;
  }

  init(location) {
    this.ws = new WebSocket(this.getWebServiceURI(location));
    this.ws.addEventListener("open", _ => this.onOpen());  
    this.ws.addEventListener("message", evt => this.onMessage(evt));
    this.ws.addEventListener("close", _ => this.onClose());
    this.ws.addEventListener("error", err => this.onError(err));
  }

  async onOpen() {
    this.mixer = new Mixer(msg => {
      // console.log('send', msg.toString());
      this.ws.send(msg);
    });
    await this.mixer.getDevices();
    this.drawUI();
  }

  onMessage(evt) {
    // console.log('recv', evt.data.toString());
    this.mixer.onMsg(evt.data);
  }

  onClose() {
    this.mixer = undefined;
    alert("Websocket connection lost!");
  }

  onError(err) {
    this.mixer = undefined;
    alert(`Websocket connection error: ${err}`);
  }

  drawUI() {
    if (this.deviceId === undefined) {
      this.deviceId = this.mixer.devices[0].deviceId;
    } else {
      device = devices.find(device => device.deviceId == this.deviceId);
    }
    this.drawDevices();
    this.drawMixes();
    this.drawInputs();
  }

  drawDevices() {
    var select = document.getElementById("deviceSelect");
    this.mixer.devices.forEach(device =>  {
      var option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.name;
      select.add(option);      
    });
  }

  drawMixes() {
    const sends = this.device.inputs[0].sends;
    var select = document.getElementById("mixSelect");
    sends.forEach(send => {
      var option = document.createElement("option");
      option.value = send.id;
      option.text = send.name;
      select.add(option);      
    });
  }
  
  get device() { return this.mixer.devices.find(device => device.deviceId == this.deviceId); }
  getChannel = input => (this.sendId === undefined) ? input : input.sends.find(send => send.id == this.sendId);

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

      const sendIdArg = (this.sendId === undefined) ? 'undefined' : `'${channel.sendId}'`;
      const args = `'${inputType}', '${inputId}', ${sendIdArg}`; 

      const gainTaperedCell = row.insertCell();
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

    this.mixer.inputChanged = (deviceId, input, send) => {
      if (deviceId != this.deviceId) {
        return;
      }

      if (send && send.id !== this.sendId) {
        return;
      }

      const channel = send ? send : input;
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
  }

  updateGain = (inputType, inputId, sendId, value) => this.mixer.updateGain(this.deviceId, inputType, inputId, sendId, value / 100);
  updatePan = (inputType, inputId, sendId, value) => this.mixer.updatePan(this.deviceId, inputType, inputId, sendId, value / 100);
  updateSolo = (inputType, inputId, sendId, value) => this.mixer.updateSolo(this.deviceId, inputType, inputId, sendId, value);
  updateMute = (inputType, inputId, sendId, value) => this.mixer.updateMute(this.deviceId, inputType, inputId, sendId, value);

  updateDevice(value) {
    this.deviceId = value;
    this.drawInputs();
  }

  updateMix(value) {
    this.sendId = (value === "") ? undefined : value;
    this.drawInputs();
  }
}

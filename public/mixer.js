export class Mixer {
  constructor(sendCallback) {
    this.sendCallback = sendCallback;
    this.devices = [];
    this.promises = new Map();
    this.subscriptions = new Map();
    this.inputChanged = undefined;
  }

  findDevice(deviceId) {
    return this.devices.find(device => device.deviceId == deviceId);
  }

  findInput(deviceId, inputId) {
    const device = this.findDevice(deviceId);
    return device.inputs.find(input => input.inputId == inputId);
  }

  async getDevices() {
    const devices = await this.sendGet(['devices']);
    for (let deviceId in devices.children) {
      await this.getDevice(deviceId);
    }
    return this.devices;
  }

  async getDevice(deviceId) {
    const device = await this.sendGet(['devices', deviceId]);
    const name = device.properties.DeviceName.value;
    const online = device.properties.DeviceOnline.value;
    const inputs = [];
    const newDevice = {deviceId, name, online, inputs};
    this.devices.push(newDevice);
    await this.getInputs(newDevice, 'inputs');
    await this.getInputs(newDevice, 'auxs');
  }

  async getInputs(device, inputType) {
    const inputs = await this.sendGet(['devices', device.deviceId, inputType]);
    for (let inputId in inputs.children) {
      await this.getInput(device, inputType, inputId);
    }
  }

  async getInput(device, inputType, inputId) {
    const input = await this.sendGet(['devices', device.deviceId, inputType, inputId]);

    if (input.properties.ChannelHidden && input.properties.ChannelHidden.value) {
      return;
    }

    const name = input.properties.Name.value;
    const gain = input.properties.FaderLevel.value;
    const gainTapered = input.properties.FaderLevelTapered.value;
    const mute = input.properties.Mute.value;
    const pan = (input.properties.Pan) ? input.properties.Pan.value : undefined;
    const solo = (input.properties.Solo) ? input.properties.Solo.value : undefined;
    const sends = [];
    const newInput = {inputId, name, gain, gainTapered, pan, mute, solo, sends, inputType};
    device.inputs.push(newInput);
    this.subscribeInput(device.deviceId, newInput);
    await this.getSends(device, newInput);
  }

  subscribeInput(deviceId, input) {
    const path = key => ['devices', deviceId, input.inputType, input.inputId, key];
    const inputChanged = _ => {
      if (this.inputChanged) {
        this.inputChanged(deviceId, input);
      }
    }
    this.subscribe(path('FaderLevel'), [value => input.gain = value, inputChanged]);
    this.subscribe(path('FaderLevelTapered'), [value => input.gainTapered = value, inputChanged]);
    this.subscribe(path('Pan'), [value => input.pan = value, inputChanged]);
    this.subscribe(path('Mute'), [value => input.mute = value, inputChanged]);
    this.subscribe(path('Solo'), [value => input.solo = value, inputChanged]);
  }

  subscribeSend(deviceId, input, send) {
    const path = key => ['devices', deviceId, input.inputType, input.inputId, 'sends', send.sendId, key];
    const inputChanged = _ => {
      if (this.inputChanged) {
        this.inputChanged(deviceId, input, send);
      }
    }
    this.subscribe(path('Gain'), [value => send.gain = value, inputChanged]);
    this.subscribe(path('GainTapered'), [value => send.gainTapered = value, inputChanged]);
    this.subscribe(path('Pan'), [value => send.pan = value, inputChanged]);
    this.subscribe(path('Bypass'), [value => send.mute = value, inputChanged]);
  }

  async getSends(device, input) {
    const sends = await this.sendGet(['devices', device.deviceId, input.inputType, input.inputId, 'sends']);
    for (let sendId in sends.children) {
      await this.getSend(device, input, sendId);
    }
  }

  async getSend(device, input, sendId) {
    const send = await this.sendGet(['devices', device.deviceId, input.inputType, input.inputId, 'sends', sendId]);
    const name = send.properties.Name.value;
    const gain = send.properties.Gain.value;
    const gainTapered = send.properties.GainTapered.value;
    const pan = send.properties.Pan ? send.properties.Pan.value : undefined;
    const id = send.properties.ID.value;
    const mute = send.properties.Bypass ? send.properties.Bypass.value : undefined;
    const solo = undefined;
    const newSend = {sendId, name, gain, gainTapered, pan, id, mute, solo};
    input.sends.push(newSend);
    this.subscribeSend(device.deviceId, input, newSend);
  }

  send(msg) {
    this.sendCallback(msg);
  }

  sendGet(path) {
    const pathStr = '/' + path.join('/');
    const promise = new Promise((resolve, reject) => {
      const callbacks = {resolve, reject};
      const promises = this.promises.get(pathStr);
      if (promises) {
        promises.push(callbacks);
      } else {
        this.promises.set(pathStr, [callbacks]);
      }
    });

    this.send(`get ${pathStr}`);

    return promise;
  }

  sendSet(path, value) {
    const pathStr = '/' + path.join('/');
    this.send(`set ${pathStr} ${value}`);
  }

  subscribe(path, callbacks) {
    const pathStr = '/' + path.join('/');
    const response = pathStr + '/value';
    let subscriptions = this.subscriptions.get(response);
    if (!subscriptions) {
      subscriptions = [];
      this.subscriptions.set(response, subscriptions);
    }
    callbacks.forEach(callback => subscriptions.push(callback));
    this.send(`subscribe ${pathStr}`);    
  }

  onMsg(msgStr) {
    const msg = JSON.parse(msgStr);
    const promises = this.promises.get(msg.path);
    if (promises) {
      promises.forEach(promise => {
        promise.resolve(msg.data);
      });
      this.promises.delete(msg.path);
    }

    const subscriptions = this.subscriptions.get(msg.path);
    if (subscriptions) {
      subscriptions.forEach(subscription => subscription(msg.data));
    }
  }

  setValue(deviceId, inputType, inputId, sendId, value, inputKey, sendKey) {
    const path = ['devices', deviceId, inputType, inputId]
      .concat((sendId === undefined) ? [inputKey] : ['sends', sendId, sendKey ? sendKey : inputKey]);
    this.sendSet(path, value)
  }

  updateGain = (...args) => this.setValue(...args, 'FaderLevelTapered', 'GainTapered');
  updatePan = (...args) => this.setValue(...args, 'Pan');
  updateSolo = (...args) => this.setValue(...args, 'Solo');
  updateMute = (...args) => this.setValue(...args, 'Mute', 'Bypass');
}
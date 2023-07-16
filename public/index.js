import { UI } from "./ui.js";

const ui = new UI(document);
window.updateGain = (inputType, inputId, sendId, value) => ui.updateGain(inputType, inputId, sendId, value);
window.updateMute = (inputType, inputId, sendId, value) => ui.updateMute(inputType, inputId, sendId, value);
window.updatePan = (inputType, inputId, sendId, value) => ui.updatePan(inputType, inputId, sendId, value);
window.updateSolo = (inputType, inputId, sendId, value) => ui.updateSolo(inputType, inputId, sendId, value);
window.updateDevice = (value) => ui.updateDevice(value, window.location);
window.updateMix = (value) => ui.updateMix(value, window.location);
window.addEventListener("DOMContentLoaded", () => ui.init(window.location));

import { encryptPayload, decryptPayload, bytesToText, bytesFromText } from "./crypto-core.js";

const $ = (id) => document.getElementById(id);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const QR_PAYLOAD_LIMIT = 2400;
const QR_FRAGMENT_SIZE = 1800;
const state = {
  mode: "message",
  file: null,
  currentPayload: "",
  payloads: [],
  qrIndex: 0,
  lastQr: null,
};

const createTab = $("tab-create");
const unlockTab = $("tab-unlock");
const createPanel = $("create-panel");
const unlockPanel = $("unlock-panel");

function setTab(which) {
  const create = which === "create";
  createTab.classList.toggle("active", create);
  unlockTab.classList.toggle("active", !create);
  createTab.setAttribute("aria-selected", create);
  unlockTab.setAttribute("aria-selected", !create);
  createPanel.classList.toggle("hidden", !create);
  unlockPanel.classList.toggle("hidden", create);
}
createTab.addEventListener("click", () => setTab("create"));
unlockTab.addEventListener("click", () => setTab("unlock"));

function setStatus(el, message = "", kind = "") {
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function estimatePasswordStrength(password) {
  if (!password) return { score: 0, label: "Enter a password" };
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 18) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Very strong"];
  return { score, label: labels[score] };
}

const passwordInput = $("create-password");
passwordInput.addEventListener("input", () => {
  const strength = estimatePasswordStrength(passwordInput.value);
  $("strength-label").textContent = strength.label;
  const bar = $("strength-bar");
  bar.style.width = `${Math.min(100, strength.score * 20)}%`;
  bar.style.background = strength.score < 2 ? "#bf3f45" : strength.score < 4 ? "#d6a200" : "#17845a";
});

function bindPasswordToggle(buttonId, inputId) {
  $(buttonId).addEventListener("click", () => {
    const input = $(inputId);
    input.type = input.type === "password" ? "text" : "password";
  });
}
bindPasswordToggle("toggle-create-password", "create-password");
bindPasswordToggle("toggle-unlock-password", "unlock-password");

$("generate-password").addEventListener("click", () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const values = crypto.getRandomValues(new Uint32Array(22));
  let result = "";
  for (const value of values) result += chars[value % chars.length];
  passwordInput.value = result;
  passwordInput.dispatchEvent(new Event("input"));
  passwordInput.type = "text";
});

$("message").addEventListener("input", () => {
  $("message-count").textContent = `${$("message").value.length} / 1500`;
});

document.querySelectorAll(".mode").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll(".mode").forEach((modeButton) => modeButton.classList.toggle("active", modeButton === button));
  $("message-mode").classList.toggle("hidden", state.mode !== "message");
  $("file-mode").classList.toggle("hidden", state.mode !== "file");
}));

function setupFileDrop(zoneId, inputId, onFile) {
  const zone = $(zoneId);
  const input = $(inputId);
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") input.click();
  });
  input.addEventListener("change", () => input.files[0] && onFile(input.files[0]));
  ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.style.borderColor = "#4682b4";
  }));
  ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.style.borderColor = "";
  }));
  zone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  });
}

setupFileDrop("dropzone", "file-input", (file) => {
  if (file.size > MAX_FILE_BYTES) {
    state.file = null;
    $("file-meta").textContent = "That file is larger than the 10 MB limit.";
    return;
  }
  state.file = file;
  $("file-meta").textContent = `${file.name} • ${formatBytes(file.size)} • any file type`;
});
setupFileDrop("unlock-dropzone", "unlock-file", decodeQrImage);

async function fileToBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createTransferId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function splitPayload(payload) {
  if (payload.length <= QR_PAYLOAD_LIMIT) return [payload];
  const transferId = createTransferId();
  const total = Math.ceil(payload.length / QR_FRAGMENT_SIZE);
  return Array.from({ length: total }, (_, index) => {
    const fragment = payload.slice(index * QR_FRAGMENT_SIZE, (index + 1) * QR_FRAGMENT_SIZE);
    return `SQR1P.${transferId}.${index + 1}.${total}.${fragment}`;
  });
}

function isFragment(payload) {
  return payload.startsWith("SQR1P.");
}

function getPayloadInputs() {
  return $("qr-payload").value.split(/\s+/).map((value) => value.trim()).filter(Boolean);
}

function reassemblePayloads(payloads) {
  const values = payloads.filter(Boolean);
  if (!values.length) throw new Error("Add a QR image or paste a payload first.");
  if (values.length === 1 && !isFragment(values[0])) return values[0];
  if (values.some((payload) => !isFragment(payload))) {
    throw new Error("Use one complete payload or one complete QR sequence, not both.");
  }

  const parts = values.map((payload) => {
    const match = payload.match(/^SQR1P\.([a-f0-9]+)\.(\d+)\.(\d+)\.(.+)$/s);
    if (!match) throw new Error("One of the QR fragments is invalid.");
    return {
      transferId: match[1],
      index: Number(match[2]),
      total: Number(match[3]),
      data: match[4],
    };
  });
  const transferId = parts[0].transferId;
  const total = parts[0].total;
  if (!total || parts.some((part) => part.transferId !== transferId || part.total !== total)) {
    throw new Error("The QR fragments belong to different transfers.");
  }
  if (new Set(parts.map((part) => part.index)).size !== parts.length) {
    throw new Error("A QR fragment was added more than once.");
  }
  if (parts.length !== total) {
    const missing = Array.from({ length: total }, (_, index) => index + 1)
      .filter((index) => !parts.some((part) => part.index === index));
    throw new Error(`Missing QR fragment(s): ${missing.join(", ")}.`);
  }
  return parts.sort((a, b) => a.index - b.index).map((part) => part.data).join("");
}

function renderQr(payloads) {
  state.payloads = payloads;
  state.qrIndex = 0;
  renderCurrentQr();
}

function renderCurrentQr() {
  const payload = state.payloads[state.qrIndex];
  if (!payload) return;
  const container = $("qr-output");
  container.className = "qr-output";
  container.innerHTML = "";
  const qrStage = document.createElement("div");
  container.appendChild(qrStage);

  try {
    new QRCode(qrStage, {
      text: payload,
      width: 280,
      height: 280,
      colorDark: "#07101e",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L,
    });
  } catch {
    throw new Error("This QR fragment is too large. Try again with a smaller payload.");
  }

  if (state.payloads.length > 1) {
    const controls = document.createElement("div");
    controls.className = "result-actions";
    controls.innerHTML = `<button class="button secondary" type="button" id="previous-qr" ${state.qrIndex === 0 ? "disabled" : ""}>Previous</button><span>QR ${state.qrIndex + 1} of ${state.payloads.length}</span><button class="button secondary" type="button" id="next-qr" ${state.qrIndex === state.payloads.length - 1 ? "disabled" : ""}>Next</button>`;
    container.appendChild(controls);
    $("previous-qr").addEventListener("click", () => {
      state.qrIndex--;
      renderCurrentQr();
    });
    $("next-qr").addEventListener("click", () => {
      state.qrIndex++;
      renderCurrentQr();
    });
  }

  $("result-title").textContent = state.payloads.length > 1 ? "Encrypted QR sequence ready" : "Encrypted QR ready";
  $("result-pill").textContent = "Ready";
  $("result-pill").className = "pill ready";
  $("result-actions").classList.remove("hidden");
  $("payload-size").textContent = state.payloads.length > 1
    ? `Payload: ${state.payloads.length} QR codes`
    : `Payload: ${payload.length.toLocaleString()} chars`;
  state.currentPayload = state.payloads.join("\n");
  state.lastQr = qrStage.querySelector("canvas") || qrStage.querySelector("img");
}

function downloadCanvasOrImage(element, filename) {
  if (!element) return;
  const dataUrl = element.tagName === "CANVAS" ? element.toDataURL("image/png") : element.src;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

$("create-qr").addEventListener("click", async () => {
  const status = $("create-status");
  setStatus(status, "Encrypting locally…");
  try {
    const password = passwordInput.value;
    if (password.length < 8) throw new Error("Use at least 8 characters; a longer unique passphrase is better.");

    let bytes;
    let meta;
    if (state.mode === "message") {
      const message = $("message").value.trim();
      if (!message) throw new Error("Enter a message first.");
      bytes = bytesFromText(message);
      meta = { type: "text", name: "secureqr.txt", mime: "text/plain;charset=utf-8" };
    } else {
      if (!state.file) throw new Error("Choose a file first.");
      if (state.file.size > MAX_FILE_BYTES) throw new Error("Files must be 10 MB or smaller.");
      bytes = await fileToBytes(state.file);
      meta = { type: "file", name: state.file.name, mime: state.file.type || "application/octet-stream" };
    }

    const payload = await encryptPayload(bytes, password, meta);
    const payloads = splitPayload(payload);
    renderQr(payloads);
    setStatus(status, payloads.length > 1
      ? `Encrypted locally and split into ${payloads.length} QR codes. Nothing was uploaded.`
      : "Encrypted in this browser. Nothing was uploaded.", "success");
  } catch (error) {
    setStatus(status, error.message || "Encryption failed.", "error");
  }
});

$("download-qr").addEventListener("click", () => {
  const suffix = state.payloads.length > 1 ? `-${state.qrIndex + 1}-of-${state.payloads.length}` : "";
  downloadCanvasOrImage(state.lastQr, `secureqr${suffix}.png`);
});

$("copy-payload").addEventListener("click", async () => {
  if (!state.currentPayload) return;
  await navigator.clipboard.writeText(state.currentPayload);
  $("copy-payload").textContent = state.payloads.length > 1 ? "Sequence copied" : "Copied";
  setTimeout(() => $("copy-payload").textContent = "Copy payload", 1200);
});

async function decodeQrImage(file) {
  const status = $("unlock-status");
  setStatus(status, "Reading QR image…");
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
    if (!result) throw new Error("No QR code was detected in that image.");

    const existing = getPayloadInputs();
    if (!existing.includes(result.data)) existing.push(result.data);
    $("qr-payload").value = existing.join("\n");
    const fragmentCount = existing.filter(isFragment).length;
    setStatus(status, fragmentCount > 1
      ? `QR fragment ${fragmentCount} loaded. Scan or paste the remaining fragments.`
      : "QR payload loaded. Enter its password and unlock.", "success");
  } catch (error) {
    setStatus(status, error.message || "Unable to read the QR image.", "error");
  }
}

$("unlock-qr").addEventListener("click", async () => {
  const status = $("unlock-status");
  setStatus(status, "Decrypting locally…");
  try {
    const payload = reassemblePayloads(getPayloadInputs());
    const password = $("unlock-password").value;
    if (!password) throw new Error("Enter the password.");

    const result = await decryptPayload(payload, password);
    const container = $("decrypted-output");
    const text = $("decrypted-text");
    const download = $("download-decrypted");
    container.classList.remove("hidden");
    $("result-title").textContent = "Content unlocked";
    $("result-pill").textContent = result.version === "legacy" ? "Legacy QR" : "Unlocked";
    $("result-pill").className = "pill ready";

    if (result.type === "text" || result.version === "legacy") {
      text.textContent = bytesToText(result.bytes);
      download.classList.add("hidden");
    } else {
      text.textContent = `${result.name}\n${formatBytes(result.bytes.length)}`;
      const blob = new Blob([result.bytes], { type: result.mime });
      download.href = URL.createObjectURL(blob);
      download.download = result.name || "secureqr-file";
      download.textContent = "Download unlocked file";
      download.classList.remove("hidden");
    }
    setStatus(status, "Decrypted successfully in this browser.", "success");
  } catch (error) {
    setStatus(status, error.message || "Decryption failed.", "error");
  }
});

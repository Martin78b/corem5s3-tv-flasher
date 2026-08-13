const FIRMWARE_URL = "./firmware/firmware-full.bin";
const FIRMWARE_VERSION = "1.0.0";

const ESPTOOL_CDN = "https://unpkg.com/esptool-js@0.6.1/bundle.js";

let esploader = null;
let transport = null;
let port = null;
let firmwareData = null;
let isFlashing = false;

function checkWebSerial() {
  if (!navigator.serial) {
    document.getElementById("webserial-warning").classList.remove("hidden");
    document.getElementById("btn-connect").disabled = true;
    return false;
  }
  return true;
}

function showState(stateId) {
  document.querySelectorAll(".state").forEach((s) => s.classList.remove("active"));
  document.getElementById(stateId).classList.add("active");
}

function logTerminal(msg) {
  const el = document.getElementById("terminal-output");
  const p = document.createElement("p");
  p.textContent = msg;
  el.appendChild(p);
  el.scrollTop = el.scrollHeight;
}

function toggleTerminal() {
  const output = document.getElementById("terminal-output");
  const toggle = document.getElementById("terminal-toggle");
  output.classList.toggle("visible");
  toggle.textContent = output.classList.contains("visible") ? "▲" : "▼";
}

function showTerminal() {
  document.getElementById("terminal-section").classList.remove("hidden");
}

async function loadFirmware() {
  try {
    const response = await fetch(FIRMWARE_URL);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el firmware: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    firmwareData = new Uint8Array(arrayBuffer);

    const sizeKB = (firmwareData.length / 1024).toFixed(0);
    document.getElementById("fw-size").textContent = `(${sizeKB} KB)`;
    logTerminal(`Firmware cargado: ${firmwareData.length} bytes`);
    return true;
  } catch (err) {
    logTerminal(`Error al cargar firmware: ${err.message}`);
    document.getElementById("error-message").textContent =
      `No se pudo cargar el firmware desde ${FIRMWARE_URL}. Asegúrate de que el archivo existe en la carpeta firmware/.`;
    showState("state-error");
    return false;
  }
}

async function loadEsptool() {
  if (window.esptoolLoaded) return true;
  try {
    logTerminal("Cargando esptool-js...");
    const mod = await import(ESPTOOL_CDN);
    window.esptoolModule = mod;
    window.esptoolLoaded = true;
    logTerminal("esptool-js cargado correctamente");
    return true;
  } catch (err) {
    logTerminal(`Error al cargar esptool-js: ${err.message}`);
    document.getElementById("error-message").textContent =
      `No se pudo cargar esptool-js desde CDN. Verifica tu conexión a internet.\n\nDetalles: ${err.message}`;
    showState("state-error");
    return false;
  }
}

function createTerminal() {
  return {
    clean() {},
    writeLine(data) {
      logTerminal(data);
    },
    write(data) {
      logTerminal(data);
    },
  };
}

async function connectDevice() {
  if (isFlashing) return;

  const btnConnect = document.getElementById("btn-connect");
  btnConnect.disabled = true;
  btnConnect.textContent = "Conectando...";

  try {
    showTerminal();

    if (!firmwareData) {
      const fwLoaded = await loadFirmware();
      if (!fwLoaded) return;
    }

    const esptoolLoaded = await loadEsptool();
    if (!esptoolLoaded) return;

    const { ESPLoader, Transport } = window.esptoolModule;

    logTerminal("Solicitando acceso al puerto serial...");
    port = await navigator.serial.requestPort();
    logTerminal("Puerto serial obtenido");

    transport = new Transport(port, true);

    esploader = new ESPLoader({
      transport: transport,
      baudrate: 460800,
      terminal: createTerminal(),
      debugLogging: false,
    });

    logTerminal("Conectando al dispositivo...");
    const chipName = await esploader.main();
    logTerminal(`Chip detectado: ${chipName}`);

    if (!chipName.includes("ESP32-S3")) {
      const msg = `Dispositivo incompatible.\n\nSe esperaba: ESP32-S3\nSe detectó: ${chipName}`;
      logTerminal(msg);
      document.getElementById("error-message").textContent = msg;
      await cleanup();
      showState("state-error");
      return;
    }

    const chipDesc = esploader.chip
      ? await esploader.chip.getChipDescription(esploader)
      : chipName;
    const crystalFreq = esploader.chip
      ? await esploader.chip.getCrystalFreq(esploader)
      : "?";

    let chipRevision = "-";
    if (esploader.chip && esploader.chip.getChipRevision) {
      chipRevision = `v${await esploader.chip.getChipRevision(esploader)}`;
    }

    let flashSize = "-";
    try {
      const flashId = await esploader.readFlashId();
      const flashSizeCode = (flashId >> 16) & 0xff;
      const flashSizes = {
        0x12: "256 KB", 0x13: "512 KB", 0x14: "1 MB", 0x15: "2 MB",
        0x16: "4 MB", 0x17: "8 MB", 0x18: "16 MB", 0x19: "32 MB",
      };
      flashSize = flashSizes[flashSizeCode] || `Desconocido (0x${flashSizeCode.toString(16)})`;
    } catch (e) {
      flashSize = "No detectado";
    }

    document.getElementById("info-chip").textContent = chipName;
    document.getElementById("info-revision").textContent = chipRevision;
    document.getElementById("info-flash").textContent = flashSize;
    document.getElementById("info-crystal").textContent = `${crystalFreq} MHz`;

    logTerminal(`Chip: ${chipName}`);
    logTerminal(`Revisión: ${chipRevision}`);
    logTerminal(`Flash: ${flashSize}`);
    logTerminal(`Cristal: ${crystalFreq} MHz`);
    logTerminal("¡Dispositivo listo para flashear!");

    showState("state-connected");
  } catch (err) {
    logTerminal(`Error de conexión: ${err.message}`);
    document.getElementById("error-message").textContent =
      `Error al conectar con el dispositivo:\n\n${err.message}\n\nVerifica que:\n1. El dispositivo esté conectado por USB\n2. No esté siendo usado por otra aplicación\n3. Los drivers estén instalados`;
    await cleanup();
    showState("state-error");
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = "Conectar dispositivo";
  }
}

async function flashFirmware() {
  if (isFlashing || !esploader || !firmwareData) return;
  isFlashing = true;

  const btnFlash = document.getElementById("btn-flash");
  const btnDisconnect = document.getElementById("btn-disconnect");
  btnFlash.disabled = true;
  btnDisconnect.disabled = true;

  showState("state-flashing");
  document.getElementById("flash-detail").textContent = "Preparando flasheo...";

  try {
    logTerminal("=== Inicio del flasheo ===");
    logTerminal(`Tamaño del firmware: ${firmwareData.length} bytes`);
    logTerminal(`Dirección: 0x0000`);

    const progressFill = document.getElementById("progress-fill");
    const progressPercent = document.getElementById("progress-percent");
    const flashDetail = document.getElementById("flash-detail");

    const flashOptions = {
      fileArray: [
        { data: firmwareData, address: 0x0000 },
      ],
      flashMode: "dio",
      flashFreq: "80m",
      flashSize: "8MB",
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const percent = Math.round((written / total) * 100);
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;

        if (percent < 10) {
          flashDetail.textContent = "Iniciando escritura...";
        } else if (percent < 90) {
          flashDetail.textContent = "Escribiendo firmware...";
        } else if (percent < 100) {
          flashDetail.textContent = "Finalizando escritura...";
        } else {
          flashDetail.textContent = "Verificando...";
        }

        logTerminal(`Progreso: ${percent}% (${written}/${total} bytes)`);
      },
    };

    logTerminal("Escribiendo firmware en flash...");
    await esploader.writeFlash(flashOptions);
    logTerminal("Flasheo completado. Reiniciando dispositivo...");

    document.getElementById("flash-detail").textContent = "Reiniciando dispositivo...";
    await esploader.after("hard_reset");

    logTerminal("=== Flasheo exitoso ===");
    showState("state-success");
  } catch (err) {
    logTerminal(`Error durante el flasheo: ${err.message}`);
    document.getElementById("error-message").textContent =
      `Error durante el flasheo:\n\n${err.message}`;
    await cleanup();
    showState("state-error");
  } finally {
    isFlashing = false;
    btnFlash.disabled = false;
    btnDisconnect.disabled = false;
  }
}

async function disconnectDevice() {
  await cleanup();
  showState("state-idle");
}

async function retryFlash() {
  await cleanup();
  showState("state-idle");
  await connectDevice();
}

function resetToIdle() {
  cleanup();
  document.getElementById("terminal-output").innerHTML = "";
  document.getElementById("terminal-section").classList.add("hidden");
  showState("state-idle");
}

async function cleanup() {
  try {
    if (esploader) {
      try {
        await esploader.after("hard_reset");
      } catch (e) {}
      esploader = null;
    }
    if (transport) {
      try {
        await transport.disconnect();
      } catch (e) {}
      transport = null;
    }
    if (port) {
      try {
        await port.close();
      } catch (e) {}
      port = null;
    }
  } catch (e) {
    logTerminal(`Error durante la limpieza: ${e.message}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkWebSerial();
  loadFirmware();
});

window.connectDevice = connectDevice;
window.flashFirmware = flashFirmware;
window.disconnectDevice = disconnectDevice;
window.retryFlash = retryFlash;
window.resetToIdle = resetToIdle;
window.toggleTerminal = toggleTerminal;

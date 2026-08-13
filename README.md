# CoreM5S3-TV Firmware Flasher

Flasheador de firmware Web para el **Waveshare ESP32-S3 Touch LCD 1.54"**.

Permite actualizar el firmware del dispositivo directamente desde el navegador, sin necesidad de instalar herramientas adicionales.

## Características

- Flasheo directo desde el navegador mediante Web Serial API
- Basado en [esptool-js](https://github.com/espressif/esptool-js) de Espressif
- Sin necesidad de PlatformIO, Python, esptool ni drivers adicionales
- Compatible con Google Chrome y Microsoft Edge
- Interfaz moderna con progreso en tiempo real
- Verificación automática del chip (ESP32-S3)
- Completamente estático, compatible con GitHub Pages

## Compatibilidad

### Navegadores

| Navegador | Soporte |
|-----------|---------|
| Google Chrome 89+ | Completo |
| Microsoft Edge 89+ | Completo |
| Firefox | No compatible (Web Serial API no disponible) |
| Safari | No compatible |

### Dispositivos

- Waveshare ESP32-S3 Touch LCD 1.54"
- Cualquier ESP32-S3 con USB CDC

## Requisitos previos

- Google Chrome o Microsoft Edge (versión 89 o superior)
- Cable USB-C compatible con datos
- Archivo `firmware/firmware-full.bin` incluido en el repositorio

## Ejecución local

### Opción 1: Python (recomendado)

```bash
cd corem5s3-tv-flasher
python3 -m http.server 8080
```

Abre http://localhost:8080 en Chrome o Edge.

### Opción 2: Node.js (si está instalado)

```bash
npx serve .
```

### Opción 3: Cualquier servidor estático

Copia la carpeta del proyecto a cualquier servidor web estático.

**Importante:** Web Serial API requiere HTTPS o localhost. No funciona con `file://`.

## Publicación en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub
2. Ve a **Settings > Pages**
3. Selecciona **Deploy from a branch**
4. Elige la rama `main` y la carpeta `/(root)`
5. Guarda
6. Tu sitio estará disponible en `https://<usuario>.github.io/<repositorio>/`

## Actualizar firmware

### Cambiar el firmware

1. Genera el firmware unificado `firmware-full.bin` con PlatformIO:
   ```bash
   # El firmware debe contener:
   # 0x0000   bootloader.bin
   # 0x8000   partitions.bin
   # 0xE000   boot_app0.bin
   # 0x10000  firmware.bin
   ```
2. Reemplaza `firmware/firmware-full.bin`
3. Sube los cambios a GitHub

### Cambiar la versión

Edita la constante en `app.js`:

```javascript
const FIRMWARE_VERSION = "1.0.0";
```

## Configuración de flash

El flasheador usa estas configuraciones (equivalentes a PlatformIO):

| Parámetro | Valor |
|-----------|-------|
| Flash Mode | DIO |
| Flash Frequency | 80 MHz |
| Flash Size | 8 MB |
| Baud Rate | 460800 |
| Dirección | 0x0000 |

## Limitaciones de Web Serial

- Solo funciona en Chrome/Edge (desktop y Android)
- Requiere HTTPS o localhost
- El usuario debe seleccionar manualmente el puerto serial
- No todos los sistemas operativos detectan automáticamente el ESP32-S3
- En algunos sistemas puede ser necesario instalar drivers USB CDC

## Troubleshooting

### "Web Serial API no disponible"

Usa Google Chrome o Microsoft Edge versión 89 o superior.

### "No se pudo conectar al dispositivo"

1. Asegúrate de que el ESP32-S3 esté conectado por USB
2. Cierra cualquier otra aplicación que use el puerto serial (Arduino IDE, PlatformIO, etc.)
3. En Linux, verifica que tu usuario tenga permisos de acceso al puerto serial

### "Dispositivo incompatible"

El chip detectado no es ESP32-S3. Solo se soporta el Waveshare ESP32-S3 Touch LCD 1.54".

### El dispositivo no arranca después del flasheo

1. Desconecta y vuelve a conectar el USB
2. Verifica que el firmware sea compatible con tu hardware
3. Revisa el log de terminal para más detalles

## Estructura del proyecto

```
corem5s3-tv-flasher/
├── index.html              # Página principal
├── app.js                  # Lógica de la aplicación
├── style.css               # Estilos
├── firmware/
│   └── firmware-full.bin   # Firmware unificado
├── README.md               # Esta documentación
├── LICENSE                  # Licencia MIT
└── .gitignore
```

## Tecnologías

- HTML5 / CSS3 / JavaScript ES2020+
- [Web Serial API](https://wicg.github.io/serial/)
- [esptool-js](https://github.com/espressif/esptool-js) v0.6.1

## Licencia

MIT License. Ver [LICENSE](LICENSE) para más detalles.

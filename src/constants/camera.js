// LAN address of the ESP32-CAM (CameraWebServer.ino, in the sibling sketch_scanner repo -
// see its CAMERA_HOST comment). This only resolves when the browser is on the same local
// network as the camera (e.g. the same hotspot during dev/testing). Set VITE_CAMERA_HOST in
// .env (see .env.example) when the camera's IP changes - restart `npm run dev` after editing it,
// since Vite only reads .env at startup. The fallback below is only used when no .env value is set.
// There's no HTTPS here on purpose: the camera's own web server is plain HTTP, consistent with
// how sketch_scanner.ino already talks to it.
export const CAMERA_HOST = import.meta.env.VITE_CAMERA_HOST || 'http://192.168.137.177'

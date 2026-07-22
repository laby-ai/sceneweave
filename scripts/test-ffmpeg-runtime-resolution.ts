import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveFfmpegBinaryPath } from '../src/lib/ffmpeg-binary';

const linuxCwd = '/opt/huiying/current';
const packagedLinuxBinary = path.resolve(linuxCwd, 'node_modules', 'ffmpeg-static', 'ffmpeg');
const windowsBuildPath = 'C:\\build\\node_modules\\ffmpeg-static\\ffmpeg.exe';

assert.equal(resolveFfmpegBinaryPath({
  cwd: linuxCwd,
  platform: 'linux',
  staticPath: windowsBuildPath,
  exists: candidate => candidate === packagedLinuxBinary || candidate === windowsBuildPath,
}), packagedLinuxBinary, 'Linux runtime package must win over a Windows build-host path');

assert.equal(resolveFfmpegBinaryPath({
  configuredPath: '/custom/ffmpeg',
  cwd: linuxCwd,
  platform: 'linux',
  staticPath: windowsBuildPath,
  exists: () => true,
}), '/custom/ffmpeg', 'explicit FFMPEG_BIN must remain authoritative');

console.log(JSON.stringify({
  ok: true,
  checks: ['linux-runtime-package-before-build-host-static-path', 'explicit-env-remains-authoritative'],
}, null, 2));

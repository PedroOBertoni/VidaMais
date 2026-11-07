const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const directory = path.resolve(__dirname, '../.signing');
const credentialsFile = path.join(directory, 'credentials.json');
const keystore = path.join(directory, 'vidamais.jks');
if (fs.existsSync(credentialsFile) && fs.existsSync(keystore)) {
  console.log('Assinatura existente preservada.');
  process.exit(0);
}
if (fs.existsSync(credentialsFile) || fs.existsSync(keystore)) {
  throw new Error('Assinatura incompleta. Confira o backup de .signing antes de continuar.');
}
if (!process.env.JAVA_HOME) throw new Error('Defina JAVA_HOME para um JDK 17 ou superior.');
fs.mkdirSync(directory, { recursive: true });
const password = crypto.randomBytes(32).toString('hex');
const alias = 'vidamais';
const result = spawnSync(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool'), [
  '-genkeypair', '-noprompt', '-keystore', keystore, '-storetype', 'JKS',
  '-alias', alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
  '-dname', 'CN=VidaMais, OU=Aplicativo, O=VidaMais, C=BR',
  '-storepass:env', 'VIDAMAIS_SIGNING_PASSWORD', '-keypass:env', 'VIDAMAIS_SIGNING_PASSWORD',
], { env: { ...process.env, VIDAMAIS_SIGNING_PASSWORD: password }, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
fs.writeFileSync(credentialsFile, JSON.stringify({ alias, password }, null, 2), { flag: 'wx', mode: 0o600 });
console.log('Assinatura criada em .signing. Guarde um backup privado dessa pasta.');

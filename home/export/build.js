// Gerüst: baut home/export/dist/zuhause/ (eigenständige Zuhause-Seite für Home Assistant /config/www).
// Kopiert die Bausteine und bettet die Konfiguration ein. Der Transport ha-direct ist noch ein Platzhalter.
'use strict';
const fs = require('fs');
const path = require('path');
const { parseJsonc } = require('../config');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'dist', 'zuhause');
fs.mkdirSync(OUT, { recursive: true });

const copy = (from, to) => fs.copyFileSync(path.join(ROOT, from), path.join(OUT, to));
copy('shared/base.css', 'base.css');
copy('app/zuhause.css', 'zuhause.css');
copy('app/zuhause-data.js', 'zuhause-data.js');
copy('app/zuhause.js', 'zuhause.js');
copy('home/export/ha-direct.js', 'ha-direct.js');

const config = parseJsonc(fs.readFileSync(path.join(ROOT, 'home', 'config.jsonc'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'config.js'), 'window.ZH_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');

fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="de" data-theme="rosenacht">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Zuhause</title>
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="zuhause.css">
</head>
<body>
<section class="screen page active" id="s-zuhause"><div class="zh" id="zh"></div></section>
<script>
  // TODO (siehe README): Hüllen für UI, WIR_PB, wir:show; Transport wählen
  window.ZH_TRANSPORT = 'ha-direct';
</script>
<script src="config.js"></script>
<script src="zuhause-data.js"></script>
<script src="ha-direct.js"></script>
<script src="zuhause.js"></script>
</body>
</html>
`);
console.log('Gerüst geschrieben nach ' + OUT + ' (Transport ha-direct ist noch ein Platzhalter)');

---
name: deploy-check
description: Prüft nach einem Push genau einmal, ob die neue Version live ist. Aufruf mit der erwarteten Cache-Version (z. B. wir-v48).
model: haiku
tools: Bash
---

Führe genau EINMAL aus (aus dem Repo-Root, erwartete Version aus dem Auftrag):

```
bash scripts/wait-deploy.sh <version>
```

Kein erneuter Aufruf, kein eigenes Polling, keine weiteren Befehle.

Antwort in höchstens 5 Zeilen:
- Deploy ok / nicht ok
- ausgelieferte sw.js-Version
- HTTP-Status der Live-Seite

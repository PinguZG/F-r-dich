/// <reference path="../pb_data/types.d.ts" />
// Gemeinsame Bausteine beider Apps (Repo-Ordner shared/): PocketBase-Client, Farbwelten-CSS, UI-Helfer, Push, Konsole.
// Wir (publicDir app/) bekommt sie hier unter /shared/…; die Spiele-App (:8443) bekommt denselben Ordner direkt
// von Tailscale (tailscale funnel --https=8443 --set-path=/shared …, siehe ANLEITUNG.md).
// Ordner: Umgebungsvariable WIR_SHARED_DIR (lokale Tests), sonst das Repo auf dem Pi.
routerAdd('GET', '/shared/{path...}', $apis.static($os.dirFS($os.getenv('WIR_SHARED_DIR') || '/home/pingu/F-r-dich/shared'), false));

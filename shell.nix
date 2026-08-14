# Fallback for non-flake workflows: nix-shell
# The flake is the source of truth; this keeps the same package set available
# to anyone without flakes enabled.
{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  name = "halon";

  packages = with pkgs; [
    gtk3
    gtk4
    libadwaita
    glib
    gnome-themes-extra
    nodejs
    python3
  ];

  shellHook = ''
    export HALON_ROOT="$PWD"
    echo "halon dev shell (nix-shell)"
    echo "  node scripts/audit.mjs      contrast audit over both schemes"
    echo "  node scripts/lint-gtk.mjs   undefined tokens, stray literals, import order"
    echo "  gtk3-widget-factory         with GTK_THEME=Halon"
  '';
}

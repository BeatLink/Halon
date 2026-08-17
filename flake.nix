{
  description = "Halon — a slate and blue application theme, its design guide, and a GTK implementation";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Every preview runs the working tree against a throwaway XDG dir, so testing
        # never depends on what is installed in ~/.themes or disturbs the running desktop.
        gtk3Preamble = ''
          root="''${HALON_ROOT:-$PWD}"
          [ -d "$root/gtk/Halon" ] || { echo "run from the repo root, or set HALON_ROOT" >&2; exit 1; }
          data=$(mktemp -d)
          trap 'rm -rf "$data"' EXIT
          mkdir -p "$data/themes"
          ln -s "$root/gtk/Halon" "$data/themes/Halon"
          export XDG_DATA_HOME="$data"
          export GTK_THEME="Halon''${1:+:$1}"
          echo "GTK_THEME=$GTK_THEME"
        '';

        # libadwaita ignores GTK_THEME by design, so GTK 4 goes through a user stylesheet
        # in a throwaway XDG_CONFIG_HOME — the same mechanism a real install uses.
        gtk4Preamble = ''
          root="''${HALON_ROOT:-$PWD}"
          [ -d "$root/gtk/Halon" ] || { echo "run from the repo root, or set HALON_ROOT" >&2; exit 1; }
          variant="''${1:-light}"
          conf=$(mktemp -d)
          trap 'rm -rf "$conf"' EXIT
          mkdir -p "$conf/gtk-4.0"
          if [ "$variant" = "dark" ]; then
            ln -s "$root/gtk/Halon/gtk-4.0/gtk-dark.css" "$conf/gtk-4.0/gtk.css"
            export ADW_DEBUG_COLOR_SCHEME=prefer-dark
          else
            ln -s "$root/gtk/Halon/gtk-4.0/gtk.css" "$conf/gtk-4.0/gtk.css"
            export ADW_DEBUG_COLOR_SCHEME=prefer-light
          fi
          export XDG_CONFIG_HOME="$conf"
          echo "scheme: $variant"
        '';

        mkPreview = { name, preamble, runtimeInputs, exe }:
          pkgs.writeShellApplication {
            inherit name;
            runtimeInputs = runtimeInputs ++ [ pkgs.coreutils ];
            text = preamble + ''
              exec ${exe} "''${@:2}"
            '';
          };

        preview-gtk3 = mkPreview {
          name = "preview-gtk3";
          preamble = gtk3Preamble;
          runtimeInputs = [ pkgs.gtk3.dev pkgs.gtk3 ];
          exe = "gtk3-widget-factory";
        };

        demo-gtk3 = mkPreview {
          name = "demo-gtk3";
          preamble = gtk3Preamble;
          runtimeInputs = [ pkgs.gtk3.dev pkgs.gtk3 ];
          exe = "gtk3-demo";
        };

        icons-gtk3 = mkPreview {
          name = "icons-gtk3";
          preamble = gtk3Preamble;
          runtimeInputs = [ pkgs.gtk3.dev pkgs.gtk3 ];
          exe = "gtk3-icon-browser";
        };

        preview-gtk4 = mkPreview {
          name = "preview-gtk4";
          preamble = gtk4Preamble;
          runtimeInputs = [ pkgs.gtk4.dev pkgs.gtk4
                           pkgs.gst_all_1.gst-plugins-base pkgs.gst_all_1.gst-plugins-good ];
          exe = ''env GST_PLUGIN_SYSTEM_PATH_1_0="${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-good}/lib/gstreamer-1.0" gtk4-widget-factory'';
        };

        demo-gtk4 = mkPreview {
          name = "demo-gtk4";
          preamble = gtk4Preamble;
          runtimeInputs = [ pkgs.gtk4.dev pkgs.gtk4 ];
          exe = "gtk4-demo";
        };

        demo-adwaita = mkPreview {
          name = "demo-adwaita";
          preamble = gtk4Preamble;
          runtimeInputs = [ (pkgs.libadwaita.devdoc or pkgs.libadwaita) pkgs.libadwaita pkgs.gtk4 ];
          exe = "adwaita-1-demo";
        };

        # The greeter has no LightDM to talk to outside a seat, so the preview
        # stages a copy with preview/mock.js enabled and opens that.
        preview-lightdm = pkgs.writeShellApplication {
          name = "preview-lightdm";
          runtimeInputs = with pkgs; [ coreutils gnused xdg-utils ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            [ -d "$root/lightdm" ] || { echo "run from the repo root, or set HALON_ROOT" >&2; exit 1; }
            work=$(mktemp -d)
            cp -r "$root/lightdm/." "$work/"
            sed -i 's|<!--<script src="preview/mock.js"></script>-->|<script src="preview/mock.js"></script>|' "$work/index.html"
            echo "greeter preview: $work/index.html  (mock password: justice)"
            exec xdg-open "$work/index.html"
          '';
        };

        # Parses the CSS and asserts every audited pair clears its WCAG threshold.
        audit = pkgs.writeShellApplication {
          name = "halon-audit";
          runtimeInputs = [ pkgs.nodejs ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            exec node "$root/scripts/audit.mjs" "$@"
          '';
        };

        # Renders the theme in Xvfb and captures every scheme plus interaction
        # states. The only honest verification for a visual project.
        shots = pkgs.writeShellApplication {
          name = "halon-shots";
          runtimeInputs = with pkgs; [
            xorg.xvfb imagemagick xdotool coreutils gnugrep
            gtk3.dev gtk4.dev adwaita-icon-theme
            gst_all_1.gst-plugins-base gst_all_1.gst-plugins-good
          ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            export GST_PLUGIN_SYSTEM_PATH_1_0="${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${pkgs.gst_all_1.gst-plugins-good}/lib/gstreamer-1.0"
            export XDG_DATA_DIRS="${pkgs.adwaita-icon-theme}/share:/run/current-system/sw/share:''${XDG_DATA_DIRS:-/usr/share}"
            exec "$root/scripts/screenshot.sh" "$@"
          '';
        };

        # Regenerates every derived stylesheet from the shared token files.
        build = pkgs.writeShellApplication {
          name = "halon-build";
          runtimeInputs = [ pkgs.nodejs ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            node "$root/scripts/build-gtk.mjs" "$@"
            node "$root/scripts/build-cinnamon.mjs" "$@"
            node "$root/scripts/build-cinnamon.mjs" --dark "$@"
            node "$root/scripts/build-vscode.mjs" "$@"
            node "$root/scripts/build-firefox.mjs" "$@"
            node "$root/scripts/build-qt.mjs" "$@"
            node "$root/scripts/build-lightdm.mjs" "$@"
          '';
        };

        # Catches the mistakes GTK reports only as runtime warnings.
        lint = pkgs.writeShellApplication {
          name = "halon-lint";
          runtimeInputs = [ pkgs.nodejs ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            exec node "$root/scripts/lint-gtk.mjs" "$@"
          '';
        };
      in
      {
        packages = {
          inherit preview-gtk3 preview-gtk4 demo-gtk3 demo-gtk4 demo-adwaita icons-gtk3
            preview-lightdm audit lint build shots;

          # Both theme directories in one derivation: Halon-Dark's stylesheets
          # import ../Halon/shared, so they must be installed side by side.
          halon-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-theme";
            version = "1.0.0";
            src = ./gtk;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/themes"
              cp -r Halon "$out/share/themes/Halon"
              cp -r Halon-Dark "$out/share/themes/Halon-Dark"
            '';
            meta = {
              description = "Halon — slate and blue GTK + Cinnamon theme; recessed chrome, raised content";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          halon-gtk-theme = self.packages.${system}.halon-theme;

          # Installs onto XDG_DATA_DIRS, where Tilix discovers color schemes.
          halon-tilix-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-tilix-theme";
            version = "1.0.0";
            src = ./tilix;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/tilix/schemes"
              cp ./*.json "$out/share/tilix/schemes/"
            '';
            meta = {
              description = "Slate and blue Tilix color schemes";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          # Both schemes as one VS Code extension, generated from the same tokens.
          halon-vscode-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-vscode-theme";
            version = "1.0.0";
            src = ./vscode;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/vscode/extensions/halon.halon-theme"
              cp -r . "$out/share/vscode/extensions/halon.halon-theme/"
            '';
            meta = {
              description = "Slate and blue VS Code theme; recessed chrome, raised content";
            };
          };

          # The unpacked static theme; Firefox loads it from about:debugging or as a signed xpi.
          halon-firefox-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-firefox-theme";
            version = "1.0.0";
            src = ./firefox;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/halon/firefox"
              cp manifest.json icon.svg userChrome.css "$out/share/halon/firefox/"
            '';
            meta = {
              description = "Slate and blue Firefox theme; recessed chrome, raised content";
            };
          };

          # Colour schemes go where qt5ct and qt6ct look for them; the style sheet
          # keeps its own directory, with its url() paths rewritten to absolute —
          # Qt resolves them against the working directory, not the sheet.
          halon-qt-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-qt-theme";
            version = "1.0.0";
            src = ./qt;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/qt5ct/colors" "$out/share/qt6ct/colors" "$out/share/halon/qt"
              cp colors/qt5ct/*.conf "$out/share/qt5ct/colors/"
              cp colors/qt6ct/*.conf "$out/share/qt6ct/colors/"
              cp -r assets ./*.qss "$out/share/halon/qt/"
              substituteInPlace "$out"/share/halon/qt/*.qss \
                --replace-fail "url(assets/" "url($out/share/halon/qt/assets/"
            '';
            meta = {
              description = "Slate and blue Qt colour schemes and style sheet";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          # web-greeter scans its own prefix for theme directories, so the whole
          # theme installs under one name; the preview copy is left behind.
          halon-lightdm-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-lightdm-theme";
            version = "1.0.0";
            src = ./lightdm;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/web-greeter/themes/halon"
              cp index.yml index.html tokens.css style.css greeter.js "$out/share/web-greeter/themes/halon/"
            '';
            meta = {
              description = "Slate and blue LightDM web greeter theme";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          default = self.packages.${system}.halon-theme;
        };

        apps = {
          preview-gtk3 = { type = "app"; program = "${preview-gtk3}/bin/preview-gtk3"; };
          preview-gtk4 = { type = "app"; program = "${preview-gtk4}/bin/preview-gtk4"; };
          demo-gtk3    = { type = "app"; program = "${demo-gtk3}/bin/demo-gtk3"; };
          demo-gtk4    = { type = "app"; program = "${demo-gtk4}/bin/demo-gtk4"; };
          demo-adwaita = { type = "app"; program = "${demo-adwaita}/bin/demo-adwaita"; };
          icons-gtk3   = { type = "app"; program = "${icons-gtk3}/bin/icons-gtk3"; };
          preview-lightdm = { type = "app"; program = "${preview-lightdm}/bin/preview-lightdm"; };
          audit = { type = "app"; program = "${audit}/bin/halon-audit"; };
          build = { type = "app"; program = "${build}/bin/halon-build"; };
          shots = { type = "app"; program = "${shots}/bin/halon-shots"; };
          lint = { type = "app"; program = "${lint}/bin/halon-lint"; };
          default = self.apps.${system}.audit;
        };

        devShells.default = pkgs.mkShell {
          name = "halon";

          packages = with pkgs; [
            # GTK, for rendering the theme rather than only reasoning about it —
            # the .dev outputs are what carry the widget factories
            gtk3.dev
            gtk3
            gtk4.dev
            gtk4
            libadwaita
            glib                      # gsettings, for flipping the system colour-scheme
            gnome-themes-extra        # Adwaita, the base these overrides sit on

            # The verification scripts
            nodejs
            python3

            preview-gtk3
            preview-gtk4
            demo-gtk3
            demo-gtk4
            demo-adwaita
            icons-gtk3
            preview-lightdm
            audit
            lint
            build
            shots
          ];

          shellHook = ''
            export HALON_ROOT="$PWD"
            echo "halon dev shell"
            echo
            echo "  preview-gtk3 [dark]     GTK 3 widget factory — every widget, every state"
            echo "  demo-gtk3    [dark]     GTK 3 demo — real windows, sidebars, dialogs"
            echo "  icons-gtk3   [dark]     GTK 3 icon browser"
            echo "  preview-gtk4 [dark]     GTK 4 widget factory"
            echo "  demo-gtk4    [dark]     GTK 4 demo"
            echo "  demo-adwaita [dark]     libadwaita demo — the GTK 4 named-colour path"
            echo "  preview-lightdm         the LightDM greeter in a browser, against its mock"
            echo
            echo "  halon-audit             contrast audit over both schemes"
            echo "  halon-lint              undefined tokens, stray literals, import order"
            echo "  halon-build [--check]   regenerate the derived stylesheets from the tokens"
            echo "  halon-shots [outdir]    render the GTK theme in Xvfb and screenshot it"
            echo
            echo "  theme source:  gtk/Halon"
            echo "  live symlink:  ~/.themes/Halon"
          '';
        };
      }) // {
      overlays.default = final: prev: {
        halon-theme = self.packages.${final.stdenv.hostPlatform.system}.halon-theme;
      };

      # NixOS: `imports = [ halon.nixosModules.default ];  themes.halon.enable = true;`
      nixosModules.default = { config, lib, pkgs, ... }: {
        options.themes.halon.enable = lib.mkEnableOption "the Halon GTK and Cinnamon theme";
        config = lib.mkIf config.themes.halon.enable {
          environment.systemPackages =
            [ self.packages.${pkgs.stdenv.hostPlatform.system}.halon-theme ];
        };
      };

      # home-manager: `imports = [ halon.homeManagerModules.default ];  themes.halon.enable = true;`
      # setDefaults additionally selects Halon for GTK and the Cinnamon shell.
      homeManagerModules.default = { config, lib, pkgs, ... }:
        let cfg = config.themes.halon;
            pkg = self.packages.${pkgs.stdenv.hostPlatform.system}.halon-theme;
        in {
          options.themes.halon = {
            enable = lib.mkEnableOption "the Halon GTK and Cinnamon theme";
            setDefaults = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Select Halon as the GTK theme and Cinnamon shell theme.";
            };
          };
          config = lib.mkIf cfg.enable {
            home.packages = [ pkg ];
            gtk = lib.mkIf cfg.setDefaults {
              enable = true;
              theme = { name = "Halon"; package = pkg; };
            };
            dconf.settings = lib.mkIf cfg.setDefaults {
              "org/cinnamon/theme".name = "Halon";
              "org/cinnamon/desktop/interface".gtk-theme = "Halon";
            };
          };
        };
    };
}

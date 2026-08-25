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

        # LMMS_THEME_PATH goes ahead of the configured theme on LMMS' resource
        # search path, so the working tree previews without touching ~/.lmmsrc.xml.
        preview-lmms = pkgs.writeShellApplication {
          name = "preview-lmms";
          runtimeInputs = [ pkgs.lmms pkgs.coreutils ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            [ -f "$root/lmms/Halon/style.css" ] || { echo "run from the repo root, or set HALON_ROOT" >&2; exit 1; }
            export LMMS_THEME_PATH="$root/lmms/Halon"
            echo "LMMS_THEME_PATH=$LMMS_THEME_PATH"
            exec lmms "$@"
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

        # The greeter renders in Firefox rather than Xvfb, so it captures on its
        # own rather than as another case in halon-shots.
        shots-lightdm = pkgs.writeShellApplication {
          name = "halon-shots-lightdm";
          runtimeInputs = with pkgs; [ firefox coreutils gnused ];
          text = ''
            root="''${HALON_ROOT:-$PWD}"
            exec "$root/scripts/screenshot-lightdm.sh" "$@"
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
            node "$root/scripts/build-lmms.mjs" "$@"
            node "$root/scripts/build-lightdm.mjs" "$@"
            node "$root/scripts/build-tokens.mjs" "$@"
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
            preview-lightdm preview-lmms audit lint build shots shots-lightdm;

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
            # nixpkgs' extension machinery reads these off the derivation, and a plain one has no manifest to infer them from
            passthru = {
              vscodeExtUniqueId = "halon.halon-theme";
              vscodeExtPublisher = "halon";
            };
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

          # LMMS falls back to its own default theme for every file the chosen
          # directory does not carry, so the theme is a style sheet plus the
          # handful of images whose stock colour is LMMS' green. Those are
          # remapped by luminance rather than by hue: desaturate, stretch, then
          # tint, which keeps the artwork's shading and lands the whole ramp on
          # a Halon token. Lit artwork goes to the accent; knob bodies are
          # control surfaces, so they go to the neutral ramp and leave the
          # accent to the indicator line the style sheet colours.
          halon-lmms-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-lmms-theme";
            version = "1.0.0";
            src = ./lmms;
            nativeBuildInputs = [ pkgs.imagemagick ];
            dontBuild = true;
            installPhase =
              let
                dark = self.tokens.dark;
                recolor = from: to: images: nixpkgs.lib.concatMapStringsSep "\n" (image: ''
                  magick "${pkgs.lmms}/share/lmms/themes/default/${image}" \
                    -alpha set -channel RGB -modulate 100,0 -auto-level \
                    +level-colors "${from},${to}" "$theme/${image}"
                '') images;
              in
              ''
                theme=$out/share/lmms/themes/Halon
                mkdir -p "$theme"
                cp Halon/style.css "$theme/"

                ${recolor dark.surface-root dark.accent [
                  "lcd_11green.png" "lcd_11green_dot.png" "lcd_19green.png" "lcd_19green_dot.png"
                  "step_btn_on_0.png" "step_btn_on_200.png" "step_btn_highlight.png"
                  "white_key_pressed.png" "black_key_pressed.png"
                  "pr_white_key_big_pressed.png" "pr_white_key_small_pressed.png" "pr_black_key_pressed.png"
                  "main_slider.png" "horizontal_slider.png" "loop_point.png"
                  "mixer_send_on.png" "lfo_x1_active.png" "lfo_x100_active.png" "lfo_d100_active.png"
                ]}

                ${recolor dark.surface-navigation-hover dark.border-control [
                  "knob01.png" "knob02.png" "knob03.png" "knob05.png"
                ]}
              '';
            meta = {
              description = "Slate and blue LMMS theme; recessed chrome, raised editor canvases";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          # The pulse is baked at build time: 360 frames of a cosine opacity sweep,
          # which two-step plays at 30fps for a 12-second cycle.
          halon-plymouth-theme = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-plymouth-theme";
            version = "1.0.0";
            src = ./plymouth;
            nativeBuildInputs = [ pkgs.librsvg pkgs.imagemagick pkgs.gawk ];
            dontBuild = true;
            installPhase = ''
              theme=$out/share/plymouth/themes/halon
              mkdir -p "$theme"

              rsvg-convert -w 220 logo.svg -o logo.png
              for i in $(seq 1 360); do
                alpha=$(awk -v i="$i" 'BEGIN { pi = atan2(0, -1); printf "%.4f", 0.675 + 0.325 * cos(2 * pi * (i - 1) / 360) }')
                magick logo.png -channel A -evaluate multiply "$alpha" +channel \
                  "$theme/throbber-$(printf '%04d' "$i").png"
              done

              rsvg-convert -w 280 entry.svg -o "$theme/entry.png"
              rsvg-convert -h 22 lock.svg -o "$theme/lock.png"
              rsvg-convert -w 10 bullet.svg -o "$theme/bullet.png"
              rsvg-convert -h 22 capslock.svg -o "$theme/capslock.png"

              substitute halon.plymouth "$theme/halon.plymouth" --replace-fail "@THEME_DIR@" "$theme"
            '';
            meta = {
              description = "Slate and blue Plymouth boot splash; pulsing mark, status messages, accent progress bar";
              platforms = nixpkgs.lib.platforms.linux;
            };
          };

          # web-greeter scans its own prefix for theme directories, so the whole
          # theme installs under one name; the preview copy is left behind.
          halon-lightdm-theme = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "halon-lightdm-theme";
            version = "1.0.0";
            src = ./lightdm;
            dontBuild = true;
            installPhase = ''
              mkdir -p "$out/share/web-greeter/themes/halon"
              cp index.yml index.html tokens.css style.css greeter.js "$out/share/web-greeter/themes/halon/"
            '';
            # web-greeter's theme key takes a path when the theme lives outside its own prefix, as this one does
            passthru.themePath = "${finalAttrs.finalPackage}/share/web-greeter/themes/halon";
            meta = {
              description = "Slate and blue LightDM web greeter theme";
              platforms = nixpkgs.lib.platforms.linux;
            };
          });

          # The tokens as data. Nix consumers should prefer the `tokens` output, which
          # is the same JSON already parsed; this exists for anything reading a path.
          halon-tokens = pkgs.stdenvNoCC.mkDerivation {
            pname = "halon-tokens";
            version = "1.0.0";
            src = ./tokens.json;
            dontUnpack = true;
            dontBuild = true;
            installPhase = ''
              install -Dm644 "$src" "$out/share/halon/tokens.json"
            '';
            meta = {
              description = "Halon's colour tokens for both schemes, as JSON";
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
          preview-lmms = { type = "app"; program = "${preview-lmms}/bin/preview-lmms"; };
          audit = { type = "app"; program = "${audit}/bin/halon-audit"; };
          build = { type = "app"; program = "${build}/bin/halon-build"; };
          shots = { type = "app"; program = "${shots}/bin/halon-shots"; };
          shots-lightdm = { type = "app"; program = "${shots-lightdm}/bin/halon-shots-lightdm"; };
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
            preview-lmms
            audit
            lint
            build
            shots
            shots-lightdm
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
            echo "  preview-lmms            LMMS against the working tree's style sheet"
            echo
            echo "  halon-audit             contrast audit over both schemes"
            echo "  halon-lint              undefined tokens, stray literals, import order"
            echo "  halon-build [--check]   regenerate the derived stylesheets from the tokens"
            echo "  halon-shots [outdir]    render the GTK theme in Xvfb and screenshot it"
            echo "  halon-shots-lightdm     render the greeter against its mock and screenshot it"
            echo
            echo "  theme source:  gtk/Halon"
            echo "  live symlink:  ~/.themes/Halon"
          '';
        };
      }) // {
      overlays.default = final: prev: {
        halon-theme = self.packages.${final.stdenv.hostPlatform.system}.halon-theme;
      };

      # Both schemes' colours, resolved and hexified, so a consumer theming something
      # Halon has no stylesheet for reads the palette instead of transcribing it.
      tokens = nixpkgs.lib.importJSON ./tokens.json;

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
            packages = self.packages.${pkgs.stdenv.hostPlatform.system};
            pkg = packages.halon-theme;
            qtPkg = packages.halon-qt-theme;
            lmmsPkg = packages.halon-lmms-theme;

            # Fusion is what the style sheet is written against; it assumes Fusion's
            # element structure for everything it does not restyle.
            qtctConf = qtct: ''
              [Appearance]
              custom_palette=true
              color_scheme_path=${qtPkg}/share/${qtct}/colors/Halon.conf
              style=Fusion
              standard_dialogs=default

              [Interface]
              stylesheets=${qtPkg}/share/halon/qt/Halon.qss
            '';
        in {
          options.themes.halon = {
            enable = lib.mkEnableOption "the Halon GTK and Cinnamon theme";
            setDefaults = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = "Select Halon as the GTK theme and Cinnamon shell theme.";
            };
            # Independent of enable: a session can be Halon in Qt without Halon in GTK
            qt = lib.mkEnableOption ''
              the Halon Qt colour scheme and style sheet, written as qt5ct and qt6ct
              configuration. Qt must be pointed at those platform themes separately,
              with NixOS' qt.platformTheme or home-manager's qt.platformTheme.name'';
            # Also independent of enable, and set by environment rather than by writing
            # ~/.lmmsrc.xml, which LMMS rewrites wholesale whenever its settings change
            lmms = lib.mkEnableOption ''
              the Halon LMMS theme, selected through LMMS_THEME_PATH. Point LMMS at it
              by hand instead, under Edit -> Settings -> Paths, if the session does not
              pick up home-manager's environment'';
          };
          config = lib.mkMerge [
            (lib.mkIf cfg.enable {
              home.packages = [ pkg ];
              gtk = lib.mkIf cfg.setDefaults {
                enable = true;
                theme = { name = "Halon"; package = pkg; };
              };
              dconf.settings = lib.mkIf cfg.setDefaults {
                "org/cinnamon/theme".name = "Halon";
                "org/cinnamon/desktop/interface".gtk-theme = "Halon";
              };
            })
            (lib.mkIf cfg.lmms {
              home.packages = [ lmmsPkg ];
              home.sessionVariables.LMMS_THEME_PATH =
                "${lmmsPkg}/share/lmms/themes/Halon";
            })
            (lib.mkIf cfg.qt {
              xdg.configFile = {
                "qt5ct/qt5ct.conf".text = qtctConf "qt5ct";
                "qt6ct/qt6ct.conf".text = qtctConf "qt6ct";
              };
            })
          ];
        };
    };
}

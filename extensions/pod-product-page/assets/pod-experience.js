(function () {
  var COLOR_NAMES = /^(color|colour|couleur|farbe|colore|cor|색상|カラー|颜色|顏色)$/i;

  function selectVariantByColor(colorName) {
    if (!colorName) return;
    var fields = document.querySelectorAll(
      'select[name="options[Color]"], select[name="options[Colour]"], select[name="options[colour]"], fieldset input[type="radio"]',
    );
    fields.forEach(function (el) {
      if (el.tagName === "SELECT") {
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].text.trim().toLowerCase() === colorName.toLowerCase()) {
            el.value = el.options[i].value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      } else if (el.type === "radio") {
        var label = el.value || (el.nextElementSibling && el.nextElementSibling.textContent) || "";
        if (String(label).trim().toLowerCase() === colorName.toLowerCase()) {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  function updateFeaturedImage(url) {
    if (!url) return;
    var media =
      document.querySelector("[data-product-media] img") ||
      document.querySelector(".product__media img") ||
      document.querySelector(".product-media-container img") ||
      document.querySelector('img[src*="/products/"]');
    if (media) {
      media.src = url;
      if (media.srcset) media.removeAttribute("srcset");
    }
  }

  function optionLabelText(el) {
    if (!el) return "";
    var legend = el.querySelector("legend");
    if (legend) return legend.textContent.trim();
    var label = el.querySelector("label, .form__label, .product-form__label");
    if (label) return label.textContent.trim();
    var name = el.getAttribute("name") || "";
    var m = name.match(/options\[([^\]]+)\]/i);
    if (m) return m[1];
    return el.getAttribute("data-option-name") || "";
  }

  function isColorOption(text) {
    if (!text) return false;
    var cleaned = String(text).replace(/[:*]/g, "").trim();
    return COLOR_NAMES.test(cleaned);
  }

  /**
   * Hide theme Variant picker Color only when POD block asks for it.
   * Non-POD products never get data-pod-hide-theme-color, so they stay unchanged.
   */
  function hideThemeColorPickers() {
    var roots = document.querySelectorAll(".pod-experience[data-pod-hide-theme-color='true']");
    if (!roots.length) return;

    document.documentElement.classList.add("pod-hide-theme-color");

    var candidates = document.querySelectorAll(
      [
        'variant-selects fieldset',
        'variant-radios fieldset',
        '.product-form__input',
        '.product-form__input--swatch',
        '.product-form__input--pill',
        '[data-option-index]',
        'select[name^="options["]',
        'fieldset',
      ].join(","),
    );

    candidates.forEach(function (el) {
      var label = optionLabelText(el);
      var name = el.getAttribute("name") || "";
      var isSelectColor =
        el.tagName === "SELECT" && /options\[(color|colour)\]/i.test(name);
      if (!isSelectColor && !isColorOption(label)) return;

      var wrap = el.closest(
        ".product-form__input, fieldset, .product__option, [data-option-index], .js",
      );
      var target = wrap || el;
      target.classList.add("pod-theme-color-hidden");
      target.setAttribute("hidden", "hidden");
      target.setAttribute("aria-hidden", "true");
      target.style.display = "none";
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".pod-experience__swatch");
    if (!btn) return;
    e.preventDefault();
    var root = btn.closest(".pod-experience__colors");
    if (root) {
      root.querySelectorAll(".pod-experience__swatch").forEach(function (s) {
        s.classList.remove("is-active");
      });
    }
    btn.classList.add("is-active");
    selectVariantByColor(btn.getAttribute("data-pod-color"));
    updateFeaturedImage(btn.getAttribute("data-pod-image"));
  });

  function boot() {
    hideThemeColorPickers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Some themes re-render variant UI after load
  setTimeout(hideThemeColorPickers, 400);
  setTimeout(hideThemeColorPickers, 1200);
})();

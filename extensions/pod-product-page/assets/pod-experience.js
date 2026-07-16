(function () {
  function selectVariantByColor(colorName) {
    if (!colorName) return;
    var fields = document.querySelectorAll(
      'select[name="options[Color]"], select[name="options[colour]"], fieldset input[type="radio"]',
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
})();

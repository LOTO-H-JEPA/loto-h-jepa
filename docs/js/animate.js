(function () {
  const SELECTOR = ".hjepa-diagram-stage";
  const DEFAULT_INTERVAL = 10200;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const stages = document.querySelectorAll(SELECTOR);

    for (const stage of stages) {
      try {
        const urls = JSON.parse(stage.dataset.svgStates || "[]");
        const autoplay = stage.dataset.autoplay !== "false";
        const interval = Number(stage.dataset.interval || DEFAULT_INTERVAL);

        if (!urls.length) continue;

        const controller = new HJEPADiagram(stage, urls, { autoplay, interval });
        await controller.mount();
      } catch (error) {
        console.error("Failed to initialize H-JEPA diagram:", error);
      }
    }
  }

  class HJEPADiagram {
    constructor(stage, urls, options = {}) {
      this.stage = stage;
      this.urls = urls;
      this.options = options;
      this.currentIndex = 0;
      this.timer = null;

      this.stateTexts = [];
      this.baseLayer = null;
      this.baseSvg = null;
    }

    async mount() {
      const svgTexts = await Promise.all(this.urls.map(fetchSVG));
      this.stateTexts = svgTexts.map(cleanSVGText);

      this.baseLayer = document.createElement("div");
      this.baseLayer.className = "hjepa-svg-layer is-active";
      this.baseLayer.style.opacity = "1";
      this.baseLayer.innerHTML = this.stateTexts[0];

      this.baseSvg = this.baseLayer.querySelector("svg");
      if (!this.baseSvg) {
        throw new Error("No <svg> root found in first state.");
      }

      prepareMountedSVG(this.baseSvg);
      this.stage.appendChild(this.baseLayer);

      if (this.options.autoplay && this.stateTexts.length > 1) {
        this.start();
      }
    }

    start() {
      this.stop();

      this.timer = window.setInterval(() => {
        const nextIndex = (this.currentIndex + 1) % this.stateTexts.length;
        this.transitionTo(nextIndex);
      }, this.options.interval);
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    transitionTo(nextIndex) {
      if (nextIndex === this.currentIndex) return;

      const nextLayer = document.createElement("div");
      nextLayer.className = "hjepa-svg-layer is-active";
      nextLayer.style.opacity = "1";
      nextLayer.innerHTML = this.stateTexts[nextIndex];

      const nextSvg = nextLayer.querySelector("svg");
      if (!nextSvg) {
        throw new Error(`No <svg> root found in state ${nextIndex}.`);
      }

      prepareMountedSVG(nextSvg);
      this.stage.appendChild(nextLayer);

      if (this.baseLayer && this.baseLayer.isConnected) {
        this.baseLayer.remove();
      }

      this.baseLayer = nextLayer;
      this.baseSvg = nextSvg;
      this.currentIndex = nextIndex;
    }
  }

  async function fetchSVG(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG: ${url}`);
    }
    return await response.text();
  }

  function cleanSVGText(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;

    removeWhiteBackgroundRects(svg);
    forceDiagramFonts(svg);

    return new XMLSerializer().serializeToString(svg);
  }

  function prepareMountedSVG(svg) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
  }

  function removeWhiteBackgroundRects(svg) {
    const rects = [...svg.querySelectorAll("rect")];

    rects.forEach((rect) => {
      const fill = (rect.getAttribute("fill") || "").trim().toLowerCase();
      const opacity = rect.getAttribute("fill-opacity") || rect.getAttribute("opacity") || "1";
      const x = rect.getAttribute("x") || "0";
      const y = rect.getAttribute("y") || "0";

      const isWhite =
        fill === "#ffffff" ||
        fill === "#fff" ||
        fill === "white" ||
        fill === "rgb(255,255,255)";

      const isVisible = opacity !== "0";

      if (isWhite && isVisible && x === "0" && y === "0") {
        rect.remove();
      }
    });
  }

  function forceDiagramFonts(svg) {
    svg.querySelectorAll("text, foreignObject, foreignObject *").forEach((node) => {
      if (node.style) {
        node.style.fontFamily = '"Manrope", sans-serif';
      }
    });
  }
})();
const COLOR_MAP = {
  "Insecta": "#f4a261",
  "Magnoliopsida": "#2a9d8f",
  "Teleostei": "#1b628f",
  "Mammalia": "#e5603f",
  "Malacostraca": "#8ecae6",
  "Cephalopoda": "#6a4c93",
  "Euchelicerata": "#6ed333",
  "Gastropoda": "#8f584c",
  "Bivalvia": "#c7f69e",
  "Pinopsida": "#004e2d",
  "Aves": "#fcbd1d",
  "Other": "#d3d3d3",
  "No data": "none",
};

const W = 1000, H = 720;
const MARGIN = { top: 30, right: 120, bottom: 50, left: 55 };
const IMG_SIZE = 10; // half-width/height of bird image in svg units
const DOT_R = 5; // half-size of dot image (matches old circle radius)

function safeName(name) {
  return name.replace(/ /g, "_").replace(/'/g, "").replace(/\//g, "_");
}

function dotImg(cls) {
  const hex = (COLOR_MAP[cls] ?? "#d3d3d3").slice(1);
  return `dots/${hex}.png`;
}

const svg = d3.select("#chart")
  .attr("viewBox", `0 0 ${W} ${H}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const plotG = svg.append("g").attr("class", "plot");

// clip path so dots don't bleed outside axes
svg.append("defs")
  .append("clipPath")
    .attr("id", "plot-clip")
  .append("rect")
    .attr("x", MARGIN.left).attr("y", MARGIN.top)
    .attr("width", W - MARGIN.left - MARGIN.right)
    .attr("height", H - MARGIN.top - MARGIN.bottom);

const dotsG = plotG.append("g").attr("clip-path", "url(#plot-clip)");

const tooltip = document.getElementById("tooltip");

Promise.all([
  d3.csv("data/umap_coords.csv"),
  d3.csv("data/diet_vectors.csv"),
]).then(([coordsRaw, dietRaw]) => {
  // parse coords 
  const coords = new Map(coordsRaw.map(d => [d.Common_Name, {
    x: d.x === "" ? null : +d.x,
    y: d.y === "" ? null : +d.y,
    grid_x: d.grid_x === "" ? null : +d.grid_x,
    grid_y: d.grid_y === "" ? null : +d.grid_y,
    cluster: d.cluster === "" ? null : +d.cluster,
  }]));

  // parse diet
  const preyClasses = dietRaw.columns.filter(c => c !== "Common_Name");
  const dominantMap = new Map();
  const topPreyMap  = new Map(); // top 5 prey fractions per species

  // get dominant prey class 
  dietRaw.forEach(row => {
    const sp = row.Common_Name;
    let maxFrac = -1;
    let maxCls = "Other";
    const fracs = [];
    preyClasses.forEach(cls => {
      const v = +row[cls];
      if (v > maxFrac) { 
        maxFrac = v; 
        maxCls = cls; 
      }
      if (v > 0.01) fracs.push({ cls, v });
    });
    fracs.sort((a, b) => b.v - a.v);
    topPreyMap.set(sp, fracs.slice(0, 5));
    dominantMap.set(sp, maxFrac > 0 ? maxCls : "Other");
  });

  // collapse rare classes (< 10 species) into "Other"
  const classCounts = new Map();
  dominantMap.forEach(cls => 
    classCounts.set(cls, (classCounts.get(cls) || 0) + 1));
  dominantMap.forEach((cls, sp) => {
    if ((classCounts.get(cls) || 0) < 10) 
      dominantMap.set(sp, "Other");
  });

  // umap scales 
  const known = coordsRaw.filter(d => d.x !== "");
  const xExt = d3.extent(known, d => +d.x);
  const yExt = d3.extent(known, d => +d.y);
  const padding = 0.5;

  const xScale = d3.scaleLinear()
    .domain([xExt[0] - padding, xExt[1] + padding]) // room for no-data strip
    .range([MARGIN.left, W - MARGIN.right]);

  const yScale = d3.scaleLinear()
    .domain([yExt[0] - padding, yExt[1] + padding])
    .range([H - MARGIN.bottom, MARGIN.top]);

  // grid scales 
  const gxExt = d3.extent(known, d => +d.grid_x);
  const gyExt = d3.extent(known, d => +d.grid_y);
  const gxScale = d3.scaleLinear()
    .domain([gxExt[0] - padding, gxExt[1] + padding])
    .range([MARGIN.left, W - MARGIN.right]);
  const gyScale = d3.scaleLinear()
    .domain([gyExt[0] - padding, gyExt[1] + padding])
    .range([H - MARGIN.bottom, MARGIN.top]);

  // no-data divider line 
  const noDataSpecies = coordsRaw.filter(d => d.x === "");
  const xDivider = xExt[1] + 1.3;

  dotsG.append("line")
    .attr("class", "no-data-divider")
    .attr("x1", xScale(xDivider))
    .attr("x2", xScale(xDivider))
    .attr("y1", yScale(yExt[1] + padding))
    .attr("y2", yScale(yExt[0] - padding))
    .attr("stroke", "rgba(255,255,255,0.12)")
    .attr("stroke-dasharray", "4 4").attr("stroke-width", 1);

  // dots - known diet species (default: grid view)
  const knownDots = dotsG.selectAll("image.dot.known")
    .data(known)
    .join("image")
      .attr("class", "dot known")
      .attr("href", d => dotImg(dominantMap.get(d.Common_Name)))
      .attr("x", d => gxScale(+d.grid_x) - DOT_R)
      .attr("y", d => gyScale(+d.grid_y) - DOT_R)
      .attr("width",  DOT_R * 2)
      .attr("height", DOT_R * 2);

  // dots - no data species
  const noDataYs = d3.range(noDataSpecies.length).map(i =>
    yExt[0] + (yExt[1] - yExt[0]) * i / Math.max(noDataSpecies.length - 1, 1)
  );
  const xNoData = xExt[1] + 2.5;

  const noDots = dotsG.selectAll("image.dot.nodata")
    .data(noDataSpecies)
    .join("image")
      .attr("class", "dot nodata")
      .attr("href", "dots/nodata.png")
      .attr("x", () => xScale(xNoData) - DOT_R)
      .attr("y", (_, i) => yScale(noDataYs[i]) - DOT_R)
      .attr("width",  DOT_R * 2)
      .attr("height", DOT_R * 2)
      .attr("opacity", 0); // hidden by default in grid view

  // tooltip 
  function showTip(event, sp, isNoData) {
    const c = coords.get(sp);
    const imgSrc = `cutouts/${safeName(sp)}.png`;
    let html = `<img src="${imgSrc}" class="tip-bird" onerror="this.style.display='none'">`;
    html += `<div class="sp-name">${sp}</div>`;

    if (isNoData) {
      html += `<div style="color:#888;font-size:0.75rem">No diet data available</div>`;
    } else {
      const dom = dominantMap.get(sp) ?? "—";
      const color = COLOR_MAP[dom] ?? "#d3d3d3";
      html += `<div style="margin-bottom:4px">Dominant: <span style="color:${color}">${dom}</span></div>`;
      html += `<hr class="divider">`;
      (topPreyMap.get(sp) || []).forEach(({ cls, v }) => {
        html += `<div class="prey-row"><span>${cls}</span><span>${(v * 100).toFixed(1)}%</span></div>`;
      });
      if (c && c.cluster !== null) {
        html += `<span class="cluster-tag">cluster ${c.cluster}</span>`;
      }
    }

    tooltip.innerHTML = html;
    tooltip.classList.add("visible");
    moveTip(event);
  }

  function moveTip(event) {
    const x = event.clientX + 14;
    const y = event.clientY - 10;
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 28 : x) + "px";
    tooltip.style.top  = (y + th > window.innerHeight ? y - th : y) + "px";
  }

  function hideTip() { tooltip.classList.remove("visible"); }

  knownDots
    .on("mouseenter", (e, d) => { 
      d3.select(e.currentTarget).attr("opacity", 0.6); showTip(e, d.Common_Name, false); })
    .on("mousemove",  moveTip)
    .on("mouseleave", (e) => { d3.select(e.currentTarget).attr("opacity", 1); hideTip(); })
    .on("click", (_, d) => {
      // click handler for animation
      if (viewMode !== "grid") return;
      const pos = window.getScreenPos(+d.grid_x, +d.grid_y);
      const dominantClass = dominantMap.get(d.Common_Name) ?? "Other";
      if (window.onBirdClick) window.onBirdClick(d.Common_Name, dominantClass, pos.x, pos.y);
    });

  noDots
    .on("mouseenter", (e, d) => { d3.select(e.currentTarget).attr("opacity", 0.6); showTip(e, d.Common_Name, true); })
    .on("mousemove",  moveTip)
    .on("mouseleave", (e) => { d3.select(e.currentTarget).attr("opacity", 1); hideTip(); });

  // view toggle state — default grid
  let viewMode = "grid";

  // zoom & pan (only in umap view)
  const zoom = d3.zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", ({ transform }) => {
      const activeX = viewMode === "umap" ? xScale : gxScale;
      const activeY = viewMode === "umap" ? yScale : gyScale;
      const newX = transform.rescaleX(activeX);
      const newY = transform.rescaleY(activeY);

      knownDots
        .attr("x", d => (viewMode === "umap" ? newX(+d.x) : newX(+d.grid_x)) - DOT_R)
        .attr("y", d => (viewMode === "umap" ? newY(+d.y) : newY(+d.grid_y)) - DOT_R);

      noDots
        .attr("x", () => newX(xNoData) - DOT_R)
        .attr("y", (_, i) => newY(noDataYs[i]) - DOT_R);

      dotsG.select(".no-data-divider")
        .attr("x1", newX(xDivider))
        .attr("x2", newX(xDivider))
        .attr("y1", newY(yExt[1] + padding))
        .attr("y2", newY(yExt[0] - padding));
    });

  // start in grid mode — zoom disabled
  dotsG.select(".no-data-divider").attr("opacity", 0);

  // toggle between umap and grid view
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "view-toggle";
  toggleBtn.textContent = "UMAP View";
  document.getElementById("controls").appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    const newMode = viewMode === "umap" ? "grid" : "umap";
    toggleBtn.textContent = newMode === "umap" ? "UMAP View" : "Grid View";

    svg.call(zoom.transform, d3.zoomIdentity);
    viewMode = newMode;

    if (viewMode === "grid") {
      svg.on(".zoom", null);
    } else {
      svg.call(zoom);
    }
    const t = d3.transition().duration(600).ease(d3.easeCubicInOut);

    if (viewMode === "grid") {
      knownDots.transition(t)
        .attr("x", d => gxScale(+d.grid_x) - DOT_R)
        .attr("y", d => gyScale(+d.grid_y) - DOT_R);
      noDots.transition(t).attr("opacity", 0);
      dotsG.select(".no-data-divider").transition(t).attr("opacity", 0);
    } else {
      knownDots.transition(t)
        .attr("x", d => xScale(+d.x) - DOT_R)
        .attr("y", d => yScale(+d.y) - DOT_R);
      noDots.transition(t).attr("opacity", 1);
      dotsG.select(".no-data-divider").transition(t).attr("opacity", 1);
    }
  });

  // legend 
  const presentClasses = [...new Set(dominantMap.values())];
  const legendOrder = Object.keys(COLOR_MAP).filter(c => presentClasses.includes(c) || c === "No data");

  const legendEl = document.getElementById("legend");
  legendEl.innerHTML = "<div style='font-size:0.72rem;color:#777;margin-bottom:5px;font-weight:600'>DOMINANT PREY CLASS</div>";
  legendOrder.forEach(cls => {
    const swatch = `<img src="${cls === "No data" ? "dots/nodata.png" : dotImg(cls)}" class="legend-swatch">`;
    legendEl.innerHTML += `<div>${swatch}${cls}</div>`;
  });

  // function for animations.js to place the animations correctly
  window.getScreenPos = function(gridX, gridY) {
    const svgX = gxScale(gridX);
    const svgY = gyScale(gridY);
    const rect = document.querySelector("#chart").getBoundingClientRect();

    // svg uses xMidYMid meet, so it letterboxes inside the container rect
    // calculate the actual rendered size and centering offset
    const containerAspect = rect.width / rect.height;
    const svgAspect = W / H;
    let renderW, renderH, offsetX, offsetY;
    if (containerAspect > svgAspect) {
      // container wider than svg — pillarbox (empty sides)
      renderH = rect.height;
      renderW = renderH * svgAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      // container taller than svg — letterbox (empty top/bottom)
      renderW = rect.width;
      renderH = renderW / svgAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }

    return {
      x: rect.left + offsetX + svgX * (renderW / W),
      y: rect.top  + offsetY + svgY * (renderH / H),
    };
  };

  window.getBirdScreenPos = function(name) {
    const c = coords.get(name);
    if (!c || c.grid_x === null) return null;
    return window.getScreenPos(c.grid_x, c.grid_y);
  };

}).catch(err => {
  document.body.innerHTML += `<p style="color:#e76f51;margin-top:40px">
    Error loading data: ${err.message}<br>
    Make sure to run <code>python3 -m http.server 8000</code> in the project folder.
  </p>`;
});

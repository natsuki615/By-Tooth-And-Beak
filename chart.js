const COLOR_MAP = {
  "Insecta": "#f4a261",
  "Magnoliopsida": "#2a9d8f",
  "Teleostei": "#457b9d",
  "Mammalia": "#e76f51",
  "Malacostraca": "#8ecae6",
  "Cephalopoda": "#6a4c93",
  "Euchelicerata": "#a8dadc",
  "Gastropoda": "#c9ada7",
  "Bivalvia": "#b5e48c",
  "Pinopsida": "#1b4332",
  "Other": "#d3d3d3",
  "No data": "none",
};

const W = 1000, H = 720;
const MARGIN = { top: 30, right: 120, bottom: 50, left: 55 };

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

  // parse diet & compute dominant prey class 
  const preyClasses = dietRaw.columns.filter(c => c !== "Common_Name");
  const dominantMap = new Map();
  const topPreyMap  = new Map(); // top 5 prey fractions per species

  dietRaw.forEach(row => {
    const sp = row.Common_Name;
    let maxFrac = -1;
    let maxCls = "Other";
    const fracs = [];
    preyClasses.forEach(cls => {
      const v = +row[cls];
      if (v > maxFrac) { maxFrac = v; maxCls = cls; }
      if (v > 0.01) fracs.push({ cls, v });
    });
    fracs.sort((a, b) => b.v - a.v);
    topPreyMap.set(sp, fracs.slice(0, 5));
    dominantMap.set(sp, maxFrac > 0 ? maxCls : "Other");
  });

  // collapse rare classes (< 10 species) into "Other"
  const classCounts = new Map();
  dominantMap.forEach(cls => classCounts.set(cls, (classCounts.get(cls) || 0) + 1));
  dominantMap.forEach((cls, sp) => {
    if ((classCounts.get(cls) || 0) < 10) dominantMap.set(sp, "Other");
  });

  // scales 
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

  const gxExt = d3.extent(known, d => +d.grid_x);
  const gyExt = d3.extent(known, d => +d.grid_y);
  const gxScale = d3.scaleLinear()
    .domain([gxExt[0] - padding, gxExt[1] + padding])
    .range([MARGIN.left, W - MARGIN.right]);
  const gyScale = d3.scaleLinear()
    .domain([gyExt[0] - padding, gyExt[1] + padding])
    .range([H - MARGIN.bottom, MARGIN.top]);

  // axes
  // const xAxisG = plotG.append("g")
  //   .attr("transform", `translate(0,${H - MARGIN.bottom})`)
  //   .call(d3.axisBottom(xScale).ticks(8).tickSize(-H + MARGIN.top + MARGIN.bottom))
  //   .call(g => g.select(".domain").remove())
  //   .call(g => g.selectAll(".tick line")
  //     .attr("stroke", "#2a2a4a"))
  //   .call(g => g.selectAll(".tick text")
  //     .attr("fill", "#777")
  //     .attr("font-size", "10px"));

  // const yAxisG = plotG.append("g")
  //   .attr("transform", `translate(${MARGIN.left},0)`)
  //   .call(d3.axisLeft(yScale).ticks(8).tickSize(-W + MARGIN.left + MARGIN.right))
  //   .call(g => g.select(".domain").remove())
  //   .call(g => g.selectAll(".tick line")
  //     .attr("stroke", "#2a2a4a"))
  //   .call(g => g.selectAll(".tick text")
  //     .attr("fill", "#777")
  //     .attr("font-size", "10px"));

  // const xLabel = svg.append("text")
  //   .attr("x", W / 2)
  //   .attr("y", H - 8)
  //   .attr("text-anchor", "middle")
  //   .attr("fill", "#666")
  //   .attr("font-size", "11px")
  //   .text("UMAP 1");
  // const yLabel = svg.append("text")
  //   .attr("transform", `translate(13,${H / 2}) rotate(-90)`)
  //   .attr("text-anchor", "middle")
  //   .attr("fill", "#666")
  //   .attr("font-size", "11px")
  //   .text("UMAP 2");

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

  // dots - known diet species
  const knownDots = dotsG.selectAll("circle.dot.known")
    .data(known)
    .join("circle")
      .attr("class", "dot known")
      .attr("cx", d => xScale(+d.x))
      .attr("cy", d => yScale(+d.y))
      .attr("r", 5)
      .attr("fill", d => COLOR_MAP[dominantMap.get(d.Common_Name)] ?? "#d3d3d3")
      .attr("fill-opacity", 0.8)
      .attr("stroke", "none");

  // dots - no data species
  const noDataYs = d3.range(noDataSpecies.length).map(i =>
    yExt[0] + (yExt[1] - yExt[0]) * i / Math.max(noDataSpecies.length - 1, 1)
  );
  const xNoData = xExt[1] + 2.5;

  const noDots = dotsG.selectAll("circle.dot.nodata")
    .data(noDataSpecies)
    .join("circle")
      .attr("class", "dot nodata")
      .attr("cx", () => xScale(xNoData))
      .attr("cy", (d, i) => yScale(noDataYs[i]))
      .attr("r", 5)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-opacity", 0.55)
      .attr("stroke-width", 1.2);

  // tooltip 
  function showTip(event, sp, isNoData) {
    const c = coords.get(sp);
    let html = `<div class="sp-name">${sp}</div>`;

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
    .on("mouseenter", (e, d) => { d3.select(e.currentTarget).attr("stroke", "white").attr("stroke-width", 1.5); showTip(e, d.Common_Name, false); })
    .on("mousemove",  moveTip)
    .on("mouseleave", (e) => { d3.select(e.currentTarget).attr("stroke", "none"); hideTip(); });

  noDots
    .on("mouseenter", (e, d) => { d3.select(e.currentTarget).attr("stroke-opacity", 1); showTip(e, d.Common_Name, true); })
    .on("mousemove",  moveTip)
    .on("mouseleave", (e) => { d3.select(e.currentTarget).attr("stroke-opacity", 0.55); hideTip(); });

  // view toggle state 
  let viewMode = "umap";

  // zoom & pan 
  const zoom = d3.zoom()
    .scaleExtent([0.5, 20])
    .on("zoom", ({ transform }) => {
      const activeX = viewMode === "umap" ? xScale : gxScale;
      const activeY = viewMode === "umap" ? yScale : gyScale;
      const newX = transform.rescaleX(activeX);
      const newY = transform.rescaleY(activeY);

      // xAxisG.call(d3.axisBottom(newX).ticks(8).tickSize(-H + MARGIN.top + MARGIN.bottom))
      //   .call(g => g.select(".domain").remove())
      //   .call(g => g.selectAll(".tick line").attr("stroke", "#2a2a4a"))
      //   .call(g => g.selectAll(".tick text").attr("fill", "#777").attr("font-size", "10px"));

      // yAxisG.call(d3.axisLeft(newY).ticks(8).tickSize(-W + MARGIN.left + MARGIN.right))
      //   .call(g => g.select(".domain").remove())
      //   .call(g => g.selectAll(".tick line").attr("stroke", "#2a2a4a"))
      //   .call(g => g.selectAll(".tick text").attr("fill", "#777").attr("font-size", "10px"));

      knownDots
        .attr("cx", d => viewMode === "umap" ? newX(+d.x): newX(+d.grid_x))
        .attr("cy", d => viewMode === "umap" ? newY(+d.y): newY(+d.grid_y));

      noDots
        .attr("cx", () => newX(xNoData))
        .attr("cy", (d, i) => newY(noDataYs[i]));

      dotsG.select(".no-data-divider")
        .attr("x1", newX(xDivider))
        .attr("x2", newX(xDivider))
        .attr("y1", newY(yExt[1] + padding))
        .attr("y2", newY(yExt[0] - padding));
    });

  svg.call(zoom);

  // toggle between umap and grid view
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "view-toggle";
  toggleBtn.textContent = "Grid View";
  document.getElementById("chart-wrap").insertAdjacentElement("afterend", toggleBtn);

  toggleBtn.addEventListener("click", () => {
    const newMode = viewMode === "umap" ? "grid" : "umap";
    toggleBtn.textContent = newMode === "umap" ? "Grid View" : "UMAP View";

    // Reset zoom using current mode so dots land at unzoomed positions first
    svg.call(zoom.transform, d3.zoomIdentity);

    viewMode = newMode;
    const t = d3.transition().duration(600).ease(d3.easeCubicInOut);

    if (viewMode === "grid") {
      knownDots.transition(t)
        .attr("cx", d => gxScale(+d.grid_x))
        .attr("cy", d => gyScale(+d.grid_y));
      noDots.transition(t).attr("opacity", 0);
      dotsG.select(".no-data-divider").transition(t).attr("opacity", 0);
      // xLabel.transition(t).attr("opacity", 0);
      // yLabel.transition(t).attr("opacity", 0);
      // xAxisG.transition(t).attr("opacity", 0);
      // yAxisG.transition(t).attr("opacity", 0);
    } else {
      knownDots.transition(t)
        .attr("cx", d => xScale(+d.x))
        .attr("cy", d => yScale(+d.y));
      noDots.transition(t).attr("opacity", 1);
      dotsG.select(".no-data-divider").transition(t).attr("opacity", 1);
      // xLabel.transition(t).attr("opacity", 1);
      // yLabel.transition(t).attr("opacity", 1);
      // xAxisG.transition(t).attr("opacity", 1);
      // yAxisG.transition(t).attr("opacity", 1);
    }
  });

  // legend 
  const presentClasses = [...new Set(dominantMap.values())];
  const legendOrder = Object.keys(COLOR_MAP).filter(c => presentClasses.includes(c) || c === "No data");

  const legendEl = document.getElementById("legend");
  legendEl.innerHTML = "<div style='font-size:0.72rem;color:#777;margin-bottom:5px;font-weight:600'>DOMINANT PREY CLASS</div>";
  legendOrder.forEach(cls => {
    const color = COLOR_MAP[cls];
    const swatch = cls === "No data"
      ? `<span class="legend-swatch" style="background:none;border:1.5px solid white;border-radius:50%"></span>`
      : `<span class="legend-swatch" style="background:${color}"></span>`;
    legendEl.innerHTML += `<div>${swatch}${cls}</div>`;
  });

}).catch(err => {
  document.body.innerHTML += `<p style="color:#e76f51;margin-top:40px">
    Error loading data: ${err.message}<br>
    Make sure to run <code>python3 -m http.server 8000</code> in the project folder.
  </p>`;
});
